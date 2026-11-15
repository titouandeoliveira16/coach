import type { Role, TypePhase } from '../../../metrics/programme'

/**
 * Musculation du cycliste reliée à l'Entraînement (validée le 13/11/2026, relue par la science) :
 *  - force lourde des jambes : améliore le rendement, la puissance sur effort court et la performance sans freiner
 *    l'endurance (Rønnestad 2010 ; Aagaard 2011 ; Llanos-Lagos 2025 ; Schumann 2022) ;
 *  - exercices du protocole Rønnestad, la flexion de hanche remplacée par le leg curl lourd (Aagaard 2011) et le
 *    soulevé de terre roumain (plausible, pas testé chez le cycliste) ; version maison à une jambe avec haltères ;
 *  - 4 exercices (Vikmoen 2016 : 4 exercices, 3 × 4-10 RM, 2 fois par semaine) : soulevé roumain et leg curl en
 *    alternance d'une séance à l'autre ; arrêt 1-2 répétitions avant l'échec (Grgic 2022, Refalo 2023, Robinson 2024) ;
 *  - apprentissage 2 à 4 semaines selon ton expérience du squat, force lourde l'hiver (3 séries, 10 → 6 → 5
 *    répétitions), puis entretien 1 fois par semaine, 2 séries à la même charge (garde les gains : Rønnestad, Hansen &
 *    Raastad 2010, Eur J Appl Physiol ; ne pas arrêter en saison : Rønnestad 2016) ; semaine allégée : mêmes charges,
 *    2 séries ; course A : dernière séance 5 à 7 jours avant, rien dans les 4 derniers jours, reprise 3 jours après au
 *    plus tôt (Pritchard 2015, extrapolé de la force maximale : choix d'entraîneur) ;
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
  /** Ce qui protège (gainage, respiration, amplitude), relu le 15/11/2026 */
  securite: string
  /** Genoux fragiles : l'étape d'amplitude remplacée (index, texte) */
  genoux?: [number, string]
  pourquoi: string
}

