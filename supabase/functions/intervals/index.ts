// Fonction serveur Supabase « intervals » (Deno).
// Garde la clé API Intervals.icu chiffrée côté serveur et relaie les données vers l'appli.
//
// Routes (toutes en POST, utilisateur Coach connecté) :
//   /intervals/cle          { cle, athlete? } → vérifie la clé auprès d'Intervals puis l'enregistre (chiffrée)
//   /intervals/etat         → { connecte, athlete }
//   /intervals/deconnexion  → efface la clé
//   /intervals/activites    { oldest } → liste des activités depuis cette date (sans flux)
//   /intervals/flux         { ids } → flux temps / FC / puissance / vitesse (jamais de GPS), 10 activités max
//   /intervals/wellness     { oldest } → VFC, FC de repos, sommeil, poids par jour
//   /intervals/planifier    { id?, date, nom, description, dureeSec, indoor } → crée (ou met à jour) une séance prévue
//                           dans le calendrier Intervals ; Intervals l'envoie ensuite à Garmin, et à Zwift si « indoor »
//   /intervals/retirer      { id } → supprime cette séance prévue du calendrier Intervals
//
// Aucun secret à ajouter : la clé de chiffrement est dérivée de la clé « service role » du projet.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const API = 'https://intervals.icu/api/v1'
const MAX_FLUX = 10

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Chiffrement AES-GCM de la clé API ----------

