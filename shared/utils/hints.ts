/**
 * Hint computation, shared between server and client.
 *
 * For the LIVE road, optimal paths remain server-side (the P0-3 boundary):
 * the client sends its committed `pathHistory` and the server returns only
 * the next actionable hint result. For ARCHIVED roads, the board payload
 * ships its solution paths and the client runs this same computation
 * locally — a deliberate RP0-5 carve-out so archive play makes no
 * analytics calls at all.
 *
 * Hint behavior:
 *   - If the current path is still a valid prefix of an optimal path, return
 *     the next correct tile.
 *   - If the current path has diverged, return the divergence tile and the
 *     next tile the player should have taken on the best matching optimal path.
 */

import type { HintResult } from '../../shared/types/game';

/**
 * Which guide tiles still need a marker on the board.
 *
 * Only the stretch the player has walked *in the guide's own order* is
 * redundant. Anything past that point must stay lit even if the player
 * happens to have stepped on it already out of order — that tile is exactly
 * what a "paths diverged" hint is pointing at, and suppressing it left the
 * player reading "you went wrong here" with nothing marked on the board.
 */
export function guideHighlightTiles(
  guidePath: number[],
  pathHistory: number[],
  startTile: number,
): number[] {
  const shared = getCommonPrefixLength(guidePath, pathHistory);
  return guidePath.slice(shared).filter((tileIndex) => tileIndex !== startTile);
}

export function computeHint(
  optimalPaths: number[][],
  pathHistory: number[],
): HintResult {
  const bestPath = pickBestMatchingPath(optimalPaths, pathHistory);
  const matchedPrefixLength = getCommonPrefixLength(bestPath, pathHistory);

  if (
    matchedPrefixLength === pathHistory.length &&
    matchedPrefixLength < bestPath.length
  ) {
    return {
      kind: 'next-step',
      nextTileIndex: bestPath[matchedPrefixLength]!,
      guidePath: bestPath.slice(0, matchedPrefixLength + 1),
    };
  }

  if (matchedPrefixLength === 0) {
    return {
      kind: 'diverged',
      divergenceTileIndex: bestPath[0]!,
      correctTileIndex: bestPath[1] ?? bestPath[0]!,
      guidePath: bestPath.slice(0, Math.min(bestPath.length, 2)),
    };
  }

  if (
    matchedPrefixLength === pathHistory.length &&
    matchedPrefixLength === bestPath.length
  ) {
    return {
      kind: 'already-solved',
      guidePath: bestPath.slice(),
    };
  }

  return {
    kind: 'diverged',
    divergenceTileIndex: bestPath[matchedPrefixLength - 1]!,
    correctTileIndex:
      bestPath[matchedPrefixLength] ?? bestPath[bestPath.length - 1]!,
    guidePath: bestPath.slice(
      0,
      Math.min(bestPath.length, matchedPrefixLength + 1),
    ),
  };
}

function pickBestMatchingPath(
  optimalPaths: number[][],
  pathHistory: number[],
): number[] {
  let bestPath = optimalPaths[0] ?? [];
  let bestPrefixLength = -1;

  for (const path of optimalPaths) {
    const prefixLength = getCommonPrefixLength(path, pathHistory);
    if (prefixLength > bestPrefixLength) {
      bestPath = path;
      bestPrefixLength = prefixLength;
    }
  }

  return bestPath;
}

function getCommonPrefixLength(left: number[], right: number[]): number {
  const max = Math.min(left.length, right.length);
  let idx = 0;

  while (idx < max && left[idx] === right[idx]) {
    idx += 1;
  }

  return idx;
}
