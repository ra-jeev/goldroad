// ---------------------------------------------------------------------------
// Game constants shared between the Nuxt app layer and the Nitro server layer.
// ---------------------------------------------------------------------------

// Board defaults
export const DEFAULT_ROWS = 6
export const DEFAULT_COLS = 6

/**
 * Number of non-open edges to inject per generated puzzle.
 * For a 6x6 grid there are 60 possible edges; blocking 10 (~17%) gives a
 * moderately challenging board comparable to v1's default "2 walls per row".
 */
export const DEFAULT_BLOCKED_EDGES = 10

// Tile coin value range
export const TILE_VALUE_MIN = 1
export const TILE_VALUE_MAX = 6

// ---------------------------------------------------------------------------
// Medals and outcome tiers
// ---------------------------------------------------------------------------

/** First solve attempt thresholds for tries-based medals. */
export const MEDAL_ATTEMPTS = {
  GOLD: 1,
  SILVER: 2,
  BRONZE: 3,
} as const

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

/**
 * Hint tokens per road, per mode, per day. Classic and Expedition each get
 * their own allowance on the day's road.
 *
 * Hints exist to get a stuck player to the finish, not to gate them out of
 * it, so the budget is deliberately generous: on a route that typically runs
 * ~30 tiles, five revealed steps help without handing over the answer. Before
 * this was enforced the button was uncapped, which made repeated taps a
 * full solution reveal.
 */
export const HINTS_PER_ROAD_MODE = 5

/**
 * Score multiplier penalty when a hint is used.
 * e.g. 0.01 -> final score is reduced by 1 %.
 */
export const HINT_SCORE_PENALTY: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.03,
  3: 0.05,
}

