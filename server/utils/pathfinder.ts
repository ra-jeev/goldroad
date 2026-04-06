/**
 * Exhaustive BFS path finder — server-side only.
 *
 * Finds the highest-value route from Board.start to Board.end respecting
 * all edge constraints. Used by:
 *   • The puzzle generator (to compute maxScore and optimalPaths at creation time).
 *   • The hint endpoint (to compute the stored optimalPaths for a given game).
 *
 * Complexity note:
 *   For a 6×6 board the search space is bounded and completes in <50 ms.
 *   Each BFS job carries only a Set<string> of visited tile ids and a path
 *   array, not a clone of the full board — significantly lighter than v1.
 */

import type { Board, PathResult } from '../../shared/types/game'
import { buildEdgeMap, getActiveNeighbors } from '../../shared/utils/puzzleEngine'

interface PathJob {
  currentId: number
  visited: Set<number>
  path: number[]
  total: number
}

/**
 * Find the highest-scoring path from Board.start to Board.end.
 * Returns null if no path exists (puzzle should be regenerated).
 */
export function findBestRoute(board: Board): PathResult | null {
  const edgeMap = buildEdgeMap(board)

  const startTileValue = board.tiles[board.start]
  if (startTileValue === undefined) return null

  const jobs: PathJob[] = [
    {
      currentId: board.start,
      visited: new Set([board.start]),
      path: [board.start],
      total: startTileValue,
    },
  ]

  const results: PathResult[] = []

  while (jobs.length > 0) {
    const job = jobs.shift()!

    if (job.currentId === board.end) {
      results.push({ total: job.total, moves: job.path.length, path: job.path })
      continue
    }

    const neighbors = getActiveNeighbors(
      job.currentId,
      board.rows,
      board.cols,
      edgeMap,
      job.visited,
    )

    for (const nId of neighbors) {
      const neighborValue = board.tiles[nId]
      if (neighborValue === undefined) continue
      jobs.push({
        currentId: nId,
        visited: new Set([...job.visited, nId]),
        path: [...job.path, nId],
        total: job.total + neighborValue,
      })
    }
  }

  if (!results.length) return null

  // Return the route with the highest total (gold route).
  results.sort((a, b) => b.total - a.total)
  return results[0] ?? null
}

/**
 * Return all valid routes sorted by descending score.
 * Used for difficulty analysis (gap between gold and silver route).
 */
export function findAllRoutes(board: Board): PathResult[] {
  const edgeMap = buildEdgeMap(board)

  const startTileValue = board.tiles[board.start]
  if (startTileValue === undefined) return []

  const jobs: PathJob[] = [
    {
      currentId: board.start,
      visited: new Set([board.start]),
      path: [board.start],
      total: startTileValue,
    },
  ]

  const results: PathResult[] = []

  while (jobs.length > 0) {
    const job = jobs.shift()!

    if (job.currentId === board.end) {
      results.push({ total: job.total, moves: job.path.length, path: job.path })
      continue
    }

    const neighbors = getActiveNeighbors(
      job.currentId,
      board.rows,
      board.cols,
      edgeMap,
      job.visited,
    )

    for (const nId of neighbors) {
      const neighborValue = board.tiles[nId]
      if (neighborValue === undefined) continue
      jobs.push({
        currentId: nId,
        visited: new Set([...job.visited, nId]),
        path: [...job.path, nId],
        total: job.total + neighborValue,
      })
    }
  }

  results.sort((a, b) => b.total - a.total)
  return results
}
