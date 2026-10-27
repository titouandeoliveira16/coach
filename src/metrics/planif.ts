/**
 * Planification de la semaine : replacement des séances et estimation de la charge prévue.
 * Règles (Seiler ; Foster ; bon sens d'entraîneur) :
 *  - pas deux séances intenses (moyenne ou haute intensité) deux jours de suite,
 *    ce qui garantit au moins un jour léger après une séance « stress » ;
 *  - au plus 2 séances par jour, jamais 2 séances intenses le même jour ;
 *  - sortie longue de préférence le week-end ;
 *  - une séance clé non replaçable est reportée, une séance normale est abandonnée.
 */
import { trimpParMinute } from './charge'
import { decaler } from './vfc'

export type Intensite = 'basse' | 'moyenne' | 'haute'

export interface SeancePlan {
  id: string
  date: string
  intensite: Intensite
  dureeMin: number
  priorite: 'cle' | 'normale'
  longue?: boolean
}

export interface Deplacement {
  id: string
  de: string
  vers?: string
  statut: 'deplacee' | 'reportee' | 'abandonnee'
  raison: string
}

const estIntense = (s: { intensite: Intensite }) => s.intensite !== 'basse'
const jourSemaine = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = dimanche

/**
 * Replace les séances `aDeplacer` (ids) dans la semaine.
 * @param semaine les 7 dates du lundi au dimanche
 * @param aPartirDe on ne place rien avant cette date (aujourd'hui)
 */
export function replanifier(
  semaine: string[],
  seances: SeancePlan[],
  indispos: Set<string>,
  aDeplacer: string[],
  aPartirDe: string,
): Deplacement[] {
  const place = new Map(seances.filter((s) => !aDeplacer.includes(s.id)).map((s) => [s.id, s]))
  const resultat: Deplacement[] = []
  const ordre = seances
    .filter((s) => aDeplacer.includes(s.id))
    .sort((a, b) => (a.priorite === b.priorite ? 0 : a.priorite === 'cle' ? -1 : 1))

  for (const s of ordre) {
    const autres = [...place.values()]
    const ce = (d: string) => autres.filter((o) => o.date === d)
    const valide = (d: string) => {
      if (d < aPartirDe || indispos.has(d) || d === s.date) return false
      if (ce(d).length >= 2) return false
      if (estIntense(s)) {
        if (ce(d).some(estIntense)) return false
        if (ce(decaler(d, -1)).some(estIntense) || ce(decaler(d, 1)).some(estIntense)) return false
      }
      return true
    }
    const distance = (d: string) => Math.abs(semaine.indexOf(d) - semaine.indexOf(s.date))
    const candidats = semaine.filter(valide).sort((a, b) => {
      if (s.longue) {
        const we = (d: string) => (jourSemaine(d) === 0 ? 0 : jourSemaine(d) === 6 ? 1 : 2)
        if (we(a) !== we(b)) return we(a) - we(b)
      }
      return distance(a) - distance(b) || (a > b ? -1 : 1) // à distance égale : plutôt après
    })

    const vers = candidats[0]
    if (vers) {
      place.set(s.id, { ...s, date: vers })
      resultat.push({ id: s.id, de: s.date, vers, statut: 'deplacee', raison: 'Replacée sur un jour libre en respectant la récupération' })
    } else if (s.priorite === 'cle') {
      resultat.push({ id: s.id, de: s.date, statut: 'reportee', raison: 'Aucun jour compatible cette semaine : séance clé à reporter' })
    } else {
      resultat.push({ id: s.id, de: s.date, statut: 'abandonnee', raison: 'Aucun jour compatible : séance secondaire abandonnée' })
    }
  }
  return resultat
}

/** Part de réserve de FC typique par domaine, pour estimer un TRIMP prévu. */
const RESERVE_TYPIQUE: Record<Intensite, number> = { basse: 0.55, moyenne: 0.75, haute: 0.85 }

/** TRIMP estimé d'une séance prévue (même unité que la charge réalisée). */
export const trimpPrevu = (intensite: Intensite, dureeMin: number) => dureeMin * trimpParMinute(RESERVE_TYPIQUE[intensite])

/** Hausse de la charge prévue par rapport à la moyenne des 4 semaines précédentes (en %). */
export function hausseCharge(prevue: number, quatreSemaines: number[]) {
  const valides = quatreSemaines.filter((c) => c > 0)
  if (!valides.length) return undefined
  const moy = valides.reduce((a, b) => a + b, 0) / valides.length
  return ((prevue - moy) / moy) * 100
}
