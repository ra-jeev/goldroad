// ---------------------------------------------------------------------------
// Game constants shared between the Nuxt app layer and the Nitro server layer.
// ---------------------------------------------------------------------------

// Board defaults
export const DEFAULT_ROWS = 6
export const DEFAULT_COLS = 6

/**
 * Band of non-open edges injected per generated puzzle; each board draws a
 * count from it at generation time so days do not all feel identical.
 *
 * For a 6x6 grid there are 60 possible edges, so this blocks 13-18%, around
 * v1's default "2 walls per row". Fewer blocked edges leaves a more open
 * graph, which is the harder board to solve — and the far more expensive one
 * to generate, since the generator enumerates every simple route. Measured
 * per expedition board: 11 blocked averages 0.1s, 9 averages 1.0s, and 8
 * averages 3.0s with an 18s worst case seen.
 *
 * That fits: generation only runs in the rotate-road cron, and a Cron Trigger
 * on an interval of an hour or more gets 15 minutes of CPU on Workers Paid,
 * for two boards a day. Memory is the tighter limit at 128 MB per isolate,
 * and it is not close either — the route enumerator's BFS queue peaks around
 * 35k jobs (~25 MB) even at 8 blocked. Going below 8 is a route-enumeration
 * question, not a limits one.
 */
export const MIN_BLOCKED_EDGES = 8
export const MAX_BLOCKED_EDGES = 11

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

