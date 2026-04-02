/// <reference types="node" />

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver:  'd1-http',
  schema:  './server/db/schema.ts',
  out:     './server/db/migrations',
  dbCredentials: {
    // Used only by drizzle-kit studio / push against a remote D1.
    // For local development, wrangler handles the D1 instance directly.
    accountId:    process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    databaseId:   process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
    token:        process.env.CLOUDFLARE_D1_TOKEN ?? '',
  },
})
