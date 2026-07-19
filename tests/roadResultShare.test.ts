import { describe, expect, it } from 'vitest';
import { buildRoadResultShareText } from '../app/composables/useRoadResultShare';

describe('replay result sharing', () => {
  const baseInput = {
    gameNo: 12,
    puzzleType: 'classic' as const,
    attempts: 1,
    solved: true,
    solveTimeMs: 1_000,
    hintsUsed: 0,
  };

  it('frames a replay medal as counterfactual rather than awarded', () => {
    expect(buildRoadResultShareText({ ...baseInput, isReplay: true }).text).toContain(
      'Solved in 1 attempt — live, that would have been 🥇 Gold.',
    );
  });

  it('keeps the plain solved wording when no replay medal tier applies', () => {
    expect(
      buildRoadResultShareText({ ...baseInput, attempts: 5, isReplay: true })
        .text,
    ).toContain('😅 Solved in 5 attempts');
  });
});
