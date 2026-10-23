// Fonction serveur Supabase « strava » (Deno).
// Garde le secret Strava côté serveur, gère la connexion OAuth et relaie les activités.
//
// Routes :
//   POST /strava/debut        → URL d'autorisation Strava (utilisateur connecté)
//   GET  /strava/retour       → retour de Strava après autorisation (échange du code)
//   POST /strava/etat         → { connecte, athlete }
//   POST /strava/activites    → activités après une date + leurs flux (sans GPS)
//   POST /strava/deconnexion  → révoque l'accès et efface les jetons
//
// Secrets à définir (Supabase → Edge Functions → Secrets) : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
// Facultatifs : APP_URL ; STRAVA_CLE_CHIFFREMENT (32 octets en base64), sinon la clé est dérivée
// de la clé « service role » du projet, secrète et fournie automatiquement par Supabase.
// « Verify JWT » doit être DÉSACTIVÉ pour cette fonction (Strava appelle /retour sans jeton) :
// la vérification est faite ici, route par route.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://titouandeoliveira16.github.io/coach/'
const RETOUR = `${SUPABASE_URL}/functions/v1/strava/retour`

/** Activités prises en compte (le reste est ignoré). */
const TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'Run', 'TrailRun', 'VirtualRun'])
/** Nombre maximal d'activités détaillées par appel (2 requêtes Strava chacune au plus). */
const MAX_PAR_APPEL = 15

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Chiffrement AES-GCM des jetons ----------

