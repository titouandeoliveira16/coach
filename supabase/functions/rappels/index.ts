// Fonction serveur Supabase « rappels » (Deno) : notifications de l'appli Coach (Web Push).
//
// Routes (POST) :
//   /rappels/cle          → clé publique VAPID (créée au premier appel, rangée dans push_config)
//   /rappels/abonner      { abonnement, fuseau, heure, peseeJours, peseeDates } → enregistre cet appareil (utilisateur connecté)
//   /rappels/desabonner   { endpoint } → retire cet appareil (utilisateur connecté)
//   /rappels/tester       → envoie une notification de test à tes appareils (utilisateur connecté)
//   /rappels/envoyer      → appelé toutes les 15 min par pg_cron : envoie les rappels dus.
//                           Sans danger si quelqu'un l'appelle : un rappel n'est envoyé qu'une fois par jour.
//
// Rappels : chaque matin (sauf si « Ton matin » est déjà rempli), pesée les jours choisis (sauf si déjà faite),
// saisie du budget le soir si activée dans l'appli (sauf si déjà faite ; le 1er du mois : annonce du bilan),
// et le 5 du mois à 9 h : relevés des placements.
// Aucun secret à ajouter : les clés VAPID sont créées et gardées par la fonction elle-même.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const CONTACT = 'https://titouandeoliveira16.github.io/coach/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Web Push (RFC 8291 : chiffrement aes128gcm ; RFC 8292 : VAPID) ----------
// --- debut webpush ---
const enc = new TextEncoder()
const b64url = (o: Uint8Array) => btoa(String.fromCharCode(...o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
const concat = (...l: Uint8Array[]) => {
  const r = new Uint8Array(l.reduce((a, x) => a + x.length, 0))
  let i = 0
  for (const x of l) {
    r.set(x, i)
    i += x.length
  }
  return r
}
async function hmac(cle: Uint8Array, donnees: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees))
}

export interface ClesVapid {
  publique: string // point P-256 non compressé, base64url (applicationServerKey)
  privee: JsonWebKey
}

export async function creerClesVapid(): Promise<ClesVapid> {
  const p = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return {
    publique: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', p.publicKey))),
    privee: await crypto.subtle.exportKey('jwk', p.privateKey),
  }
}

/** En-tête Authorization VAPID pour un point d'envoi. */
async function enteteVapid(endpoint: string, cles: ClesVapid) {
  const corps = { aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT }
  const nonSigne = `${b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))}.${b64url(enc.encode(JSON.stringify(corps)))}`
  const k = await crypto.subtle.importKey('jwk', cles.privee, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(nonSigne)))
  return `vapid t=${nonSigne}.${b64url(sig)}, k=${cles.publique}`
}

/** Chiffre un message pour un abonnement (p256dh, auth). */
export async function chiffrerMessage(p256dh: string, auth: string, texte: string) {
  const uaPublic = deB64url(p256dh)
  const secretAuth = deB64url(auth)
  const ephemere = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemere.publicKey))
  const cleUa = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secretEcdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: cleUa }, ephemere.privateKey, 256))
  const prkCle = await hmac(secretAuth, secretEcdh)
  const ikm = (await hmac(prkCle, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32)
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(sel, ikm)
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, concat(enc.encode(texte), new Uint8Array([2]))))
  const rs = new Uint8Array([0, 0, 16, 0]) // 4096
  return concat(sel, rs, new Uint8Array([asPublic.length]), asPublic, chiffre)
}

/** Envoie une notification. Renvoie le statut HTTP du service de push (404 / 410 : abonnement expiré). */
export async function envoyerPush(abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }, message: unknown, cles: ClesVapid) {
  const corps = await chiffrerMessage(abonnement.keys.p256dh, abonnement.keys.auth, JSON.stringify(message))
  const r = await fetch(abonnement.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await enteteVapid(abonnement.endpoint, cles),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(4 * 3600),
      Urgency: 'high',
    },
    body: corps,
  })
  return r.status
}
// --- fin webpush ---

// ---------- Clés et abonnements ----------

async function cles(): Promise<ClesVapid> {
  const { data } = await admin.from('push_config').select('*').eq('id', 1).maybeSingle()
  if (data) return { publique: data.cle_publique, privee: JSON.parse(data.cle_privee) }
  const c = await creerClesVapid()
  await admin.from('push_config').upsert({ id: 1, cle_publique: c.publique, cle_privee: JSON.stringify(c.privee) }, { onConflict: 'id', ignoreDuplicates: true })
  // Deux appels simultanés : on relit la clé réellement gardée
  const { data: gardee } = await admin.from('push_config').select('*').eq('id', 1).single()
  return { publique: gardee.cle_publique, privee: JSON.parse(gardee.cle_privee) }
}

/** Date (AAAA-MM-JJ), heure (HH:MM) et jour de la semaine (0 = dimanche) dans un fuseau. */
function maintenantDans(fuseau: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  const date = `${p.year}-${p.month}-${p.day}`
  return { date, heure: `${p.hour}:${p.minute}`, jour: new Date(`${date}T12:00:00Z`).getUTCDay() }
}

