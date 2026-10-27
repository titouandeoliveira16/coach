import type { Intensite, Seance, SeancePrevue } from '../types'

/**
 * Contrôle FC d'une séance faite, selon le type de séance prévu. Repères d'entraîneur, pas des seuils prouvés
 * (relecture scientifique du 27/10/2026) : ils comptent surtout en tendance, sur plusieurs séances au frais.
 *  - facile : dérive cardiaque (découplage puissance ou vitesse / FC entre 1re et 2e moitié) ;
 *  - seuil, sweet spot, tempo : la FC doit faire un plateau dans chaque bloc (sous la CP, état stable) ;
 *  - VO2 longs : temps passé à 90 % ou plus de la FC max ;
 *  - intervalles courts (30/15…), over-unders, tests : pas de verdict (la FC suit avec retard).
 */
/** Découplage (Friel, TrainingPeaks) : < 5 % bonne endurance, 5-10 % limite ou fatigue, > 10 % trop dur. */
export const DERIVE_FACILE = { ok: 5, moyen: 10 }
/** Montée de FC dans un bloc sous la CP : elle monte toujours un peu (domaine lourd, Jones 2019). */
export const DERIVE_BLOC = { ok: 5, moyen: 8 }
/** « Au-dessus de la CP » seulement si la FC monte de plus de 8 % ET finit à 95 % de la FC max ou plus. */
export const FC_FIN_HAUTE = 0.95
export const MIN_FC90 = { ok: 8, moyen: 4 }

export type Categorie = 'facile' | 'plateau' | 'vo2' | 'sans'
export type Verdict = { couleur: 'vert' | 'orange' | 'rouge' | 'gris'; texte: string }

/** Type de séance pour le contrôle FC et la question « en réserve ». */
export function categorieDe(s: Seance, prevue: SeancePrevue | undefined, domaine: Intensite): Categorie {
  const f = prevue?.velo?.famille
  if (f === 'z2' || f === 'z2-long') return 'facile'
  if (f === 'seuil' || f === 'sweet-spot' || f === 'tempo') return 'plateau'
  if (f === 'vo2-longs') return 'vo2'
  if (f) return 'sans'
  if (prevue) return prevue.intensite === 'basse' ? 'facile' : 'sans'
  return domaine === 'basse' && s.sport !== 'natation' ? 'facile' : 'sans'
}

export function controleFc(s: Seance, categorie: Categorie, fcMax: number): Verdict | undefined {
  if (s.sansCeinture) return { couleur: 'gris', texte: 'Sans ceinture cardio : FC non jugée, verdict sur ton ressenti.' }
  const sansFc = !s.fcMoy
  if (categorie === 'facile') {
    if (sansFc) return { couleur: 'gris', texte: 'Pas de FC sur cette séance : verdict sur ton ressenti.' }
    if (s.decouplage === undefined) return s.dureeSec < 45 * 60 ? undefined : { couleur: 'gris', texte: 'FC trop incomplète pour juger la dérive.' }
    const d = Math.max(0, s.decouplage)
    const v = d.toFixed(1).replace('.', ',')
    if (d < DERIVE_FACILE.ok) return { couleur: 'vert', texte: `FC stable (dérive ${v} %)` }
    if (d <= DERIVE_FACILE.moyen) return { couleur: 'orange', texte: `FC qui dérive un peu (${v} %) : chaleur, hydratation ou fatigue ?` }
    return { couleur: 'rouge', texte: `FC qui monte trop (${v} %) : séance plus dure que prévu, ou fatigue` }
  }
  if (categorie === 'plateau') {
    if (sansFc) return { couleur: 'gris', texte: 'Pas de FC sur cette séance : verdict sur les watts et ton ressenti.' }
    const d = s.blocs?.deriveFc
    if (!d?.length) return undefined
    const max = Math.max(...d)
    const n = d.length
    if (max <= DERIVE_BLOC.ok) return { couleur: 'vert', texte: `FC en plateau sur ${n > 1 ? `tes ${n} blocs` : 'ton bloc'}` }
    const finHaute = (s.blocs?.fcFin ?? []).some((f) => f >= FC_FIN_HAUTE * fcMax)
    if (max > DERIVE_BLOC.moyen && finHaute)
      return { couleur: 'rouge', texte: `FC qui ne se stabilise pas (+${Math.round(max)} %, jusqu'à ${Math.max(...s.blocs!.fcFin!)} bpm) : au-dessus de ton seuil, watts trop hauts ou fatigue` }
    return { couleur: 'orange', texte: `FC qui monte encore en fin de bloc (+${Math.round(max)} %) : un peu plus dur que visé (chaleur, fatigue ?)` }
  }
  if (categorie === 'vo2') {
    if (sansFc) return { couleur: 'gris', texte: 'Pas de FC sur cette séance : verdict sur les watts et ton ressenti.' }
    if (s.tempsFc90 === undefined) return undefined
    const min = Math.round(s.tempsFc90 / 60)
    if (min >= MIN_FC90.ok) return { couleur: 'vert', texte: `${min} min à 90 % ou plus de ta FC max : bon stimulus VO2` }
    if (min >= MIN_FC90.moyen) return { couleur: 'orange', texte: `${min} min à 90 % ou plus de ta FC max : stimulus moyen (visé ≈ 10 min)` }
    return { couleur: 'rouge', texte: `Seulement ${min} min à 90 % ou plus de ta FC max : stimulus faible` }
  }
  return undefined
}

/**
 * Question « en réserve » selon le type de séance (proximité de l'échec ; test de la parole pour le facile).
 * Seuil, sweet spot : 1 à 3 en réserve (0 = trop dur) ; VO2 et intervalles : 0 à 1.
 */
export function questionReserve(categorie: Categorie) {
  if (categorie === 'facile') return { question: 'Tu pouvais parler en phrases complètes tout du long ?', choix: { ok: 'Oui', moyen: 'Par moments', non: 'Non' } }
  if (categorie === 'plateau') return { question: 'Combien de minutes en réserve à la fin des blocs ?', choix: { ok: '1 à 3', moyen: '0, à bloc', non: '4 et +' } }
  return { question: 'Combien de répétitions en réserve à la fin ?', choix: { ok: '0 à 1', moyen: '2', non: '3 et +' } }
}

/** Ce que veut dire la réponse « en réserve ». */
export function texteReserve(categorie: Categorie, r: 'ok' | 'moyen' | 'non') {
  if (categorie === 'facile')
    return { ok: 'Parfait : vraie séance facile.', moyen: 'Un peu juste pour une séance facile : surveille ta fatigue.', non: 'Trop dur pour une séance facile : ralentis la prochaine fois, ou fatigue.' }[r]
  if (categorie === 'plateau')
    return { ok: 'Parfait : effort de seuil bien dosé.', moyen: 'À bloc : un peu trop dur pour du seuil.', non: 'Beaucoup de marge : watts peut-être trop bas.' }[r]
  return { ok: 'Parfait : proche de l’échec, comme voulu.', moyen: 'Bien, encore un peu de marge.', non: 'Il restait beaucoup de marge : watts peut-être trop bas.' }[r]
}
