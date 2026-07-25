/**
 * The tries histogram pools every solve at or beyond this attempt count into a
 * single `${SOLVED_ATTEMPTS_UPPER_BOUND}+` bucket — v1's histogram contract.
 *
 * Server aggregation and client rendering must agree on this number: the
 * server writes the pooled key, the client reads it. If the two ever drift the
 * pooled bar silently renders empty rather than erroring, so both sides import
 * from here rather than defaulting independently.
 */
export const SOLVED_ATTEMPTS_UPPER_BOUND = 25;