export const EXOS: Record<Lieu, ExoForce[]> = {
  salle: [
    {
      id: 'squat', nom: 'Demi-squat', materiel: 'barre guidée ou barre libre', picto: 'squat', pas: 5,
      etapes: ['Barre sur le haut du dos, pieds largeur de hanches.', 'Descends lentement (2-3 s) jusqu’à un angle droit au genou, genoux dans l’axe des pieds.', 'Remonte vite et fort, dos droit, talons au sol.'],
      securite: 'Inspire et bloque l’air en gainant le ventre avant de descendre, souffle en remontant. Dos neutre, jamais arrondi.',
      genoux: [1, 'Descends lentement (2-3 s) un peu moins bas qu’un angle droit au genou, et arrête-toi avant toute douleur.'],
      pourquoi: 'L’exercice de base de tous les protocoles testés chez des cyclistes (Rønnestad 2010 ; Sunde 2010).',
    },
    {
      id: 'presse', nom: 'Presse à une jambe', materiel: 'presse à cuisses', picto: 'fente', unilateral: true, pas: 5,
      etapes: ['Un pied au milieu de la plateforme, l’autre posé à côté.', 'Descends lentement jusqu’à un angle droit au genou.', 'Pousse vite, sans verrouiller le genou en haut. Puis l’autre jambe.'],
      securite: 'Bas du dos collé au dossier, genou dans l’axe du pied, jamais vers l’intérieur.',
      genoux: [1, 'Descends lentement, pas plus bas qu’un angle droit au genou, sans douleur.'],
      pourquoi: 'Une jambe à la fois, comme sur le vélo : chaque jambe travaille autant (Rønnestad 2010).',
    },
    {
      id: 'souleve', nom: 'Soulevé de terre roumain', materiel: 'barre ou haltères', picto: 'souleve', pas: 5,
      etapes: ['Debout, barre contre les cuisses, genoux légèrement fléchis.', 'Penche le buste en reculant les fesses, dos bien plat, barre qui glisse le long des jambes.', 'Arrête-toi quand l’arrière des cuisses tire (sous les genoux), remonte en serrant les fessiers.'],
      securite: 'Dos plat du début à la fin, barre près des jambes ; si le dos s’arrondit, la charge est trop lourde.',
      pourquoi: 'Fessiers et arrière des cuisses, qui poussent la pédale vers le bas. Plausible, pas encore testé chez le cycliste.',
    },
    {
      id: 'curl', nom: 'Leg curl lourd', materiel: 'machine leg curl', picto: 'curl', pas: 2.5,
      etapes: ['Allongé ou assis, le rouleau juste au-dessus des talons.', 'Ramène les talons vers les fesses, vite.', 'Relâche lentement (2-3 s).'],
      securite: 'Bassin collé au banc, mouvement sans élan.',
      pourquoi: 'Utilisé lourd chez des cyclistes de l’équipe nationale danoise (Aagaard 2011 : +8 % d’endurance sur 45 min).',
    },
    {
      id: 'mollets', nom: 'Mollets debout', materiel: 'machine à mollets ou presse', picto: 'mollet', pas: 5,
      etapes: ['Avant des pieds sur le bord, talons dans le vide.', 'Descends les talons lentement, bien bas.', 'Monte vite sur la pointe des pieds, tiens 1 s en haut.'],
      securite: 'Genoux presque tendus, sans rebond en bas.',
      pourquoi: 'Le 4e exercice du protocole Rønnestad : la cheville transmet la force à la pédale.',
    },
  ],
  maison: [
    {
      id: 'bulgare', nom: 'Squat bulgare', materiel: 'haltères et un banc ou une marche stable', picto: 'fente', unilateral: true, pas: 2,
      etapes: ['Dos à un banc ou une marche stable (jamais une chaise à roulettes ou pliante), pose le dessus du pied arrière dessus, un haltère dans chaque main.', 'Descends lentement sur la jambe avant jusqu’à un angle droit au genou avant.', 'Remonte vite en poussant dans le talon avant. Puis l’autre jambe.'],
      securite: 'Buste droit, ventre gainé, genou avant dans l’axe du pied ; pose les haltères si tu perds l’équilibre.',
      genoux: [1, 'Descends lentement, moins bas qu’un angle droit au genou avant, sans douleur.'],
      pourquoi: 'Remplace le squat et la presse : à une jambe, des haltères suffisent pour une charge lourde.',
    },
    {
      id: 'stepup', nom: 'Step-up chargé', materiel: 'haltères et une marche d’escalier ou un banc stable', picto: 'stepup', unilateral: true, pas: 2,
      etapes: ['Un pied sur une marche d’escalier ou un banc stable (jamais une chaise à roulettes ou pliante), haltères en main.', 'Monte en poussant seulement sur la jambe du haut, sans t’aider de l’autre.', 'Redescends lentement. Puis l’autre jambe.'],
      securite: 'Tout le pied sur la marche, genou dans l’axe ; près d’un mur ou d’une rampe pour te rattraper.',
      genoux: [0, 'Un pied sur une marche basse (genou à moins d’un angle droit), haltères en main.'],
      pourquoi: 'Le geste du coup de pédale, jambe par jambe.',
    },
    {
      id: 'souleve1', nom: 'Soulevé de terre roumain à une jambe', materiel: 'un haltère', picto: 'souleve', unilateral: true, pas: 2,
      etapes: ['Debout sur une jambe, haltère dans la main opposée.', 'Penche le buste en tendant l’autre jambe derrière toi, dos plat.', 'Remonte en serrant le fessier de la jambe d’appui.'],
      securite: 'Dos plat, hanches de niveau ; une main contre un mur si l’équilibre te limite.',
      pourquoi: 'Fessiers et arrière des cuisses, avec peu de charge grâce au travail sur une jambe.',
    },
    {
      id: 'curlsol', nom: 'Leg curl glissé', materiel: 'une serviette sur un sol lisse', picto: 'curl', sansCharge: true, pas: 0,
      etapes: ['Allongé sur le dos, talons sur une serviette, bassin levé.', 'Ramène les talons vers les fesses en gardant le bassin haut.', 'Repousse lentement (3 s). Trop facile : une jambe à la fois.'],
      securite: 'Bassin haut, sans creuser le bas du dos.',
      pourquoi: 'L’arrière des cuisses sans machine.',
    },
    {
      id: 'mollets1', nom: 'Mollets sur une marche', materiel: 'une marche et un haltère', picto: 'mollet', unilateral: true, pas: 2,
      etapes: ['Sur une jambe, l’avant du pied sur la marche, haltère dans la main du même côté.', 'Descends le talon lentement, bien bas.', 'Monte vite sur la pointe, tiens 1 s.'],
      securite: 'Une main contre le mur pour l’équilibre, sans rebond en bas.',
      pourquoi: 'Même travail que la machine, une jambe à la fois.',
    },
  ],
}

