import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { TABLES_DONNEES, db } from './db'
import type { Horodate } from './stockage'
import { surEcriture } from './stockage'
import { supabase } from './supabase'

/**
 * Synchronisation entre la base locale (IndexedDB) et le serveur Supabase.
 *
 * Principe (« local d'abord ») :
 *  1. l'appli lit et écrit toujours en local → elle marche hors ligne ;
 *  2. RÉCEPTION : on récupère les lignes arrivées sur le serveur depuis la dernière fois
 *     (venant d'un autre appareil) et on garde, pour chaque ligne, la version la plus récente ;
 *  3. ENVOI : on envoie les lignes modifiées localement depuis le dernier envoi.
 *
 * Côté serveur, toutes les données tiennent dans une seule table « donnees » :
 * (table_nom, cle) → valeur (le contenu de la ligne en JSON).
 */

// ---------- État affiché dans l'interface ----------

export interface EtatSynchro {
  session: Session | null
  statut: 'deconnecte' | 'en-cours' | 'ok' | 'hors-ligne' | 'erreur'
  derniereSynchro?: string
  erreur?: string
  /** La session enregistrée a été relue (avant : on ne sait pas encore si quelqu'un est connecté) */
  pret?: boolean
}

let etat: EtatSynchro = { session: null, statut: 'deconnecte' }
const abonnes = new Set<() => void>()
function majEtat(changements: Partial<EtatSynchro>) {
  etat = { ...etat, ...changements }
  abonnes.forEach((a) => a())
}

/** Hook React : état de la synchro, mis à jour en direct. */
export const useSynchro = () =>
  useSyncExternalStore(
    (a) => {
      abonnes.add(a)
      return () => abonnes.delete(a)
    },
    () => etat,
  )

// ---------- Curseurs (où en est-on ?), propres à chaque compte et à chaque appareil ----------

interface Curseurs {
  /** Dernier numéro d'arrivée serveur (seq, strictement croissant) déjà reçu */
  recuSeq?: number
  /** Ancien curseur (avant la colonne seq) : dernière date d'arrivée serveur (synchro_le) déjà reçue */
  recu?: string
  /** Dernière date de modification locale (_modifie) déjà envoyée */
  envoye?: string
}
const cleCurseurs = (userId: string) => `coach-synchro-${userId}`
function lireCurseurs(userId: string): Curseurs {
  try {
    return JSON.parse(localStorage.getItem(cleCurseurs(userId)) ?? '{}')
  } catch {
    return {}
  }
}
function ecrireCurseurs(userId: string, c: Curseurs) {
  try {
    localStorage.setItem(cleCurseurs(userId), JSON.stringify(c))
  } catch {
    /* stockage indisponible : on renverra simplement tout la prochaine fois */
  }
}

// ---------- Synchronisation ----------

interface LigneServeur {
  table_nom: string
  cle: string
  valeur: Record<string, unknown> | null
  supprime: boolean
  modifie_le: string
  synchro_le: string
  seq?: number
}

const tableParNom = (nom: string) => TABLES_DONNEES().find((t) => t.name === nom)
const cleDe = (table: ReturnType<typeof tableParNom>, ligne: object) =>
  String((ligne as Record<string, unknown>)[table!.schema.primKey.keyPath as string])

/** Récupère les lignes arrivées sur le serveur depuis le dernier passage. */
let colonneSeq = true

async function recevoir(userId: string, curseurs: Curseurs) {
  const PAGE = 500
  for (;;) {
    // Curseur sur « seq » (numéro donné par le serveur à chaque écriture, unique et croissant) : avec la date
    // d'arrivée, toutes les lignes d'un même envoi groupé avaient la même date et la page suivante en sautait.
    let requete = colonneSeq
      ? supabase.from('donnees').select('*').order('seq').limit(PAGE).gt('seq', curseurs.recuSeq ?? 0)
      : supabase.from('donnees').select('*').order('synchro_le').limit(PAGE)
    if (!colonneSeq && curseurs.recu) requete = requete.gt('synchro_le', curseurs.recu)
    const { data, error } = await requete
    // Serveur pas encore mis à jour (colonne seq absente) : ancien curseur
    if (error && colonneSeq && /seq/.test(error.message ?? '') && /column|colonne/i.test(error.message ?? '')) {
      colonneSeq = false
      continue
    }
    if (error) throw error
    const lignes = data as LigneServeur[]

    await db.transaction('rw', [...TABLES_DONNEES(), db.suppressions], async () => {
      for (const l of lignes) {
        const table = tableParNom(l.table_nom)
        if (!table) continue // table d'une future version de l'appli : ignorée
        const locale = (await table.get(l.cle)) as Horodate | undefined
        const suppression = await db.suppressions.get(`${l.table_nom}|${l.cle}`)
        // On garde la version la plus récente (en local ou sur le serveur)
        const dateLocale = locale?._modifie ?? suppression?._modifie
        if (dateLocale && dateLocale >= l.modifie_le) continue
        if (suppression) await db.suppressions.delete(suppression.id)
        if (l.supprime) await table.delete(l.cle)
        else await table.put({ ...l.valeur, _modifie: l.modifie_le, _recu: true })
      }
    })

    if (lignes.length) {
      const derniere = lignes[lignes.length - 1]
      curseurs.recu = derniere.synchro_le
      if (colonneSeq && derniere.seq !== undefined) curseurs.recuSeq = derniere.seq
      ecrireCurseurs(userId, curseurs)
    }
    if (lignes.length < PAGE) return
  }
}

