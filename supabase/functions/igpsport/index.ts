// Fonction serveur Supabase « igpsport » (Deno), 16/11/2026.
// iGPSPORT n'a pas de lien officiel avec Intervals.icu : cette fonction se connecte à ton compte iGPSPORT (accès non
// officiel, le même que l'appli web d'iGPSPORT, repéré par l'outil libre « intervalssync »), récupère les fichiers .fit
// de tes sorties et les envoie dans ton Intervals.icu. Cycle les importe ensuite comme les autres.
// iGPSPORT peut changer cet accès sans prévenir : en cas d'erreur, l'état du lien l'affiche dans l'appli.
//
// Routes (POST) :
//   /igpsport/relier   { identifiant, motDePasse } → vérifie la connexion, garde le mot de passe chiffré, 1re synchro
//   /igpsport/etat     → { relie, identifiant, derniereSynchro, importees, reste, erreur }
//   /igpsport/synchro  → récupère tout de suite les nouvelles sorties (et la suite de l'historique)
//   /igpsport/delier   → efface le lien (les sorties déjà envoyées restent dans Intervals)
//   /igpsport/cron     → tâche planifiée (en-tête secret « x-coach-cron », sql/09) : tous les comptes reliés
//
// Aucun secret à ajouter : la clé de chiffrement est dérivée de la clé « service role » du projet.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const IGP = 'https://prod.en.igpsport.com/service'
const ICU = 'https://intervals.icu/api/v1'
/** Sorties envoyées au plus par compte et par passage (l'historique se remplit au fil des passages) */
const LOT = 12
/** Pages de 20 sorties lues au plus pour trouver celles qui manquent (800 sorties) */
const PAGES_MAX = 40

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Chiffrement AES-GCM (mot de passe iGPSPORT ; clé Intervals déjà chiffrée par la fonction « intervals ») ----------
const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o))
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const cles = new Map<string, CryptoKey>()
async function cleDe(etiquette: string) {
  if (!cles.has(etiquette)) {
    const brute = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${etiquette}|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)))
    cles.set(etiquette, await crypto.subtle.importKey('raw', brute, 'AES-GCM', false, ['encrypt', 'decrypt']))
  }
  return cles.get(etiquette)!
}
async function chiffrer(texte: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleDe('coach-igpsport'), new TextEncoder().encode(texte)))
  return `${b64(iv)}.${b64(ct)}`
}
async function dechiffrer(valeur: string, etiquette = 'coach-igpsport') {
  const [iv, ct] = valeur.split('.').map(deB64)
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cleDe(etiquette), ct))
}

// ---------- iGPSPORT ----------
const delai = (ms: number) => AbortSignal.timeout(ms)

class RefusIgp extends Error {}

