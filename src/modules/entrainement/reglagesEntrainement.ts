import { useReglage } from '../../core/reglages'
import type { ReglagesEntrainement } from './types'

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
}

export const useReglagesEntrainement = () => useReglage<ReglagesEntrainement>('entrainement', DEFAUT)
