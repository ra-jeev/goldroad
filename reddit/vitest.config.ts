import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  // Files from the repo root would otherwise pick up the root tsconfig,
  // which extends Nuxt's generated .nuxt config. Use ours for every file.
  tsconfig: 'tools/tsconfig.server.json',
  resolve: {
    alias: {
      '#game': repoRoot,
      // The website's own alias for shared/. Its board parts import through it.
      '#shared': `${repoRoot}shared`,
    },
  },
  test: {
    // Devvit Web uses custom export conditions that the type checker trips on.
    typecheck: { enabled: false },
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
