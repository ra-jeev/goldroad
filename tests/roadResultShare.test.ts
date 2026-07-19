import { describe, expect, it } from 'vitest';
import { buildRoadResultShareText } from '../app/composables/useRoadResultShare';

// Sharing is a live-road concept: archive replays expose no share affordance,
// so the result line always presents the medal as genuinely awarded.
describe('road result sharing', () => {
  const baseInput = {
    gameNo: 12,
    puzzleType: 'classic' as const,
    attempts: 1,
    solved: true,
    solveTimeMs: 1_000,
    hintsUsed: 0,
  };

  it('presents a first-attempt solve as an awarded gold medal', () => {
    expect(buildRoadResultShareText(baseInput).text).toContain(
      '🥇 Gold in 1 attempt',
    );
  });

  it('keeps the plain solved wording when no medal tier applies', () => {
    expect(
      buildRoadResultShareText({ ...baseInput, attempts: 5 }).text,
    ).toContain('😅 Solved in 5 attempts');
  });
});
