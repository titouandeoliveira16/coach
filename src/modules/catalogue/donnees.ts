import brut from '../../../catalogue/seances.json'

/** Catalogue scientifique de séances (catalogue/seances.json, voir catalogue/README.md). Pas encore relié au reste de l'appli. */
export interface Etape {
  type: 'echauffement' | 'effort' | 'recup' | 'retour' | 'repetition'
  duree?: number
  intensite?: number[]
  max?: boolean
  cadence?: string
  note?: string
  fois?: number
  etapes?: Etape[]
}

export interface Reference { auteurs: string; annee: number; titre: string; revue: string; pmid?: string }

export interface SeanceCatalogue {
  id: string
  sport: 'velo' | 'course' | 'force' | 'methode'
  famille: string
  nom: string
  objectif: string
  resume: string
  unite?: string
  zone: string
  rpe: string
  niveau: string
  dureeMin?: number
  travailMin?: number
  deroule?: Etape[]
  exercices?: { nom: string; series: number; reps: string; repos?: number }[]
  variantes: string[]
  quand: { phases: string[]; parSemaine: string; recuperation: string }
  conseils: string[]
  preuve: { niveau: string; resultat: string; references: Reference[] }
}

export const CATALOGUE = brut as unknown as { version: number; majLe: string; seances: SeanceCatalogue[] }

export const NOMS_SPORTS: Record<SeanceCatalogue['sport'], string> = { velo: 'Vélo', course: 'Course à pied', force: 'Renfo', methode: 'Méthodes' }
export const NOMS_FAMILLES: Record<string, string> = {
  recuperation: 'Récupération', endurance: 'Endurance', durabilite: 'Durabilité', tempo: 'Tempo / sweet spot', seuil: 'Seuil',
  vo2max: 'VO2max', anaerobie: 'Anaérobie', sprint: 'Sprint / vitesse', force: 'Force sur le vélo', specifique: 'Spécifique',
  test: 'Tests', 'force-lourde': 'Force lourde', 'force-explosive': 'Explosivité', prevention: 'Prévention', organisation: 'Organisation',
}
export const PREUVES = ['prouvé', 'plausible', 'mitigé', 'pratique', 'faible'] as const
export const COULEUR_PREUVE: Record<string, string> = { 'prouvé': '#4ade80', plausible: '#7cb4f0', 'mitigé': '#fb923c', pratique: '#a3a8ab', faible: '#7d8183' }

/** Couleur de zone d'une étape (vélo en %CP, course en %VMA). */
export function couleurZone(e: Etape, unite?: string) {
  if (e.max) return '#b56be0'
  const v = ((e.intensite?.[0] ?? 0) + (e.intensite?.[1] ?? 0)) / 2
  const seuils = unite === '%VMA' ? [0, 72, 85, 92, 110] : [55, 76, 91, 106, 121]
  const couleurs = ['#6f7774', '#5aa7e8', '#45c178', '#f2b93a', '#fb8a3c', '#f0605b']
  return couleurs[seuils.filter((s) => v >= s).length]
}

/** Étapes à plat (répétitions déroulées), pour dessiner le profil. */
export function aPlat(etapes: Etape[], out: Etape[] = []): Etape[] {
  for (const e of etapes) {
    if (e.type === 'repetition') for (let i = 0; i < (e.fois ?? 0); i++) aPlat(e.etapes ?? [], out)
    else out.push(e)
  }
  return out
}

export const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
