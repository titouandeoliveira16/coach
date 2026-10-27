import { useReglage } from '../../core/reglages'
import type { ReglagesEntrainement, ReglagesProgramme } from './types'

/** Semaine type : footing lundi, intensité vélo mardi, renfo mercredi, intensité course jeudi, Z2 vendredi, sortie longue course samedi, vélo long dimanche. */
export const PROGRAMME_DEFAUT: ReglagesProgramme = {
  semaineType: ['course', 'velo-dur', 'renfo', 'course', 'velo-z2', 'course', 'velo-long'],
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
  competitions: [{ date: '2026-12-13', nom: '5 km route' }],
}

/**
 * Programme enregistré + valeurs par défaut. Les versions d'avant les tests courts (un seul test le 30/10)
 * reçoivent le calendrier de tests de la saison.
 */
export function programmeDe(p?: Partial<ReglagesProgramme>): ReglagesProgramme {
  const prog = { ...PROGRAMME_DEFAUT, ...p }
  if (p && p.testsCourts === undefined) {
    const autres = (p.testsCp ?? []).filter((d) => d !== '2026-10-30')
    prog.testsCp = [...new Set([...PROGRAMME_DEFAUT.testsCp, ...autres])].sort()
    prog.testsCourts = PROGRAMME_DEFAUT.testsCourts
  }
  return prog
}

/** Valeurs neutres de départ : les vraies zones vivent dans tes données (Réglages → Avancé → Zones), jamais dans le code. */
const DEFAUT: ReglagesEntrainement = {
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

export const useReglagesEntrainement = () => useReglage<ReglagesEntrainement>('entrainement', DEFAUT)
