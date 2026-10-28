import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import type { Etape } from '../../../metrics/programme'
import type { SeancePrevue } from '../types'
import { appeler } from './intervals'

/**
 * Envoi d'une séance vélo vers la montre (Garmin) ou Zwift, en passant par le calendrier Intervals.icu :
 * Intervals l'envoie à Garmin Connect (« Upload planned workouts ») et à Zwift si elle est marquée « intérieur ».
 * Watts réels, sans ERG. Les envois sont retenus dans un réglage synchronisé (ils survivent au recalcul de la semaine).
 */
export type Cible = 'garmin' | 'zwift'
export interface Envoi { id: string; cible: Cible; le: string }

const CLE = 'envois-intervals'
const lireEnvois = async () => ((await db.reglages.get(CLE))?.valeur as Record<string, Envoi> | undefined) ?? {}
export const useEnvoi = (prevueId: string) => useLiveQuery(async () => (await lireEnvois())[prevueId] ?? null, [prevueId])

/** Durée au format d'Intervals : 30s, 10m, 1m30s, 1h40m. */
export function dureeIntervals(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${s || (!h && !m) ? `${s}s` : ''}`
}

/** Libellé court (avant les « : »), sans chiffres ni zones que le lecteur d'Intervals prendrait pour une durée, des watts ou une zone. */
const NOMS_ZONES: Record<string, string> = { Z1: 'Récup', Z2: 'Endurance', Z3: 'Tempo', Z4: 'Seuil', Z5: 'VO2' }
const libelle = (t: string) => t.split(':')[0]
  .replace(/\bZ([1-5])\b/g, (z) => NOMS_ZONES[z])
  .replace(/[0-9'"%×+/()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 35)

/** Texte de la séance au format du « workout builder » d'Intervals.icu : une ligne par étape, watts absolus. */
export function texteIntervals(etapes: Etape[]) {
  return etapes
    .filter((e) => e.dureeSec > 0)
    .map((e) => `- ${libelle(e.libelle)} ${dureeIntervals(e.dureeSec)} ${e.w ? `${e.w}w` : 'freeride'}`.replace(/\s+/g, ' '))
    .join('\n')
}

export async function envoyerSeance(p: SeancePrevue, etapes: Etape[], cible: Cible) {
  const envois = await lireEnvois()
  const avant = envois[p.id]
  const { id } = await appeler<{ id: string }>('planifier', {
    id: avant?.id, date: p.date, nom: p.titre, description: texteIntervals(etapes),
    dureeSec: etapes.reduce((t, e) => t + e.dureeSec, 0), indoor: cible === 'zwift',
  })
  await enregistrer(db.reglages, { id: CLE, valeur: { ...(await lireEnvois()), [p.id]: { id, cible, le: new Date().toISOString() } } })
}

export async function retirerSeance(p: SeancePrevue) {
  const envois = await lireEnvois()
  const envoi = envois[p.id]
  if (!envoi) return
  await appeler('retirer', { id: envoi.id }).catch(() => {})
  const { [p.id]: _retire, ...reste } = envois
  await enregistrer(db.reglages, { id: CLE, valeur: reste })
}
