import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3100';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --port 3100',
    url: `${baseURL}/api/games/current`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      CHOKIDAR_USEPOLLING: 'true',
      WATCHPACK_POLLING: 'true',
      WRANGLER_CI_DISABLE_CONFIG_WATCHING: 'true',
      XDG_CONFIG_HOME: '.wrangler/xdg-config',
      XDG_CACHE_HOME: '.wrangler/xdg-cache',
    },
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
