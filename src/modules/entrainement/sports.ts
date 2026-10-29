import type { Sport } from './types'

/** Sports saisissables, dans l'ordre d'affichage. */
export const SPORTS: Sport[] = ['velo', 'course', 'natation', 'renfo', 'autre']

export const NOMS_SPORTS: Record<Sport, string> = { velo: 'Vélo', course: 'Course', natation: 'Natation', renfo: 'Renfo', autre: 'Autre' }

const ICONES: Record<Sport, string> = { velo: '🚴', course: '🏃', natation: '🏊', renfo: '🏋️', autre: '⚽' }

export const iconeSport = (sport: Sport, homeTrainer?: boolean) => (sport === 'velo' && homeTrainer ? '🏠' : ICONES[sport] ?? '🤸')

/** Type d'activité Intervals.icu (ou Strava) → sport de l'appli. « autre » (foot…) : calories seulement. */
export function sportDepuisType(type: string): Sport {
  if (/Ride/.test(type)) return 'velo'
  if (/Run/.test(type)) return 'course'
  if (/Swim/.test(type)) return 'natation'
  if (/Weight|Strength|Workout|Crossfit|Pilates|Yoga/.test(type)) return 'renfo'
  return 'autre'
}