/** Prévention en fin de séance (sans suivi de charge) : léger, pour les genoux et le tronc. */
export const PREVENTION: Record<Lieu, { nom: string; dose: string }[]> = {
  salle: [{ nom: 'Leg extension', dose: '2 × 15, léger' }, { nom: 'Gainage (planche)', dose: '3 × 40 s' }],
  maison: [{ nom: 'Extension de jambe assis sur une chaise, lente', dose: '2 × 15 par jambe' }, { nom: 'Gainage (planche)', dose: '3 × 40 s' }],
}
/** VTT : le haut du corps tient le guidon dans les descentes (plausible, non testé en VTT ; Lauersen 2018 : la muscu réduit les blessures). */
const HAUT_DU_CORPS: Record<Lieu, { nom: string; dose: string }[]> = {
  salle: [{ nom: 'Tirage horizontal (poulie ou haltère)', dose: '2 × 10, modéré' }, { nom: 'Pompes', dose: '2 × 10' }],
  maison: [{ nom: 'Rowing à un bras avec un haltère', dose: '2 × 10 par bras' }, { nom: 'Pompes', dose: '2 × 10' }],
}
export const preventionDe = (s: Pick<SeanceForce, 'lieu' | 'vtt'>) => [...PREVENTION[s.lieu], ...(s.vtt ? HAUT_DU_CORPS[s.lieu] : [])]

/**
 * Les 4 exercices de la séance (relecture du 15/11/2026) : soulevé roumain et leg curl en alternance d'une séance à
 * l'autre ; version réduite (veille d'une séance clé) : leg curl, jamais le soulevé (plus de courbatures).
 */
export function exosDe(s: Pick<SeanceForce, 'lieu' | 'variante' | 'reduite'>) {
  const curl = s.variante === 'curl' || !!s.reduite
  return EXOS[s.lieu].filter((e) => (e.picto === 'souleve' ? !curl : e.picto === 'curl' ? curl : true))
}
/** Étapes d'un exercice, l'amplitude adaptée si tes genoux sont fragiles, puis ce qui protège. */
export const etapesDe = (e: ExoForce, genoux?: boolean) => [...e.etapes.map((t, i) => (genoux && e.genoux?.[0] === i ? e.genoux[1] : t)), e.securite]

/** Semaines d'apprentissage selon ton expérience du squat chargé (choix d'entraîneur, relu le 15/11/2026). */
export const semainesApprentissage = (x?: ReglagesForce['experience']) => (x === 'jamais' ? 4 : x === 'un-peu' ? 3 : 2)

export type PeriodeForce = 'apprentissage' | 'lourd' | 'entretien' | 'affutage' | 'repos' | 'reprise'
export const NOMS_PERIODES: Record<PeriodeForce, string> = {
  apprentissage: 'apprentissage', lourd: 'force lourde', entretien: 'entretien', affutage: 'avant ta course', repos: 'repos', reprise: 'reprise',
}
export const SEMAINES_APPRENTISSAGE = 2
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
  /** Après un arrêt : part de la charge habituelle (0,9 ou 0,8) */
  facteur?: number
  /** 1re semaine d'une reprise après plus de 8 semaines (la suivante est aussi légère) */
  longue?: boolean
}

/**
 * Ce que prévoit la muscu la semaine de ce lundi (13/11/2026). Le programme avance avec les semaines vraiment faites
 * (`semainesFaites`), pas avec le calendrier : une semaine manquée ne fait pas sauter de palier. Arrêt (relu :
 * McMaster 2013, Mujika & Padilla 2001, Blocquiaux 2020) : jusqu'à 3 semaines sans séance, même charge ; 4 à 8 semaines,
 * −10 % et une semaine de reprise à 2 séries ; au-delà, −20 % et 2 semaines légères.
 */
