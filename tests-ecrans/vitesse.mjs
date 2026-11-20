/**
 * Vitesse sur téléphone lent (20/11/2026, demande de Titouan) : première ouverture de l'écran Aujourd'hui avec un
 * processeur 4 fois plus lent et une 4G lente. Au-dessus du seuil, le code de sortie vaut 2 : GitHub ouvre alors un
 * ticket pour prévenir, sans bloquer la mise en ligne. Lancer : npm run build && node tests-ecrans/vitesse.mjs
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)('playwright')
const SEUIL_MS = 5000
const PORT = 4176
const BASE = `http://localhost:${PORT}/coach/`
const serveur = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
for (let i = 0; i < 40; i++) {
  if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break
  await new Promise((r) => setTimeout(r, 500))
}
const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] } : {})
const mesures = []
for (let essai = 0; essai < 3; essai++) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.route(/supabase\.co|intervals\.icu|igpsport/, (r) => r.abort())
  await ctx.addInitScript(() => {
    const id = '00000000-0000-0000-0000-000000000001'
    localStorage.setItem('coach-proprietaire', id)
    localStorage.setItem('sb-vjjuopkiwfyqjolxmnho-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 10, user: { id, email: 'test@example.com', aud: 'authenticated', role: 'authenticated' } }))
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 })
  const t = Date.now()
  await page.goto(`${BASE}#/entrainement/aujourdhui`)
  await page.getByText(/Imprévu/).first().waitFor({ timeout: 30_000 }).catch(() => {})
  mesures.push(Date.now() - t)
  await ctx.close()
}
await navigateur.close()
serveur.kill()
const mediane = mesures.sort((a, b) => a - b)[1]
console.log(`Ouverture sur téléphone lent + 4G lente : ${(mediane / 1000).toFixed(1)} s (essais ${mesures.join(', ')} ms ; seuil ${SEUIL_MS / 1000} s)`)
process.exit(mediane > SEUIL_MS ? 2 : 0)
