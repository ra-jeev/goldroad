import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { devvit } from '@devvit/start/vite';

// The game logic lives in the repo root (shared/, lib/, server/utils/) so the
// website, the iOS app and this Reddit app cannot drift apart. `#game` points
// at the repo root; devvit.json lists the same folders in
// additionalSourceRoots so they ship in the review archive.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// The Vue plugin compiles the website's board components with the repo root
// tsconfig, which points into Nuxt's generated .nuxt folder. A checkout
// without it cannot build, so say how to fix it instead of failing later.
if (!existsSync(`${repoRoot}.nuxt/tsconfig.app.json`)) {
  throw new Error('Run `pnpm install` in the repo root first: it generates .nuxt, which the board components need to build.');
}

export default defineConfig({
  // Files from the repo root would otherwise pick up the root tsconfig,
  // which extends Nuxt's generated .nuxt config. Use ours for every file.
  tsconfig: fileURLToPath(new URL('tools/tsconfig.client.json', import.meta.url)),
  resolve: {
    // Repo-root files import these too. Resolve them from this app only, so
    // the build never mixes in the website's copies (or fails without them).
    dedupe: ['vue', 'zod'],
    alias: {
      '#game': repoRoot,
      // The website's own alias for shared/. Its board parts import through it.
      '#shared': `${repoRoot}shared`,
    },
  },
  build: {
    // Sounds are fetched at run time. Keep each one a real file, because a
    // data: URL may not pass Reddit's content rules for fetch.
    assetsInlineLimit: (file) => (file.endsWith('.mp3') ? false : undefined),
  },
  // The Devvit plugin must stay last.
  plugins: [vue(), devvit()],
});
