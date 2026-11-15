/**
 * Nutrition autour d'une séance (consensus ACSM / AND / DC, Thomas 2016 ; Jeukendrup 2014 ; relectures des 10 et
 * 15/11/2026) :
 *  - < 45 min : eau ; 45-75 min : un peu (ou bain de bouche) si c'est intense ;
 *  - 1 h 15-2 h 30 : 30-60 g de glucides par heure ; > 2 h 30 : 60-90 g/h ; au-delà de 90 g/h, plus de sucre
 *    oxydé mais pas plus de réserves épargnées (Podlogar 2022) ;
 *  - boire selon la soif (Kenefick 2018), environ 500-750 mL/h au chaud ou sur home trainer (ACSM, Sawka 2007 :
 *    0,4-0,8 L/h), du sel au-delà de 2 h (≈ 500-700 mg par litre, ACSM 2007 ; par heure, selon la sueur) ;
 *  - glucose + fructose seulement au-delà de 60 g/h (le glucose seul sature vers 60 g/h, Jeukendrup 2014) ;
 *  - après une séance dure ou longue : ≈ 0,3 g de protéines par kg (Thomas 2016) ; si une séance dure suit dans
 *    moins de 8 h, recharge rapide ≈ 1 g de glucides par kg et par heure pendant 4 h (Burke 2011).
 * Les glucides pris pendant l'effort comptent dans les glucides du jour.
 * Par discipline (relecture du 10/11/2026) : short track (XCC) eau, rinçage de bouche facultatif (Brietzke 2019) ;
 * XCO 40-60 g/h surtout en boisson (choix d'entraîneur : haut de la fourchette à cause de l'intensité) ; mélange
 * glucose:fructose 2:1 jusqu'à 90 g/h (Jeukendrup 2014), ~1:0,8 au-delà (O'Brien 2013, Rowlands 2015).
 * Jour de course (> 2 h 30) : ce que ton ventre a toléré à l'entraînement, rien de nouveau le jour J (Jeukendrup 2017).
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
  /** Course longue : palier toléré à l'entraînement (g/h) ; absent = ventre pas entraîné */
  palierTolere?: number
  /** Poids (kg) : protéines et recharge rapide à ta mesure */
  kg?: number
  /** Une séance dure (ou une course) suit dans moins de 8 h : recharge rapide */
  rechargeRapide?: boolean
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
  } else if (s.epreuve && s.epreuve !== 'xco' && s.dureeMin > 150) {
    // Jour de course longue : la dose que ton ventre a tolérée à l'entraînement, jamais moins de 60 g/h
    const gph = Math.max(60, Math.min(90, s.palierTolere ?? 60))
    glucides = [arrondi5(60 * h), arrondi5(gph * h)]
    pendant = s.palierTolere
      ? `${gph} g de glucides par heure (ce que ton ventre a toléré à l'entraînement), soit ≈ ${glucides[1]} g, toutes les 20 min${s.epreuve === 'en-ligne' ? ', dans les moments calmes' : ''}. Rien de nouveau aujourd'hui.`
      : `60 g de glucides par heure (ton ventre n'a pas été entraîné à plus), soit ≈ ${glucides[0]} g, toutes les 20 min${s.epreuve === 'en-ligne' ? ', dans les moments calmes' : ''}. Rien de nouveau aujourd'hui.`
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
    // Dès la 30e minute : la quantité compte les heures après ce début (avant, une sortie de 2 h donnait 60-120 g)
    const nourri = h - 0.5
    glucides = [arrondi5(30 * nourri), arrondi5(60 * nourri)]
    pendant = `30-60 g de glucides par heure${s.epreuve === 'en-ligne' ? ' (dans les moments calmes)' : ''}, soit ${glucides[0]}-${glucides[1]} g au total (boisson d'effort, gels, barre), dès la 30e minute.`
  } else {
    glucides = [arrondi5(60 * h), arrondi5(90 * h)]
    pendant = `60-90 g de glucides par heure, soit ${glucides[0]}-${glucides[1]} g au total, régulièrement toutes les 20 min.`
  }

  const ht = s.sport === 'velo' && s.homeTrainer !== false
  // Une seule consigne de boisson (relecture du 15/11/2026)
  const sel = s.dureeMin > 120 ? ', avec du sel (boisson d’effort ou une pincée)' : ''
  const hydratation = !endurance && s.dureeMin < 60
    ? 'Selon ta soif.'
    : ht
      ? `Selon ta soif, environ 500-750 mL par heure sur home trainer (≈ ${Math.round((Math.max(0.5, h) * 600) / 50) * 50} mL)${sel}, et un ventilateur.`
      : `Selon ta soif ; s’il fait chaud, environ 500-750 mL par heure${sel}.`

  const avant = s.test || (dure && endurance) || longue
    ? 'Repas riche en glucides 2-3 h avant (ou une collation 1 h avant : banane, pain, compote).'
    : undefined

  const proteines = s.kg ? `≈ ${Math.round((0.3 * s.kg) / 5) * 5} g de protéines` : '≈ 0,3 g de protéines par kg'
  const recharge = s.rechargeRapide && (dure || longue)
    ? ` Autre séance dure aujourd’hui : entre les deux, recharge vite, ≈ ${s.kg ? `${Math.round(s.kg / 5) * 5} g` : '1 g par kg'} de glucides par heure pendant 4 h.`
    : ''
  const apres = dure || longue
    ? `${proteines} dans les 2 h (repas ou collation : skyr, lait, œufs…), avec des glucides.${recharge}`
    : 'Ton repas habituel suffit.'

  const gph = glucides ? (glucides[1] / Math.max(h, 0.25)) : 0
  // Mélange de sucres seulement au-delà de 60 g/h : en dessous, un seul sucre suffit
  const melange = glucides && s.dureeMin >= 75 && gph > 60
    ? `Glucose + fructose ${gph > 90 ? 'à parts presque égales (1 : 0,8)' : '2 pour 1'} ; sel ≈ 500-700 mg par litre de boisson (plus si tu sues salé).`
    : undefined
  return { avant, pendant, hydratation, apres, glucides, melange }
}

/**
 * Habituer ton ventre (relecture du 10/11/2026 : Costa 2017, Miall 2018, Cox 2010 ; délai d'adaptation inconnu,
 * Jeukendrup 2017 ; protocole = choix d'entraîneur) : pour une course A de plus de 2 h 30, les 6 semaines avant,
 * 1 sortie longue par semaine ; départ 60 g/h, +10 g/h par semaine jusqu'à la cible de 90 g/h (relecture du
 * 15/11/2026 : au-delà, pas plus de réserves épargnées, Podlogar 2022 ; le jour de la course, le palier toléré) ; ventre noté 5 ou plus la fois d'avant : même palier ; 7 ou plus : −10 g/h.
 */
export const SEMAINES_VENTRE = 6
/** Palier de la semaine `semaine` (0 = 1re semaine) ; `notes[i]` : ventre noté après la sortie de la semaine i (absent : pas noté). */
export function palierVentre(o: { semaine: number; notes: (number | undefined)[]; dureeCourseMin: number; depart?: number }) {
  const cible = 90
  let palier = o.depart ?? 60
  for (let i = 0; i < o.semaine; i++) {
    const n = o.notes[i]
    palier = n !== undefined && n >= 7 ? palier - 10 : n !== undefined && n >= 5 ? palier : palier + 10
    palier = Math.max(40, Math.min(cible, palier))
  }
  return palier
}
