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
    const text = buildRoadResultShareText(baseInput).text;
    expect(text).toContain('🟩');
    expect(text).toContain('🥇 Gold in 1 try');
  });

  it('keeps the plain solved wording when no medal tier applies', () => {
    const text = buildRoadResultShareText({ ...baseInput, attempts: 5 }).text;
    expect(text).toContain('🟫🟫🟫🟫🟩');
    expect(text).toContain('😅 Solved in 5 tries');
  });

  it('caps long attempt trails while preserving the actual try count', () => {
    const text = buildRoadResultShareText({ ...baseInput, attempts: 11 }).text;
    expect(text).toContain('🟫🟫🟫🟫🟫🟫🟫🟩 +3');
    expect(text).toContain('Solved in 11 tries');
  });

  it('sends every road result to the configured canonical homepage', () => {
    const result = buildRoadResultShareText(
      baseInput,
      'https://v2.example.test/archive/path',
    );
    expect(result.url).toBe('https://v2.example.test/');
    expect(result.text).toContain(
      "Walk today’s road:\nhttps://v2.example.test/",
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
    expect(result.text).toContain("Walk today’s road:");
    expect(result.text).not.toContain('/games/12');
  });
});