async function connexionIgp(identifiant: string, motDePasse: string) {
  const r = await fetch(`${IGP}/auth/account/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en' }, signal: delai(20_000),
    body: JSON.stringify({ appId: 'igpsport-web', username: identifiant, password: motDePasse }),
  })
  const corps = await r.json().catch(() => ({}))
  const jeton = corps?.data?.access_token
  if (!jeton) throw new RefusIgp('iGPSPORT refuse la connexion : vérifie ton email et ton mot de passe iGPSPORT.')
  return { Authorization: `Bearer ${jeton}`, 'Accept-Language': 'en' }
}

interface Sortie { rideId: number; titre: string }

/** Toutes les sorties (plus récentes d'abord), jusqu'à PAGES_MAX pages. */
async function sortiesIgp(entetes: Record<string, string>) {
  const liste: Sortie[] = []
  for (let page = 1; page <= PAGES_MAX; page++) {
    const r = await fetch(`${IGP}/web-gateway/web-analyze/activity/queryMyActivity?pageNo=${page}&pageSize=20&sort=1&reqType=0`, { headers: entetes, signal: delai(20_000) })
    if (!r.ok) throw new Error(`iGPSPORT ${r.status} (liste des sorties)`)
    const rows = ((await r.json())?.data?.rows ?? []) as Record<string, unknown>[]
    for (const x of rows) {
      const id = Number(x.rideId ?? x.RideId)
      if (Number.isFinite(id) && id > 0) liste.push({ rideId: id, titre: String(x.title ?? x.Title ?? 'Sortie iGPSPORT').slice(0, 120) })
    }
    if (rows.length < 20) break
  }
  return liste
}

async function fichierFit(entetes: Record<string, string>, rideId: number) {
  let url: string | undefined
  const d = await fetch(`${IGP}/web-gateway/web-analyze/activity/queryActivityDetail/${rideId}`, { headers: entetes, signal: delai(20_000) })
  if (d.ok) url = (await d.json().catch(() => ({})))?.data?.fitUrl
  if (!url) {
    const f = await fetch(`${IGP}/web-gateway/web-analyze/activity/getDownloadUrl/${rideId}`, { headers: entetes, signal: delai(20_000) })
    if (f.ok) url = (await f.json().catch(() => ({})))?.data
  }
  if (!url || typeof url !== 'string' || !/^https:\/\//.test(url)) return undefined
  const r = await fetch(url, { signal: delai(30_000) })
  if (!r.ok) return undefined
  const octets = new Uint8Array(await r.arrayBuffer())
  // Un .fit commence par un en-tête de 12 ou 14 octets contenant « .FIT » aux octets 8-11
  return octets.length > 14 && String.fromCharCode(...octets.slice(8, 12)) === '.FIT' ? octets : undefined
}

// ---------- Intervals.icu ----------
async function cleIntervals(userId: string) {
  const { data } = await admin.from('intervals_cles').select('cle_chiffre').eq('user_id', userId).maybeSingle()
  return data ? await dechiffrer(data.cle_chiffre, 'coach-intervals') : undefined
}

/** Envoie le .fit dans Intervals.icu ; external_id évite les doublons. Renvoie l'id de l'activité (ou undefined). */
async function envoyerIntervals(cleApi: string, s: Sortie, fit: Uint8Array<ArrayBuffer>) {
  const form = new FormData()
  form.append('file', new Blob([fit], { type: 'application/octet-stream' }), `igpsport_${s.rideId}.fit`)
  const r = await fetch(`${ICU}/athlete/0/activities?name=${encodeURIComponent(s.titre)}&external_id=igpsport_${s.rideId}`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`API_KEY:${cleApi}`)}` }, body: form, signal: delai(60_000),
  })
  if (r.status === 401 || r.status === 403) throw new Error('Clé Intervals.icu refusée : relie à nouveau Intervals dans Réglages.')
  if (!r.ok) throw new Error(`Intervals.icu ${r.status} à l'envoi d'une sortie`)
  const corps = await r.json().catch(() => ({}))
  return String(corps?.activities?.[0]?.id ?? corps?.id ?? 'envoyee')
}

// ---------- Synchro d'un compte ----------
async function synchroniser(userId: string, finAvant: number) {
  const { data: compte } = await admin.from('igpsport_comptes').select('*').eq('user_id', userId).maybeSingle()
  if (!compte) return { envoyees: 0, reste: 0 }
  const maj = (champs: Record<string, unknown>) => admin.from('igpsport_comptes').update({ derniere_synchro: new Date().toISOString(), ...champs }).eq('user_id', userId)
  try {
    const cleApi = await cleIntervals(userId)
    if (!cleApi) {
      await maj({ erreur: 'Relie d’abord Intervals.icu (Réglages) : les sorties iGPSPORT y sont envoyées.' })
      return { envoyees: 0, reste: compte.reste ?? 0 }
    }
    const entetes = await connexionIgp(compte.identifiant, await dechiffrer(compte.mdp_chiffre))
    const toutes = await sortiesIgp(entetes)
    const { data: faits } = await admin.from('igpsport_faits').select('ride_id').eq('user_id', userId)
    const deja = new Set((faits ?? []).map((f: { ride_id: number }) => Number(f.ride_id)))
    const manquantes = toutes.filter((s) => !deja.has(s.rideId))
    let envoyees = 0
    for (const s of manquantes.slice(0, LOT)) {
      if (Date.now() > finAvant) break
      const fit = await fichierFit(entetes, s.rideId)
      // Sans fichier lisible (sortie vide, sans GPS ni capteur) : notée comme traitée pour ne pas la redemander sans fin
      const intervalsId = fit ? await envoyerIntervals(cleApi, s, fit) : 'sans-fichier'
      await admin.from('igpsport_faits').upsert({ user_id: userId, ride_id: s.rideId, intervals_id: intervalsId })
      if (fit) envoyees++
    }
    const reste = Math.max(0, manquantes.length - envoyees)
    await maj({ erreur: null, importees: (compte.importees ?? 0) + envoyees, reste })
    return { envoyees, reste }
  } catch (e) {
    const message = e instanceof RefusIgp ? e.message : `Synchro iGPSPORT interrompue : ${(e as Error).message}`.slice(0, 300)
    console.error('igpsport', userId, (e as Error).message)
    await maj({ erreur: message })
    return { envoyees: 0, reste: compte.reste ?? 0, erreur: message }
  }
}

