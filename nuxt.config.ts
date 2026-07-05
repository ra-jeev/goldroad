// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

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
});
