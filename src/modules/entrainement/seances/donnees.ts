import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import type { Profil } from '../../../core/profil'
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
  return b.every((x) => x !== undefined) ? (b as BornesZones) : [143, 163, 184, 194]
}

/** Charge le contexte depuis la base : profil, réglages, FC de repos = moyenne des 7 derniers matins. */
export async function chargerContexte(): Promise<Contexte> {
  const profil = { fcMax: 204, ...((await db.reglages.get('profil'))?.valeur as Profil | undefined) }
  const r = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined
  const reglages = { zonesVelo: [], seuilCoursePct: 87, chargeRef: 'trimp', vmaKmh: 18.5, ...r } as ReglagesEntrainement
  const matins = await db.mesures.where('date').between(decalerJour(aujourdhui(), -6), aujourdhui(), true, true).toArray()
  const fc = matins.map((m) => m.fcRepos).filter((x): x is number => x !== undefined)
  return {
    fcRepos: fc.length ? fc.reduce((a, b) => a + b, 0) / fc.length : FC_REPOS_DEFAUT,
    fcMax: profil.fcMax ?? 204,
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
  } else {
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

/** Doublon : même sport et départ à ± 2 minutes (ou même jour si pas d'heure). */
export async function trouverDoublon(s: Pick<Seance, 'id' | 'date' | 'debut' | 'sport' | 'idExterne'>) {
  const memeJour = await db.seances.where('date').equals(s.date).toArray()
  return memeJour.find((x) => {
    if (x.id === s.id || x.sport !== s.sport) return false
    if (s.idExterne && x.idExterne === s.idExterne) return true
    if (!x.debut || !s.debut) return false
    return Math.abs(new Date(x.debut).getTime() - new Date(s.debut).getTime()) <= 2 * 60_000
  })
}

/**
 * Enregistre une séance : calcule ses métriques, la rattache à la séance prévue
 * du même jour et du même sport (marquée « faite »).
 */
export async function enregistrerSeance(s: Seance) {
  const c = await chargerContexte()
  const complete = completerMetriques(s, c)
  if (!complete.prevueId) {
    const prevue = (await db.prevues.where('date').equals(s.date).toArray()).find((p) => p.sport === s.sport && p.statut === 'prevue')
    if (prevue) complete.prevueId = prevue.id
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
