/**
 * Frontend-only board utilities.
 *
 * These depend on browser APIs (window.innerWidth / innerHeight) or produce
 * Vue-specific runtime tile state, so they live in app/utils rather than
 * shared/utils.
 */

import type { Board } from '#shared/types/game'
import type { TileState } from '../types/game'

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

