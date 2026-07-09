import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['nuxt-auth-utils'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },

  app: {
    head: {
      title: 'RCS — LAN-турниры CS2',
      titleTemplate: 'RCS — LAN-турниры CS2',
      htmlAttrs: { lang: 'ru' },
      meta: [
        { charset: 'utf-8' },
        // viewport-fit=cover — чтобы работали safe-area (чёлка/домашний индикатор);
        // maximum-scale=1 + user-scalable=no — как в нативном приложении (без зума по тапу)
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
        { name: 'description', content: 'Организация и ведение турниров по Counter-Strike 2' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        // Полноэкранный режим при добавлении на домашний экран iPhone
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'RCS' },
        { name: 'theme-color', content: '#0a0b0f' },
      ],
      link: [
        { rel: 'icon', type: 'image/webp', href: '/logo.webp' },
        { rel: 'apple-touch-icon', href: '/logo.webp' },
      ],
    },
  },

  runtimeConfig: {
    // Приватные (только сервер) — читаются из .env
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        sameSite: 'lax',
        // Для LAN/HTTP в dev cookie должна быть без Secure, иначе мобильный браузер её не отправит.
        secure: process.env.NODE_ENV === 'production',
      },
    },
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      siteName: 'RCS',
    },
  },

  routeRules: {
    '/admin/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    },
    '/api/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    },
  },
})
