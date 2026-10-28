import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../core/db'
import { aujourdhui } from '../../core/dates'
import type { Profil } from '../../core/profil'
import { enregistrer } from '../../core/stockage'
import { decisionCycle, maxEstime, PART_REFERENCE, referenceDepuisMax, referenceSuivante, type Objectif, type Semaine, type Verdict } from './programme'

/** Une séance notée. */
export interface SeanceMuscu {
  date: string
  cycle: number
  semaine: Semaine
  reference: number
  /** Série « + » : charge et reps faites */
  plus?: { kg: number; reps: number }
  /** Max estimé d'après la série « + » */
  maxEstime?: number
  /** État juste avant cette séance, pour pouvoir l'annuler */
  avant: Omit<EtatMuscu, 'seances'>
}

/** Tout le module tient dans un réglage synchronisé (« muscu »). */
export interface EtatMuscu {
  /** Max de départ (kg) et jour où il a été donné */
  max?: number
  maxLe?: string
  /** Référence du cycle en cours (kg) et part du max utilisée pour la calculer */
  reference?: number
  part?: number
  cycle: number
  semaine: Semaine
  /** Décision prise en semaine 3, appliquée après l'allègement */
  decision?: { verdict: Verdict; raison: string }
  /** 1 seule rep à 95 % au cycle précédent */
  unAuCyclePrecedent?: boolean
  seances: SeanceMuscu[]
}

const CLE = 'muscu'
const DEPART: EtatMuscu = { cycle: 1, semaine: 1, seances: [] }

const lire = async () => ({ ...DEPART, ...((await db.reglages.get(CLE))?.valeur as Partial<EtatMuscu> | undefined) })
const ecrire = (e: EtatMuscu) => enregistrer(db.reglages, { id: CLE, valeur: e })

export const useMuscu = () => useLiveQuery(lire)

/** Objectif nutritionnel (réglé dans Entraînement → Réglages → Profil). */
export async function objectifActuel(): Promise<Objectif> {
  return ((await db.reglages.get('profil'))?.valeur as Profil | undefined)?.objectif === 'perte' ? 'perte' : 'maintien'
}
export const useObjectif = () => useLiveQuery(objectifActuel)

/** Donne le max (connu, ou estimé d'après une série) et démarre un nouveau cycle. L'historique est gardé. */
export async function demarrer(kg: number, reps: number) {
  const objectif = await objectifActuel()
  const max = maxEstime(kg, reps)
  const e = await lire()
  await ecrire({ ...e, max, maxLe: aujourdhui(), reference: referenceDepuisMax(max, objectif), part: PART_REFERENCE[objectif], cycle: e.seances.length ? e.cycle + 1 : 1, semaine: 1, decision: undefined, unAuCyclePrecedent: undefined })
}

/** Note la séance du jour et passe à la suivante. Renvoie un message à afficher. */
export async function noterSeance(repsPlus: number | undefined, kgPlus: number | undefined) {
  const e = await lire()
  if (!e.reference) return
  const { seances, ...avant } = e
  const seance: SeanceMuscu = {
    date: aujourdhui(), cycle: e.cycle, semaine: e.semaine, reference: e.reference, avant,
    ...(repsPlus !== undefined && kgPlus ? { plus: { kg: kgPlus, reps: repsPlus }, maxEstime: maxEstime(kgPlus, Math.max(1, repsPlus)) } : {}),
  }
  const suivant: EtatMuscu = { ...e, seances: [...seances, seance] }
  let message = 'Séance notée ✓'

  if (e.semaine === 3 && repsPlus !== undefined) {
    suivant.decision = decisionCycle(repsPlus, !!e.unAuCyclePrecedent)
    message = suivant.decision.raison
  }
  if (e.semaine < 4) {
    suivant.semaine = (e.semaine + 1) as Semaine
  } else {
    // Fin de l'allègement : nouveau cycle avec la référence décidée en semaine 3
    const objectif = await objectifActuel()
    const verdict = e.decision?.verdict ?? 'stable'
    const reps3 = seances.findLast((s) => s.cycle === e.cycle && s.semaine === 3)?.plus?.reps
    suivant.reference = referenceSuivante(e.reference, verdict, e.part ?? PART_REFERENCE[objectif], PART_REFERENCE[objectif])
    suivant.part = PART_REFERENCE[objectif]
    suivant.cycle = e.cycle + 1
    suivant.semaine = 1
    suivant.unAuCyclePrecedent = reps3 === 1 && verdict !== 'baisse'
    suivant.decision = undefined
    message = `Nouveau cycle : référence ${suivant.reference.toLocaleString('fr-FR')} kg`
  }
  await ecrire(suivant)
  return message
}

/** Annule la dernière séance notée (erreur de saisie). */
export async function annulerDerniere() {
  const e = await lire()
  const derniere = e.seances.at(-1)
  if (!derniere) return
  await ecrire({ ...derniere.avant, seances: e.seances.slice(0, -1) })
}
