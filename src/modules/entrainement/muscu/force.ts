import type { Role, TypePhase } from '../../../metrics/programme'

/**
 * Musculation du cycliste reliée à l'Entraînement (validée le 13/11/2026, relue par la science) :
 *  - force lourde des jambes : améliore le rendement, la puissance sur effort court et la performance sans freiner
 *    l'endurance (Rønnestad 2010 ; Aagaard 2011 ; Llanos-Lagos 2025 ; Schumann 2022) ;
 *  - exercices du protocole Rønnestad, la flexion de hanche remplacée par le leg curl lourd (Aagaard 2011) et le
 *    soulevé de terre roumain (plausible, pas testé chez le cycliste) ; version maison à une jambe avec haltères ;
 *  - apprentissage 3 semaines, force lourde 12 semaines (3 séries, 10 → 6 → 5 répétitions), puis entretien 1 fois par
 *    semaine (garde les gains, Rønnestad 2010b) ; semaine allégée : mêmes charges, 2 séries (Coleman 2024 : ne pas
 *    arrêter) ; affûtage : 2 séries, jamais dans les 4 jours avant la course (Pritchard 2015) ;
 *  - placée un jour sans vélo, sinon le soir d'une séance dure à 3 h au moins (Schumann 2022), jamais la veille d'une
 *    séance clé. Durées, progression et repos : choix d'entraîneur.
 */
export type Lieu = 'salle' | 'maison'
export type Picto = 'squat' | 'fente' | 'souleve' | 'curl' | 'mollet' | 'stepup'

export interface ExoForce {
  id: string
  nom: string
  materiel: string
  picto: Picto
  /** Une jambe à la fois : les répétitions sont par jambe */
  unilateral?: boolean
  /** Au poids du corps : on progresse par les répétitions */
  sansCharge?: boolean
  /** Hausse quand toutes les répétitions sont faites (kg) */
  pas: number
  etapes: string[]
  pourquoi: string
}