const NOTES = ['sommeil', 'energie', 'jambes', 'motivation', 'serenite']

async function ligne(userId: string, table: string, cle: string) {
  const { data } = await admin.from('donnees').select('valeur, supprime').eq('user_id', userId).eq('table_nom', table).eq('cle', cle).maybeSingle()
  return data && !data.supprime ? (data.valeur as Record<string, unknown>) : undefined
}

/** Heure du rappel de pesée (avant le petit-déjeuner). */
const HEURE_PESEE = '07:00'

/** "AAAA-MM-JJ" du lendemain. */
function lendemain(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Noms des abonnements à confirmer ce jour-là (même règle que l'appli : échéance passée, ni payé, ni sauté, ni remis à plus tard). */
async function abonnementsAVerifier(userId: string, date: string) {
  const v = (await ligne(userId, 'reglages', 'abonnements'))?.valeur as
    { abonnements?: { id: string; nom: string; jour: number; actif: boolean; depuis: string }[]; etatsAbonnements?: Record<string, { statut?: string; relance?: string }> } | undefined
  const mois = date.slice(0, 7)
  const fin = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0)).getUTCDate()
  return (v?.abonnements ?? []).filter((a) => {
    const ech = `${mois}-${String(Math.min(a.jour, fin)).padStart(2, '0')}`
    const e = v?.etatsAbonnements?.[`${a.id}|${mois}`]
    return a.actif && ech >= a.depuis && ech <= date && !e?.statut && (!e?.relance || e.relance <= date)
  }).map((a) => a.nom)
}

/** Vrai si l'utilisateur a des comptes dans le Budget. */
async function utiliseBudget(userId: string) {
  const { data } = await admin.from('donnees').select('cle').eq('user_id', userId).eq('table_nom', 'comptes').eq('supprime', false).limit(1)
  return !!data?.length
}

/** Vrai si `heure` ("HH:MM") tombe dans le quart d'heure qui commence à `debut`. */
function dansLeQuart(heure: string, debut: string) {
  const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
  const ecart = min(heure) - min(debut)
  return ecart >= 0 && ecart < 15
}

/** Vrai si un mouvement du budget a été saisi ou modifié aujourd'hui (dans le fuseau de l'appareil). */
async function saisiAujourdhui(userId: string, fuseau: string, date: string) {
  const { data } = await admin.from('donnees').select('modifie_le').eq('user_id', userId).eq('table_nom', 'mouvements')
    .order('modifie_le', { ascending: false }).limit(1).maybeSingle()
  if (!data) return false
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau }).format(new Date(data.modifie_le)) === date
}

