/**
 * Nutrition autour d'une séance (consensus ACSM / AND / DC 2016 ; Jeukendrup ; Podlogar 2022) :
 *  - < 45 min : eau ; 45-75 min : un peu (ou bain de bouche) si c'est intense ;
 *  - 1 h 15-2 h 30 : 30-60 g de glucides par heure ; > 2 h 30 : 60-90 g/h, glucose + fructose ;
 *  - hydratation selon la soif, plus sur home trainer (pas d'air) ; sodium au-delà d'1 h ;
 *  - après une séance dure ou longue : 20-25 g de protéines dans les 2 h.
 * Les glucides pris pendant l'effort comptent dans les glucides du jour.
 * Par discipline (relecture du 10/11/2026) : short track (XCC) eau, rinçage de bouche facultatif (Brietzke 2019) ;
 * XCO 40-60 g/h surtout en boisson (choix d'entraîneur : haut de la fourchette à cause de l'intensité) ; mélange
 * glucose:fructose 2:1 jusqu'à 90 g/h, ~1:0,8 au-delà (Podlogar 2022) ; boisson 400-800 mL/h, sodium ~300-400 mg/h
 * (ACSM), jusqu'à 600 mg/h s'il fait chaud (choix d'entraîneur).
 */
export interface SeanceNutrition {
  sport: 'velo' | 'course' | 'natation' | 'renfo' | 'autre'
  dureeMin: number
  intensite: 'basse' | 'moyenne' | 'haute'
  test?: boolean
  homeTrainer?: boolean
  /** Course (ou simulation) : sa discipline règle les glucides */
  epreuve?: 'en-ligne' | 'cyclo' | 'xco' | 'xcc' | 'xcm'
  /** Habituer ton ventre : palier de la semaine (g/h) pour une sortie longue */
  palierVentre?: number
}

export interface ConseilsNutrition {
  avant?: string
  pendant: string
  hydratation: string
  apres: string
  /** Glucides à prendre pendant la séance (g), fourchette */
  glucides?: [number, number]
  /** Mélange de sucres et sel, quand il y a des glucides à prendre */
  melange?: string
}

const arrondi5 = (n: number) => Math.round(n / 5) * 5

export function conseilsSeance(s: SeanceNutrition): ConseilsNutrition {
  const h = s.dureeMin / 60
  const dure = s.intensite !== 'basse' || !!s.test
  const longue = s.dureeMin >= 90
  const endurance = s.sport === 'velo' || s.sport === 'course'

  let pendant: string
  let glucides: [number, number] | undefined
  if (s.epreuve === 'xcc') {
    pendant = 'De l’eau suffit (20-30 min). Facultatif : te rincer la bouche avec une boisson sucrée.'
  } else if (s.palierVentre && s.dureeMin >= 75) {
    glucides = [arrondi5(s.palierVentre * h), arrondi5(s.palierVentre * h)]
    pendant = `Habituer ton ventre : ${s.palierVentre} g de glucides par heure cette semaine, soit ≈ ${glucides[0]} g, avec tes produits de course, régulièrement toutes les 20 min. Note ton ventre après.`
  } else if (s.epreuve === 'xco' && s.dureeMin >= 45) {
    glucides = [arrondi5(40 * h), arrondi5(60 * h)]
    pendant = `40-60 g de glucides par heure, soit ${glucides[0]}-${glucides[1]} g, surtout en boisson (1 bidon ≈ 60 g) + 1 gel dans une partie roulante.`
  } else if (s.test) {
    glucides = [20, 40]
    pendant = '1 bidon de boisson d’effort (20-40 g de glucides), à boire entre les efforts.'
  } else if (!endurance || s.dureeMin < 45) {
    pendant = 'Rien à manger, de l’eau suffit.'
  } else if (s.dureeMin < 75) {
    if (dure) {
      glucides = [20, 30]
      pendant = '1 bidon de boisson d’effort (20-30 g de glucides), ou au moins un bain de bouche sucré pour les derniers blocs.'
    } else pendant = 'Rien à manger, de l’eau suffit.'
  } else if (s.dureeMin <= 150) {
    glucides = [arrondi5(30 * h), arrondi5(60 * h)]
    pendant = `30-60 g de glucides par heure, soit ${glucides[0]}-${glucides[1]} g au total (boisson d'effort, gels, barre), dès la 30e minute.`
  } else {
    glucides = [arrondi5(60 * h), arrondi5(90 * h)]
    pendant = `60-90 g de glucides par heure (mélange glucose + fructose), soit ${glucides[0]}-${glucides[1]} g au total, régulièrement toutes les 20 min.`
  }

  const ht = s.sport === 'velo' && s.homeTrainer !== false
  const hydratation = !endurance && s.dureeMin < 60
    ? 'Bois selon ta soif.'
    : ht
      ? `Home trainer : 500-750 ml par heure (≈ ${Math.round((Math.max(0.5, h) * 600) / 50) * 50} ml)${s.dureeMin >= 60 ? ', avec du sodium (boisson d’effort ou une pincée de sel)' : ''}, et un ventilateur.`
      : `Bois selon ta soif${s.dureeMin >= 60 ? ', avec du sodium au-delà d’1 h s’il fait chaud' : ''}.`

  const avant = s.test || (dure && endurance) || longue
    ? 'Repas riche en glucides 2-3 h avant (ou une collation 1 h avant : banane, pain, compote).'
    : undefined

  const apres = dure || longue
    ? '20-25 g de protéines dans les 2 h (repas ou collation : skyr, lait, œufs…), avec des glucides.'
    : 'Ton repas habituel suffit.'

  const gph = glucides ? (glucides[1] / Math.max(h, 0.25)) : 0
  const melange = glucides && s.dureeMin >= 75
    ? `Glucose + fructose ${gph > 90 ? 'à parts presque égales (1 : 0,8)' : '2 pour 1'} ; 400-800 mL de boisson par heure et ~300-400 mg de sodium par heure (jusqu'à 600 s'il fait chaud ou si tu sues salé).`
    : undefined
  return { avant, pendant, hydratation, apres, glucides, melange }
}

/**
 * Habituer ton ventre (relecture du 10/11/2026 : Costa 2017, Miall 2018, Cox 2010 ; délai d'adaptation inconnu,
 * Jeukendrup 2017 ; protocole = choix d'entraîneur) : pour une course A de plus de 2 h 30, les 6 semaines avant,
 * 1 sortie longue par semaine ; départ 60 g/h, +10 g/h par semaine jusqu'à la cible (90, ou 110 au-delà de 4 h de
 * course) ; ventre noté 5 ou plus la fois d'avant : même palier ; 7 ou plus : −10 g/h.
 */
export const SEMAINES_VENTRE = 6
/** Palier de la semaine `semaine` (0 = 1re semaine) ; `notes[i]` : ventre noté après la sortie de la semaine i (absent : pas noté). */
export function palierVentre(o: { semaine: number; notes: (number | undefined)[]; dureeCourseMin: number; depart?: number }) {
  const cible = o.dureeCourseMin > 240 ? 110 : 90
  let palier = o.depart ?? 60
  for (let i = 0; i < o.semaine; i++) {
    const n = o.notes[i]
    palier = n !== undefined && n >= 7 ? palier - 10 : n !== undefined && n >= 5 ? palier : palier + 10
    palier = Math.max(40, Math.min(cible, palier))
  }
  return palier
}
