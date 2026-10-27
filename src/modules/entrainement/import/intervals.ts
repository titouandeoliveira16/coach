import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import type { Profil } from '../../../core/profil'
import { enregistrer } from '../../../core/stockage'
import { CLE_PUBLIQUE, URL_SUPABASE, supabase } from '../../../core/supabase'
import { chargerContexte, completerMetriques, enregistrerSeance, fusionner, nettoyerDoublons, richesse, trouverDoublon } from '../seances/donnees'
import { sportDepuisType } from '../sports'
import type { MesureMatin } from '../types'
import { meilleursEfforts, reechantillonner1Hz } from '../../../metrics/puissance'
import { blocsDeLaSeance, tempsFc90, tousTenus } from '../plan/blocs'
import { regrouperEnchainements } from '../seances/enchainements'
import { analyserFlux } from './flux'
import { CLE_PESEES_EFFACEES, nettoyerPeseesEffacees } from '../forme/pesees'

/**
 * Import Intervals.icu (via la fonction serveur « intervals » : la clé API n'est jamais dans l'appli).
 * Récupère les séances (avec flux) et les données « wellness » de Garmin : VFC, FC de repos, sommeil, poids.
 * Import à l'ouverture de l'appli (au plus une fois par heure) ou sur demande.
 */

/** État enregistré (synchronisé entre appareils). */
export interface EtatIntervals {
  relie?: boolean
  /** Date à partir de laquelle reprendre l'import ("AAAA-MM-JJ") */
  depuis?: string
  /** Dernier import (ISO) */
  dernierImport?: string
  /** Version de la courbe de puissance déjà calculée pour les séances importées (3 : de 1 s à 2 h) */
  courbeVersion?: number
}

const CLE = 'intervals'
const JOURS_HISTORIQUE = 90
/** On relit toujours les 3 derniers jours (synchronisations tardives de la montre). */
const MARGE_JOURS = 3