export function planForce(o: { semainesFaites: number; semainesSans?: number; repriseEnCours?: boolean; phase: TypePhase; allegee: boolean; seancesVoulues: 1 | 2; apprentissage?: number }): PlanForce {
  const n = o.semainesFaites
  const sans = o.semainesSans ?? 0
  const appr = o.apprentissage ?? SEMAINES_APPRENTISSAGE
  let p: PlanForce
  // Semaine d'après la course A : une séance d'entretien, 3 jours après la course au plus tôt (joursMuscu)
  if (o.phase === 'recuperation') return n < appr ? { periode: 'repos', semaine: 1, series: 0, reps: 0, seances: 0 } : { periode: 'entretien', semaine: 1, series: 2, reps: 5, seances: 1 }
  if (o.phase === 'affutage') p = { periode: 'affutage', semaine: 1, series: 2, reps: 5, seances: 1 }
  else if (n < appr) p = { periode: 'apprentissage', semaine: n + 1, series: n === 0 ? 2 : 3, reps: 12, seances: o.seancesVoulues, legere: true }
  else if (sans > 8 || o.repriseEnCours) p = { periode: 'reprise', semaine: o.repriseEnCours ? 2 : 1, series: o.repriseEnCours ? 3 : 2, reps: 12, seances: o.seancesVoulues, legere: true, facteur: sans > 8 ? 0.8 : undefined, longue: !o.repriseEnCours }
  else if (o.phase === 'fin-prepa' || o.phase === 'specifique' || o.phase === 'entretien' || n >= appr + SEMAINES_LOURD)
    // Entretien : 2 séries à la même charge (on baisse le volume, on garde la charge ; relu le 15/11/2026)
    p = { periode: 'entretien', semaine: Math.max(1, n - appr - SEMAINES_LOURD + 1), series: 2, reps: 5, seances: 1 }
  else {
    const k = n - appr
    p = { periode: 'lourd', semaine: k + 1, series: 3, reps: k < 4 ? 10 : k < 8 ? 6 : 5, seances: o.seancesVoulues }
  }
  // 4 à 8 semaines sans séance : −10 % et 2 séries cette semaine
  if (sans >= 4 && sans <= 8 && p.periode !== 'apprentissage' && p.periode !== 'reprise') p = { ...p, series: 2, facteur: 0.9 }
  // Proche de la course (VO2, spécifique) et en entretien : une séance par semaine au plus, même en (ré)apprentissage
  if (o.phase === 'fin-prepa' || o.phase === 'specifique' || o.phase === 'entretien') p = { ...p, seances: Math.min(1, p.seances) }
  // Semaine allégée du vélo : mêmes charges, 2 séries (on n'arrête pas)
  if (o.allegee && p.series > 2) p = { ...p, series: 2 }
  return p
}

/**
 * Jours de muscu dans la semaine (`roles` du lundi au dimanche, `dates` correspondantes) : d'abord les jours « renfo »,
 * puis les jours sans vélo, jamais la veille d'une séance clé (`cles` : intensité, sortie longue, test, course) ni dans
 * les 4 jours avant une course (`courses`) ; deux séances à 2 jours d'écart au moins. Sans jour possible : le soir de la
 * séance dure (3 h après le vélo au moins) ; sinon, hors semaine de course, un jour sans vélo même la veille d'une
 * séance clé (mieux qu'aucune séance).
 */
