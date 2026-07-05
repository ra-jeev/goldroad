import { describe, expect, it } from 'vitest';
import { computeHint } from '../server/utils/hints';

describe('computeHint', () => {
  it('returns the next tile when the player path is a valid prefix of the optimal path', () => {
    const optimalPaths = [[0, 1, 2, 5]];
    const result = computeHint(optimalPaths, [0, 1]);

    expect(result).toEqual({
      kind: 'next-step',
      nextTileIndex: 2,
      guidePath: [0, 1, 2],
    });
  });

  it('gives a hint from the start tile alone', () => {
    const optimalPaths = [[0, 1, 2, 5]];
    const result = computeHint(optimalPaths, [0]);

    expect(result).toEqual({
      kind: 'next-step',
      nextTileIndex: 1,
      guidePath: [0, 1],
    });
  });

  it('reports divergence and the correct next tile once the player leaves the optimal path', () => {
    const optimalPaths = [[0, 1, 2, 5]];
    // Player went 0 -> 3, but the optimal path continues 0 -> 1.
    const result = computeHint(optimalPaths, [0, 3]);

    expect(result).toEqual({
      kind: 'diverged',
      divergenceTileIndex: 0,
      correctTileIndex: 1,
      guidePath: [0, 1],
    });
  });

  it('reports divergence deeper into a longer diverged path', () => {
    const optimalPaths = [[0, 1, 2, 5]];
    // Player matched the first two tiles, then diverged to 4 instead of 5.
    const result = computeHint(optimalPaths, [0, 1, 2, 4]);

    expect(result).toEqual({
      kind: 'diverged',
      divergenceTileIndex: 2,
      correctTileIndex: 5,
      guidePath: [0, 1, 2, 5],
    });
  });

  it('picks the optimal path with the longest matching prefix when several exist', () => {
    const optimalPaths = [
      [0, 1, 2, 5],
      [0, 3, 4, 5],
    ];
    // Path history matches the second optimal path's prefix, not the first's.
    const result = computeHint(optimalPaths, [0, 3]);

    expect(result).toEqual({
      kind: 'next-step',
      nextTileIndex: 4,
      guidePath: [0, 3, 4],
    });
  });

  it('breaks ties toward whichever optimal path is listed first when prefixes match equally', () => {
    const optimalPaths = [
      [0, 1, 5],
      [0, 1, 4, 5],
    ];
    // [0] matches both paths' first tile equally (prefix length 1); the
    // implementation keeps the first candidate found.
    const result = computeHint(optimalPaths, [0]);

    expect(result).toEqual({
      kind: 'next-step',
      nextTileIndex: 1,
      guidePath: [0, 1],
    });
  });

  it('reports full divergence when the path history does not start on any optimal path', () => {
    const optimalPaths = [[0, 1, 2, 5]];
    const result = computeHint(optimalPaths, [9]);

    expect(result).toEqual({
      kind: 'diverged',
      divergenceTileIndex: 0,
      correctTileIndex: 1,
      guidePath: [0, 1],
    });
  });

  it('returns already-solved for a single-tile optimal path (start === end)', () => {
    const optimalPaths = [[0]];
    const result = computeHint(optimalPaths, [0]);

    expect(result).toEqual({
      kind: 'already-solved',
      guidePath: [0],
    });
  });

  it('regression: returns already-solved once the player has fully completed the best-matching optimal path', () => {
    const optimalPaths = [[0, 1, 2, 5]];
    const result = computeHint(optimalPaths, [0, 1, 2, 5]);

    expect(result).toEqual({
      kind: 'already-solved',
      guidePath: [0, 1, 2, 5],
    });
  });

  it('returns already-solved when the fully completed path is the best match among several optimal paths', () => {
    const optimalPaths = [
      [0, 1, 2, 5],
      [0, 3, 4, 5],
    ];
    const result = computeHint(optimalPaths, [0, 3, 4, 5]);

    expect(result).toEqual({
      kind: 'already-solved',
      guidePath: [0, 3, 4, 5],
    });
  });
});
