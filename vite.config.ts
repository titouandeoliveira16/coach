import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// L'appli est publiée sur https://titouandeoliveira16.github.io/coach/
// d'où le préfixe "/coach/" pour tous les fichiers.
const BASE = '/coach/'

// Règles de sécurité de la page (CSP, audit du 14/11/2026) : seuls l'appli elle-même et le serveur Supabase sont
// autorisés. Ajoutées seulement à la construction (le serveur de développement a besoin de scripts en ligne).
const SUPABASE = 'vjjuopkiwfyqjolxmnho.supabase.co'
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self' data:", `connect-src 'self' https://${SUPABASE} wss://${SUPABASE}`, "worker-src 'self'",
  "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
].join('; ')
const securite = {
  name: 'csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
}

export default defineConfig({
  base: BASE,
  // Numéro de version affiché dans Réglages
  define: { __VERSION__: JSON.stringify(process.env.npm_package_version) },
  plugins: [
    react(),
    securite,
    tailwindcss(),
    VitePWA({
      // Met à jour l'appli automatiquement dès qu'une nouvelle version est en ligne
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cycle',
        short_name: 'Cycle',
        description: 'Ton plan vélo calculé depuis ta course et ajusté chaque matin à ta récupération. En français, appuyé sur la science.',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout le code et les icônes sont mis en cache : l'appli marche sans réseau
        // Police : seulement le jeu latin (les autres ne servent pas en français)
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/archivo-latin-wdth-*.woff2'],
        // Réception des notifications (rappels)
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
