import { construireIntervalles, formatDe, palierRaccourci, type Etape } from '../../../metrics/programme'
import type { Couleur } from '../../../metrics/signal'
import type { SeancePrevue } from '../types'

export interface Adaptation {
  /** Ce qu'il faut faire, en une phrase */
  texte: string
  /** Déroulé à suivre (version adaptée le cas échéant) */
  etapes?: Etape[]
  modifiee: boolean
}

const INTENSITES = ['vo2-courts', 'vo2-longs', 'seuil', 'seuil-variable', 'sweet-spot', 'tempo']
const arrondi5 = (n: number) => Math.round(n / 5) * 5

/**
 * Séance du jour selon le feu :
 *  - 🟢 séance prévue ;
 *  - 🟠 intensité raccourcie (une série en moins ou un tiers des répétitions en moins, mêmes watts) ;
 *  - 🔴 intensité supprimée : 30 à 45 min très facile, ou repos.
 * Une séance raccourcie ou supprimée ne compte pas pour la progression.
 */
export function adapterDuJour(p: SeancePrevue, couleur: Couleur): Adaptation {
  const etapes = p.velo?.etapes
  if (couleur === 'vert') return { texte: 'Séance prévue maintenue.', etapes, modifiee: false }

  const intensiteVelo = p.velo && INTENSITES.includes(p.velo.famille)
  // Watts « très facile » : moitié de la CP, retrouvée depuis la cible de la séance
  const f = p.velo?.formatId ? formatDe(p.velo.formatId) : undefined
  const cpEff = f && p.velo?.cibleW ? p.velo.cibleW / (f.pct / 100) : undefined
  const tresFacile = (min: number): Etape[] => [{ debutSec: 0, dureeSec: min * 60, libelle: 'Très facile, pédale souple (RPE ≤ 2)', w: cpEff ? arrondi5(cpEff * 0.5) : p.velo?.cibleW ? arrondi5(p.velo.cibleW * 0.8) : undefined }]

  if (couleur === 'rouge') {
    if (p.sport === 'velo') return { texte: 'Feu rouge : intensité supprimée. 30 à 45 min très facile, ou repos complet.', etapes: tresFacile(40), modifiee: true }
    if (p.sport === 'course') return { texte: 'Feu rouge : remplace par 30 min de footing très facile, ou repos complet.', modifiee: true }
    return { texte: 'Feu rouge : repos ou mobilité légère.', modifiee: true }
  }

  // Orange
  if (p.velo?.famille === 'test') return { texte: 'Feu orange : reporte le test (il faut être frais pour qu’il soit juste). Fais 45 min de Z2 à la place.', modifiee: true }
  if (intensiteVelo && f && cpEff) {
    const court = construireIntervalles(f, palierRaccourci(f, p.velo!.palier ?? 0), cpEff, 0)
    return { texte: `Feu orange : version raccourcie, mêmes watts (${court.titre}, ${court.dureeMin} min).`, etapes: court.velo.etapes, modifiee: true }
  }
  if (p.sport === 'course' && p.intensite === 'haute') return { texte: 'Feu orange : version courte, enlève un tiers des fractions, mêmes allures.', modifiee: true }
  return { texte: 'Feu orange : séance facile maintenue, reste bien tranquille.', etapes, modifiee: false }
}
