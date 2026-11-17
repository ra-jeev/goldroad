import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { devvit } from '@devvit/start/vite';

// The game logic lives in the repo root (shared/, lib/, server/utils/) so the
// website, the iOS app and this Reddit app cannot drift apart. `#game` points
// at the repo root; devvit.json lists the same folders in
// additionalSourceRoots so they ship in the review archive.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  // Files from the repo root would otherwise pick up the root tsconfig,
  // which extends Nuxt's generated .nuxt config. Use ours for every file.
  tsconfig: fileURLToPath(new URL('tools/tsconfig.client.json', import.meta.url)),
  resolve: {
    alias: { '#game': repoRoot },
  },
  // The Devvit plugin must stay last.
  plugins: [vue(), devvit()],
});
