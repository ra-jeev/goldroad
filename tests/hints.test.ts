import { describe, expect, it } from 'vitest';
import { computeHint, guideHighlightTiles } from '../shared/utils/hints';

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

  // Archived roads ship their `optimalPaths` in the board payload and the
  // client runs this exact same computeHint locally (RP0-5/RP1-9) — no
  // server round trip. These cases exercise that path shape end to end.
  describe('local archive hint calculation', () => {
    it('computes a next-step hint purely from a shipped optimalPaths array, no server call involved', () => {
      const shippedOptimalPaths = [[0, 4, 8, 12]];
      const localPathHistory = [0, 4];

      const hint = computeHint(shippedOptimalPaths, localPathHistory);

      expect(hint).toEqual({
        kind: 'next-step',
        nextTileIndex: 8,
        guidePath: [0, 4, 8],
      });
    });

    it('computes a diverged hint for an archive replay that left the shipped optimal path', () => {
      const shippedOptimalPaths = [[0, 4, 8, 12]];
      const localPathHistory = [0, 4, 9];

      const hint = computeHint(shippedOptimalPaths, localPathHistory);

      expect(hint).toEqual({
        kind: 'diverged',
        divergenceTileIndex: 4,
        correctTileIndex: 8,
        guidePath: [0, 4, 8],
      });
    });

    it('computes already-solved for a completed archive replay against a shipped path', () => {
      const shippedOptimalPaths = [[0, 4, 8, 12]];
      const localPathHistory = [0, 4, 8, 12];

      const hint = computeHint(shippedOptimalPaths, localPathHistory);

      expect(hint).toEqual({
        kind: 'already-solved',
        guidePath: [0, 4, 8, 12],
      });
    });
  });
});

describe('guideHighlightTiles', () => {
  const START = 0;

  it('marks only the next tile while the player is on the guide', () => {
    // Walked 0 -> 1 correctly; guide runs 0 -> 1 -> 2.
    expect(guideHighlightTiles([0, 1, 2], [0, 1], START)).toEqual([2]);
  });

  it('never marks the start tile', () => {
    expect(guideHighlightTiles([0, 1], [0], START)).toEqual([1]);
    expect(guideHighlightTiles([0], [0], START)).toEqual([]);
  });

  it('still marks the correct tile after the player reached it out of order', () => {
    // The guide wanted 0 -> 5 first. The player went 0 -> 1 -> 2 -> 5, so tile
    // 5 is in their history but was reached the wrong way round. The hint says
    // "paths diverged", so tile 5 has to stay lit or nothing on the board
    // shows where the route actually broke.
    expect(guideHighlightTiles([0, 5], [0, 1, 2, 5], START)).toEqual([5]);
  });

  it('marks nothing once the walked route matches the guide exactly', () => {
    expect(guideHighlightTiles([0, 1, 2], [0, 1, 2], START)).toEqual([]);
  });

  it('drops the shared prefix but keeps everything after the divergence', () => {
    expect(guideHighlightTiles([0, 1, 7, 8], [0, 1, 4], START)).toEqual([7, 8]);
  });
});
