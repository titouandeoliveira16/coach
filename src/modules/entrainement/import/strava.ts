import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { CLE_PUBLIQUE, URL_SUPABASE, supabase } from '../../../core/supabase'
import { chargerContexte, completerMetriques, enregistrerSeance, trouverDoublon } from '../seances/donnees'
import type { Sport } from '../types'
import { analyserFlux } from './flux'

/**
 * Import Strava (via la fonction serveur « strava » : le secret Strava n'est jamais dans l'appli).
 * Limites de l'API respectées : import à l'ouverture (au plus 1 fois par heure) ou sur demande,
 * 15 activités détaillées par appel, pas d'interrogation en boucle.
 */

/** État Strava enregistré (synchronisé entre appareils). */
export interface EtatStrava {
  /** Date (s depuis 1970) de départ de la dernière activité importée */
  curseur?: number
  /** Dernier import (ISO) */
  dernierImport?: string
}

const CLE = 'strava'
const JOURS_HISTORIQUE = 90

async function appeler<T>(route: string, corps?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Connecte-toi d’abord à ton compte (Réglages).')
  const r = await fetch(`${URL_SUPABASE}/functions/v1/strava/${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps ?? {}),
  }).catch(() => {
    throw new Error('Pas de connexion internet (ou fonction Strava pas encore installée).')
  })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction Strava n’est pas encore installée sur Supabase.')
  if (!r.ok) throw new Error(json.erreur ?? `Erreur ${r.status}`)
  return json as T
}

export const etatStravaServeur = () => appeler<{ connecte: boolean; athlete: number | null }>('etat')

/** Ouvre la page d'autorisation Strava (dans Safari sur iPhone ; le retour se fait côté serveur). */
export async function connecterStrava() {
  const { url } = await appeler<{ url: string }>('debut')
  window.open(url, '_blank')
}

export async function deconnecterStrava() {
  await appeler('deconnexion')
  await enregistrer(db.reglages, { id: CLE, valeur: {} })
}

async function lireEtat(): Promise<EtatStrava> {
  return ((await db.reglages.get(CLE))?.valeur as EtatStrava | undefined) ?? {}
}

interface ActiviteStrava {
  id: number
  ignoree?: boolean
  nom?: string
  type?: string
  start_date: string
  moving_time?: number
  distance?: number
  total_elevation_gain?: number
  trainer?: boolean
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  device_watts?: boolean
  kilojoules?: number
  flux?: { time?: number[]; heartrate?: number[]; watts?: number[]; velocity_smooth?: number[] }
}

const sportDe = (type: string): Sport => (type.includes('Run') ? 'course' : 'velo')

/**
 * Importe les nouvelles activités Strava (par défaut : depuis le dernier import,
 * ou les 90 derniers jours la première fois). Renvoie le nombre de séances importées.
 */
export async function importerStrava(surProgression?: (n: number) => void): Promise<number> {
  const etat = await lireEtat()
  let curseur = etat.curseur ?? Math.floor(Date.now() / 1000) - JOURS_HISTORIQUE * 86400
  const c = await chargerContexte()
  let total = 0

  for (let tour = 0; tour < 20; tour++) {
    const { activites, suite } = await appeler<{ activites: ActiviteStrava[]; suite: boolean }>('activites', { apres: curseur })
    for (const a of activites) {
      curseur = Math.max(curseur, Math.floor(new Date(a.start_date).getTime() / 1000))
      if (a.ignoree || !a.type) continue
      const f = a.flux ?? {}
      const sport = sportDe(a.type)
      let s = analyserFlux(
        { t: f.time ?? [], fc: f.heartrate, w: f.watts, v: f.velocity_smooth },
        {
          sport, debut: new Date(a.start_date), dureeSec: a.moving_time, distanceM: a.distance,
          deniveleM: a.total_elevation_gain, homeTrainer: !!a.trainer || a.type === 'VirtualRide',
          titre: a.nom, source: 'strava', stravaId: a.id,
        },
        c,
      )
      // Sans flux : on garde les moyennes fournies par Strava
      if (!s.fcMoy && a.average_heartrate) s = { ...s, fcMoy: Math.round(a.average_heartrate), fcMax: a.max_heartrate }
      if (!s.kj && a.device_watts && a.kilojoules) s = { ...s, kj: Math.round(a.kilojoules), puissanceMoyW: a.average_watts && Math.round(a.average_watts) }

      // Doublon (saisie manuelle ou .FIT déjà présent) : on complète en gardant ton ressenti
      const doublon = await trouverDoublon(s)
      if (doublon) {
        s = { ...s, id: doublon.id, rpe: doublon.rpe, sensations: doublon.sensations, notes: doublon.notes, type: doublon.type, prevueId: doublon.prevueId }
        // Un fichier .FIT déjà importé contient les mêmes flux : on ne le remplace pas
        if (doublon.source === 'fit') continue
      }
      await enregistrerSeance(completerMetriques(s, c))
      total++
      surProgression?.(total)
    }
    await enregistrer(db.reglages, { id: CLE, valeur: { curseur, dernierImport: new Date().toISOString() } satisfies EtatStrava })
    if (!suite || activites.length === 0) break
  }
  return total
}

/** Import automatique à l'ouverture de l'appli, au plus une fois par heure (silencieux en cas d'échec). */
export async function importerStravaSiBesoin() {
  const etat = await lireEtat()
  if (!etat.curseur) return // Strava jamais connecté depuis l'appli
  if (etat.dernierImport && Date.now() - new Date(etat.dernierImport).getTime() < 3600_000) return
  await importerStrava().catch(() => {})
}
