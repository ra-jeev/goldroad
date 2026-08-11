import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      // Nuxt supplies this alias for the shared/ directory at build time; the
      // app layer imports through it, so tests have to resolve it too.
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
});
