/**
 * Puzzle generator — server-side only.
 *
 * Generates a new GoldRoad puzzle using the v2 edge-based board model.
 *
 * Key improvements over v1:
 *   1. Barriers live on edges, not tiles — no "wall on the outer boundary"
 *      wasted slots.
 *   2. Start/end adjacency is protected — we never block edges directly
 *      adjacent to the start or end tile, so the player always has an
 *      initial move and can always reach the goal tile from the last step.
 *   3. Path existence is verified via BFS before accepting the board.
 *   4. A difficulty band is tagged at generation time for future filtering.
 */

import { findBestRoute, findAllRoutes } from './pathfinder'
import type { Board, DifficultyBand, EdgePair, PathResult } from '../../shared/types/game'
import {
  DEFAULT_BLOCKED_EDGES,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  TILE_VALUE_MAX,
  TILE_VALUE_MIN,
} from '../../lib/gameConstants'
import { allBoardEdgePairs, tileIndex } from '../../shared/utils/puzzleEngine'

// ---------------------------------------------------------------------------
// RNG helpers
// ---------------------------------------------------------------------------

/** Integer in [min, max] inclusive. */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

// ---------------------------------------------------------------------------
// Position pickers
// ---------------------------------------------------------------------------

/**
 * Pick a start tile from the inner quadrant of the board.
 * This ensures the start is never in a corner, giving the player more
 * initial branching options.
 */
function pickStart(rows: number, cols: number): number {
  const minRow = Math.floor(rows / 4)
  const maxRow = rows - minRow - 1
  const minCol = Math.floor(cols / 4)
  const maxCol = cols - minCol - 1
  return tileIndex(randomInt(minRow, maxRow), randomInt(minCol, maxCol), cols)
}

