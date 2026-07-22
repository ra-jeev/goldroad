import { describe, expect, it } from 'vitest';
import {
  computeIsRoadModeSolved,
  normalizeStoredArchiveCompletionMap,
  serializeGoldroadLocalStorageSnapshot,
  type ArchiveCompletionRecord,
  type HistoryDayRecord,
} from '../app/composables/useGoldroadLocalState';
import {
  isRoadExpired,
  isDifferentGameIdentity,
  getClassicOverTargetWarning,
  shouldCallSessionApi,
  shouldStartSessionApi,
  shouldSubmitSessionEnd,
  shouldRecordArchiveCompletion,
  resolveRunMedals,
} from '../app/composables/useRoadDayGameplay';
import { calcMedalForAttempt } from '../lib/gameTiers';

describe('isDifferentGameIdentity', () => {
  it('treats the two modes of one road as different games', () => {
    expect(
      isDifferentGameIdentity(
        { gameNo: 8, puzzleType: 'classic' },
        { gameNo: 8, puzzleType: 'expedition' },
      ),
    ).toBe(true);
  });

  it('distinguishes a new road but not the same road and mode', () => {
    expect(
      isDifferentGameIdentity(
        { gameNo: 8, puzzleType: 'classic' },
        { gameNo: 9, puzzleType: 'classic' },
      ),
    ).toBe(true);
    expect(
      isDifferentGameIdentity(
        { gameNo: 8, puzzleType: 'classic' },
        { gameNo: 8, puzzleType: 'classic' },
      ),
    ).toBe(false);
  });
});

describe('normalizeStoredArchiveCompletionMap', () => {
  it('returns an empty map for non-object input', () => {
    expect(normalizeStoredArchiveCompletionMap(null)).toEqual({});
    expect(normalizeStoredArchiveCompletionMap(undefined)).toEqual({});
    expect(normalizeStoredArchiveCompletionMap('nope')).toEqual({});
    expect(normalizeStoredArchiveCompletionMap([1, 2, 3])).toEqual({});
  });

  it('keeps only numeric-string keys', () => {
    const input = {
      '12': { classic: true },
      'abc': { classic: true },
      '12.5': { classic: true },
      '-3': { classic: true },
      '007': { classic: true },
    };
    expect(normalizeStoredArchiveCompletionMap(input)).toEqual({
      '12': { classic: true },
      '007': { classic: true },
    });
  });

  it('drops non-true mode values and non-object records', () => {
    const input = {
      '1': { classic: false, expedition: 'yes' },
      '2': 'not-an-object',
      '3': { classic: true, expedition: 1 },
    };
    expect(normalizeStoredArchiveCompletionMap(input)).toEqual({
      '3': { classic: true },
    });
  });

  it('drops entries whose record has neither mode set', () => {
    const input = { '1': {}, '2': { classic: false } };
    expect(normalizeStoredArchiveCompletionMap(input)).toEqual({});
  });

  it('keeps both modes when both are true', () => {
    const input = { '4': { classic: true, expedition: true } };
    expect(normalizeStoredArchiveCompletionMap(input)).toEqual({
      '4': { classic: true, expedition: true },
    });
  });
});

describe('computeIsRoadModeSolved', () => {
  const emptyHistory: Record<string, HistoryDayRecord> = {};
  const emptyArchive: Record<string, ArchiveCompletionRecord> = {};

  it('is false when neither history nor archive completion has a record', () => {
    expect(computeIsRoadModeSolved(emptyHistory, emptyArchive, 5, 'classic')).toBe(
      false,
    );
  });

  it('is true from the archive-completion map alone', () => {
    const archive: Record<string, ArchiveCompletionRecord> = {
      '5': { classic: true },
    };
    expect(computeIsRoadModeSolved(emptyHistory, archive, 5, 'classic')).toBe(true);
    expect(computeIsRoadModeSolved(emptyHistory, archive, 5, 'expedition')).toBe(
      false,
    );
  });

  it('is true from live history alone', () => {
    const history: Record<string, HistoryDayRecord> = {
      '2026-07-01': {
        day: '2026-07-01',
        gameNo: 5,
        modes: {
          classic: {
            attempts: 2,
            solved: true,
            hintsUsed: 0,
            solveTimeMs: null,
            updatedAt: '2026-07-01T00:00:00.000Z',
          },
        },
      },
    };
    expect(computeIsRoadModeSolved(history, emptyArchive, 5, 'classic')).toBe(true);
  });

  it('does not treat an unsolved history mode record as solved', () => {
    const history: Record<string, HistoryDayRecord> = {
      '2026-07-01': {
        day: '2026-07-01',
        gameNo: 5,
        modes: {
          classic: {
            attempts: 2,
            solved: false,
            hintsUsed: 0,
            solveTimeMs: null,
            updatedAt: '2026-07-01T00:00:00.000Z',
          },
        },
      },
    };
    expect(computeIsRoadModeSolved(history, emptyArchive, 5, 'classic')).toBe(
      false,
    );
  });

  it('merges both sources: either counts', () => {
    const history: Record<string, HistoryDayRecord> = {
      '2026-07-01': {
        day: '2026-07-01',
        gameNo: 9,
        modes: {
          expedition: {
            attempts: 1,
            solved: true,
            hintsUsed: 0,
            solveTimeMs: 1000,
            updatedAt: '2026-07-01T00:00:00.000Z',
          },
        },
      },
    };
    const archive: Record<string, ArchiveCompletionRecord> = {
      '9': { classic: true },
    };
    expect(computeIsRoadModeSolved(history, archive, 9, 'classic')).toBe(true);
    expect(computeIsRoadModeSolved(history, archive, 9, 'expedition')).toBe(true);
  });

  it('does not match a different gameNo in history', () => {
    const history: Record<string, HistoryDayRecord> = {
      '2026-07-01': {
        day: '2026-07-01',
        gameNo: 5,
        modes: {
          classic: {
            attempts: 1,
            solved: true,
            hintsUsed: 0,
            solveTimeMs: null,
            updatedAt: '2026-07-01T00:00:00.000Z',
          },
        },
      },
    };
    expect(computeIsRoadModeSolved(history, emptyArchive, 6, 'classic')).toBe(
      false,
    );
  });
});

