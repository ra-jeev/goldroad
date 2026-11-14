import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import {
  applyHintProgress,
  useGoldroadLocalState,
} from '../app/composables/useGoldroadLocalState';

const road = { gameNo: 4, puzzleType: 'classic', day: '2026-11-14' } as const;
const route = { path: [8, 14, 20], undoAvailable: true };

function createStorage() {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal('useState', (_key: string, initial: () => unknown) => ref(initial()));
  vi.stubGlobal('window', {
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('saved progress', () => {
  it('loads the same route and completed attempt count twice', () => {
    const state = useGoldroadLocalState();
    state.recordRun({ ...road, attemptNumber: 1, solved: false });
    state.setSolveTimerState({ ...road, route, activeTimeMs: 40_000, timerStartedAt: null });
    state.setSolveTimerState({ ...road, activeTimeMs: 20_000, timerStartedAt: null });

    for (let load = 0; load < 2; load++) {
      const reopened = useGoldroadLocalState();
      reopened.load();
      expect(reopened.getPuzzleProgress(road.gameNo, road.puzzleType, 'live', road.day))
        .toMatchObject({ route, activeTimeMs: 40_000, attempts: 1 });
    }
  });

  it('clears the route after a failed run and retains time and the highest attempt count', () => {
    const state = useGoldroadLocalState();
    state.recordRun({ ...road, attemptNumber: 2, solved: false });
    state.setSolveTimerState({ ...road, route, activeTimeMs: 40_000, timerStartedAt: null });
    expect(state.recordRun({ ...road, attemptNumber: 1, solved: false }))
      .toMatchObject({ route: null, activeTimeMs: 40_000, attempts: 2 });
  });

  it('only discards the route that the caller inspected', () => {
    const state = useGoldroadLocalState();
    state.setSolveTimerState({ ...road, route, activeTimeMs: 40_000, timerStartedAt: null });
    const key = { ...road, scope: 'live' } as const;
    const stale = { path: [8, 14], undoAvailable: true };
    expect(state.discardSavedRoute({ ...key, route: stale }).route).toEqual(route);
    expect(state.discardSavedRoute({ ...key, route }))
      .toMatchObject({ route: null, activeTimeMs: 40_000, attempts: 0 });
  });

  it('keeps the saved route when recording a hint', () => {
    const progress = { solved: false, hintsUsed: 0, guidePath: [], route };
    expect(applyHintProgress(progress, [8, 14]).route).toEqual(route);
  });

  it('claims the Start instruction once per day and skips it after three played roads', () => {
    const state = useGoldroadLocalState();
    expect(state.claimStartInstruction(road.day)).toBe(true);
    expect(useGoldroadLocalState().claimStartInstruction(road.day)).toBe(false);
    for (const gameNo of [1, 2, 3]) {
      state.recordRun({
        ...road, gameNo, day: `2026-11-0${gameNo}`, attemptNumber: 1, solved: false,
      });
    }
    expect(state.claimStartInstruction('2026-11-15')).toBe(false);
  });
});