/** Pick an end tile from any edge of the board. */
function pickEnd(rows: number, cols: number, excludeId: number): number {
  const edgeTiles: number[] = []
  
  // Top and bottom edges
  for (let c = 0; c < cols; c++) {
    edgeTiles.push(tileIndex(0, c, cols))
    edgeTiles.push(tileIndex(rows - 1, c, cols))
  }
  
  // Left and right edges (excluding corners already added)
  for (let r = 1; r < rows - 1; r++) {
    edgeTiles.push(tileIndex(r, 0, cols))
    edgeTiles.push(tileIndex(r, cols - 1, cols))
  }
  
  const candidates = edgeTiles.filter(id => id !== excludeId)
  return candidates[randomInt(0, candidates.length - 1)]!
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface GeneratedPuzzle {
  board: Board
  maxScore: number
  /** Sum of all tile values on the board (upper bound if player collected everything). */
  totalCoins: number
  /** The gold (optimal) path — stored server-side only, never sent to client. */
  optimalPath: number[]
  difficultyBand: DifficultyBand
  /** Branching factor — number of valid routes (informational). */
  routeCount: number
  /** Coin gap between gold and silver route (0 if only one route). */
  goldSilverGap: number
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a valid GoldRoad puzzle.
 *
 * Retries up to `maxAttempts` times when no valid path can be found after
 * placing blocked edges. In practice the first attempt succeeds almost always
 * for default parameters.
 *
 * @param rows         Board row count (default 6).
 * @param cols         Board column count (default 6).
 * @param numBlocked   Number of edges to block (default 10).
 * @param maxAttempts  Maximum generation retries before giving up.
 */
export function generatePuzzle(
  rows = DEFAULT_ROWS,
  cols = DEFAULT_COLS,
  numBlocked = DEFAULT_BLOCKED_EDGES,
  maxAttempts = 20,
): GeneratedPuzzle | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // ------------------------------------------------------------------
    // 1. Build tile grid with random coin values
    // ------------------------------------------------------------------
    const tiles: number[] = Array.from({ length: rows * cols }, () =>
      randomInt(TILE_VALUE_MIN, TILE_VALUE_MAX),
    )

    // ------------------------------------------------------------------
    // 2. Place start (inner quadrant) and end (corner)
    // ------------------------------------------------------------------
    const startId = pickStart(rows, cols)
    const endId = pickEnd(rows, cols, startId)

    // ------------------------------------------------------------------
    // 3. Select edges to block
    //    Skip edges adjacent to start or end to guarantee initial moves
    //    and a reachable destination from the penultimate tile.
    // ------------------------------------------------------------------
    const protectedSet = new Set<string>()
    const allPairs = allBoardEdgePairs(rows, cols)

    for (const [a, b] of allPairs) {
      if (a === startId || b === startId || a === endId || b === endId) {
        protectedSet.add(`${a}|${b}`)
      }
    }

    const candidates = shuffle(
      allPairs.filter(([a, b]) => !protectedSet.has(`${a}|${b}`)),
    )

    const blockedEdges: EdgePair[] = []
    for (const [a, b] of candidates) {
      if (blockedEdges.length >= numBlocked) break
      blockedEdges.push({ from: a, to: b })
    }

    const board: Board = {
      rows,
      cols,
      tiles,
      blocked: blockedEdges,
      cost: [],
      bonus: [],
      costValue: 1,
      bonusValue: 1,
      start: startId,
      end: endId,
    }

    // ------------------------------------------------------------------
    // 4. Verify at least one valid path exists
    // ------------------------------------------------------------------
    const bestRoute = findBestRoute(board)
    if (!bestRoute) continue

    // ------------------------------------------------------------------
    // 5. Compute analytics / difficulty metadata
    // ------------------------------------------------------------------
    const allRoutes = findAllRoutes(board)
    const silverRoute: PathResult | undefined = allRoutes[1]
    const goldSilverGap = silverRoute ? bestRoute.total - silverRoute.total : 0
    const difficultyBand = calcDifficultyBand(bestRoute, board, allRoutes.length, goldSilverGap)

    // Calculate total coins available on the board
    const totalCoins = board.tiles.reduce((sum, tileValue) => sum + tileValue, 0)

    return {
      board,
      maxScore: bestRoute.total,
      totalCoins,
      optimalPath: bestRoute.path,
      difficultyBand,
      routeCount: allRoutes.length,
      goldSilverGap,
    }
  }

  return null // Failed to produce a valid board after maxAttempts
}

// ---------------------------------------------------------------------------
// Difficulty banding
// ---------------------------------------------------------------------------

/**
 * Tag the puzzle with a rough difficulty band based on:
 *   • Path coverage: what fraction of tiles the gold route visits.
 *   • Blocked-edge density: fraction of possible edges that are blocked.
 *   • Gold–silver gap: a large gap means the gold route is uniquely hard to find.
 *   • Route count: fewer routes = less room for error.
 */
function calcDifficultyBand(
  best: PathResult,
  board: Board,
  routeCount: number,
  goldSilverGap: number,
): DifficultyBand {
  const totalTiles = board.rows * board.cols
  const totalEdges = board.rows * (board.cols - 1) + (board.rows - 1) * board.cols
  const blockedCount = board.blocked.length

  const coverage = best.moves / totalTiles          // 0..1, higher = easier (more of board visited)
  const density = blockedCount / totalEdges          // 0..1, higher = more barriers
  const gapRatio = best.total > 0 ? goldSilverGap / best.total : 0 // higher = gold harder to identify

  // Score: higher = harder
  let hardnessScore = 0
  if (coverage < 0.40) hardnessScore += 2
  else if (coverage < 0.60) hardnessScore += 1

  if (density > 0.22) hardnessScore += 2
  else if (density > 0.14) hardnessScore += 1

  if (routeCount <= 2) hardnessScore += 2
  else if (routeCount <= 5) hardnessScore += 1

  if (gapRatio > 0.15) hardnessScore += 1

  if (hardnessScore >= 5) return 'hard'
  if (hardnessScore >= 2) return 'medium'
  return 'easy'
}
