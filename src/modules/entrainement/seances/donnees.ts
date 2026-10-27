import { db } from '../../../core/db'
import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { PROFIL_DEFAUT, type Profil } from '../../../core/profil'
import { enregistrer, supprimer } from '../../../core/stockage'
import { srpe, trimpDepuisMoyenne } from '../../../metrics/charge'
import { rtss, vitesseKmh } from '../../../metrics/course'
import { domaineDepuisFc, type BornesZones } from '../../../metrics/fc'
import { kjDepuisMoyenne, tss } from '../../../metrics/puissance'
import type { Intensite, ReglagesEntrainement, Seance } from '../types'

/** Tout ce qu'il faut pour calculer les métriques d'une séance. */
export interface Contexte {
  fcRepos: number
  fcMax: number
  bornes: BornesZones
  cpW?: number
  vmaKmh?: number
  seuilCoursePct: number
  poidsKg?: number
  chargeRef: 'trimp' | 'srpe'
}

/** FC de repos par défaut tant qu'aucune mesure du matin n'existe. */
const FC_REPOS_DEFAUT = 50

/** Bornes hautes des zones FC 1 à 4, lues dans les zones (Frive) des réglages. */
export function bornesDepuisReglages(r: ReglagesEntrainement): BornesZones {
  const z = r.zonesVelo
  const b = [0, 1, 2, 3].map((i) => z[i]?.fcMax)
  return b.every((x) => x !== undefined) ? (b as BornesZones) : [130, 150, 165, 177]
}

/** Charge le contexte depuis la base : profil, réglages, FC de repos = moyenne des 7 derniers matins. */
export async function chargerContexte(): Promise<Contexte> {
  const profil = { fcMax: PROFIL_DEFAUT.fcMax, ...((await db.reglages.get('profil'))?.valeur as Profil | undefined) }
  const r = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined
  const reglages = { zonesVelo: [], seuilCoursePct: 87, chargeRef: 'trimp', vmaKmh: 18.5, ...r } as ReglagesEntrainement
  const matins = (await db.mesures.where('date').between(decalerJour(aujourdhui(), -6), aujourdhui(), true, true).toArray()).filter((m) => !m.sansMontre)
  const fc = matins.map((m) => m.fcRepos).filter((x): x is number => x !== undefined)
  return {
    fcRepos: fc.length ? fc.reduce((a, b) => a + b, 0) / fc.length : FC_REPOS_DEFAUT,
    fcMax: profil.fcMax ?? PROFIL_DEFAUT.fcMax!,
    bornes: bornesDepuisReglages(reglages),
    cpW: reglages.cpW,
    vmaKmh: reglages.vmaKmh,
    seuilCoursePct: reglages.seuilCoursePct ?? 87,
    poidsKg: profil.poidsKg,
    chargeRef: reglages.chargeRef ?? 'trimp',
  }
}

/**
 * Complète les métriques d'une séance saisie à la main (sans flux) :
 * TRIMP depuis la FC moyenne, kJ depuis la puissance moyenne, TSS / rTSS.
 * Les métriques déjà calculées depuis un flux (.FIT, Intervals.icu) sont conservées.
 */
export function completerMetriques(s: Seance, c: Contexte): Seance {
  const r = { ...s }
  const min = s.dureeSec / 60
  if (!r.trimpFlux) r.trimp = s.fcMoy ? trimpDepuisMoyenne(s.fcMoy, min, c.fcRepos, c.fcMax) : undefined
  if (s.sport === 'velo') {
    if (r.kj === undefined && s.puissanceMoyW) r.kj = kjDepuisMoyenne(s.puissanceMoyW, s.dureeSec)
    const p = s.puissanceNormW ?? s.puissanceMoyW
    r.tss = p && c.cpW ? tss(s.dureeSec, p, c.cpW) : undefined
  } else if (s.sport === 'course') {
    r.tss = s.distanceKm && c.vmaKmh ? rtss(s.dureeSec, vitesseKmh(s.distanceKm, s.dureeSec), c.vmaKmh, c.seuilCoursePct) : undefined
  }
  return r
}

