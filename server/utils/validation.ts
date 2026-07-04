/**
 * Shared request payload validation helper.
 *
 * `ZodSchema.parse()` throws a `ZodError`, not an H3 error. Nitro has no
 * global handler that downgrades a bare thrown `ZodError` to a 400 - left
 * uncaught, it surfaces to clients as a bare 500 Server Error, which is
 * indistinguishable from a real server fault. Route handlers should use
 * `parsePayload` instead of calling `schema.parse(body)` directly so malformed
 * client input consistently produces a 400.
 */

import { z } from 'zod';

export function parsePayload<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request payload',
      message: JSON.stringify(result.error.issues),
    });
  }
  return result.data;
}
