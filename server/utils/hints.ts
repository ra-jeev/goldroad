/**
 * Server-side hint computation.
 *
 * The optimal paths are NEVER sent to the client. When a hint is requested,
 * the client sends its current tile id and the desired level; the server
 * looks up the stored optimalPaths for that game and returns only the
 * minimal information needed for that hint level.
 *
 * Hint levels:
 *   1 — Nudge:   recommend a direction from the player's current tile.
 *   2 — Branch:  reveal 2–3 upcoming tiles on the optimal path.
 *   3 — Rescue:  reveal the exact next optimal step (locks out Gold tier).
 */

import type { Direction, HintResult } from '../../shared/types/game'
import { getDirection, parseTileIndex } from '../../shared/utils/puzzleEngine'

/**
 * Compute a hint given the server-stored optimal paths and the player's
 * current position. When multiple optimal paths exist, chooses the one
 * closest to the player's current position.
 *
 * @param optimalPaths  All gold paths from start → end (server-side only).
 * @param currentId     The tile the player is currently on.
 * @param level         Hint level requested (1 | 2 | 3).
 */
export function computeHint(
  optimalPaths: number[][],
  currentId: number,
  cols: number,
  level: 1 | 2 | 3,
): HintResult {
  // Find the optimal path that contains the current tile, or the nearest one
  let bestPath = optimalPaths[0]!
  let bestIndex = -1
  
  // First, check if player is on any optimal path
  for (const path of optimalPaths) {
    const idx = path.indexOf(currentId)
    if (idx !== -1 && idx < path.length - 1) {
      bestPath = path
      bestIndex = idx
      break
    }
  }
  
  // If not on any optimal path, find the nearest one
  if (bestIndex === -1) {
    let minDist = Infinity
    for (const path of optimalPaths) {
      const dist = minDistanceToPath(currentId, path, cols)
      if (dist < minDist) {
        minDist = dist
        bestPath = path
      }
    }
  }
  
  const currentIndex = bestPath.indexOf(currentId)
  const onPath = currentIndex !== -1 && currentIndex < bestPath.length - 1

  if (level === 1) {
    // Nudge: direction toward the next tile on the optimal path.
    if (onPath) {
      const nextId = bestPath[currentIndex + 1]!
      return {
        level: 1,
        direction: getDirection(currentId, nextId, cols),
        fromTileIndex: currentId,
        nextTileIndex: nextId,
      }
    }
    // Off-path: nudge toward the nearest tile on the optimal path.
    return { level: 1, direction: nearestOptimalDirection(currentId, bestPath, cols), fromTileIndex: currentId }
  }

  if (level === 2) {
    // Branch: next 2–3 tiles on the optimal path from the current position.
    // If the player is off-path, show tiles from the start of the optimal path.
    const startIndex = onPath ? currentIndex + 1 : 0
    const tileIndexes = bestPath.slice(startIndex, startIndex + 3)
    return { level: 2, tileIndexes }
  }

  // Level 3 — Rescue: exact next step.
  if (onPath) {
    return { level: 3, nextTileIndex: bestPath[currentIndex + 1]! }
  }
  // If the player is completely off-path, guide back to the start of the route.
  return { level: 3, nextTileIndex: bestPath[0]! }
}

/**
 * Calculate minimum Manhattan distance from a tile to any tile in a path.
 */
function minDistanceToPath(tileId: number, path: number[], cols: number): number {
  const [tr, tc] = parseTileIndex(tileId, cols)
  let minDist = Infinity
  
  for (const pathId of path) {
    const [pr, pc] = parseTileIndex(pathId, cols)
    const dist = Math.abs(pr - tr) + Math.abs(pc - tc)
    if (dist < minDist) {
      minDist = dist
    }
  }
  
  return minDist
}

/**
 * Approximate best direction from `currentId` toward the nearest tile
 * on the optimal path. Used when the player has strayed off the gold route.
 *
 * Ties are broken by whichever optimal tile appears earliest in the path.
 */
function nearestOptimalDirection(currentId: number, optimalPath: number[], cols: number): Direction {
  const [cr, cc] = parseTileIndex(currentId, cols)
  let bestDir: Direction = 'top'
  let bestDist = Infinity

  for (const pathId of optimalPath) {
    const [pr, pc] = parseTileIndex(pathId, cols)
    const dist = Math.abs(pr - cr) + Math.abs(pc - cc)
    if (dist < bestDist) {
      bestDist = dist
      if (pr < cr)      bestDir = 'top'
      else if (pr > cr) bestDir = 'bottom'
      else if (pc < cc) bestDir = 'left'
      else              bestDir = 'right'
    }
  }

  return bestDir
}