const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o))
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
let cle: CryptoKey | undefined
async function cleChiffrement() {
  if (!cle) {
    const brute = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`coach-intervals|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)),
    )
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

// ---------- Appels Intervals.icu ----------

const entete = (cleApi: string) => ({ Authorization: `Basic ${btoa(`API_KEY:${cleApi}`)}` })

async function intervals(chemin: string, cleApi: string) {
  const r = await fetch(`${API}${chemin}`, { headers: entete(cleApi) })
  if (r.status === 401 || r.status === 403) throw new Error('CLE')
  if (r.status === 429) throw new Error('LIMITE')
  if (!r.ok) throw new Error(`Intervals.icu ${r.status}`)
  return r.json()
}

/** Écriture dans Intervals.icu (calendrier). */
async function intervalsEcrire(chemin: string, cleApi: string, methode: 'POST' | 'PUT' | 'DELETE', corps?: unknown) {
  const r = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: { ...entete(cleApi), 'Content-Type': 'application/json' },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  if (r.status === 401 || r.status === 403) throw new Error('CLE')
  if (r.status === 429) throw new Error('LIMITE')
  if (!r.ok) throw new Error(`Intervals.icu ${r.status} : ${(await r.text()).slice(0, 200)}`)
  return r.status === 204 ? {} : r.json().catch(() => ({}))
}

async function compte(userId: string) {
  const { data } = await admin.from('intervals_cles').select('*').eq('user_id', userId).maybeSingle()
  return data ? { athlete: data.athlete_id as string, cle: await dechiffrer(data.cle_chiffre) } : null
}

const SPORTS = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'Run', 'TrailRun', 'VirtualRun',
  // Renfo : remonte pour cocher la séance prévue et compter dans les calories (pas dans la charge)
  'WeightTraining', 'Workout', 'Crossfit', 'Pilates', 'Yoga',
  // Autres activités (foot, sports de raquette…) : comptées dans les calories seulement, jamais dans l'entraînement.
  // Pas la marche ni la randonnée : déjà comprises dans la vie quotidienne (métabolisme × 1,4).
  'Soccer', 'Football', 'Basketball', 'Handball', 'Rugby', 'Volleyball', 'Hockey', 'Tennis', 'Padel', 'Badminton',
  'Squash', 'TableTennis', 'Pickleball', 'RockClimbing'])
const aujourdhui = () => new Date().toISOString().slice(0, 10)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()

  try {
    const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
    const user = data.user
    if (!user) return json({ erreur: 'Connecte-toi à ton compte Coach.' }, 401)
    const corps = await req.json().catch(() => ({}))

    if (route === 'cle') {
      const cleApi = String(corps.cle ?? '').trim()
      if (!cleApi) return json({ erreur: 'Clé manquante.' }, 400)
      // « 0 » = l'athlète propriétaire de la clé
      const profil = await intervals(`/athlete/${corps.athlete || '0'}`, cleApi)
      const { error } = await admin.from('intervals_cles').upsert({
        user_id: user.id, athlete_id: String(profil.id), cle_chiffre: await chiffrer(cleApi), maj_le: new Date().toISOString(),
      })
      if (error) throw error
      return json({ connecte: true, athlete: profil.id, nom: profil.name })
    }

    if (route === 'etat') {
      const { data: ligne } = await admin.from('intervals_cles').select('athlete_id').eq('user_id', user.id).maybeSingle()
      return json({ connecte: !!ligne, athlete: ligne?.athlete_id ?? null })
    }

    if (route === 'deconnexion') {
      await admin.from('intervals_cles').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    const c = await compte(user.id)
    if (!c) return json({ erreur: 'Intervals.icu n’est pas relié.' }, 409)

    if (route === 'activites') {
      const liste = (await intervals(`/athlete/${c.athlete}/activities?oldest=${corps.oldest}&newest=${aujourdhui()}`, c.cle)) as Record<string, unknown>[]
      const viaStrava = liste.filter((a) => a.source === 'STRAVA').length
      const activites = liste
        .filter((a) => a.source !== 'STRAVA' && SPORTS.has(String(a.type)))
        .map((a) => ({
          id: String(a.id), nom: a.name, type: a.type, start_date: a.start_date ?? a.start_date_local,
          moving_time: a.moving_time, distance: a.distance, total_elevation_gain: a.total_elevation_gain, trainer: a.trainer,
          average_heartrate: a.average_heartrate, max_heartrate: a.max_heartrate, average_watts: a.icu_average_watts,
          joules: a.icu_joules, average_cadence: a.average_cadence,
        }))
      return json({ activites, viaStrava })
    }

    if (route === 'flux') {
      const ids = (corps.ids as string[] ?? []).slice(0, MAX_FLUX)
      const flux: Record<string, Record<string, unknown[]>> = {}
      for (const id of ids) {
        const series = (await intervals(`/activity/${id}/streams.json?types=time,heartrate,watts,velocity_smooth`, c.cle).catch(() => [])) as { type: string; data: unknown[] }[]
        flux[id] = Object.fromEntries(series.map((s) => [s.type, s.data]))
      }
      return json({ flux })
    }

    if (route === 'wellness') {
      const jours = (await intervals(`/athlete/${c.athlete}/wellness?oldest=${corps.oldest}&newest=${aujourdhui()}`, c.cle)) as Record<string, unknown>[]
      return json({
        jours: jours.map((j) => ({ date: j.id, hrv: j.hrv, restingHR: j.restingHR, sleepSecs: j.sleepSecs, weight: j.weight, steps: j.steps })),
      })
    }

    if (route === 'planifier') {
      // Séance structurée (texte au format du « workout builder » d'Intervals), sans ERG côté Zwift
      const evenement = {
        category: 'WORKOUT', type: 'Ride', start_date_local: `${corps.date}T00:00:00`, name: corps.nom,
        description: corps.description, moving_time: corps.dureeSec, indoor: !!corps.indoor,
      }
      const e = (corps.id
        ? await intervalsEcrire(`/athlete/${c.athlete}/events/${corps.id}`, c.cle, 'PUT', evenement)
        : await intervalsEcrire(`/athlete/${c.athlete}/events`, c.cle, 'POST', evenement)) as { id?: number | string }
      return json({ id: e.id !== undefined ? String(e.id) : corps.id })
    }

    if (route === 'retirer') {
      await intervalsEcrire(`/athlete/${c.athlete}/events/${corps.id}`, c.cle, 'DELETE')
      return json({ ok: true })
    }

    return json({ erreur: 'Route inconnue' }, 404)
  } catch (e) {
    const m = (e as Error).message
    if (m === 'CLE') return json({ erreur: 'Clé Intervals.icu refusée : vérifie-la (Settings → Developer Settings).' }, 400)
    if (m === 'LIMITE') return json({ erreur: 'Trop de requêtes vers Intervals.icu : réessaie dans quelques minutes.' }, 429)
    return json({ erreur: m }, 500)
  }
})
