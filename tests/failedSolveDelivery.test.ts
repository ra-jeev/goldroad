import { describe, expect, it } from 'vitest';
import {
  FAILED_SOLVE_BACKOFF_MS,
  failedSolveKey,
  FailedSolveDeliveryService,
  getDeliveryErrorStatus,
  isFailedSolveExpired,
  isRetryableDeliveryError,
  parsePendingFailedSolves,
  type PendingFailedSolve,
} from '../app/utils/failedSolveDelivery';

const payload = {
  playerUUID: '11111111-1111-4111-8111-111111111111',
  gameNo: 3,
  puzzleType: 'classic' as const,
  sessionId: '22222222-2222-4222-8222-222222222222',
  score: 109,
  moves: 12,
  attemptNumber: 2,
  hintsUsed: 1,
  solveTimeMs: 90_000,
};

function pending(overrides: Partial<PendingFailedSolve> = {}): PendingFailedSolve {
  return {
    payload,
    expiresAt: '2026-07-22T00:00:00.000Z',
    backoffIndex: 0,
    nextAttemptAt: 1_000,
    ...overrides,
  };
}

describe('failed solve delivery persistence', () => {
  it('keys one pending solve per player, road, and mode', () => {
    expect(failedSolveKey(payload)).toBe(
      '11111111-1111-4111-8111-111111111111:3:classic',
    );
  });

  it('round-trips valid pending solves and rejects malformed storage', () => {
    expect(parsePendingFailedSolves(JSON.stringify([pending()]))).toEqual([
      pending(),
    ]);
    expect(parsePendingFailedSolves('{broken')).toEqual([]);
    expect(parsePendingFailedSolves(JSON.stringify({ payload }))).toEqual([]);
  });

  it('expires at nextGameAt and treats an invalid deadline as expired', () => {
    expect(isFailedSolveExpired(pending(), Date.parse('2026-07-21T23:59:59Z'))).toBe(false);
    expect(isFailedSolveExpired(pending(), Date.parse('2026-07-22T00:00:00Z'))).toBe(true);
    expect(isFailedSolveExpired(pending({ expiresAt: 'invalid' }), 0)).toBe(true);
  });
});

describe('failed solve response classification', () => {
  it('retries network failures, 429s, and server errors', () => {
    expect(isRetryableDeliveryError(new TypeError('offline'))).toBe(true);
    expect(isRetryableDeliveryError({ statusCode: 429 })).toBe(true);
    expect(isRetryableDeliveryError({ response: { status: 503 } })).toBe(true);
  });

  it('discards final client errors', () => {
    expect(isRetryableDeliveryError({ statusCode: 400 })).toBe(false);
    expect(isRetryableDeliveryError({ response: { status: 404 } })).toBe(false);
  });

  it('reads status codes from ofetch error shapes', () => {
    expect(getDeliveryErrorStatus({ statusCode: 429 })).toBe(429);
    expect(getDeliveryErrorStatus({ response: { status: 503 } })).toBe(503);
    expect(getDeliveryErrorStatus(new TypeError('offline'))).toBeNull();
  });
});

describe('failed solve delivery service', () => {
  it('serializes handoff and advances through the configured backoff', async () => {
    let now = 1_000;
    const persisted: string[] = [];
    const jitterMultiplier = 0.75;
    const service = new FailedSolveDeliveryService({
      now: () => now,
      random: () => jitterMultiplier - 0.5,
      send: async () => {
        throw new TypeError('offline');
      },
      persist: (raw) => persisted.push(raw),
      setTimer: (() => 1) as unknown as typeof setTimeout,
      clearTimer: () => {},
    });

    service.queue(payload, '2026-07-22T00:00:00.000Z');
    expect(service.snapshot()[0]?.nextAttemptAt).toBe(
      now + FAILED_SOLVE_BACKOFF_MS[0] * jitterMultiplier,
    );

    for (const [index, baseDelay] of FAILED_SOLVE_BACKOFF_MS.entries()) {
      if (index === 0) continue;
      await service.trigger();
      expect(service.snapshot()[0]).toMatchObject({
        backoffIndex: index,
        nextAttemptAt: now + baseDelay * jitterMultiplier,
      });
      now += baseDelay * jitterMultiplier;
    }
    expect(parsePendingFailedSolves(persisted.at(-1) ?? null)).toEqual(
      service.snapshot(),
    );
  });

  it('keeps delivery single-flight across simultaneous lifecycle triggers', async () => {
    let finish!: () => void;
    let sends = 0;
    const service = new FailedSolveDeliveryService({
      send: () => {
        sends += 1;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
      persist: () => {},
      setTimer: (() => 1) as unknown as typeof setTimeout,
      clearTimer: () => {},
    });
    service.queue(payload, '2099-01-01T00:00:00.000Z');

    const first = service.trigger();
    await service.trigger();
    expect(sends).toBe(1);
    finish();
    await first;
    expect(service.snapshot()).toEqual([]);
  });

  it('discards final 4xx responses without another backoff', async () => {
    const service = new FailedSolveDeliveryService({
      send: async () => {
        throw { statusCode: 404 };
      },
      persist: () => {},
      setTimer: (() => 1) as unknown as typeof setTimeout,
      clearTimer: () => {},
    });
    service.queue(payload, '2099-01-01T00:00:00.000Z');
    await service.trigger();
    expect(service.snapshot()).toEqual([]);
  });

  it('schedules and performs road-rotation expiry even after backoff is exhausted', () => {
    let now = 1_000;
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const service = new FailedSolveDeliveryService({
      now: () => now,
      send: async () => {},
      persist: () => {},
      setTimer: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimer: () => {},
    });
    service.hydrate(
      JSON.stringify([
        pending({ expiresAt: '1970-01-01T00:00:10.000Z', nextAttemptAt: null }),
      ]),
    );
    expect(timers.at(-1)?.delay).toBe(9_000);
    now = 10_000;
    timers.at(-1)?.callback();
    expect(service.snapshot()).toEqual([]);
  });
});
