import type { SessionEndRequest } from '../composables/useSessionApi';

export const FAILED_SOLVE_STORAGE_KEY = 'goldroad-failed-solves-v1';
export const FAILED_SOLVE_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000] as const;

export type PendingFailedSolve = {
  payload: SessionEndRequest;
  expiresAt: string;
  backoffIndex: number;
  nextAttemptAt: number | null;
};

export function failedSolveKey(payload: SessionEndRequest): string {
  return `${payload.playerUUID}:${payload.gameNo}:${payload.puzzleType}`;
}

export function isFailedSolveExpired(
  pending: Pick<PendingFailedSolve, 'expiresAt'>,
  nowMs = Date.now(),
): boolean {
  const expiresAt = Date.parse(pending.expiresAt);
  return Number.isNaN(expiresAt) || nowMs >= expiresAt;
}

export function getDeliveryErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if (
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }
  return null;
}

export function isRetryableDeliveryError(error: unknown): boolean {
  const status = getDeliveryErrorStatus(error);
  return status === null || status === 429 || status >= 500;
}

export function parsePendingFailedSolves(raw: string | null): PendingFailedSolve[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingFailedSolve => {
      if (typeof item !== 'object' || item === null) return false;
      const candidate = item as Partial<PendingFailedSolve>;
      return (
        typeof candidate.expiresAt === 'string' &&
        typeof candidate.backoffIndex === 'number' &&
        (candidate.nextAttemptAt === null ||
          typeof candidate.nextAttemptAt === 'number') &&
        typeof candidate.payload === 'object' &&
        candidate.payload !== null
      );
    });
  } catch {
    return [];
  }
}

type TimerHandle = ReturnType<typeof setTimeout>;

export type FailedSolveDeliveryDependencies = {
  send: (payload: SessionEndRequest) => Promise<unknown>;
  persist: (raw: string) => void;
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  log?: (message: string, item: PendingFailedSolve, error?: unknown) => void;
};

export class FailedSolveDeliveryService {
  private pending: PendingFailedSolve[] = [];
  private inFlight = false;
  private timer: TimerHandle | null = null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly clearTimer: (handle: TimerHandle) => void;

  constructor(private readonly dependencies: FailedSolveDeliveryDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.random = dependencies.random ?? Math.random;
    this.setTimer = dependencies.setTimer ?? setTimeout;
    this.clearTimer = dependencies.clearTimer ?? clearTimeout;
  }

  hydrate(raw: string | null) {
    this.pending = parsePendingFailedSolves(raw);
    this.discardExpired();
    this.scheduleNext();
  }

  queue(payload: SessionEndRequest, expiresAt: string) {
    const item: PendingFailedSolve = {
      payload,
      expiresAt,
      backoffIndex: 0,
      nextAttemptAt: this.now() + this.jitteredDelay(FAILED_SOLVE_BACKOFF_MS[0]),
    };
    const key = failedSolveKey(payload);
    this.pending = [
      ...this.pending.filter(
        (existing) => failedSolveKey(existing.payload) !== key,
      ),
      item,
    ];
    this.persist();
    this.scheduleNext();
  }

  trigger() {
    return this.attempt(true);
  }

  snapshot(): PendingFailedSolve[] {
    return structuredClone(this.pending);
  }

  private persist() {
    this.dependencies.persist(JSON.stringify(this.pending));
  }

  private jitteredDelay(delayMs: number) {
    return delayMs * (0.5 + this.random());
  }

  private remove(key: string) {
    this.pending = this.pending.filter(
      (item) => failedSolveKey(item.payload) !== key,
    );
    this.persist();
  }

  private discardExpired() {
    const nowMs = this.now();
    const expired = this.pending.filter((item) =>
      isFailedSolveExpired(item, nowMs),
    );
    if (!expired.length) return;
    for (const item of expired) {
      this.dependencies.log?.('expired failed solve', item);
    }
    this.pending = this.pending.filter(
      (item) => !isFailedSolveExpired(item, nowMs),
    );
    this.persist();
  }

  private scheduleNext() {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.discardExpired();
    if (this.inFlight) return;

    const wakeAt = this.pending
      .flatMap((item) => [item.nextAttemptAt, Date.parse(item.expiresAt)])
      .filter((value): value is number => value !== null && !Number.isNaN(value))
      .sort((a, b) => a - b)[0];
    if (wakeAt === undefined) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.attempt(false);
    }, Math.max(0, wakeAt - this.now()));
  }

  private async attempt(force: boolean) {
    if (this.inFlight) return;
    this.discardExpired();
    const nowMs = this.now();
    const next = this.pending.find(
      (item) =>
        force ||
        (item.nextAttemptAt !== null && item.nextAttemptAt <= nowMs),
    );
    if (!next) {
      this.scheduleNext();
      return;
    }

    const key = failedSolveKey(next.payload);
    this.inFlight = true;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    try {
      await this.dependencies.send(next.payload);
      this.remove(key);
    } catch (error) {
      if (!isRetryableDeliveryError(error)) {
        this.dependencies.log?.('discarded final solve failure', next, error);
        this.remove(key);
      } else {
        this.dependencies.log?.('solve retry failed', next, error);
        next.backoffIndex += 1;
        const delay = FAILED_SOLVE_BACKOFF_MS[next.backoffIndex];
        next.nextAttemptAt =
          delay === undefined ? null : this.now() + this.jitteredDelay(delay);
        this.persist();
      }
    } finally {
      this.inFlight = false;
      this.scheduleNext();
    }
  }
}
