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

// UI sizing (pixels) - used by both the board util and CSS
export const TILE_SIZE = 56
export const MIN_TILE_SIZE = 48
export const TILE_GAP = 8

/** Pixel height consumed by toolbar + score row + footer + padding. */
export const OTHER_ELEMENTS_HEIGHT = 52 + 62 + 28 + 2 * 24 + 2 * 16

// ---------------------------------------------------------------------------
// Medals and outcome tiers
// ---------------------------------------------------------------------------

/** First solve attempt thresholds for tries-based medals. */
export const MEDAL_ATTEMPTS = {
  GOLD: 1,
  SILVER: 2,
  BRONZE: 3,
} as const

/**
 * Score-ratio thresholds for tier classification.
 * Gold always requires score === maxScore.
 */
export const TIER_THRESHOLDS = {
  SILVER: 0.92,
  BRONZE: 0.80,
} as const

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

/** Default hint tokens granted per day. */
export const HINTS_PER_DAY_DEFAULT = 2

/** Maximum hint tokens per day (after earning extras via Gold solves). */
export const HINTS_PER_DAY_MAX = 3

/**
 * Score multiplier penalty when a hint is used.
 * e.g. 0.01 -> final score is reduced by 1 %.
 */
export const HINT_SCORE_PENALTY: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.03,
  3: 0.05,
}

/**
 * Using a hint at this level or above locks the Gold tier for that run.
 * (Level 3 = Rescue reveals the exact next step, so Gold is off the table.)
 */
export const HINT_GOLD_LOCK_LEVEL = 3

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/** How many days of past games to keep in the public archive. */
export const PAST_ROADS_LIMIT = 90