export const EXOS: Record<Lieu, ExoForce[]> = {
  salle: [
    {
      id: 'squat', nom: 'Demi-squat', materiel: 'barre guidée ou barre libre', picto: 'squat', pas: 5,
      etapes: ['Barre sur le haut du dos, pieds largeur de hanches.', 'Descends lentement (2-3 s) jusqu’à ce que les cuisses soient presque parallèles au sol, genoux dans l’axe des pieds.', 'Remonte vite et fort, dos droit, talons au sol.'],
      pourquoi: 'L’exercice de base de tous les protocoles testés chez des cyclistes (Rønnestad 2010 ; Sunde 2010).',
    },
    {
      id: 'presse', nom: 'Presse à une jambe', materiel: 'presse à cuisses', picto: 'fente', unilateral: true, pas: 5,
      etapes: ['Un pied au milieu de la plateforme, l’autre posé à côté.', 'Descends lentement jusqu’à un angle droit au genou.', 'Pousse vite, sans verrouiller le genou en haut. Puis l’autre jambe.'],
      pourquoi: 'Une jambe à la fois, comme sur le vélo : chaque jambe travaille autant (Rønnestad 2010).',
    },
    {
      id: 'souleve', nom: 'Soulevé de terre roumain', materiel: 'barre ou haltères', picto: 'souleve', pas: 5,
      etapes: ['Debout, barre contre les cuisses, genoux légèrement fléchis.', 'Penche le buste en reculant les fesses, dos bien plat, barre qui glisse le long des jambes.', 'Arrête-toi quand l’arrière des cuisses tire (sous les genoux), remonte en serrant les fessiers.'],
      pourquoi: 'Fessiers et arrière des cuisses, qui poussent la pédale vers le bas. Plausible, pas encore testé chez le cycliste.',
    },
    {
      id: 'curl', nom: 'Leg curl lourd', materiel: 'machine leg curl', picto: 'curl', pas: 2.5,
      etapes: ['Allongé ou assis, le rouleau juste au-dessus des talons.', 'Ramène les talons vers les fesses, vite.', 'Relâche lentement (2-3 s).'],
      pourquoi: 'Utilisé lourd chez des cyclistes de l’équipe nationale danoise (Aagaard 2011 : +8 % d’endurance sur 45 min).',
    },
    {
      id: 'mollets', nom: 'Mollets debout', materiel: 'machine à mollets ou presse', picto: 'mollet', pas: 5,
      etapes: ['Avant des pieds sur le bord, talons dans le vide.', 'Descends les talons lentement, bien bas.', 'Monte vite sur la pointe des pieds, tiens 1 s en haut.'],
      pourquoi: 'Le 4e exercice du protocole Rønnestad : la cheville transmet la force à la pédale.',
    },
  ],
  maison: [
    {
      id: 'bulgare', nom: 'Squat bulgare', materiel: 'haltères et une chaise', picto: 'fente', unilateral: true, pas: 2,
      etapes: ['Dos à une chaise, pose le dessus du pied arrière dessus, un haltère dans chaque main.', 'Descends lentement sur la jambe avant jusqu’à frôler le sol avec le genou arrière.', 'Remonte vite en poussant dans le talon avant. Puis l’autre jambe.'],
      pourquoi: 'Remplace le squat et la presse : à une jambe, des haltères suffisent pour une charge lourde.',
    },
    {
      id: 'stepup', nom: 'Step-up chargé', materiel: 'haltères et une chaise stable', picto: 'stepup', unilateral: true, pas: 2,
      etapes: ['Un pied sur la chaise (contre un mur), haltères en main.', 'Monte en poussant seulement sur la jambe du haut, sans t’aider de l’autre.', 'Redescends lentement. Puis l’autre jambe.'],
      pourquoi: 'Le geste du coup de pédale, jambe par jambe.',
    },
    {
      id: 'souleve1', nom: 'Soulevé de terre roumain à une jambe', materiel: 'un haltère', picto: 'souleve', unilateral: true, pas: 2,
      etapes: ['Debout sur une jambe, haltère dans la main opposée.', 'Penche le buste en tendant l’autre jambe derrière toi, dos plat.', 'Remonte en serrant le fessier de la jambe d’appui.'],
      pourquoi: 'Fessiers et arrière des cuisses, avec peu de charge grâce au travail sur une jambe.',
    },
    {
      id: 'curlsol', nom: 'Leg curl glissé', materiel: 'une serviette sur un sol lisse', picto: 'curl', sansCharge: true, pas: 0,
      etapes: ['Allongé sur le dos, talons sur une serviette, bassin levé.', 'Ramène les talons vers les fesses en gardant le bassin haut.', 'Repousse lentement (3 s). Trop facile : une jambe à la fois.'],
      pourquoi: 'L’arrière des cuisses sans machine.',
    },
    {
      id: 'mollets1', nom: 'Mollets sur une marche', materiel: 'une marche et un haltère', picto: 'mollet', unilateral: true, pas: 2,
      etapes: ['Sur une jambe, l’avant du pied sur la marche, haltère dans la main du même côté.', 'Descends le talon lentement, bien bas.', 'Monte vite sur la pointe, tiens 1 s.'],
      pourquoi: 'Même travail que la machine, une jambe à la fois.',
    },
  ],
}

export type PeriodeForce = 'apprentissage' | 'lourd' | 'entretien' | 'affutage' | 'repos'
export const NOMS_PERIODES: Record<PeriodeForce, string> = {
  apprentissage: 'apprentissage', lourd: 'force lourde', entretien: 'entretien', affutage: 'avant ta course', repos: 'repos',
}
export const SEMAINES_APPRENTISSAGE = 3
export const SEMAINES_LOURD = 12

