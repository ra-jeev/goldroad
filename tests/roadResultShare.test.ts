import { describe, expect, it } from 'vitest';
import {
  buildDayResultShareText,
  buildRoadResultShareText,
} from '../app/composables/useRoadResultShare';

// Live and archive completions share the same result-text contract. Archive
// callers intentionally use the canonical homepage instead of a replay URL.
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
      '🥇 Gold in 1 try',
    );
  });

  it('keeps the plain solved wording when no medal tier applies', () => {
    expect(
      buildRoadResultShareText({ ...baseInput, attempts: 5 }).text,
    ).toContain('😅 Solved in 5 tries');
  });

  it('sends every road result to the configured canonical homepage', () => {
    const result = buildRoadResultShareText(
      baseInput,
      'https://v2.example.test/archive/path',
    );
    expect(result.url).toBe('https://v2.example.test/');
    expect(result.text).toContain(
      "Walk today's road:\nhttps://v2.example.test/",
    );
    expect(result.text).not.toContain('/games/12');
  });

  it('sends combined-day results to the homepage too', () => {
    const result = buildDayResultShareText({
      gameNo: 12,
      classic: { attempts: 1, solved: true, solveTimeMs: 10_000 },
      expedition: { attempts: 2, solved: true, solveTimeMs: 20_000 },
    });
    expect(result.url).toBe('https://playgoldroad.com/');
    expect(result.text).toContain("Walk today's road:");
    expect(result.text).not.toContain('/games/12');
  });
});
