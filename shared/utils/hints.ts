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
 *   - A hint taken again before that tile is walked reveals one tile further
 *     along the same route. It does not repeat the tile already lit.
 *   - If the current path has diverged, return the divergence tile and the
 *     next tile the player should have taken on the best matching optimal path.
 *     A further hint extends that correction by one tile.
 */

import type { HintResult } from '../../shared/types/game';

/**
 * True when `nextGuide` shows a route the board is not already showing.
 * A repeat, including a shorter prefix of the same route, spends no hint.
 * A shorter guide on a different route is new.
 */
export function hintRevealsNewTile(
  currentGuide: number[],
  nextGuide: number[],
): boolean {
  if (nextGuide.length > currentGuide.length) return true;
  return nextGuide.some((tile, index) => tile !== currentGuide[index]);
}

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
  revealedGuide: number[] = [],
): HintResult {
  const bestPath = pickBestMatchingPath(
    optimalPaths,
    pathHistory,
    revealedGuide,
  );
  const matchedPrefixLength = getCommonPrefixLength(bestPath, pathHistory);
  const revealedOnRoute = isPrefix(revealedGuide, bestPath)
    ? revealedGuide.length
    : 0;

  if (
    matchedPrefixLength === pathHistory.length &&
    matchedPrefixLength < bestPath.length
  ) {
    const nextIndex = Math.max(matchedPrefixLength, revealedOnRoute);
    // The guide can already show every coin while the player still stands
    // earlier on the route. That is the next step, not a solve.
    if (nextIndex >= bestPath.length) {
      return {
        kind: 'next-step',
        nextTileIndex: bestPath[matchedPrefixLength]!,
        guidePath: bestPath.slice(),
      };
    }

    return {
      kind: 'next-step',
      nextTileIndex: bestPath[nextIndex]!,
      guidePath: bestPath.slice(0, nextIndex + 1),
    };
  }

  if (matchedPrefixLength === 0) {
    const end = Math.min(
      bestPath.length,
      Math.max(2, revealedOnRoute > 0 ? revealedOnRoute + 1 : 2),
    );
    return {
      kind: 'diverged',
      divergenceTileIndex: bestPath[0]!,
      correctTileIndex: bestPath[end - 1] ?? bestPath[0]!,
      guidePath: bestPath.slice(0, end),
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

  const end = Math.min(
    bestPath.length,
    Math.max(
      matchedPrefixLength + 1,
      revealedOnRoute > matchedPrefixLength ? revealedOnRoute + 1 : 0,
    ),
  );
  return {
    kind: 'diverged',
    divergenceTileIndex: bestPath[matchedPrefixLength - 1]!,
    correctTileIndex:
      bestPath[end - 1] ?? bestPath[bestPath.length - 1]!,
    guidePath: bestPath.slice(0, end),
  };
}

function pickBestMatchingPath(
  optimalPaths: number[][],
  pathHistory: number[],
  revealedGuide: number[] = [],
): number[] {
  // Stay on the route a previous hint already showed, when the player has
  // not walked off it. A fresh pick would tie-break to the first optimal
  // path and repeat the first step.
  if (revealedGuide.length > 1 && isPrefix(pathHistory, revealedGuide)) {
    const guided = optimalPaths.find((path) => isPrefix(revealedGuide, path));
    if (guided) return guided;
  }

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

function isPrefix(prefix: number[], full: number[]): boolean {
  if (prefix.length > full.length) return false;

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== full[index]) return false;
  }

  return true;
}

function getCommonPrefixLength(left: number[], right: number[]): number {
  const max = Math.min(left.length, right.length);
  let idx = 0;

  while (idx < max && left[idx] === right[idx]) {
    idx += 1;
  }

  return idx;
}
