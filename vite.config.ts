import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// L'appli est publiée sur https://titouandeoliveira16.github.io/coach/
// d'où le préfixe "/coach/" pour tous les fichiers.
const BASE = '/coach/'

export default defineConfig({
  base: BASE,
  // Numéro de version affiché dans Réglages
  define: { __VERSION__: JSON.stringify(process.env.npm_package_version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Met à jour l'appli automatiquement dès qu'une nouvelle version est en ligne
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Coach',
        short_name: 'Coach',
        description: 'Mon coach personnel : entraînement, nutrition, apprentissage, argent.',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0d10',
        theme_color: '#0b0d10',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout le code et les icônes sont mis en cache : l'appli marche sans réseau
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Réception des notifications (rappels)
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