export interface PlanForce {
  periode: PeriodeForce
  /** Semaine dans la période (1 = première) */
  semaine: number
  series: number
  reps: number
  /** Séances au plus cette semaine */
  seances: number
  /** Charge légère, on apprend le geste */
  legere?: boolean
}

const semainesEntre = (a: string, b: string) => Math.floor((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / (7 * 86_400_000))

/** Ce que prévoit la muscu la semaine de ce lundi. */
export function planForce(o: { debut: string; lundi: string; phase: TypePhase; allegee: boolean; seancesVoulues: 1 | 2 }): PlanForce {
  const n = Math.max(0, semainesEntre(o.debut, o.lundi))
  let p: PlanForce
  if (o.phase === 'recuperation') p = { periode: 'repos', semaine: 1, series: 0, reps: 0, seances: 0 }
  else if (o.phase === 'affutage') p = { periode: 'affutage', semaine: 1, series: 2, reps: 5, seances: 1 }
  else if (n < SEMAINES_APPRENTISSAGE) p = { periode: 'apprentissage', semaine: n + 1, series: n === 0 ? 2 : 3, reps: 12, seances: o.seancesVoulues, legere: true }
  else if (o.phase === 'fin-prepa' || o.phase === 'specifique' || o.phase === 'entretien' || n >= SEMAINES_APPRENTISSAGE + SEMAINES_LOURD)
    p = { periode: 'entretien', semaine: n - SEMAINES_APPRENTISSAGE - SEMAINES_LOURD + 1, series: 3, reps: 5, seances: 1 }
  else {
    const k = n - SEMAINES_APPRENTISSAGE
    p = { periode: 'lourd', semaine: k + 1, series: 3, reps: k < 4 ? 10 : k < 8 ? 6 : 5, seances: o.seancesVoulues }
  }
  // Semaine allégée du vélo : mêmes charges, 2 séries (on n'arrête pas)
  if (o.allegee && p.series > 2) p = { ...p, series: 2 }
  return p
}

/**
 * Jours de muscu dans la semaine (`roles` du lundi au dimanche, `dates` correspondantes) : d'abord les jours « renfo »,
 * puis les jours sans vélo, jamais la veille d'une séance clé (`cles` : intensité, sortie longue, test, course) ni dans
 * les 4 jours avant une course (`courses`) ; deux séances à 2 jours d'écart au moins. Sans jour possible : le soir de la
 * séance dure (3 h après le vélo au moins).
 */
export function joursMuscu(o: { roles: Role[]; dates: string[]; n: number; cles: string[]; durs: string[]; courses: string[]; indispos?: string[] }) {
  if (o.n <= 0) return []
  const ecart = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000)
  const veille = (d: string) => o.cles.some((c) => ecart(d, c) === 1)
  const avantCourse = (d: string) => o.courses.some((c) => ecart(d, c) >= 0 && ecart(d, c) <= 4)
  const libres = o.dates.filter((d, i) => !o.roles[i].startsWith('velo') && o.roles[i] !== 'course' && !veille(d) && !avantCourse(d) && !o.indispos?.includes(d) && !o.cles.includes(d))
  const rang = (d: string) => (o.roles[o.dates.indexOf(d)] === 'renfo' ? 0 : 1)
  const tries = [...libres].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
  const choisis: { date: string; soir: boolean }[] = []
  for (const d of tries) {
    if (choisis.length >= o.n) break
    if (choisis.every((c) => Math.abs(ecart(c.date, d)) >= 2)) choisis.push({ date: d, soir: false })
  }
  // Pas assez de jours sans vélo : le soir d'une séance dure (pas la veille d'une autre séance clé)
  for (const d of o.durs) {
    if (choisis.length >= o.n) break
    if (!veille(d) && !avantCourse(d) && choisis.every((c) => Math.abs(ecart(c.date, d)) >= 2)) choisis.push({ date: d, soir: true })
  }
  return choisis.sort((a, b) => a.date.localeCompare(b.date))
}

