/**
 * Développé couché, méthode 5/3/1 (Wendler), adaptée d'après la littérature (relecture du 28/10/2026) :
 *  - max estimé sans test à 1 répétition : formule d'Epley, charge × (1 + reps / 30), fiable jusqu'à ~10 reps
 *    (Reynolds 2006) ;
 *  - référence (« training max ») = 85 % du max en perte de gras, 90 % en maintien (Wendler : 85 % dans ses
 *    écrits récents, plus prudent en déficit), arrondie au 2,5 kg inférieur, fixe pendant le cycle ;
 *  - pas d'échec : la série « + » s'arrête à 1 répétition en réserve, 10 au plus (Grgic 2022, Refalo 2023 :
 *    l'échec n'apporte rien de plus pour la force ; Helms 2016 pour les répétitions en réserve) ;
 *  - volume : 3 séries lourdes, c'est peu (Ralston 2017, Schoenfeld 2017) → 5×5 à la charge de la 1re série
 *    (« First Set Last »), sauf en semaine d'allègement ;
 *  - progression décidée par la série « + » à 95 % (semaine 3), inspirée de l'autorégulation (APRE, Mann 2010) :
 *    3 reps ou plus → +2,5 kg ; 1-2 → stable ; 0, ou 1 deux cycles de suite → −10 %.
 *  Le 5/3/1 lui-même n'a pas été étudié : chaque règle s'appuie sur la recherche, l'ensemble reste un choix d'entraîneur.
 */
export type Objectif = 'maintien' | 'perte'
export type Semaine = 1 | 2 | 3 | 4

/** Part du max qui sert de référence, selon l'objectif nutritionnel. */
export const PART_REFERENCE: Record<Objectif, number> = { perte: 0.85, maintien: 0.9 }
export const BARRE_KG = 20
/** La série « + » s'arrête là : au-delà, l'estimation du max devient imprécise. */
export const PLAFOND_REPS = 10
/** Repos (secondes) : séries lourdes (Schoenfeld 2016 : 3 min > 1 min) et séries complémentaires. */
export const REPOS_LOURD = 180
export const REPOS_COMPLEMENTAIRE = 120

export const SEMAINES: Record<Semaine, { nom: string; pct: number[]; reps: number[]; plus: boolean }> = {
  1: { nom: '5 / 5 / 5+', pct: [0.65, 0.75, 0.85], reps: [5, 5, 5], plus: true },
  2: { nom: '3 / 3 / 3+', pct: [0.7, 0.8, 0.9], reps: [3, 3, 3], plus: true },
  3: { nom: '5 / 3 / 1+', pct: [0.75, 0.85, 0.95], reps: [5, 3, 1], plus: true },
  4: { nom: 'Allègement', pct: [0.4, 0.5, 0.6], reps: [5, 5, 5], plus: false },
}

/** Au 2,5 kg inférieur (jamais sous la barre seule). */
export const arrondi = (kg: number) => Math.max(BARRE_KG, Math.floor(kg / 2.5 + 1e-9) * 2.5)

/** Max estimé (Epley) d'après une série faite près du maximum ; 1 rep = le max lui-même. */
export const maxEstime = (kg: number, reps: number) => (reps <= 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10)

export const referenceDepuisMax = (max: number, objectif: Objectif) => arrondi(max * PART_REFERENCE[objectif])

export interface Serie {
  kg: number
  reps: number
  /** Dernière série : le plus de reps possible, en gardant 1 en réserve */
  plus?: boolean
}

export interface SeanceProgramme {
  echauffement: Serie[]
  principales: Serie[]
  /** 5×5 à la charge de la 1re série (semaines 1 à 3) */
  complementaires: Serie[]
}

export function seanceDe(semaine: Semaine, reference: number): SeanceProgramme {
  const s = SEMAINES[semaine]
  const principales = s.pct.map((p, i) => ({ kg: arrondi(reference * p), reps: s.reps[i], plus: s.plus && i === 2 ? true : undefined }))
  const premiere = principales[0].kg
  const echauffement = [{ kg: BARRE_KG, reps: 10 }]
  if (semaine !== 4) {
    for (const [p, reps] of [[0.4, 5], [0.5, 5], [0.6, 3]] as const) {
      const kg = arrondi(reference * p)
      if (kg > echauffement[echauffement.length - 1].kg && kg < premiere) echauffement.push({ kg, reps })
    }
  }
  const complementaires = semaine === 4 ? [] : Array.from({ length: 5 }, () => ({ kg: premiere, reps: 5 }))
  return { echauffement, principales, complementaires }
}

export type Verdict = 'plus' | 'stable' | 'baisse'

/** Fin de cycle, d'après la série « + » à 95 % (semaine 3). */
export function decisionCycle(repsSemaine3: number, unAuCyclePrecedent: boolean): { verdict: Verdict; raison: string } {
  if (repsSemaine3 >= 3) return { verdict: 'plus', raison: `${repsSemaine3} reps à 95 % : tu es plus fort, référence +2,5 kg au prochain cycle` }
  if (repsSemaine3 === 0) return { verdict: 'baisse', raison: '0 rep à 95 % : référence −10 % au prochain cycle, pour repartir sur des séries propres' }
  if (repsSemaine3 === 1 && unAuCyclePrecedent) return { verdict: 'baisse', raison: '1 seule rep à 95 % deux cycles de suite : référence −10 % pour relancer la progression' }
  return { verdict: 'stable', raison: `${repsSemaine3} rep${repsSemaine3 > 1 ? 's' : ''} à 95 % : on garde la même référence, le temps de consolider` }
}

/** Référence du cycle suivant : verdict, puis passage au pourcentage de l'objectif actuel s'il a changé. */
export function referenceSuivante(reference: number, verdict: Verdict, partAvant: number, partMaintenant: number) {
  const r = verdict === 'plus' ? reference + 2.5 : verdict === 'baisse' ? arrondi(reference * 0.9) : reference
  return partAvant === partMaintenant ? r : arrondi((r / partAvant) * partMaintenant)
}

/** Reps minimum de la série « + » (sous ce nombre, la référence est trop haute). */
export const repsMinimum = (semaine: Semaine) => SEMAINES[semaine].reps[2]