export function joursMuscu(o: { roles: Role[]; dates: string[]; n: number; cles: string[]; durs: string[]; courses: string[]; indispos?: string[]; velo?: string[] }) {
  if (o.n <= 0) return []
  const ecart = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000)
  const veille = (d: string) => o.cles.some((c) => ecart(d, c) === 1)
  // Rien dans les 4 jours avant une course, ni dans les 2 jours après (reprise 3 jours après au plus tôt)
  const avantCourse = (d: string) => o.courses.some((c) => (ecart(d, c) >= 0 && ecart(d, c) <= 4) || (ecart(c, d) >= 0 && ecart(c, d) <= 2))
  // Jours sans vélo : rôle sans vélo (les anciens jours « course » comptent comme libres) et aucune séance de vélo prévue
  const sansVelo = (d: string, i: number) => !o.roles[i].startsWith('velo') && !(o.velo ?? []).includes(d) && !o.indispos?.includes(d) && !o.cles.includes(d) && !avantCourse(d)
  const rang = (d: string) => (o.roles[o.dates.indexOf(d)] === 'renfo' ? 0 : 1)
  const choisis: { date: string; soir: boolean; reduite?: boolean }[] = []
  const ajouter = (l: string[], soir: boolean, reduite = false) => {
    for (const d of l) {
      if (choisis.length >= o.n) return
      if (choisis.every((c) => Math.abs(ecart(c.date, d)) >= 2)) choisis.push({ date: d, soir, ...(reduite ? { reduite } : {}) })
    }
  }
  const libres = o.dates.filter((d, i) => sansVelo(d, i)).sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
  // 1. Un jour sans vélo qui n'est pas la veille d'une séance clé
  ajouter(libres.filter((d) => !veille(d)), false)
  // 2. Le soir d'une séance dure (pas la veille d'une autre séance clé)
  ajouter(o.durs.filter((d) => !veille(d) && !avantCourse(d)), true)
  // 3. En dernier recours : un jour sans vélo, même la veille d'une séance clé, en version réduite (2 séries, sans le
  // soulevé : l'endurance baisse surtout 24 à 72 h après une muscu à fort excentrique, Doma 2017 et 2019)
  if (!choisis.length && !o.courses.some((c) => c >= o.dates[0] && c <= o.dates[6])) ajouter(libres, false, true)
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
export function chargeProposee(exo: ExoForce, e: EtatExo | undefined, reps: number, facteur = 1): number | undefined {
  if (exo.sansCharge || !e?.charge) return undefined
  const ratio = !e.repsRef || e.repsRef === reps ? 1 : (1 + e.repsRef / 30) / (1 + reps / 30)
  const pas = exo.pas || 1
  return Math.max(pas, Math.floor((e.charge * ratio * facteur) / pas) * pas)
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
  /** 2e séance de la semaine ailleurs (ex. 1 en salle, 1 à la maison), en option (15/11/2026) */
  lieu2?: Lieu
  /** Déjà fait du squat chargé : règle l'apprentissage (4, 3 ou 2 semaines) */
  experience?: 'jamais' | 'un-peu' | 'regulier'
}
// 2 séances par semaine par défaut (toutes les études positives chez le cycliste) ; 1 garde l'essentiel des gains
export const FORCE_DEFAUT: ReglagesForce = { actif: false, lieu: 'salle', seances: 2, exos: {} }

/** Ce qui est prévu pour une séance : période, séries, répétitions, lieu, et si c'est le soir d'une séance de vélo. */
export interface SeanceForce {
  periode: PeriodeForce
  semaine: number
  series: number
  reps: number
  lieu: Lieu
  legere?: boolean
  soir?: boolean
  facteur?: number
  longue?: boolean
  /** Soulevé roumain ou leg curl cette fois (alternance) */
  variante?: 'souleve' | 'curl'
  /** Veille d'une séance clé (dernier recours) : 2 séries, sans le soulevé */
  reduite?: boolean
  /** Genoux fragiles (profil) : amplitude limitée */
  genoux?: boolean
  /** VTT : 2 exercices du haut du corps en prévention */
  vtt?: boolean
}

/**
 * Durée estimée (min) : 10 min de mise en route et d'échauffement, par série ~1 min d'effort + 2-3 min de repos (× 1,7
 * pour un exercice à une jambe : les deux jambes à la suite, choix d'entraîneur), 8 min de prévention (+4 en VTT).
 */
export const dureeForce = (s: SeanceForce) =>
  Math.round(10 + exosDe(s).reduce((t, e) => t + s.series * (s.legere ? 2.5 : 3.2) * (e.unilateral ? 1.7 : 1), 0) + 8 + (s.vtt ? 4 : 0))
