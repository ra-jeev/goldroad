/**
 * Core puzzle engine — movement rules, edge lookups, and board helpers.
 *
 * This module is used by BOTH the Nuxt app layer (client-side move validation,
 * active-neighbor highlighting) and the Nitro server layer (path finding,
 * hint computation, puzzle generation).
 *
 * It is intentionally pure (no side-effects, no I/O) so it can run in any
 * environment: browser, Node, or Cloudflare Workers.
 */

import type { Board, EdgeMap, EdgeType, Direction } from '../types/game'

// ---------------------------------------------------------------------------
// Tile ID helpers
// ---------------------------------------------------------------------------

/**
 * Build a stable tile index from row/col.
 * Index format: row * cols + col
 */
export function tileIndex(row: number, col: number, cols: number): number {
  return row * cols + col
}

/** Parse a tile index back to [row, col]. */
export function parseTileIndex(index: number, cols: number): [number, number] {
  return [Math.floor(index / cols), index % cols]
}

// ---------------------------------------------------------------------------
// Edge helpers
// ---------------------------------------------------------------------------

/**
 * Map key for an edge lookup.
 * Both directions are stored in the EdgeMap (A→B and B→A) so the same key
 * format is used regardless of which side initiates the move.
 */
export function edgeKey(from: number, to: number): string {
  return `${from}->${to}`
}

/**
 * Build an EdgeMap (O(1) lookup) from the board's grouped edge arrays.
 *
 * Design note: Board stores only non-open edge groups (blocked, toll, bonus).
 * Open traversal between adjacent tiles is the implicit default, so edges
 * absent from the map are open. This keeps game payloads small.
 */
export function buildEdgeMap(board: Board): EdgeMap {
  const map: EdgeMap = new Map()

  for (const edge of board.blocked) {
    map.set(edgeKey(edge.from, edge.to), 'blocked')
    map.set(edgeKey(edge.to, edge.from), 'blocked')
  }

  for (const edge of board.toll) {
    map.set(edgeKey(edge.from, edge.to), 'toll')
    map.set(edgeKey(edge.to, edge.from), 'toll')
  }

  for (const edge of board.bonus) {
    map.set(edgeKey(edge.from, edge.to), 'bonus')
    map.set(edgeKey(edge.to, edge.from), 'bonus')
  }

  return map
}

/**
 * Return the type of the connection between two tiles.
 * Returns 'open' if no entry exists (default).
 */
export function getEdgeType(from: number, to: number, edgeMap: EdgeMap): EdgeType | 'open' {
  return edgeMap.get(edgeKey(from, to)) ?? 'open'
}

/**
 * Whether a player can move from `from` to `to`.
 * Currently 'blocked' and 'locked' prevent movement; 'toll' and 'bonus' allow it.
 * Extend this function when new edge types are added.
 */
export function canMove(from: number, to: number, edgeMap: EdgeMap): boolean {
  const type = getEdgeType(from, to, edgeMap)
  return type !== 'blocked'
}

// ---------------------------------------------------------------------------
// Neighbour helpers
// ---------------------------------------------------------------------------

/**
 * Return the tile index of the neighbour in the given direction,
 * or null if the move would go out of bounds.
 */
export function getNeighborId(
  row: number,
  col: number,
  dir: Direction,
  rows: number,
  cols: number,
): number | null {
  switch (dir) {
    case 'top':    return row > 0        ? tileIndex(row - 1, col, cols) : null
    case 'bottom': return row < rows - 1 ? tileIndex(row + 1, col, cols) : null
    case 'left':   return col > 0        ? tileIndex(row, col - 1, cols) : null
    case 'right':  return col < cols - 1 ? tileIndex(row, col + 1, cols) : null
  }
}

/** All four cardinal directions. */
const DIRECTIONS: Direction[] = ['top', 'bottom', 'left', 'right']

/**
 * Return ids of all reachable neighbours from `currentId`:
 *   • in bounds
 *   • not already visited (in `done`)
 *   • edge is traversable
 */
export function getActiveNeighbors(
  currentId: number,
  rows: number,
  cols: number,
  edgeMap: EdgeMap,
  done: ReadonlySet<number>,
): number[] {
  const [row, col] = parseTileIndex(currentId, cols)
  const result: number[] = []
  for (const dir of DIRECTIONS) {
    const nId = getNeighborId(row, col, dir, rows, cols)
    if (nId !== null && !done.has(nId) && canMove(currentId, nId, edgeMap)) {
      result.push(nId)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Direction inference
// ---------------------------------------------------------------------------

/**
 * Derive the Direction from `fromId` to `toId` (must be adjacent tiles).
 * Used when drawing connection lines on the board.
 */
export function getDirection(fromId: number, toId: number, cols: number): Direction {
  const [fr, fc] = parseTileIndex(fromId, cols)
  const [tr, tc] = parseTileIndex(toId, cols)
  if (tr < fr) return 'top'
  if (tr > fr) return 'bottom'
  if (tc < fc) return 'left'
  return 'right'
}

// ---------------------------------------------------------------------------
// Tile map
// ---------------------------------------------------------------------------

/**
 * Generate all possible adjacent tile-pair edges for a rows×cols board.
 * Returns pairs [fromId, toId] for horizontal-right and vertical-down traversals.
 * Used by the puzzle generator to pick edges to block.
 */
export function allBoardEdgePairs(rows: number, cols: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) pairs.push([tileIndex(r, c, cols), tileIndex(r, c + 1, cols)]) // horizontal
      if (r < rows - 1) pairs.push([tileIndex(r, c, cols), tileIndex(r + 1, c, cols)]) // vertical
    }
  }
  return pairs
}