/** Où tu en es sur un exercice : charge (ou répétitions en plus au poids du corps), échecs d'affilée, répétitions de référence. */
export interface EtatExo {
  charge?: number
  repsEnPlus?: number
  echecs?: number
  /** Répétitions visées quand la charge a été fixée (pour l'adapter quand l'objectif change, ex. 10 → 6) */
  repsRef?: number
  /** Charge de la dernière séance (affichage) */
  derniere?: number
}

const arrondi = (kg: number, pas: number) => (pas > 0 ? Math.round(kg / pas) * pas : Math.round(kg))

/**
 * Charge proposée : la tienne, adaptée si le nombre de répétitions visé change (équivalence d'Epley : 1RM = charge ×
 * (1 + reps / 30)), arrondie au pas de l'exercice (vers le bas). Sans charge connue : à trouver à la 1re séance.
 */
export function chargeProposee(exo: ExoForce, e: EtatExo | undefined, reps: number): number | undefined {
  if (exo.sansCharge || !e?.charge) return undefined
  if (!e.repsRef || e.repsRef === reps) return e.charge
  const ratio = (1 + e.repsRef / 30) / (1 + reps / 30)
  const pas = exo.pas || 1
  return Math.floor((e.charge * ratio) / pas) * pas
}

/**
 * Surcharge progressive (choix d'entraîneur, relu) : toutes les répétitions de toutes les séries faites → + le pas de
 * l'exercice (5 kg squat, presse, soulevé, mollets ; 2,5 kg leg curl ; 2 kg aux haltères) ou +1 répétition au poids
 * du corps ; sinon même charge ; deux fois raté d'affilée → −5 %. Charge légère (apprentissage) : retenue telle quelle.
 */
export function apresSeance(exo: ExoForce, avant: EtatExo | undefined, faite: { charge?: number; reps: number[]; cible: number; series: number; legere?: boolean }): EtatExo {
  const charge = faite.charge ?? avant?.charge
  const reussie = faite.reps.length >= faite.series && faite.reps.every((r) => r >= faite.cible)
  if (exo.sansCharge) {
    const plus = avant?.repsEnPlus ?? 0
    return { repsEnPlus: reussie ? Math.min(8, plus + 1) : plus, echecs: 0 }
  }
  if (charge === undefined) return { ...avant }
  const derniere = charge
  if (faite.legere) return { charge, repsRef: faite.cible, echecs: 0, derniere }
  if (reussie) return { charge: charge + exo.pas, repsRef: faite.cible, echecs: 0, derniere }
  const echecs = (avant?.echecs ?? 0) + 1
  if (echecs >= 2) return { charge: Math.max(exo.pas || 1, arrondi(charge * 0.95, exo.pas || 1)), repsRef: faite.cible, echecs: 0, derniere }
  return { charge, repsRef: faite.cible, echecs, derniere }
}

/** Réglage « force » : la muscu reliée à l'Entraînement. */
export interface ReglagesForce {
  actif: boolean
  lieu: Lieu
  seances: 1 | 2
  /** Lundi de la 1re semaine (apprentissage) */
  debut?: string
  exos: Record<string, EtatExo>
}
export const FORCE_DEFAUT: ReglagesForce = { actif: false, lieu: 'salle', seances: 1, exos: {} }

/** Ce qui est prévu pour une séance : période, séries, répétitions, lieu, et si c'est le soir d'une séance de vélo. */
export interface SeanceForce {
  periode: PeriodeForce
  semaine: number
  series: number
  reps: number
  lieu: Lieu
  legere?: boolean
  soir?: boolean
}

/** Durée estimée (min) : 10 min de mise en route, puis par série ~1 min d'effort + 2-3 min de repos. */
export const dureeForce = (s: SeanceForce) => Math.round(10 + EXOS[s.lieu].length * s.series * (s.legere ? 2.5 : 3.2))