/** Secret partagé avec la tâche pg_cron (table secret_cron, sql/06), comparé à durée constante. */
async function appelDuCron(req: Request) {
  const recu = req.headers.get('x-coach-cron')
  if (!recu) return false
  const { data } = await admin.from('secret_cron').select('valeur').eq('id', 1).maybeSingle()
  if (!data?.valeur) return false
  const x = new TextEncoder().encode(String(data.valeur)), y = new TextEncoder().encode(recu)
  let diff = x.length ^ y.length
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ (y[i % (y.length || 1)] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()
  const debut = Date.now()
  try {
    if (route === 'cron') {
      if (!(await appelDuCron(req))) return json({ erreur: 'Réservé à la tâche planifiée.' }, 401)
      const { data: comptes } = await admin.from('igpsport_comptes').select('user_id').order('derniere_synchro', { ascending: true, nullsFirst: true })
      let envoyees = 0
      for (const c of comptes ?? []) {
        if (Date.now() - debut > 90_000) break
        envoyees += (await synchroniser(c.user_id, debut + 100_000)).envoyees
      }
      return json({ comptes: comptes?.length ?? 0, envoyees })
    }

    const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
    const user = data.user
    if (!user) return json({ erreur: 'Connecte-toi à ton compte Cycle.' }, 401)
    const corps = await req.json().catch(() => ({}))

    if (route === 'relier') {
      const identifiant = String(corps.identifiant ?? '').trim().slice(0, 120)
      const motDePasse = String(corps.motDePasse ?? '').slice(0, 200)
      if (!identifiant || !motDePasse) return json({ erreur: 'Email et mot de passe iGPSPORT nécessaires.' }, 400)
      if (!(await cleIntervals(user.id))) return json({ erreur: 'Relie d’abord Intervals.icu : tes sorties iGPSPORT y seront envoyées.' }, 409)
      try {
        await connexionIgp(identifiant, motDePasse)
      } catch (e) {
        return json({ erreur: e instanceof RefusIgp ? e.message : 'iGPSPORT ne répond pas : réessaie dans un moment.' }, 400)
      }
      const { error } = await admin.from('igpsport_comptes').upsert({
        user_id: user.id, identifiant, mdp_chiffre: await chiffrer(motDePasse), relie_le: new Date().toISOString(), erreur: null,
      })
      if (error) throw error
      const r = await synchroniser(user.id, debut + 60_000)
      return json({ relie: true, ...r })
    }

    if (route === 'etat') {
      const { data: c } = await admin.from('igpsport_comptes').select('identifiant, derniere_synchro, importees, reste, erreur').eq('user_id', user.id).maybeSingle()
      return json(c ? { relie: true, identifiant: c.identifiant, derniereSynchro: c.derniere_synchro, importees: c.importees ?? 0, reste: c.reste ?? 0, erreur: c.erreur } : { relie: false })
    }

    if (route === 'synchro') return json(await synchroniser(user.id, debut + 60_000))

    if (route === 'delier') {
      await admin.from('igpsport_comptes').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    return json({ erreur: 'Route inconnue.' }, 404)
  } catch (e) {
    console.error('igpsport', route, (e as Error).message)
    return json({ erreur: 'Une erreur est survenue sur le serveur : réessaie dans un moment.' }, 500)
  }
})
