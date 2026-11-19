/**
 * Tests d'écrans des parcours principaux (audit du 18/11/2026) : l'appli construite (dist/) est ouverte en taille
 * iPhone, en mode local (fausse session, réseau vers Supabase / Intervals / iGPSPORT coupé), et chaque écran doit
 * s'afficher sans erreur de page, sans débordement de la largeur, avec son titre ou son bouton clé.
 * Lancer : npm run build && npm run test:ecrans (Playwright doit être installé : localement il l'est, en CI le workflow
 * l'installe).
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

// require (et non import) : suit NODE_PATH, pour un Playwright installé hors du projet
const { chromium } = createRequire(import.meta.url)('playwright')

const PORT = 4174
const BASE = `http://localhost:${PORT}/coach/`
const serveur = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const fin = (code) => { serveur.kill(); process.exit(code) }
for (let i = 0; i < 40; i++) {
  if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break
  await new Promise((r) => setTimeout(r, 500))
}

const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } })
await ctx.route(/supabase\.co|intervals\.icu|igpsport/, (r) => r.abort())
await ctx.addInitScript(() => {
  if (localStorage.getItem('coach-proprietaire')) return
  const id = '00000000-0000-0000-0000-000000000001'
  localStorage.setItem('coach-proprietaire', id)
  const t = Math.floor(Date.now() / 1000)
  localStorage.setItem('sb-vjjuopkiwfyqjolxmnho-auth-token', JSON.stringify({
    access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: t - 10,
    user: { id, email: 'test@example.com', aud: 'authenticated', role: 'authenticated' },
  }))
})
const page = await ctx.newPage()
const erreurs = []
let ecran = ''
page.on('pageerror', (e) => erreurs.push(`${ecran} : ${e.message}`))

/** [adresse, texte attendu à l'écran, action facultative] */
const PARCOURS = [
  ['#/', /Entraînement/],
  ['#/entrainement/aujourdhui', /Imprévu/],
  ['#/entrainement/aujourdhui', /Je ne peux pas rouler/, async () => page.getByRole('button', { name: /Imprévu/ }).first().click()],
  ['#/entrainement/semaine', /Sem/],
  ['#/entrainement/saison', /./],
  ['#/entrainement/progres', /./],
  ['#/entrainement/reglages', /Mode d'emploi/],
  ['#/entrainement/aide', /L'idée en 30 secondes/],
  ['#/budget', /./, async () => { const b = page.getByText("C'est parti"); if (await b.count()) await b.click() }],
  ['#/budget/mois', /./],
  ['#/budget/mois', /Courses/, async () => page.getByRole('button', { name: 'Nouveau mouvement' }).click()],
  ['#/budget/reglages', /Catégories de dépenses/],
  ['#/revision', /./],
  ['#/revision/sujets', /./],
  ['#/reglages', /Compte/],
]

let echecs = 0
for (const [adresse, attendu, action] of PARCOURS) {
  ecran = adresse
  await page.goto(BASE + adresse)
  await page.waitForTimeout(1200)
  if (action) { await action().catch((e) => erreurs.push(`${adresse} : action impossible (${e.message.split('\n')[0]})`)); await page.waitForTimeout(800) }
  const texte = await page.innerText('body')
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  const ok = attendu.test(texte) && !deborde
  if (!ok) echecs++
  console.log(`${ok ? '✓' : '✗'} ${adresse}${action ? ' (action)' : ''}${!attendu.test(texte) ? ` : « ${attendu.source} » absent` : ''}${deborde ? ' : déborde en largeur' : ''}`)
}
await navigateur.close()
if (erreurs.length) console.log(`Erreurs de page :\n${erreurs.join('\n')}`)
fin(echecs || erreurs.length ? 1 : 0)