/**
 * Charge d'une séance dans l'unité de référence.
 * TRIMP : si la FC manque, il est estimé depuis le RPE (relation approximative RPE ↔ % de réserve
 * de FC : x ≈ 0,4 + 0,05 × RPE).
 */
export function chargeDe(s: Seance, c: Pick<Contexte, 'chargeRef'>): number {
  const min = s.dureeSec / 60
  if (c.chargeRef === 'srpe') return s.rpe !== undefined ? srpe(s.rpe, min) : 0
  if (s.trimp !== undefined) return s.trimp
  if (s.rpe !== undefined) {
    const x = Math.min(1, 0.4 + 0.05 * s.rpe)
    return min * x * 0.64 * Math.exp(1.92 * x)
  }
  return 0
}

/** Domaine d'intensité d'une séance (temps par zone si dispo, sinon FC moyenne, sinon RPE). */
export function domaineDe(s: Seance, bornes: BornesZones): Intensite {
  if (s.tempsZones) {
    const [b, m, h] = [s.tempsZones[0] + s.tempsZones[1], s.tempsZones[2], s.tempsZones[3] + s.tempsZones[4]]
    return h >= 600 ? 'haute' : m >= 900 ? 'moyenne' : b >= m + h ? 'basse' : m >= h ? 'moyenne' : 'haute'
  }
  if (s.fcMoy) return domaineDepuisFc(s.fcMoy, bornes)
  if (s.rpe !== undefined) return s.rpe < 3 ? 'basse' : s.rpe >= 7.5 ? 'haute' : 'moyenne'
  return 'basse'
}

/** Début et fin (ms) d'une séance, si son heure de départ est connue. */
function plage(s: Pick<Seance, 'debut' | 'dureeSec'>) {
  if (!s.debut) return undefined
  const d = new Date(s.debut).getTime()
  return [d, d + Math.max(s.dureeSec, 60) * 1000] as const
}

/**
 * Doublon : même sport, même identifiant externe, ou séances qui se chevauchent
 * sur au moins la moitié de la plus courte (ex. sortie enregistrée à la fois
 * par la montre et par le compteur, lancés à quelques minutes d'écart).
 */
export function sontDoublons(a: Pick<Seance, 'id' | 'debut' | 'dureeSec' | 'sport' | 'idExterne' | 'autresIds'>, b: typeof a) {
  if (a.id === b.id || a.sport !== b.sport) return false
  const idsA = [a.idExterne, ...(a.autresIds ?? [])].filter(Boolean)
  if (b.idExterne && idsA.includes(b.idExterne)) return true
  const pa = plage(a)
  const pb = plage(b)
  if (!pa || !pb) return false
  const commun = Math.min(pa[1], pb[1]) - Math.max(pa[0], pb[0])
  return commun >= 0.5 * Math.min(pa[1] - pa[0], pb[1] - pb[0])
}

export async function trouverDoublon(s: Pick<Seance, 'id' | 'date' | 'debut' | 'dureeSec' | 'sport' | 'idExterne' | 'autresIds'>) {
  const proches = await db.seances.where('date').between(decalerJour(s.date, -1), decalerJour(s.date, 1), true, true).toArray()
  return proches.find((x) => sontDoublons(s, x))
}

/** Richesse des données d'une séance : on garde la plus riche lors d'une fusion. */
export const richesse = (s: Seance) => (s.kj ? 4 : 0) + (s.tempsZones ? 2 : 0) + (s.fcMoy ? 1 : 0) + (s.distanceKm ? 1 : 0)