/**
 * Envoie les lignes modifiées (ou supprimées) localement depuis le dernier envoi.
 * `tout` : renvoie aussi les lignes reçues du serveur, pour reconstruire la copie en ligne
 * (ex. compte supprimé puis recréé : le serveur est vide, l'appareil a tout).
 */
const cleRefus = (userId: string) => `coach-synchro-refus-${userId}`
function lireRefus(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(cleRefus(userId)) ?? '[]')
  } catch {
    return []
  }
}
function ecrireRefus(userId: string, refus: string[]) {
  try {
    if (refus.length) localStorage.setItem(cleRefus(userId), JSON.stringify(refus))
    else localStorage.removeItem(cleRefus(userId))
  } catch {
    /* stockage indisponible */
  }
}

/** Lignes refusées au dernier envoi : retentées à chaque synchro, sans bloquer les autres. */
let refusesDernierEnvoi = 0

async function envoyer(userId: string, curseurs: Curseurs, tout: boolean) {
  const aEnvoyer: Omit<LigneServeur, 'synchro_le'>[] = []
  const depuis = curseurs.envoye ?? ''
  // Lignes refusées la dernière fois : on les renvoie quelle que soit leur date
  const refusAvant = new Set(lireRefus(userId))

  for (const table of TABLES_DONNEES()) {
    for (const ligne of (await table.toArray()) as (Horodate & Record<string, unknown>)[]) {
      // Une ligne sans date (créée avant la synchro) est envoyée, datée de maintenant
      if (!ligne._modifie) {
        ligne._modifie = new Date().toISOString()
        await table.put(ligne)
      }
      if (!tout && !refusAvant.has(`${table.name}|${cleDe(table, ligne)}`) && (ligne._recu || ligne._modifie <= depuis)) continue
      const { _modifie, _recu, ...valeur } = ligne
      aEnvoyer.push({ table_nom: table.name, cle: cleDe(table, ligne), valeur, supprime: false, modifie_le: _modifie })
    }
  }
  const suppressionsEnvoyees = await db.suppressions.toArray()
  for (const s of suppressionsEnvoyees) {
    aEnvoyer.push({ table_nom: s.table, cle: s.cle, valeur: null, supprime: true, modifie_le: s._modifie })
  }
  if (!aEnvoyer.length) {
    ecrireRefus(userId, [])
    refusesDernierEnvoi = 0
    return
  }

  // Une même ligne ne doit figurer qu'une fois dans l'envoi (ex. supprimée puis recréée) : on garde la version la plus récente
  const parCle = new Map<string, (typeof aEnvoyer)[number]>()
  for (const l of aEnvoyer) {
    const k = `${l.table_nom}|${l.cle}`
    const deja = parCle.get(k)
    if (!deja || l.modifie_le >= deja.modifie_le) parCle.set(k, l)
  }

  const lignes = [...parCle.values()].map((l) => ({ ...l, user_id: userId }))
  const refus: string[] = []
  const { error } = await supabase.from('donnees').upsert(lignes, { onConflict: 'user_id,table_nom,cle' })
  if (error) {
    if (estErreurReseau(error.message)) throw error
    // Envoi groupé refusé : ligne par ligne ; une ligne refusée est mise de côté (retentée plus tard) sans bloquer les autres
    for (const l of lignes) {
      const r = await supabase.from('donnees').upsert(l, { onConflict: 'user_id,table_nom,cle' })
      if (r.error && estErreurReseau(r.error.message)) throw r.error
      if (r.error) refus.push(`${l.table_nom}|${l.cle}`)
    }
  }

  // Suppressions : on n'efface que celles réellement envoyées et inchangées depuis (une suppression faite pendant
  // l'envoi reste en attente pour la prochaine fois)
  await db.transaction('rw', db.suppressions, async () => {
    for (const s of suppressionsEnvoyees) {
      if (refus.includes(s.id)) continue
      const actuelle = await db.suppressions.get(s.id)
      if (actuelle && actuelle._modifie === s._modifie) await db.suppressions.delete(s.id)
    }
  })
  ecrireRefus(userId, refus)
  refusesDernierEnvoi = refus.length
  curseurs.envoye = aEnvoyer.reduce((max, l) => (l.modifie_le > max ? l.modifie_le : max), depuis)
  ecrireCurseurs(userId, curseurs)
}

