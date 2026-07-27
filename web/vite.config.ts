import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Marci időmérő',
        short_name: 'Marci',
        description: 'Marci napi időtöltéseinek rögzítése',
        lang: 'hu',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0e1014',
        theme_color: '#4a56c4',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Az API-t SOHA nem cache-eljük: a szinkron mindig friss adatot kér,
        // a lokális igazságtár az IndexedDB.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    // Fejlesztéskor két origin van, élesben egy — ezt a proxy hidalja át,
    // NEM CORS-fejlécek. Így a fejlesztői és az éles környezet azonos
    // origin-modellt lát. Lásd wiki/workflows/fejlesztoi-kornyezet.md.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: { target: 'es2022', sourcemap: true },
});
