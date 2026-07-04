import { describe, expect, it } from 'vitest';
import { calcMedalForAttempt, isExactSolve } from '../lib/gameTiers';

describe('calcMedalForAttempt', () => {
  it('returns null for unsolved runs regardless of attempt number', () => {
    expect(calcMedalForAttempt(1, false)).toBeNull();
    expect(calcMedalForAttempt(2, false)).toBeNull();
    expect(calcMedalForAttempt(3, false)).toBeNull();
    expect(calcMedalForAttempt(4, false)).toBeNull();
  });

  it('awards gold/silver/bronze exactly at attempts 1/2/3 when solved', () => {
    expect(calcMedalForAttempt(1, true)).toBe('gold');
    expect(calcMedalForAttempt(2, true)).toBe('silver');
    expect(calcMedalForAttempt(3, true)).toBe('bronze');
  });

  it('awards no medal on attempt 4 or later even when solved', () => {
    expect(calcMedalForAttempt(4, true)).toBeNull();
    expect(calcMedalForAttempt(10, true)).toBeNull();
  });
});

describe('isExactSolve', () => {
  it('is true only when score equals maxScore', () => {
    expect(isExactSolve(10, 10)).toBe(true);
    expect(isExactSolve(9, 10)).toBe(false);
    expect(isExactSolve(11, 10)).toBe(false);
  });
});