async function appeler<T>(route: string, corps?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Connecte-toi d’abord à ton compte (Accueil → ⚙️).')
  const r = await fetch(`${URL_SUPABASE}/functions/v1/intervals/${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps ?? {}),
  }).catch(() => {
    throw new Error('Pas de connexion internet (ou fonction « intervals » pas encore installée sur Supabase).')
  })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction « intervals » n’est pas encore installée sur Supabase.')
  if (!r.ok) throw new Error(json.erreur ?? json.message ?? `Erreur ${r.status}`)
  return json as T
}

const lireEtat = async (): Promise<EtatIntervals> => ((await db.reglages.get(CLE))?.valeur as EtatIntervals | undefined) ?? {}
const ecrireEtat = async (e: EtatIntervals) => enregistrer(db.reglages, { id: CLE, valeur: e })

export const etatIntervalsServeur = () => appeler<{ connecte: boolean; athlete: string | null }>('etat')

/** Vérifie la clé auprès d'Intervals.icu et l'enregistre (chiffrée) sur le serveur. */
export async function relierIntervals(cle: string, athlete?: string) {
  const r = await appeler<{ athlete: string; nom?: string }>('cle', { cle, athlete })
  await ecrireEtat({ ...(await lireEtat()), relie: true })
  return r
}

export async function delierIntervals() {
  await appeler('deconnexion')
  await ecrireEtat({})
}

interface Activite {
  id: string
  nom?: string
  type: string
  start_date: string
  moving_time?: number
  distance?: number
  total_elevation_gain?: number
  trainer?: boolean
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  joules?: number
}

interface JourWellness {
  date: string
  hrv?: number
  restingHR?: number
  sleepSecs?: number
  weight?: number
  steps?: number
}

/** Données de Garmin (via Intervals) → mesures du matin et pesées. Ne remplace jamais une valeur saisie à la main. */
async function importerWellness(depuis: string) {
  const { jours } = await appeler<{ jours: JourWellness[] }>('wellness', { oldest: depuis })
  let n = 0
  let dernierPoids: number | undefined
  // Pesées supprimées à la main : on ne les réimporte pas depuis Garmin
  const effacees = ((await db.reglages.get(CLE_PESEES_EFFACEES))?.valeur as string[] | undefined) ?? []
  for (const j of jours) {
    const avant = await db.mesures.get(j.date)
    const m: MesureMatin = { modifieLe: new Date().toISOString(), ...avant, date: j.date }
    if (m.vfcMs === undefined && j.hrv) m.vfcMs = Math.round(j.hrv)
    if (m.fcRepos === undefined && j.restingHR) m.fcRepos = Math.round(j.restingHR)
    if (m.sommeilH === undefined && j.sleepSecs) m.sommeilH = Math.round(j.sleepSecs / 360) / 10
    // Les pas du jour augmentent au fil de la journée : toujours la dernière valeur de la montre
    if (j.steps) m.pas = j.steps
    if (m.vfcMs !== avant?.vfcMs || m.fcRepos !== avant?.fcRepos || m.sommeilH !== avant?.sommeilH || m.pas !== avant?.pas) {
      await enregistrer(db.mesures, m)
      n++
    }
    if (j.weight && !(await db.pesees.get(j.date)) && !effacees.includes(j.date)) {
      await enregistrer(db.pesees, { date: j.date, poidsKg: Math.round(j.weight * 10) / 10 })
      dernierPoids = j.weight
    }
  }
  if (dernierPoids) {
    const profil = (await db.reglages.get('profil'))?.valeur as Profil | undefined
    await enregistrer(db.reglages, { id: 'profil', valeur: { ...profil, poidsKg: Math.round(dernierPoids * 10) / 10 } })
  }
  return n
}

/** Séances Intervals.icu → séances de l'appli (métriques calculées sur les flux). */
async function importerActivites(depuis: string, surProgression?: (n: number) => void) {
  const { activites, viaStrava } = await appeler<{ activites: Activite[]; viaStrava: number }>('activites', { oldest: depuis })
  const connues = new Set((await db.seances.toArray()).flatMap((s) => [s.idExterne, ...(s.autresIds ?? [])]).filter(Boolean))
  const nouvelles = activites.filter((a) => !connues.has(a.id)).sort((a, b) => a.start_date.localeCompare(b.start_date))
  const c = await chargerContexte()
  let n = 0

  for (let i = 0; i < nouvelles.length; i += 10) {
    const lot = nouvelles.slice(i, i + 10)
    const { flux } = await appeler<{ flux: Record<string, { time?: number[]; heartrate?: number[]; watts?: number[]; velocity_smooth?: number[] }> }>('flux', { ids: lot.map((a) => a.id) })
    for (const a of lot) {
      const f = flux[a.id] ?? {}
      const debut = new Date(a.start_date)
      let s = analyserFlux(
        { t: f.time ?? [], fc: f.heartrate, w: f.watts, v: f.velocity_smooth },
        {
          sport: sportDepuisType(a.type), debut, dureeSec: a.moving_time, distanceM: a.distance, deniveleM: a.total_elevation_gain,
          homeTrainer: !!a.trainer || a.type.startsWith('Virtual'), titre: a.nom, source: 'intervals', idExterne: a.id,
        },
        c,
      )
      // Sans flux : on garde les moyennes calculées par Intervals
      if (!s.fcMoy && a.average_heartrate) s = { ...s, fcMoy: Math.round(a.average_heartrate), fcMax: a.max_heartrate }
      if (!s.kj && a.joules) s = { ...s, kj: Math.round(a.joules / 1000), puissanceMoyW: a.average_watts && Math.round(a.average_watts) }

      // Doublon (saisie manuelle, .FIT, ou même sortie vue par la montre et le compteur) :
      // on garde la version la plus riche et ton ressenti
      s = completerMetriques(s, c)
      const doublon = await trouverDoublon(s)
      if (doublon) {
        const [gardee, autre] = richesse(s) > richesse(doublon) ? [{ ...s, id: doublon.id }, doublon] : [doublon, s]
        s = fusionner(gardee, autre)
      }
      const enregistree = await enregistrerSeance(s)
      // Watts de chaque bloc comparés à la séance prévue ; tous tenus → progression validée toute seule
      // et contrôle FC (montée de FC dans chaque bloc, temps à 90 % de la FC max en VO2)
      if (enregistree.prevueId && f.time?.length && f.watts?.length) {
        const prevue = await db.prevues.get(enregistree.prevueId)
        const fc1Hz = f.heartrate?.length ? reechantillonner1Hz(f.time, f.heartrate) : undefined
        const blocs = prevue && blocsDeLaSeance(reechantillonner1Hz(f.time, f.watts), prevue, fc1Hz)
        const t90 = prevue && tempsFc90(prevue, fc1Hz, c.fcMax)
        if (prevue && (blocs || t90 !== undefined)) {
          await enregistrer(db.seances, { ...enregistree, ...(blocs ? { blocs } : {}), ...(t90 !== undefined ? { tempsFc90: t90 } : {}) })
          if (blocs && !prevue.resultat && tousTenus(blocs)) await enregistrer(db.prevues, { ...(await db.prevues.get(prevue.id))!, resultat: 'reussie' })
        }
      }
      n++
      surProgression?.(n)
    }
  }
  return { n, viaStrava }
}

/** Import complet (séances + données Garmin). Première fois : 90 derniers jours. */
export async function importerIntervals(surProgression?: (n: number) => void) {
  const etat = await lireEtat()
  const depuis = etat.depuis ?? decalerJour(aujourdhui(), -JOURS_HISTORIQUE)
  const mesures = await importerWellness(depuis)
  const { n, viaStrava } = await importerActivites(depuis, surProgression)
  await nettoyerDoublons()
  await regrouperEnchainements()
  await nettoyerPeseesEffacees()
  await ecrireEtat({ ...(await lireEtat()), relie: true, depuis: decalerJour(aujourdhui(), -MARGE_JOURS), dernierImport: new Date().toISOString() })
  await completerCourbe().catch(() => {})
  return { seances: n, mesures, viaStrava }
}

/**
 * Une seule fois : recalcule les meilleurs efforts (1 s à 1 h) des séances vélo déjà importées,
 * pour que la courbe de puissance parte de tout l'historique.
 */
async function completerCourbe() {
  if (((await lireEtat()).courbeVersion ?? 0) >= 3) return
  const aRefaire = (await db.seances.toArray()).filter((s) => s.sport === 'velo' && s.source === 'intervals' && s.idExterne && s.kj && !s.meilleurs?.['10'])
  for (let i = 0; i < aRefaire.length; i += 10) {
    const lot = aRefaire.slice(i, i + 10)
    const { flux } = await appeler<{ flux: Record<string, { time?: number[]; watts?: number[] }> }>('flux', { ids: lot.map((s) => s.idExterne) })
    for (const s of lot) {
      const f = flux[s.idExterne!]
      if (!f?.time?.length || !f.watts?.length) continue
      const meilleurs = meilleursEfforts(reechantillonner1Hz(f.time, f.watts))
      if (Object.keys(meilleurs).length) await enregistrer(db.seances, { ...s, meilleurs: { ...s.meilleurs, ...meilleurs } })
    }
  }
  await ecrireEtat({ ...(await lireEtat()), courbeVersion: 3 })
}

/** Import automatique à l'ouverture (au plus une fois par heure, silencieux en cas d'échec). */
export async function importerIntervalsSiBesoin() {
  const etat = await lireEtat()
  if (!etat.relie) return
  if (etat.dernierImport && Date.now() - new Date(etat.dernierImport).getTime() < 3600_000) return
  await importerIntervals().catch(() => {})
}