describe('shouldRecordArchiveCompletion (solved-only local completion writes)', () => {
  it('writes only for an archive entry that solved', () => {
    expect(shouldRecordArchiveCompletion('archive', true)).toBe(true);
  });

  it('does not write for a live solve (live uses puzzleProgressByKey/history instead)', () => {
    expect(shouldRecordArchiveCompletion('live', true)).toBe(false);
  });

  it('does not write when starting/failing/abandoning an archive run', () => {
    expect(shouldRecordArchiveCompletion('archive', false)).toBe(false);
  });

  it('does not write for a live non-solve either', () => {
    expect(shouldRecordArchiveCompletion('live', false)).toBe(false);
  });
});

describe('shouldCallSessionApi (zero analytics writes for archive play)', () => {
  it('calls the session API only for a tracked live run', () => {
    expect(shouldCallSessionApi('live', false)).toBe(true);
  });

  it('never calls the session API for archive play, tracked or not', () => {
    expect(shouldCallSessionApi('archive', false)).toBe(false);
    expect(shouldCallSessionApi('archive', true)).toBe(false);
  });

  it('never calls the session API for an untracked live replay', () => {
    expect(shouldCallSessionApi('live', true)).toBe(false);
  });

  it('skips the session API for a grandfathered finish on an expired road', () => {
    expect(shouldCallSessionApi('live', false, true)).toBe(false);
    expect(shouldCallSessionApi('live', false, false)).toBe(true);
  });
});

describe('start and solve-only analytics gates', () => {
  it('starts once for a fresh live mode', () => {
    expect(shouldStartSessionApi('live', false, false, false)).toBe(true);
    expect(shouldStartSessionApi('live', false, false, true)).toBe(false);
  });

  it('never starts archive, replay, or expired play', () => {
    expect(shouldStartSessionApi('archive', false, false, false)).toBe(false);
    expect(shouldStartSessionApi('live', true, false, false)).toBe(false);
    expect(shouldStartSessionApi('live', false, true, false)).toBe(false);
  });

  it('submits only exact solves, never failed outcomes or manual retries', () => {
    expect(shouldSubmitSessionEnd('live', false, false, 'solved')).toBe(true);
    expect(shouldSubmitSessionEnd('live', false, false, 'dead-end')).toBe(false);
    expect(shouldSubmitSessionEnd('live', false, false, 'wrong-exit')).toBe(false);
    expect(shouldSubmitSessionEnd('live', false, false, 'retry')).toBe(false);
  });
});

describe('isRoadExpired (midnight contract, RP1-16)', () => {
  const nextGameAt = '2026-07-20T00:00:00.000Z';
  const beforeMs = Date.parse('2026-07-19T23:59:59.000Z');
  const atMs = Date.parse(nextGameAt);

  it('is not expired before nextGameAt', () => {
    expect(isRoadExpired(nextGameAt, beforeMs)).toBe(false);
  });

  it('expires exactly at nextGameAt and after', () => {
    expect(isRoadExpired(nextGameAt, atMs)).toBe(true);
    expect(isRoadExpired(nextGameAt, atMs + 60_000)).toBe(true);
  });

  it('never expires without a valid schedule', () => {
    expect(isRoadExpired(null, atMs)).toBe(false);
    expect(isRoadExpired(undefined, atMs)).toBe(false);
    expect(isRoadExpired('not-a-date', atMs)).toBe(false);
  });
});

describe('Classic over-target warning', () => {
  it('warns on a non-terminal Classic route at or above target', () => {
    expect(
      getClassicOverTargetWarning({
        puzzleType: 'classic',
        score: 109,
        target: 109,
        terminal: false,
      }),
    ).toBe('This route may not lead to an exact finish.');
  });

  it('lets terminal outcomes and Expedition behavior take precedence', () => {
    expect(
      getClassicOverTargetWarning({
        puzzleType: 'classic',
        score: 110,
        target: 109,
        terminal: true,
      }),
    ).toBeNull();
    expect(
      getClassicOverTargetWarning({
        puzzleType: 'expedition',
        score: 110,
        target: 109,
        terminal: false,
      }),
    ).toBeNull();
  });
});

describe('archive solve medal contract', () => {
  it('keeps the awarded medal null while preserving the would-have tier', () => {
    for (const attempts of [1, 3]) {
      expect(resolveRunMedals('archive', false, attempts, true)).toEqual({
        medal: null,
        wouldHaveMedal: calcMedalForAttempt(attempts, true),
      });
    }
  });

  it('does not set a would-have medal for live variants', () => {
    expect(resolveRunMedals('live', false, 1, true)).toEqual({
      medal: 'gold',
      wouldHaveMedal: null,
    });
  });
});

describe('local state serialization', () => {
  it('excludes replay progress from the localStorage snapshot', () => {
    const localSnapshot = serializeGoldroadLocalStorageSnapshot({
      version: 2,
      puzzleProgressByKey: { 'classic:10': { attempts: 1 } },
      replayProgressByKey: { 'classic:9': { attempts: 2 } },
    });

    expect(localSnapshot).toEqual({
      version: 2,
      puzzleProgressByKey: { 'classic:10': { attempts: 1 } },
    });
    expect(localSnapshot).not.toHaveProperty('replayProgressByKey');
  });
});
