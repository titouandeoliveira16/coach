import { migrerBase } from '../../metrics/saison'
import { useReglage } from '../../core/reglages'
import type { ReglagesEntrainement, ReglagesProgramme } from './types'

/**
 * Programme de repli, le temps que le questionnaire d'arrivée calcule la saison (tous les comptes y passent depuis
 * 11/2026 : l'ancienne saison écrite à la main de Titouan, course à pied comprise, est abandonnée). Vélo seul.
 */
export const PROGRAMME_DEFAUT: ReglagesProgramme = {
  semaineType: ['libre', 'velo-dur', 'renfo', 'libre', 'velo-z2', 'libre', 'velo-long'],
  maxSemaineMin: 75,
  maxLongMin: 120,
  minLongMin: 90,
  phases: [
    { debut: '2026-10-26', type: 'reprise' },
    { debut: '2026-12-14', type: 'vo2' },
    { debut: '2027-02-01', type: 'seuil' },
    { debut: '2027-03-15', type: 'entretien' },
  ],
  // Tests complets le dimanche (créneau long : 30' de récupération entre les efforts), tests courts en début de phase
  testsCp: ['2026-11-01', '2026-12-15', '2027-02-02', '2027-03-21'],
  testsCourts: ['2026-12-15', '2027-02-02'],
  competitions: [],
}

/**
 * Programme enregistré + valeurs par défaut. Les versions d'avant les tests courts (un seul test le 30/10)
 * reçoivent le calendrier de tests de la saison.
 */
export function programmeDe(p?: Partial<ReglagesProgramme>): ReglagesProgramme {
  const prog = { ...PROGRAMME_DEFAUT, ...p }
  // Phases absentes ou vides (données abîmées) : celles par défaut, pour que la semaine puisse toujours se calculer
  if (!prog.phases?.length) prog.phases = PROGRAMME_DEFAUT.phases
  // Saison calculée avant le 10/11/2026 : longue reprise → 2 semaines de reprise puis une base
  if (prog.modele === 'chauvin') prog.phases = migrerBase(prog.phases)
  if (p && p.testsCourts === undefined) {
    const autres = (p.testsCp ?? []).filter((d) => d !== '2026-10-30')
    prog.testsCp = [...new Set([...PROGRAMME_DEFAUT.testsCp, ...autres])].sort()
    prog.testsCourts = PROGRAMME_DEFAUT.testsCourts
  }
  return prog
}

/** Semaine type (jours et durées) qui s'applique la semaine de ce lundi : la plus récente des semaines types à venir déjà commencées. */
export function programmeAu(p: ReglagesProgramme, lundi: string): ReglagesProgramme {
  const c = [...(p.semainesTypesFutures ?? [])].filter((x) => x.debut <= lundi).sort((a, b) => a.debut.localeCompare(b.debut)).at(-1)
  return c ? { ...p, semaineType: c.semaineType, maxSemaineMin: c.maxSemaineMin ?? p.maxSemaineMin, maxLongMin: c.maxLongMin ?? p.maxLongMin } : p
}

/** Les semaines types à venir déjà commencées deviennent la semaine type (elles quittent la liste). */
export function fusionnerSemainesPassees(p: ReglagesProgramme, lundi: string): ReglagesProgramme {
  const passees = (p.semainesTypesFutures ?? []).filter((x) => x.debut <= lundi)
  if (!passees.length) return p
  const base = programmeAu(p, lundi)
  return { ...base, semainesTypesFutures: (p.semainesTypesFutures ?? []).filter((x) => x.debut > lundi) }
}

/** Valeurs neutres de départ : les vraies zones vivent dans tes données (Réglages → Avancé → Zones), jamais dans le code. */
export const DEFAUT_ENTRAINEMENT: ReglagesEntrainement = {
  vmaKmh: 18.5,
  zonesVelo: [
    { nom: 'Z1', wMin: 0, wMax: 110, fcMin: 0, fcMax: 130 },
    { nom: 'Z2', wMin: 110, wMax: 150, fcMin: 130, fcMax: 150 },
    { nom: 'Z3', wMin: 150, wMax: 180, fcMin: 150, fcMax: 165 },
    { nom: 'Z4', wMin: 180, wMax: 210, fcMin: 165, fcMax: 177 },
    { nom: 'Z5', wMin: 210, wMax: 300, fcMin: 177, fcMax: 190 },
    { nom: 'Sprint', wMin: 500 },
  ],
  seuilCoursePct: 87,
  chargeRef: 'trimp',
  modeleCible: 'polarise',
  tests: [{ date: '2026-09-01', type: 'vma', valeur: 18.5 }],
  programme: PROGRAMME_DEFAUT,
}

export const useReglagesEntrainement = () => useReglage<ReglagesEntrainement>('entrainement', DEFAUT_ENTRAINEMENT)
