import { describe, expect, it } from 'vitest';
import {
  HintRequestPayloadSchema,
  SessionEndPayloadSchema,
  SessionStartPayloadSchema,
} from '../shared/validators/game';

function baseEndPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    playerUUID: '11111111-1111-4111-8111-111111111111',
    gameNo: 1,
    puzzleType: 'classic',
    sessionId: '22222222-2222-4222-8222-222222222222',
    score: 10,
    moves: 5,
    attemptNumber: 1,
    hintsUsed: 0,
    solveTimeMs: 1000,
    ...overrides,
  };
}

function baseHintPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    playerUUID: '11111111-1111-4111-8111-111111111111',
    gameNo: 1,
    puzzleType: 'classic',
    sessionId: '22222222-2222-4222-8222-222222222222',
    attemptNumber: 1,
    pathHistory: [0, 1],
    ...overrides,
  };
}

describe('SessionEndPayloadSchema bounds', () => {
  it('accepts a plausible payload', () => {
    expect(SessionEndPayloadSchema.safeParse(baseEndPayload()).success).toBe(true);
  });

  it('rejects an implausibly large attemptNumber', () => {
    const result = SessionEndPayloadSchema.safeParse(
      baseEndPayload({ attemptNumber: 100_000 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an implausibly large moves count', () => {
    const result = SessionEndPayloadSchema.safeParse(
      baseEndPayload({ moves: 1_000_000 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an implausibly large hintsUsed count', () => {
    const result = SessionEndPayloadSchema.safeParse(
      baseEndPayload({ hintsUsed: 100_000 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects hintsUsed wildly disproportionate to attemptNumber', () => {
    const result = SessionEndPayloadSchema.safeParse(
      baseEndPayload({ attemptNumber: 1, hintsUsed: 100 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a solveTimeMs beyond the 24-hour ceiling', () => {
    const result = SessionEndPayloadSchema.safeParse(
      baseEndPayload({ solveTimeMs: 24 * 60 * 60 * 1000 + 1 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a negative solveTimeMs', () => {
    const result = SessionEndPayloadSchema.safeParse(
      baseEndPayload({ solveTimeMs: -1 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects obsolete non-solve outcome fields', () => {
    expect(
      SessionEndPayloadSchema.safeParse(
        baseEndPayload({ solved: false, endReason: 'dead-end' }),
      ).success,
    ).toBe(false);
  });
});

describe('SessionStartPayloadSchema', () => {
  it('accepts the minimal unique-start identity', () => {
    expect(
      SessionStartPayloadSchema.safeParse({
        playerUUID: '11111111-1111-4111-8111-111111111111',
        gameNo: 1,
        puzzleType: 'classic',
        sessionId: '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(true);
  });
});

describe('HintRequestPayloadSchema bounds', () => {
  it('accepts a plausible payload', () => {
    expect(HintRequestPayloadSchema.safeParse(baseHintPayload()).success).toBe(true);
  });

  it('rejects an implausibly large attemptNumber', () => {
    const result = HintRequestPayloadSchema.safeParse(
      baseHintPayload({ attemptNumber: 100_000 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an implausibly long pathHistory', () => {
    const result = HintRequestPayloadSchema.safeParse(
      baseHintPayload({ pathHistory: Array.from({ length: 6000 }, (_, i) => i) }),
    );
    expect(result.success).toBe(false);
  });
});
