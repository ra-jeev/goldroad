/**
 * Frontend-only board utilities.
 *
 * These depend on browser APIs (window.innerWidth / innerHeight) or produce
 * Vue-specific runtime tile state, so they live in app/utils rather than
 * shared/utils.
 */

import type { Board } from '../../shared/types/game'
import type { ConnectionGrid, TileState } from '../types/game'
import { MIN_TILE_SIZE, OTHER_ELEMENTS_HEIGHT, TILE_GAP, TILE_SIZE } from '../../lib/gameConstants'

// ---------------------------------------------------------------------------
// Initial runtime state builders
// ---------------------------------------------------------------------------

/**
 * Convert a raw Board into the mutable TileState grid used by the game loop.
 * Sets the start tile as active and gives it keyboard focus (tabIndex 0).
 */
export function buildInitialTileStates(board: Board): TileState[][] {
  return Array.from({ length: board.rows }, (_, row) =>
    Array.from({ length: board.cols }, (_, col): TileState => {
      const id = row * board.cols + col
      const value = board.tiles[id] ?? 1
      return {
        id,
        row,
        col,
        value,
        start: id === board.start,
        end: id === board.end,
        active: id === board.start,
        done: false,
        tabIndex: id === board.start ? 0 : -1,
        focus: false,
      }
    }),
  )
}

/**
 * Build an empty connection grid (one entry per tile, initially null).
 * A non-null entry records the direction of the drawn path segment
 * leaving that tile.
 */
export function buildConnectionGrid(rows: number, cols: number): ConnectionGrid {
  return Array.from({ length: rows }, () => Array(cols).fill(null))
}

// ---------------------------------------------------------------------------
// Tile sizing
// ---------------------------------------------------------------------------

export interface TileSizeResult {
  tileSize: number | undefined
  useAlternateLayout: boolean
}

/**
 * Calculate the pixel size each tile should render at so the board fits
 * within the current viewport, accounting for fixed chrome around it.
 *
 * Returns `tileSize: undefined` when the default TILE_SIZE fits fine.
 * Sets `useAlternateLayout: true` when the board is too tall even at minimum
 * tile size (triggers a side-by-side board + info layout).
 */
export function calcTileSize(numTiles: number): TileSizeResult {
  if (typeof window === 'undefined') {
    return { tileSize: undefined, useAlternateLayout: false }
  }

  const { innerWidth: vw, innerHeight: vh } = window
  const totalGap = numTiles * TILE_GAP
  const boardSize = numTiles * TILE_SIZE + totalGap

  if (vw < boardSize) {
    return {
      tileSize: (vw - totalGap) / numTiles,
      useAlternateLayout: false,
    }
  }

  if (vh < boardSize + OTHER_ELEMENTS_HEIGHT) {
    const altBoardSize = numTiles * MIN_TILE_SIZE + totalGap
    if (vh > altBoardSize + OTHER_ELEMENTS_HEIGHT) {
      return {
        tileSize: (vh - totalGap - OTHER_ELEMENTS_HEIGHT) / numTiles,
        useAlternateLayout: false,
      }
    }
    return { tileSize: MIN_TILE_SIZE, useAlternateLayout: true }
  }

  return { tileSize: undefined, useAlternateLayout: false }
}

// ---------------------------------------------------------------------------
// Board value helpers
// ---------------------------------------------------------------------------

/** Compute "coins still needed" display string above the board. */
export function coinsNeededLabel(maxScore: number, currentScore: number): string {
  const remaining = maxScore - currentScore
  if (remaining <= 0) return 'You have collected enough coins!'
  return `Collect ${remaining} coin${remaining === 1 ? '' : 's'}${currentScore > 0 ? ' more' : ' in your path'}`
}
