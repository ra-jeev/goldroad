/**
 * Drizzle database client factory for Cloudflare Workers + D1.
 *
 * Usage inside a Nitro route handler:
 *
 *   const db = useDb(event)
 *   const game = await db.select().from(games).where(eq(games.current, true)).get()
 */

import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function useDb(event: Parameters<typeof useD1>[0]) {
  const d1 = useD1(event)
  return drizzle(d1, { schema })
}

/**
 * Resolve the D1 binding from the Nitro/Cloudflare event context.
 * The binding name 'DB' matches wrangler.jsonc and the generated env types.
 */
function useD1(event: { context: { cloudflare?: { env?: { DB?: D1Database } } } }) {
  const db = event.context?.cloudflare?.env?.DB
  if (!db) throw new Error('D1 binding "DB" not found. Check wrangler.jsonc and cf-typegen.')
  return db
}