const estErreurReseau = (message?: string) => !navigator.onLine || /fetch|network|réseau/i.test(message ?? '')

/** Reste-t-il sur cet appareil des modifications pas encore acceptées par le serveur ? */
export async function resteAEnvoyer(): Promise<boolean> {
  const userId = etat.session?.user.id
  if (!userId) return false
  if ((await db.suppressions.count()) > 0 || lireRefus(userId).length > 0) return true
  const depuis = lireCurseurs(userId).envoye ?? ''
  for (const table of TABLES_DONNEES()) {
    const enAttente = await table.filter((l: Horodate) => !l._recu && (!l._modifie || l._modifie > depuis)).count()
    if (enAttente) return true
  }
  return false
}

let enCours: Promise<void> | null = null
let aRefaire = false

/** Lance une synchronisation complète (sans effet si déconnecté). */
export async function synchroniser(): Promise<void> {
  const userId = etat.session?.user.id
  if (!userId) return
  if (enCours) {
    aRefaire = true // une écriture est arrivée pendant la synchro : on repassera
    return enCours
  }
  if (!navigator.onLine) {
    majEtat({ statut: 'hors-ligne' })
    return
  }

  majEtat({ statut: 'en-cours', erreur: undefined })
  enCours = (async () => {
    try {
      const curseurs = lireCurseurs(userId)
      // Première synchro de ce compte sur cet appareil : on envoie tout ce qu'il contient
      const premiere = !curseurs.recu && !curseurs.envoye
      await recevoir(userId, curseurs)
      await envoyer(userId, curseurs, premiere)
      if (refusesDernierEnvoi) majEtat({ statut: 'erreur', erreur: `${refusesDernierEnvoi} donnée${refusesDernierEnvoi > 1 ? 's' : ''} refusée${refusesDernierEnvoi > 1 ? 's' : ''} par le serveur (nouvel essai à la prochaine synchro)`, derniereSynchro: new Date().toISOString() })
      else majEtat({ statut: 'ok', derniereSynchro: new Date().toISOString() })
    } catch (e) {
      const message = (e as Error).message ?? String(e)
      const reseau = estErreurReseau(message)
      majEtat({ statut: reseau ? 'hors-ligne' : 'erreur', erreur: reseau ? undefined : message })
    } finally {
      enCours = null
    }
  })()
  await enCours
  if (aRefaire) {
    aRefaire = false
    await synchroniser()
  }
}

// Après une écriture locale, on attend 2 s (regroupe les saisies rapides) puis on envoie
let minuterie: ReturnType<typeof setTimeout> | undefined
function planifier() {
  clearTimeout(minuterie)
  minuterie = setTimeout(() => synchroniser(), 2000)
}

// ---------- Compte ----------

/** Connexion avec un compte existant ; en cas de succès, la synchro démarre. */
export async function seConnecter(email: string, motDePasse: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
  if (error) throw new Error(traduire(error.message))
  // Une seule session active à la fois : les autres appareils sont déconnectés (leurs saisies non envoyées restent
  // chez eux et partiront à leur prochaine connexion). Évite que deux appareils s'écrasent leurs réglages.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
}

/** Compte à qui appartiennent les données de cet appareil (un appareil déconnecté à distance les garde). */
const CLE_PROPRIETAIRE = 'coach-proprietaire'
async function verifierProprietaire(userId: string) {
  let avant: string | null = null
  try {
    avant = localStorage.getItem(CLE_PROPRIETAIRE)
    localStorage.setItem(CLE_PROPRIETAIRE, userId)
  } catch {
    return
  }
  // Un autre compte se connecte sur un appareil qui garde encore les données du précédent : on repart d'une base vide
  // (sinon elles partiraient sur le mauvais compte)
  if (avant && avant !== userId) {
    await db.transaction('rw', [...TABLES_DONNEES(), db.suppressions], async () => {
      for (const t of [...TABLES_DONNEES(), db.suppressions]) await t.clear()
    })
  }
}

