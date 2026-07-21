// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      title: 'GoldRoad',
      meta: [
        {
          name: 'description',
          content:
            'A daily route puzzle. Build a path from the start tile to the exit tile and land exactly on the target score.',
        },
        { name: 'theme-color', content: '#0d0702' },
        { property: 'og:title', content: 'GoldRoad' },
        {
          property: 'og:description',
          content:
            'A daily route puzzle. Build a path from the start tile to the exit tile and land exactly on the target score.',
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
      deployConfig: true,
      nodeCompat: true,
    },
  },

  modules: ['nitro-cloudflare-dev', '@vueuse/nuxt'],

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
    '/sign-in': { redirect: { to: '/about', statusCode: 301 } },
  },
});