const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o))
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
let cle: CryptoKey | undefined
async function cleChiffrement() {
  if (!cle) {
    const fournie = Deno.env.get('STRAVA_CLE_CHIFFREMENT')
    const brute = fournie
      ? deB64(fournie)
      : new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`coach-strava|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)))
    cle = await crypto.subtle.importKey('raw', brute, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return cle
}
async function chiffrer(texte: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleChiffrement(), new TextEncoder().encode(texte)))
  return `${b64(iv)}.${b64(ct)}`
}
async function dechiffrer(valeur: string) {
  const [iv, ct] = valeur.split('.').map(deB64)
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cleChiffrement(), ct))
}

// ---------- Utilisateur et jetons ----------

async function utilisateur(req: Request) {
  const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jeton) return null
  const { data } = await admin.auth.getUser(jeton)
  return data.user
}

async function enregistrerJetons(userId: string, t: { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number } }) {
  const ligne: Record<string, unknown> = {
    user_id: userId,
    access_chiffre: await chiffrer(t.access_token),
    refresh_chiffre: await chiffrer(t.refresh_token),
    expire_le: t.expires_at,
    maj_le: new Date().toISOString(),
  }
  if (t.athlete) ligne.athlete_id = t.athlete.id
  const { error } = await admin.from('strava_jetons').upsert(ligne)
  if (error) throw error
}

/** Jeton d'accès valide (rafraîchi si nécessaire). */
async function jetonAcces(userId: string) {
  const { data } = await admin.from('strava_jetons').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return null
  if (data.expire_le > Date.now() / 1000 + 120) return dechiffrer(data.access_chiffre)
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: await dechiffrer(data.refresh_chiffre) }),
  })
  if (!r.ok) return null
  const t = await r.json()
  await enregistrerJetons(userId, t)
  return t.access_token as string
}

async function strava(chemin: string, jeton: string) {
  const r = await fetch(`https://www.strava.com/api/v3${chemin}`, { headers: { Authorization: `Bearer ${jeton}` } })
  if (r.status === 429) throw new Error('LIMITE')
  if (!r.ok) throw new Error(`Strava ${r.status}`)
  return r.json()
}

// ---------- Routes ----------

function pageHtml(titre: string, texte: string) {
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre}</title><body style="background:#0b0d10;color:#f2f4f7;font-family:-apple-system,sans-serif;padding:32px;text-align:center">
<h1>${titre}</h1><p style="color:#a3abb7">${texte}</p>
<p><a href="${APP_URL}" style="color:#ff8a3d;font-weight:bold">Retourner dans Coach</a></p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()

  try {
    // Retour de Strava : pas de jeton Supabase, on s'appuie sur l'« état » créé à /debut
    if (route === 'retour') {
      const p = new URL(req.url).searchParams
      const etat = p.get('state')
      if (p.get('error') || !p.get('code') || !etat) return pageHtml('Connexion annulée', "Strava n'a pas donné l'autorisation.")
      if (!(p.get('scope') ?? '').includes('activity:read_all'))
        return pageHtml('Autorisation incomplète', 'Coche bien « Voir les données de vos activités privées » et recommence.')
      const { data: ligne } = await admin.from('strava_etats').delete().eq('etat', etat).select().maybeSingle()
      if (!ligne || Date.now() - new Date(ligne.cree_le).getTime() > 15 * 60_000) return pageHtml('Lien expiré', 'Recommence depuis l’appli.')
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: p.get('code'), grant_type: 'authorization_code' }),
      })
      if (!r.ok) return pageHtml('Erreur', `Strava a refusé l'échange (${r.status}).`)
      await enregistrerJetons(ligne.user_id, await r.json())
      return pageHtml('✓ Strava connecté', 'Retourne dans l’appli Coach : tes activités vont arriver.')
    }

    const user = await utilisateur(req)
    if (!user) return json({ erreur: 'Non connecté' }, 401)

    if (route === 'debut') {
      const etat = crypto.randomUUID()
      await admin.from('strava_etats').insert({ etat, user_id: user.id })
      const url = new URL('https://www.strava.com/oauth/authorize')
      url.search = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: RETOUR, approval_prompt: 'auto', scope: 'activity:read_all', state: etat }).toString()
      return json({ url: url.toString() })
    }

    if (route === 'etat') {
      const { data } = await admin.from('strava_jetons').select('athlete_id').eq('user_id', user.id).maybeSingle()
      return json({ connecte: !!data, athlete: data?.athlete_id ?? null })
    }

    if (route === 'deconnexion') {
      const jeton = await jetonAcces(user.id)
      if (jeton) await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${jeton}` } })
      await admin.from('strava_jetons').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    if (route === 'activites') {
      const { apres = 0 } = await req.json().catch(() => ({}))
      const jeton = await jetonAcces(user.id)
      if (!jeton) return json({ erreur: 'Strava non connecté' }, 409)
      // Les plus anciennes d'abord : l'appli reprend ensuite après la dernière reçue
      const liste = (await strava(`/athlete/activities?after=${Math.floor(apres)}&per_page=50`, jeton)) as Record<string, unknown>[]
      liste.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
      const lot = liste.slice(0, MAX_PAR_APPEL)
      const activites = []
      for (const a of lot) {
        if (!TYPES.has(String(a.sport_type ?? a.type))) {
          activites.push({ id: a.id, ignoree: true, start_date: a.start_date })
          continue
        }
        // Flux SANS coordonnées GPS (latlng non demandé)
        const flux = await strava(`/activities/${a.id}/streams?keys=time,heartrate,watts,velocity_smooth&key_by_type=true`, jeton).catch(() => ({}))
        activites.push({
          id: a.id, nom: a.name, type: a.sport_type ?? a.type, start_date: a.start_date,
          moving_time: a.moving_time, distance: a.distance, total_elevation_gain: a.total_elevation_gain, trainer: a.trainer,
          average_heartrate: a.average_heartrate, max_heartrate: a.max_heartrate, average_watts: a.average_watts,
          device_watts: a.device_watts, kilojoules: a.kilojoules,
          flux: Object.fromEntries(Object.entries(flux as Record<string, { data: unknown[] }>).map(([k, v]) => [k, v.data])),
        })
      }
      return json({ activites, suite: liste.length > MAX_PAR_APPEL || liste.length === 50 })
    }

    return json({ erreur: 'Route inconnue' }, 404)
  } catch (e) {
    const limite = (e as Error).message === 'LIMITE'
    return json({ erreur: limite ? 'Limite Strava atteinte : réessaie dans 15 minutes.' : String(e) }, limite ? 429 : 500)
  }
})
