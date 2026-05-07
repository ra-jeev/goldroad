/**
 * Server-side hint computation.
 *
 * The optimal paths remain server-side. The client sends its committed
 * `pathHistory`, and the server returns only the next actionable hint result.
 *
 * Hint behavior:
 *   - If the current path is still a valid prefix of an optimal path, return
 *     the next correct tile.
 *   - If the current path has diverged, return the divergence tile and the
 *     next tile the player should have taken on the best matching optimal path.
 */

import type { HintResult } from '../../shared/types/game';

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
