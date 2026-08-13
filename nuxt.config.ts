// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  experimental: {
    watcher: 'builder',
  },

  app: {
    head: {
      title: 'GoldRoad – Daily Number Path Puzzle',
      meta: [
        {
          name: 'description',
          content:
            'Play GoldRoad, a free daily number path puzzle. Build a route from Start to Finish and land exactly on the target score.',
        },
        { name: 'theme-color', content: '#0d0702' },
        {
          property: 'og:title',
          content: 'GoldRoad – Daily Number Path Puzzle',
        },
        {
          property: 'og:description',
          content:
            'Play GoldRoad, a free daily number path puzzle. Build a route from Start to Finish and land exactly on the target score.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  nitro: {
    preset: 'cloudflare_module',

    experimental: {
      tasks: true,
    },

    scheduledTasks: {
      '0 0 * * *': 'rotate-road',
    },

    cloudflare: {
      deployConfig: false,
      nodeCompat: true,
    },
  },

  modules: ['nitro-cloudflare-dev', '@vueuse/nuxt', '@nuxt/fonts'],

  /**
   * Two faces, two jobs. Marcellus — Roman inscriptional forms with real
   * lowercase — carries the wordmark and every title. Chivo carries
   * everything else, chosen for its figures: `1` and `8` are the same width,
   * so the board's 36 digits keep an even rhythm and the score never jitters
   * as it climbs. Only weights the app actually sets are downloaded.
   */
  fonts: {
    families: [
      { name: 'Marcellus', provider: 'google', weights: [400], styles: ['normal'] },
      {
        name: 'Chivo',
        provider: 'google',
        weights: [400, 600, 700, 800, 900],
        // Nothing in the app is italic, and Chivo's italics are a separate
        // variable file per subset — 73 KB of the deployed font payload.
        styles: ['normal'],
      },
    ],
  },

  vite: {
    optimizeDeps: {
      include: ['howler'],
    },
  },

  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://playgoldroad.com',
    },
  },

  routeRules: {
    '/': { headers: { 'cache-control': 'no-cache' } },
    '/about': { headers: { 'cache-control': 'no-cache' } },
    '/games': { headers: { 'cache-control': 'no-cache' } },
    '/games/**': { headers: { 'cache-control': 'no-cache' } },
    '/stats': { headers: { 'cache-control': 'no-cache' } },
    '/sign-in': { redirect: { to: '/about', statusCode: 301 } },
  },
});
