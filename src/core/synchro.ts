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
  /** Dernière date d'arrivée serveur (synchro_le) déjà reçue */
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
}

const tableParNom = (nom: string) => TABLES_DONNEES().find((t) => t.name === nom)
const cleDe = (table: ReturnType<typeof tableParNom>, ligne: object) =>
  String((ligne as Record<string, unknown>)[table!.schema.primKey.keyPath as string])

/** Récupère les lignes arrivées sur le serveur depuis le dernier passage. */
async function recevoir(userId: string, curseurs: Curseurs) {
  const PAGE = 500
  for (;;) {
    let requete = supabase.from('donnees').select('*').order('synchro_le').limit(PAGE)
    if (curseurs.recu) requete = requete.gt('synchro_le', curseurs.recu)
    const { data, error } = await requete
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
      curseurs.recu = lignes[lignes.length - 1].synchro_le
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
async function envoyer(userId: string, curseurs: Curseurs, tout: boolean) {
  const aEnvoyer: Omit<LigneServeur, 'synchro_le'>[] = []
  const depuis = curseurs.envoye ?? ''

  for (const table of TABLES_DONNEES()) {
    for (const ligne of (await table.toArray()) as (Horodate & Record<string, unknown>)[]) {
      // Une ligne sans date (créée avant la synchro) est envoyée, datée de maintenant
      if (!ligne._modifie) {
        ligne._modifie = new Date().toISOString()
        await table.put(ligne)
      }
      if (!tout && (ligne._recu || ligne._modifie <= depuis)) continue
      const { _modifie, _recu, ...valeur } = ligne
      aEnvoyer.push({ table_nom: table.name, cle: cleDe(table, ligne), valeur, supprime: false, modifie_le: _modifie })
    }
  }
  for (const s of await db.suppressions.toArray()) {
    aEnvoyer.push({ table_nom: s.table, cle: s.cle, valeur: null, supprime: true, modifie_le: s._modifie })
  }
  if (!aEnvoyer.length) return

  // Une même ligne ne doit figurer qu'une fois dans l'envoi (ex. supprimée puis recréée) : on garde la version la plus récente
  const parCle = new Map<string, (typeof aEnvoyer)[number]>()
  for (const l of aEnvoyer) {
    const k = `${l.table_nom}|${l.cle}`
    const deja = parCle.get(k)
    if (!deja || l.modifie_le >= deja.modifie_le) parCle.set(k, l)
  }

  const lignes = [...parCle.values()].map((l) => ({ ...l, user_id: userId }))
  const { error } = await supabase.from('donnees').upsert(lignes, { onConflict: 'user_id,table_nom,cle' })
  if (error) {
    // Envoi groupé refusé : on envoie ligne par ligne pour ne pas bloquer toute la synchro
    for (const l of lignes) {
      const r = await supabase.from('donnees').upsert(l, { onConflict: 'user_id,table_nom,cle' })
      if (r.error) throw r.error
    }
  }

  await db.suppressions.clear()
  curseurs.envoye = aEnvoyer.reduce((max, l) => (l.modifie_le > max ? l.modifie_le : max), depuis)
  ecrireCurseurs(userId, curseurs)
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
      majEtat({ statut: 'ok', derniereSynchro: new Date().toISOString() })
    } catch (e) {
      const message = (e as Error).message ?? String(e)
      const reseau = !navigator.onLine || /fetch|network|réseau/i.test(message)
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
}

/** Création de compte (la confirmation par email est désactivée côté Supabase). */
export async function creerCompte(email: string, motDePasse: string) {
  const { data, error } = await supabase.auth.signUp({ email, password: motDePasse })
  if (error) throw new Error(traduire(error.message))
  if (!data.session) throw new Error('Compte créé, mais Supabase demande une confirmation par email : désactive « Confirm email » dans Supabase.')
}

/**
 * Déconnexion : dernière synchro, puis effacement des données de cet appareil
 * (elles restent sur le serveur et reviendront à la prochaine connexion).
 */
export async function seDeconnecter() {
  await synchroniser()
  const userId = etat.session?.user.id
  await supabase.auth.signOut()
  if (userId) localStorage.removeItem(cleCurseurs(userId))
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
    majEtat({ session, statut: session ? etat.statut : 'deconnecte' })
    // Synchro à l'ouverture de session (sans bloquer le rappel de Supabase)
    if (session && (evenement === 'INITIAL_SESSION' || evenement === 'SIGNED_IN')) setTimeout(() => synchroniser(), 0)
  })
  surEcriture(planifier)
  window.addEventListener('online', () => synchroniser())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchroniser()
  })
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