/**
 * Déconnexion : dernière synchro, puis effacement des données de cet appareil
 * (elles restent sur le serveur et reviendront à la prochaine connexion).
 */
export async function seDeconnecter() {
  await synchroniser()
  // Jamais d'effacement tant que tout n'est pas parti : hors ligne ou en erreur, les saisies seraient perdues
  if (etat.statut !== 'ok' || (await resteAEnvoyer()))
    throw new Error(etat.statut === 'hors-ligne'
      ? 'Pas de réseau : des saisies ne sont pas encore envoyées. Reconnecte-toi à internet puis réessaie.'
      : 'Des saisies ne sont pas encore envoyées sur ton compte. Réessaie dans un moment (Synchroniser maintenant).')
  const userId = etat.session?.user.id
  await supabase.auth.signOut()
  if (userId) {
    localStorage.removeItem(cleCurseurs(userId))
    localStorage.removeItem(cleRefus(userId))
  }
  localStorage.removeItem(CLE_PROPRIETAIRE)
  await db.transaction('rw', [...TABLES_DONNEES(), db.suppressions], async () => {
    for (const t of [...TABLES_DONNEES(), db.suppressions]) await t.clear()
  })
}

function traduire(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.'
  if (/already registered|already exists/i.test(message)) return 'Un compte existe déjà avec cet email : utilise « Se connecter ».'
  if (/at least|password should/i.test(message)) return 'Mot de passe trop court (6 caractères minimum).'
  if (/email not confirmed/i.test(message)) return 'Email non confirmé : désactive « Confirm email » dans Supabase.'
  if (/rate limit|security purposes/i.test(message)) return 'Trop de tentatives : patiente quelques minutes.'
  if (/fetch|network/i.test(message)) return 'Pas de connexion internet.'
  return message
}

/** À appeler une fois au démarrage de l'appli. */
export function demarrerSynchro() {
  supabase.auth.onAuthStateChange((evenement, session) => {
    majEtat({ session, statut: session ? etat.statut : 'deconnecte', pret: true })
    // Synchro à l'ouverture de session (sans bloquer le rappel de Supabase)
    if (session && (evenement === 'INITIAL_SESSION' || evenement === 'SIGNED_IN'))
      setTimeout(() => verifierProprietaire(session.user.id).then(() => synchroniser()), 0)
  })
  surEcriture(planifier)
  window.addEventListener('online', () => synchroniser())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      synchroniser()
      verifierSessionActive()
    }
  })
  setInterval(verifierSessionActive, 5 * 60 * 1000)
}

/** Message à montrer sur l'écran de connexion quand une session a été fermée par un autre appareil. */
export const CLE_SESSION_FERMEE = 'coach-session-fermee'

/**
 * Une seule session active (12/11/2026) : la connexion sur un autre appareil ferme les autres sessions sur le serveur,
 * mais cet appareil ne s'en rendait compte qu'à l'expiration de son jeton (jusqu'à 1 h). On demande donc au serveur, au
 * retour dans l'appli et toutes les 5 minutes, si la session existe encore ; sinon, déconnexion de cet appareil (ses
 * saisies non envoyées restent ici et partiront à la prochaine connexion du même compte).
 */
async function verifierSessionActive() {
  if (!etat.session || !navigator.onLine) return
  const { error } = await supabase.auth.getUser()
  if (!error) return
  const code = (error as { code?: string; status?: number }).code
  const status = (error as { status?: number }).status
  if (code === 'session_not_found' || code === 'refresh_token_not_found' || status === 401 || status === 403) {
    try { sessionStorage.setItem(CLE_SESSION_FERMEE, '1') } catch { /* stockage indisponible */ }
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}

/**
 * Supprime TOUTES les données : sur le serveur (si connecté) puis sur cet appareil.
 * Le compte lui-même reste (pour le supprimer : Supabase → Authentication → Users).
 */
export async function supprimerToutesMesDonnees() {
  const userId = etat.session?.user.id
  if (userId) {
    const { error } = await supabase.from('donnees').delete().eq('user_id', userId)
    if (error) throw new Error(`Suppression sur le serveur impossible : ${error.message}`)
    localStorage.removeItem(cleCurseurs(userId))
  }
  await db.transaction('rw', [...TABLES_DONNEES(), db.suppressions], async () => {
    for (const t of [...TABLES_DONNEES(), db.suppressions]) await t.clear()
  })
}
