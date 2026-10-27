import { db } from '../../../core/db'
import { aujourdhui } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { TYPES_COURSE, type SeancePrevue, type TypeCourse } from '../types'
import { champsCourse } from './donnees'
import { genererSemaineVelo } from './programme'

/**
 * Plan Campus Coach du 26/10 au 15/11/2026, placé une fois pour Titouan en suivant la semaine type
 * (course lundi / jeudi / samedi, renfo mercredi, une séance par jour, jamais deux jours durs d'affilée),
 * puis vélo généré autour. Ensuite, la saisie reprend normalement.
 */
const CLE = 'plan-campus-26-10'
export const LUNDIS = ['2026-10-26', '2026-11-02', '2026-11-09']
const FIN = '2026-11-15'

type Ligne = { date: string; titre: string; dureeMin: number; typeCourse?: TypeCourse; minutesCle?: number; detail?: string; renfo?: boolean }

const PLAN: Ligne[] = [
  // Semaine du 26/10 (test 1500 m mardi, test CP vélo dimanche)
  { date: '2026-10-26', titre: 'Renfo', dureeMin: 30, renfo: true },
  { date: '2026-10-27', titre: 'Test 1500 m', dureeMin: 40, typeCourse: 'Test', minutesCle: 5, detail: 'Échauffement 20′ + gammes, test 1500 m à fond, retour au calme.' },
  { date: '2026-10-29', titre: 'Footing EF', dureeMin: 45, typeCourse: 'Endurance fondamentale' },
  { date: '2026-10-31', titre: 'Sortie longue EF', dureeMin: 70, typeCourse: 'Sortie longue' },
  // Semaine du 02/11
  { date: '2026-11-02', titre: 'Footing EF', dureeMin: 45, typeCourse: 'Endurance fondamentale' },
  { date: '2026-11-04', titre: 'Renfo', dureeMin: 30, renfo: true },
  { date: '2026-11-05', titre: "8 × 1' seuil 30", dureeMin: 46, typeCourse: 'Seuil 30', minutesCle: 8, detail: "8 × 1' à l'allure seuil 30." },
  { date: '2026-11-07', titre: 'Sortie longue EF', dureeMin: 70, typeCourse: 'Sortie longue' },
  // Semaine du 09/11
  { date: '2026-11-09', titre: 'Footing EF', dureeMin: 25, typeCourse: 'Endurance fondamentale' },
  { date: '2026-11-11', titre: 'Renfo', dureeMin: 30, renfo: true },
  { date: '2026-11-12', titre: 'EF + 6 sprints', dureeMin: 25, typeCourse: 'Endurance fondamentale', detail: '25′ en endurance fondamentale avec 6 × 15″ de sprint, bien récupérer entre.' },
  { date: '2026-11-14', titre: 'Footing EF', dureeMin: 50, typeCourse: 'Endurance fondamentale' },
]

export const planFait = async () => !!(await db.reglages.get(CLE))
export const planDisponible = () => aujourdhui() <= FIN

export async function ajouterPlanCampus() {
  for (const l of PLAN) {
    const sport = l.renfo ? 'renfo' : 'course'
    // Déjà une séance de ce sport ce jour-là (saisie à la main) : on n'en ajoute pas une deuxième
    const deja = (await db.prevues.where('date').equals(l.date).toArray()).some((p) => p.sport === sport && p.statut !== 'abandonnee' && !p.id.startsWith('campus-'))
    if (deja) continue
    const base: SeancePrevue = {
      id: `campus-${l.date}-${sport}`, date: l.date, sport, titre: l.titre, dureeMin: l.dureeMin, detail: l.detail,
      intensite: 'basse', priorite: 'normale', statut: 'prevue', origine: 'manuel',
    }
    const existante = await db.prevues.get(base.id)
    await enregistrer(db.prevues, l.typeCourse
      ? { ...base, typeCourse: l.typeCourse, minutesCle: l.minutesCle, ...champsCourse(l.typeCourse), priorite: TYPES_COURSE[l.typeCourse].intensite === 'haute' || l.typeCourse === 'Sortie longue' ? 'cle' : 'normale', statut: existante?.statut ?? 'prevue' }
      : { ...base, statut: existante?.statut ?? 'prevue' })
  }
  // Puis le vélo de chaque semaine, placé autour de la course
  const phrases: string[] = []
  for (const l of LUNDIS) {
    try {
      await genererSemaineVelo(l)
    } catch (e) {
      phrases.push((e as Error).message)
    }
  }
  await enregistrer(db.reglages, { id: CLE, valeur: { le: new Date().toISOString() } })
  return phrases
}
