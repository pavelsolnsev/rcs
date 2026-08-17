import tailwindcss from '@tailwindcss/vite'

/**
 * Экраны iPhone для iOS-splash: [имя файла, CSS-ширина, CSS-высота, dpr].
 * Список синхронизирован со scripts/generate-splash.mjs — скрипт печатает
 * готовые media-запросы, если добавляешь новую модель.
 */
const SPLASH_SCREENS: [string, number, number, number][] = [
  ['iphone-se', 320, 568, 2],
  ['iphone-8', 375, 667, 2],
  ['iphone-8plus', 414, 736, 3],
  ['iphone-x', 375, 812, 3],
  ['iphone-xr', 414, 896, 2],
  ['iphone-xs-max', 414, 896, 3],
  ['iphone-12-mini', 360, 780, 3],
  ['iphone-12', 390, 844, 3],
  ['iphone-12-pro-max', 428, 926, 3],
  ['iphone-14-pro', 393, 852, 3],
  ['iphone-14-pro-max', 430, 932, 3],
  ['iphone-16-pro', 402, 874, 3],
  ['iphone-16-pro-max', 440, 956, 3],
]

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

        // Splash-экраны для iOS (логотип РКС на тёмном фоне) — иначе при запуске
        // с домашнего экрана вместо них белое полотно. iOS сам выбирает файл по
        // media-запросу и показывает его ДО загрузки WebView.
        // Картинки генерирует scripts/generate-splash.mjs (npm run splash:generate).
        ...SPLASH_SCREENS.map(([name, cssW, cssH, dpr]) => ({
          rel: 'apple-touch-startup-image',
          href: `/splash/${name}.png`,
          media: `(device-width:${cssW}px) and (device-height:${cssH}px) and (-webkit-device-pixel-ratio:${dpr})`,
        })),
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
      // Без maxAge h3 не ставит Expires, и кук становится сессионным — браузер
      // удаляет его при закрытии, из-за чего админ каждый раз вылетал.
      // Год: заходим в админку один раз и остаёмся в ней. Отсчёт идёт от входа,
      // продлить его на лету нельзя — h3 считает срок от createdAt сессии.
      maxAge: 60 * 60 * 24 * 365,
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