async function envoyerRappels() {
  const c = await cles()
  const { data: abonnements } = await admin.from('push_abonnements').select('*')
  let envoyes = 0
  for (const a of abonnements ?? []) {
    const t = maintenantDans(a.fuseau)
    const maj: Record<string, string> = {}
    const messages: { titre: string; texte: string; tag: string; url: string }[] = []

    // Rappel du matin : à partir de l'heure choisie, jusqu'à midi
    if (t.heure >= a.heure && t.heure < '12:00' && a.dernier_matin !== t.date) {
      maj.dernier_matin = t.date
      const matin = await ligne(a.user_id, 'mesures', t.date)
      if (!matin || !NOTES.some((n) => matin[n] !== undefined))
        messages.push({ titre: '☀️ Ton matin', texte: 'Tes 5 notes du matin : 30 secondes pour avoir ton feu du jour.', tag: 'matin', url: './#/entrainement/aujourdhui' })
    }
    // Pesée : les jours choisis, à partir de 7 h (avant le petit-déjeuner), jusqu'à midi
    const jourPesee = (a.pesee_jours ?? []).includes(t.jour) || (a.pesee_dates ?? []).includes(t.date)
    if (jourPesee && t.heure >= HEURE_PESEE && t.heure < '12:00' && a.derniere_pesee !== t.date) {
      maj.derniere_pesee = t.date
      if (!(await ligne(a.user_id, 'pesees', t.date)))
        messages.push({ titre: '⚖️ Pesée', texte: 'Le matin, à jeun, après être passé aux toilettes.', tag: 'pesee', url: './#/entrainement/aujourdhui' })
    }

    // Le lendemain d'un test CP enregistré dans l'appli (réglage « entrainement »), à 9 h : mettre la FTP Zwift à jour
    if (dansLeQuart(t.heure, '09:00')) {
      const e = (await ligne(a.user_id, 'reglages', 'entrainement'))?.valeur as { tests?: { date: string; type: string; valeur: number }[] } | undefined
      const test = (e?.tests ?? []).filter((x) => x.type === 'cp').sort((x, y) => x.date.localeCompare(y.date)).pop()
      if (test && lendemain(test.date) === t.date)
        messages.push({ titre: '🚴 FTP Zwift', texte: `Nouvelle CP : ${Math.round(test.valeur)} W. Mets ta FTP Zwift à ${Math.round(test.valeur)} W et renvoie tes séances déjà envoyées.`, tag: 'ftp', url: './#/entrainement/semaine' })
    }

    // Budget : rappel de saisie à l'heure choisie dans l'appli (réglage synchronisé « budget »).
    // L'appel a lieu tous les quarts d'heure : le rappel part dans le quart d'heure choisi, donc une seule fois par jour.
    const budget = (await ligne(a.user_id, 'reglages', 'budget'))?.valeur as { rappelActif?: boolean; rappelHeure?: string; rappelReleves?: boolean; rappelControle?: boolean; dernierControle?: string } | undefined
    // Relevés du mois : le 5 à 9 h (sauf si désactivé dans Budget → Réglages), pour qui utilise le Budget
    if (t.date.endsWith('-05') && dansLeQuart(t.heure, '09:00') && budget?.rappelReleves !== false && (await utiliseBudget(a.user_id)))
      messages.push({ titre: '📈 Relevés du mois', texte: '2 minutes : note la valeur de tes placements (PEA, CTO, Bricks).', tag: 'releves', url: './#/budget/patrimoine' })
    // Dimanche, à l'heure du rappel du soir : contrôle du solde du compte courant (sauf si déjà fait aujourd'hui)
    if (t.jour === 0 && budget?.rappelControle !== false && budget?.dernierControle !== t.date && dansLeQuart(t.heure, budget?.rappelHeure ?? '21:00') && (await utiliseBudget(a.user_id)))
      messages.push({ titre: '🔍 Contrôle de la semaine', texte: "1 minute : compare le solde de ton compte courant avec celui de ta banque.", tag: 'controle', url: './#/budget/mois' })
    // Abonnements dont le prélèvement est passé et pas encore confirmé (réglage « abonnements »), à l'heure du rappel du soir
    if (dansLeQuart(t.heure, budget?.rappelHeure ?? '21:00')) {
      const n = await abonnementsAVerifier(a.user_id, t.date)
      if (n.length) messages.push({ titre: '🔁 Abonnements', texte: `${n.join(', ')} : est-ce passé sur ton compte ?`, tag: 'abonnements', url: './#/budget/mois' })
    }
    if (budget?.rappelActif && dansLeQuart(t.heure, budget.rappelHeure ?? '21:00')) {
      if (t.date.endsWith('-01'))
        messages.push({ titre: '📊 Bilan du mois', texte: 'Ton bilan du mois dernier est prêt. Pense aussi aux relevés de tes placements.', tag: 'bilan', url: './#/budget/mois' })
      else if (!(await saisiAujourdhui(a.user_id, a.fuseau, t.date)))
        messages.push({ titre: '💶 Budget', texte: "Tes dépenses du jour : 10 secondes chacune, avant d'oublier.", tag: 'budget', url: './#/budget/mois' })
    }

    for (const m of messages) {
      const statut = await envoyerPush(a.abonnement, m, c).catch(() => 0)
      if (statut === 404 || statut === 410) await admin.from('push_abonnements').delete().eq('endpoint', a.endpoint)
      else if (statut >= 200 && statut < 300) envoyes++
    }
    if (Object.keys(maj).length) await admin.from('push_abonnements').update(maj).eq('endpoint', a.endpoint)
  }
  return envoyes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()
  try {
    if (route === 'envoyer') return json({ envoyes: await envoyerRappels() })
    if (route === 'cle') return json({ cle: (await cles()).publique })

    const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
    const user = data.user
    if (!user) return json({ erreur: 'Connecte-toi à ton compte Coach.' }, 401)
    const corps = await req.json().catch(() => ({}))

    if (route === 'abonner') {
      const ab = corps.abonnement
      if (!ab?.endpoint || !ab?.keys?.p256dh || !ab?.keys?.auth) return json({ erreur: 'Abonnement invalide.' }, 400)
      const { error } = await admin.from('push_abonnements').upsert({
        endpoint: ab.endpoint, user_id: user.id, abonnement: ab, fuseau: corps.fuseau ?? 'Europe/Paris', heure: corps.heure ?? '08:30',
        pesee_jours: corps.peseeJours ?? [2], pesee_dates: corps.peseeDates ?? [],
      }, { onConflict: 'endpoint' })
      if (error) throw error
      return json({ ok: true })
    }
    if (route === 'desabonner') {
      await admin.from('push_abonnements').delete().eq('endpoint', corps.endpoint).eq('user_id', user.id)
      return json({ ok: true })
    }
    if (route === 'tester') {
      const c = await cles()
      const { data: abonnements } = await admin.from('push_abonnements').select('*').eq('user_id', user.id)
      let n = 0
      for (const a of abonnements ?? []) {
        const statut = await envoyerPush(a.abonnement, { titre: '✅ Coach', texte: 'Les rappels fonctionnent sur cet appareil.', tag: 'test', url: './#/reglages' }, c).catch(() => 0)
        if (statut >= 200 && statut < 300) n++
      }
      return json({ envoyes: n })
    }
    return json({ erreur: 'Route inconnue.' }, 404)
  } catch (e) {
    return json({ erreur: (e as Error).message }, 500)
  }
})
