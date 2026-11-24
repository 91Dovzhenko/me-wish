import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/me-wish/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // регистрация — в src/lib/pwa.ts: новая версия применяется сама (см. docs/tech/sync.md)
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ME:WISH',
        short_name: 'ME:WISH',
        description: 'Списки желаний, где карточка создаётся из ссылки',
        lang: 'ru',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        theme_color: '#f4f4ef',
        background_color: '#f4f4ef',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA: любые адреса внутри /me-wish/ отдаём из index.html
        navigateFallback: `${BASE}index.html`,
        // шрифты: только кириллица и латиница (остальные наборы браузер грузит по необходимости)
        globPatterns: [
          '**/*.{js,css,html,svg,png}',
          'assets/*-{cyrillic,latin}-wght-normal-*.woff2',
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
