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
  testsCp: ['2026-10-30'],
  competitions: [{ date: '2026-12-13', nom: '5 km route' }],
}

/** Valeurs de départ : VMA Campus Coach et zones Frive de début de programme. */
const DEFAUT: ReglagesEntrainement = {
  vmaKmh: 18.5,
  zonesVelo: [
    { nom: 'Z1', wMin: 104, wMax: 148, fcMin: 114, fcMax: 143 },
    { nom: 'Z2', wMin: 148, wMax: 202, fcMin: 143, fcMax: 163 },
    { nom: 'Z3', wMin: 202, wMax: 256, fcMin: 163, fcMax: 184 },
    { nom: 'Z4', wMin: 256, wMax: 296, fcMin: 184, fcMax: 194 },
    { nom: 'Z5', wMin: 296, wMax: 431, fcMin: 194, fcMax: 204 },
    { nom: 'Sprint', wMin: 674 },
  ],
  seuilCoursePct: 87,
  chargeRef: 'trimp',
  modeleCible: 'polarise',
  tests: [{ date: '2026-09-01', type: 'vma', valeur: 18.5 }],
  programme: PROGRAMME_DEFAUT,
}

export const useReglagesEntrainement = () => useReglage<ReglagesEntrainement>('entrainement', DEFAUT)