/** Fusionne deux versions d'une même séance : données de la plus riche, ressenti saisi conservé. */
export function fusionner(gardee: Seance, autre: Seance): Seance {
  return {
    ...gardee,
    rpe: gardee.rpe ?? autre.rpe,
    sensations: gardee.sensations ?? autre.sensations,
    notes: gardee.notes ?? autre.notes,
    type: gardee.type ?? autre.type,
    prevueId: gardee.prevueId ?? autre.prevueId,
    meilleurs: gardee.meilleurs ?? autre.meilleurs,
    autresIds: [...new Set([...(gardee.autresIds ?? []), ...(autre.autresIds ?? []), ...(autre.idExterne ? [autre.idExterne] : [])])]
      .filter((id) => id !== gardee.idExterne),
  }
}

/** Fusionne les doublons déjà enregistrés. Renvoie le nombre de séances fusionnées. */
export async function nettoyerDoublons() {
  const toutes = (await db.seances.orderBy('date').toArray())
  const supprimees = new Set<string>()
  let n = 0
  for (const a of toutes) {
    if (supprimees.has(a.id)) continue
    for (const b of toutes) {
      if (b.id === a.id || supprimees.has(b.id) || b.date < decalerJour(a.date, -1) || b.date > decalerJour(a.date, 1)) continue
      if (!sontDoublons(a, b)) continue
      const [gardee, autre] = richesse(b) > richesse(a) ? [b, a] : [a, b]
      await enregistrer(db.seances, fusionner(gardee, autre))
      await supprimer(db.seances, autre.id)
      supprimees.add(autre.id)
      n++
      if (autre.id === a.id) break
    }
  }
  return n
}

/**
 * Enregistre une séance : calcule ses métriques, la rattache à la séance prévue
 * du même jour et du même sport (marquée « faite »).
 */
export async function enregistrerSeance(s: Seance) {
  const c = await chargerContexte()
  const complete = completerMetriques(s, c)
  if (!complete.prevueId) {
    // Séance prévue le même jour, sinon la plus proche (2 jours au plus, même semaine) : séance décalée
    const lundi = lundiDe(s.date)
    const proches = (await db.prevues.where('date').between(decalerJour(s.date, -2), decalerJour(s.date, 2), true, true).toArray())
      .filter((p) => p.sport === s.sport && p.statut === 'prevue' && lundiDe(p.date) === lundi)
      .sort((a, b) => Math.abs(ecartJours(a.date, s.date)) - Math.abs(ecartJours(b.date, s.date)) || a.date.localeCompare(b.date))
    const prevue = proches[0]
    if (prevue) {
      // La séance prévue suit la date réelle
      if (prevue.date !== s.date) await enregistrer(db.prevues, { ...prevue, date: s.date })
      complete.prevueId = prevue.id
      // Séance importée (montre, Intervals) : elle prend le nom de la séance prévue (ex. « Seuil 30 »)
      if (s.source !== 'manuel') {
        complete.titre = prevue.titre
        complete.type = complete.type ?? prevue.type
      }
    }
  }
  await enregistrer(db.seances, complete)
  if (complete.prevueId) {
    const p = await db.prevues.get(complete.prevueId)
    if (p && p.statut !== 'faite') await enregistrer(db.prevues, { ...p, statut: 'faite' })
  }
  return complete
}

export async function supprimerSeance(id: string) {
  const s = await db.seances.get(id)
  await supprimer(db.seances, id)
  if (s?.prevueId) {
    const p = await db.prevues.get(s.prevueId)
    if (p?.statut === 'faite') await enregistrer(db.prevues, { ...p, statut: 'prevue' })
  }
}

/** Dernière séance (éventuellement d'un sport donné). */
export async function derniereSeance(sport?: Seance['sport']) {
  const toutes = await db.seances.orderBy('date').reverse().toArray()
  return toutes.find((s) => !sport || s.sport === sport)
}

/** Lundi de la semaine d'une date. */
export function lundiDe(jour: string) {
  const d = new Date(`${jour}T12:00:00`)
  const decalage = (d.getDay() + 6) % 7
  return decalerJour(jour, -decalage)
}

export const nouvelId = () => crypto.randomUUID()
