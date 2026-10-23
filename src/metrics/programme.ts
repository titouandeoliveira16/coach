/**
 * Programme vélo automatique (système kJ + banque de séances validées).
 *
 * Principes (voir les « ? » de l'appli) :
 *  - 1 séance d'intensité vélo par semaine, le reste en Z2 (dont la sortie longue avec sprints) ;
 *  - l'ordre et la répartition VO2 / seuil comptent peu à charge égale (Sylta 2016, Almquist 2022) :
 *    on mélange, avec une dominante qui change selon la phase ;
 *  - progression par famille : on allonge le temps de travail d'abord, puis +2,5 % de watts
 *    (règle 6 du PDF kJ) ; un bloc non tenu = −5 % ;
 *  - budget kJ hebdomadaire : +7,5 % si validé et signaux au vert, stable si mitigé, −15 % si rouge ;
 *    semaine allégée (−35 %) toutes les 4 semaines et la semaine d'une course.
 */
import { decaler } from './vfc'

export type Famille = 'vo2-courts' | 'vo2-longs' | 'seuil' | 'seuil-variable' | 'sweet-spot' | 'tempo'
export type TypePhase = 'reprise' | 'vo2' | 'seuil' | 'entretien'
/** Rôle d'un jour dans la semaine type */
export type Role = 'course' | 'renfo' | 'velo-dur' | 'velo-z2' | 'velo-long' | 'libre'

export interface Palier {
  series: number
  reps: number
  /** Durée d'une répétition, si différente de celle du format */
  travailSec?: number
}

export interface Format {
  id: string
  famille: Famille
  nom: string
  travailSec: number
  /** Intensité du travail, en % de CP */
  pct: number
  recupSec: number
  pctRecup: number
  /** Récupération entre séries */
  recupSerieSec?: number
  /** Over-unders : la « récup » est la partie sous la CP, sans pause entre les cycles */
  continu?: boolean
  paliers: [Palier, Palier, Palier, Palier]
  preuve: 'forte' | 'bonne' | 'correcte' | 'plus faible'
  source: string
}

const p = (series: number, reps: number, travailSec?: number): Palier => ({ series, reps, travailSec })

/** Banque de séances d'intensité. Les % de CP sont des points de départ, ajustés ensuite par la progression. */
export const FORMATS: Format[] = [
  // VO2 courts : séries de 3' de récupération
  { id: '30-15', famille: 'vo2-courts', nom: '30/15', travailSec: 30, pct: 120, recupSec: 15, pctRecup: 50, recupSerieSec: 180,
    paliers: [p(2, 10), p(2, 13), p(3, 10), p(3, 13)], preuve: 'forte', source: 'Rønnestad et al. 2015, 2020 : meilleurs gains de VO2max et de puissance que 4 × 5 min chez des cyclistes entraînés.' },
  { id: '30-30', famille: 'vo2-courts', nom: '30/30', travailSec: 30, pct: 125, recupSec: 30, pctRecup: 50, recupSerieSec: 180,
    paliers: [p(2, 8), p(2, 10), p(3, 8), p(3, 10)], preuve: 'correcte', source: 'Billat 2000-2001 : le 30/30 permet de passer beaucoup de temps près de la VO2max.' },
  { id: '15-15', famille: 'vo2-courts', nom: '15/15', travailSec: 15, pct: 135, recupSec: 15, pctRecup: 50, recupSerieSec: 180,
    paliers: [p(2, 10), p(2, 12), p(3, 10), p(3, 12)], preuve: 'correcte', source: 'Buchheit & Laursen 2013 : les intervalles très courts accumulent du temps près de la VO2max avec peu de fatigue.' },
  { id: '40-20', famille: 'vo2-courts', nom: '40/20', travailSec: 40, pct: 115, recupSec: 20, pctRecup: 50, recupSerieSec: 180,
    paliers: [p(2, 6), p(2, 8), p(3, 6), p(3, 8)], preuve: 'correcte', source: 'Buchheit & Laursen 2013 : même logique que le 30/15, avec un ratio travail/récup de 2:1.' },
  { id: '20-40', famille: 'vo2-courts', nom: '20/40', travailSec: 20, pct: 140, recupSec: 40, pctRecup: 50, recupSerieSec: 180,
    paliers: [p(2, 8), p(2, 10), p(3, 8), p(3, 10)], preuve: 'correcte', source: 'Buchheit & Laursen 2013 : efforts courts plus intenses, récupération longue.' },
  // VO2 longs
  { id: '3min', famille: 'vo2-longs', nom: "intervalles de 3'", travailSec: 180, pct: 115, recupSec: 180, pctRecup: 50,
    paliers: [p(1, 4), p(1, 5), p(1, 6), p(1, 7)], preuve: 'correcte', source: 'Buchheit & Laursen 2013 : intervalles longs de 2-4 min à la PMA.' },
  { id: '4min', famille: 'vo2-longs', nom: "intervalles de 4'", travailSec: 240, pct: 110, recupSec: 180, pctRecup: 50,
    paliers: [p(1, 3), p(1, 4), p(1, 5), p(1, 6)], preuve: 'correcte', source: 'Helgerud et al. 2007 : 4 × 4 min, gains de VO2max (étudié surtout en course à pied).' },
  { id: '5min', famille: 'vo2-longs', nom: "intervalles de 5'", travailSec: 300, pct: 107, recupSec: 150, pctRecup: 50,
    paliers: [p(1, 3), p(1, 4), p(1, 5), p(1, 6)], preuve: 'bonne', source: 'Rønnestad et al. 2015 : 4 × 5 min, groupe contrôle qui progresse aussi.' },
  { id: '6min', famille: 'vo2-longs', nom: "intervalles de 6'", travailSec: 360, pct: 106, recupSec: 150, pctRecup: 50,
    paliers: [p(1, 2), p(1, 3), p(1, 4), p(1, 5)], preuve: 'correcte', source: 'Buchheit & Laursen 2013 : intervalles longs proches de la PMA.' },
  { id: '8min', famille: 'vo2-longs', nom: "intervalles de 8'", travailSec: 480, pct: 104, recupSec: 120, pctRecup: 50,
    paliers: [p(1, 2), p(1, 3), p(1, 4), p(1, 5)], preuve: 'forte', source: 'Seiler et al. 2013 : 4 × 8 min a donné plus de gains que 4 × 4 et 4 × 16 min.' },
  // Seuil
  { id: 'seuil-8-10', famille: 'seuil', nom: "seuil en blocs de 8-10'", travailSec: 480, pct: 97, recupSec: 180, pctRecup: 50,
    paliers: [p(1, 3), p(1, 3, 600), p(1, 4), p(1, 4, 600)], preuve: 'bonne', source: 'Sylta et al. 2016 : intervalles longs au seuil, progrès comparables aux formats VO2 à charge égale.' },
  { id: 'seuil-12-20', famille: 'seuil', nom: "seuil en blocs de 12-20'", travailSec: 720, pct: 97, recupSec: 240, pctRecup: 50,
    paliers: [p(1, 2), p(1, 2, 900), p(1, 3), p(1, 2, 1200)], preuve: 'bonne', source: 'Sylta et al. 2016 : intervalles longs (jusqu’à 16 min), +5 à 10 % de puissance sur 40 min.' },
  { id: 'seuil-continu', famille: 'seuil', nom: 'seuil continu', travailSec: 1200, pct: 95, recupSec: 0, pctRecup: 50,
    paliers: [p(1, 1), p(1, 1, 1500), p(1, 1, 1800), p(1, 1, 2100)], preuve: 'bonne', source: 'Travail continu juste sous la CP (état stable lactique maximal).' },
  // Seuil variable : cycles de 2' à 95 % + 1' à 105 %
  { id: 'over-under', famille: 'seuil-variable', nom: 'over-unders', travailSec: 60, pct: 105, recupSec: 120, pctRecup: 95, recupSerieSec: 240, continu: true,
    paliers: [p(2, 3), p(2, 4), p(3, 3), p(3, 4)], preuve: 'plus faible', source: 'Pratique d’entraîneurs, peu étudiée : gardée pour varier le travail au seuil.' },
  // Sweet spot et tempo
  { id: 'sweet-spot', famille: 'sweet-spot', nom: 'sweet spot', travailSec: 900, pct: 91, recupSec: 240, pctRecup: 50,
    paliers: [p(1, 2), p(1, 3, 720), p(1, 2, 1200), p(1, 3, 840)], preuve: 'plus faible', source: 'Peu étudié : utile en reprise pour accumuler du travail sous le seuil.' },
  { id: 'tempo', famille: 'tempo', nom: 'tempo', travailSec: 900, pct: 83, recupSec: 300, pctRecup: 50,
    paliers: [p(1, 2), p(1, 2, 1080), p(1, 2, 1200), p(1, 1, 2700)], preuve: 'plus faible', source: 'Zone 3 (« moyenne ») : utile en reprise, à doser (modèle pyramidal).' },
]

export const formatDe = (id: string) => FORMATS.find((f) => f.id === id)

/** Échauffement et retour au calme des séances d'intensité */
export const ECHAUFFEMENT_SEC = 15 * 60
export const RETOUR_SEC = 10 * 60

const arrondi5 = (w: number) => Math.round(w / 5) * 5
const enMin = (sec: number) => (sec % 60 ? `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, '0')}` : `${sec / 60}'`)
const enDuree = (sec: number) => (sec < 60 ? `${sec}"` : enMin(sec))

/** Une séance vélo générée (stockée dans la séance prévue). */
export interface SeanceVelo {
  famille: Famille | 'z2' | 'z2-long' | 'test'
  formatId?: string
  palier?: number
  allegee?: boolean
  /** Watts du travail (intervalles) ou de la Z2 */
  cibleW?: number
  /** Explication du choix (phase, alternance, progression) */
  pourquoi?: string
}

export interface SeanceConstruite {
  titre: string
  detail: string
  dureeMin: number
  kj: number
  velo: SeanceVelo
}

/** Durée totale (s) d'un format à un palier. */
export function dureeFormat(f: Format, palier: number) {
  const pa = f.paliers[palier]
  const t = pa.travailSec ?? f.travailSec
  const bloc = f.continu ? pa.reps * (t + f.recupSec) : pa.reps * t + (pa.reps - 1) * f.recupSec
  const corps = pa.series * bloc + (pa.series - 1) * (f.recupSerieSec ?? 0)
  return { totalSec: ECHAUFFEMENT_SEC + corps + RETOUR_SEC, corpsSec: corps, travailSec: pa.series * pa.reps * t }
}

/** Plus haut palier (≤ visé) qui tient dans le créneau. */
export function palierPossible(f: Format, vise: number, maxMin: number) {
  for (let i = vise; i > 0; i--) if (dureeFormat(f, i).totalSec <= maxMin * 60) return i
  return 0
}

/** Construit une séance d'intervalles : structure, watts, durée, kJ. */
export function construireIntervalles(f: Format, palier: number, cpW: number, bonus: number): SeanceConstruite {
  const pa = f.paliers[palier]
  const t = pa.travailSec ?? f.travailSec
  const { totalSec, corpsSec, travailSec } = dureeFormat(f, palier)
  const wT = arrondi5(cpW * (f.pct / 100) * (1 + bonus))
  const wR = arrondi5(cpW * (f.pctRecup / 100) * (f.continu ? 1 + bonus : 1))
  const wEch = arrondi5(cpW * 0.6)
  const wRet = arrondi5(cpW * 0.5)
  const kj = (ECHAUFFEMENT_SEC * wEch + travailSec * wT + (corpsSec - travailSec) * wR + RETOUR_SEC * wRet) / 1000

  let titre: string
  let corps: string
  if (f.continu) {
    titre = `${pa.series} × ${pa.reps} cycles over-unders`
    corps = `${pa.series} × [${pa.reps} × (${enDuree(f.recupSec)} à ${wR} W + ${enDuree(t)} à ${wT} W)], ${enMin(f.recupSerieSec ?? 0)} facile entre les blocs`
  } else if (f.famille === 'vo2-courts') {
    titre = `${pa.series} × ${pa.reps} × ${f.nom}`
    corps = `${pa.series} séries de ${pa.reps} × (${enDuree(t)} à ${wT} W / ${enDuree(f.recupSec)} à ${wR} W), ${enMin(f.recupSerieSec ?? 0)} facile entre les séries`
  } else if (pa.reps === 1 && pa.series === 1) {
    titre = `${enMin(t)} ${f.nom}`
    corps = `${enMin(t)} à ${wT} W`
  } else {
    titre = `${pa.reps} × ${enMin(t)} ${f.famille === 'seuil' ? 'seuil' : f.nom.replace(/^intervalles de .*/, 'VO2')}`
    corps = `${pa.reps} × ${enMin(t)} à ${wT} W, ${enMin(f.recupSec)} à ${wR} W entre`
  }
  const detail = `Échauffement 15' progressif (≈ ${wEch} W, 3 accélérations de 10") · ${corps} · Retour au calme 10' (≈ ${wRet} W)`
  return {
    titre, detail, dureeMin: Math.round(totalSec / 60), kj: Math.round(kj),
    velo: { famille: f.famille, formatId: f.id, palier, cibleW: wT },
  }
}

/** Sprints de la sortie longue (Almquist 2020) : de plus en plus nombreux, puis plus longs. */
export const SPRINTS = [
  { n: 6, sec: 10 }, { n: 8, sec: 10 }, { n: 6, sec: 15 }, { n: 8, sec: 15 },
]

/** Séance d'endurance (Z2), avec sprints pour la sortie longue. */
export function construireZ2(dureeMin: number, z2W: number, sprints?: { n: number; sec: number }): SeanceConstruite {
  const ech = Math.min(10, dureeMin) * 60
  const wEch = arrondi5(z2W * 0.85)
  const kj = (ech * wEch + (dureeMin * 60 - ech) * z2W) / 1000 + (sprints ? sprints.n * sprints.sec * z2W * 2.5 / 1000 : 0)
  const s = sprints
    ? ` · ${sprints.n} sprints de ${sprints.sec}" à fond (assis puis debout), un toutes les 10 min environ à partir de la 20e minute, bien récupérer entre`
    : ''
  return {
    titre: sprints ? `Z2 longue + ${sprints.n} sprints` : 'Endurance Z2',
    detail: `10' progressif (≈ ${wEch} W) puis ${dureeMin - 10}' à ${z2W} W (Z2, RPE ≤ 3, aisance respiratoire)${s}`,
    dureeMin, kj: Math.round(kj),
    velo: { famille: sprints ? 'z2-long' : 'z2', cibleW: z2W },
  }
}

/** Test CP 12-7-3 (calculateur des Réglages). */
export function construireTest(cpW: number): SeanceConstruite {
  return {
    titre: 'Test CP 12-7-3',
    detail: "Échauffement 20' dont 2 × 1' à 110 % de CP · 12' à fond (régulier) · 10' très facile · 7' à fond · 10' très facile · 3' à fond · 10' retour au calme. Saisis ensuite tes 3 puissances moyennes : Réglages → Vélo → Calculer depuis mon test.",
    dureeMin: 85,
    kj: Math.round((20 * 60 * cpW * 0.6 + 12 * 60 * cpW * 1.02 + 7 * 60 * cpW * 1.1 + 3 * 60 * cpW * 1.25 + 30 * 60 * cpW * 0.45) / 1000),
    velo: { famille: 'test' },
  }
}

// ——— Phases et choix de la séance ———

export interface Phase {
  debut: string
  type: TypePhase
}

export const NOMS_PHASES: Record<TypePhase, string> = {
  reprise: 'Reprise & endurance',
  vo2: 'Dominante VO2max',
  seuil: 'Dominante seuil',
  entretien: 'Entretien (VO2 / seuil)',
}

/** Phase d'une semaine et numéro de la semaine dans la phase (0 = première). */
export function phaseDe(lundi: string, phases: Phase[]) {
  const triees = [...phases].sort((a, b) => a.debut.localeCompare(b.debut))
  const phase = [...triees].reverse().find((ph) => ph.debut <= lundi) ?? triees[0]
  const semaine = Math.max(0, Math.floor((Date.parse(lundi) - Date.parse(phase.debut)) / (7 * 86_400_000)))
  return { phase, semaine }
}

/** Semaine allégée : 1 sur 4 dans chaque phase. */
export const estSemaineAllegee = (semaineDansPhase: number) => semaineDansPhase % 4 === 3

/** Dominante de chaque phase : enchaînement des types de séance d'une semaine sur l'autre. */
const CYCLES: Record<TypePhase, ('vo2' | 'seuil' | 'sous-seuil')[]> = {
  reprise: ['sous-seuil', 'vo2'],
  vo2: ['vo2', 'vo2', 'seuil'],
  seuil: ['seuil', 'seuil', 'vo2'],
  entretien: ['vo2', 'seuil'],
}

/** Une séance d'intensité passée (ou déjà prévue), pour l'alternance et la progression. */
export interface HistoIntensite {
  date: string
  famille: Famille
  formatId: string
  palier: number
  allegee?: boolean
  resultat?: 'reussie' | 'ratee'
}

/** Choisit la famille et le format de la séance d'intensité de la semaine. */
export function choisirFormat(lundi: string, phases: Phase[], histo: HistoIntensite[]) {
  const { phase } = phaseDe(lundi, phases)
  const avant = histo.filter((h) => h.date < lundi).sort((a, b) => a.date.localeCompare(b.date))
  const dansPhase = avant.filter((h) => h.date >= phase.debut)
  const cycle = CYCLES[phase.type]
  const dominante = cycle[dansPhase.length % cycle.length]
  const derniere = (f: (h: HistoIntensite) => boolean) => [...avant].reverse().find(f)

  let famille: Famille
  if (dominante === 'sous-seuil') {
    famille = derniere((h) => h.famille === 'sweet-spot' || h.famille === 'tempo')?.famille === 'sweet-spot' ? 'tempo' : 'sweet-spot'
  } else if (dominante === 'vo2') {
    // En reprise : uniquement des VO2 courts (30/15 « léger »), sinon alternance courts / longs
    famille = phase.type === 'reprise' ? 'vo2-courts' : derniere((h) => h.famille.startsWith('vo2'))?.famille === 'vo2-courts' ? 'vo2-longs' : 'vo2-courts'
  } else {
    // 1 séance de seuil sur 3 en over-unders
    const nSeuil = avant.filter((h) => h.famille === 'seuil' || h.famille === 'seuil-variable').length
    famille = nSeuil % 3 === 2 ? 'seuil-variable' : 'seuil'
  }

  // Formats de la famille à tour de rôle (jamais deux fois le même d'affilée)
  const formats = FORMATS.filter((f) => f.famille === famille)
  const dernier = derniere((h) => h.famille === famille)
  const i = dernier ? (formats.findIndex((f) => f.id === dernier.formatId) + 1) % formats.length : 0
  // En reprise, on commence par le 30/15
  return { famille, format: formats[i], phase, dominante }
}

/** Progression par famille : palier atteint (0 à 3) et bonus de watts. */
export function etatProgression(histo: HistoIntensite[]) {
  const etat = {} as Record<Famille, { palier: number; bonus: number }>
  for (const f of FORMATS) etat[f.famille] = { palier: 0, bonus: 0 }
  for (const h of [...histo].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!h.resultat || h.allegee) continue
    const e = etat[h.famille]
    if (h.resultat === 'reussie') {
      // Palier réussi : on monte d'un cran ; au dernier palier, +2,5 % de watts et retour au 2e palier
      if (h.palier >= 3) {
        e.bonus += 0.025
        e.palier = 1
      } else e.palier = Math.max(e.palier, h.palier + 1)
    } else {
      e.bonus -= 0.05
    }
  }
  return etat
}

// ——— Budget kJ ———

export interface BilanSemaine {
  /** Budget de référence (hors allègement) */
  budgetRef: number
  kjPrevus: number
  kjRealises: number
  rouges: number
  oranges: number
  allegee: boolean
}

/**
 * Budget kJ de la semaine (système kJ) à partir du bilan de la précédente.
 * @param nominal semaine type (séance d'intensité + Z2 1 h + Z2 longue 1 h 40)
 * @param plafond tout au maximum du créneau
 */
export function budgetSemaine(prec: BilanSemaine | undefined, nominal: number, plafond: number, allegee: boolean, raisonAllegee = 'semaine allégée (1 sur 4)') {
  let ref: number
  let raison: string
  if (!prec) {
    ref = nominal
    raison = 'Budget de départ (semaine type)'
  } else if (prec.allegee) {
    ref = prec.budgetRef
    raison = 'Retour au budget d’avant la semaine allégée'
  } else {
    const part = prec.kjPrevus ? prec.kjRealises / prec.kjPrevus : 0
    if (prec.rouges >= 2) {
      ref = prec.budgetRef * 0.85
      raison = `−15 % : ${prec.rouges} jours rouges la semaine dernière`
    } else if (part < 0.9) {
      ref = prec.budgetRef
      raison = `Stable : budget de la semaine dernière réalisé à ${Math.round(part * 100)} % (validé à partir de 90 %)`
    } else if (prec.rouges === 0 && prec.oranges <= 1) {
      ref = prec.budgetRef * 1.075
      raison = '+7,5 % : budget validé et signaux au vert'
    } else {
      ref = prec.budgetRef
      raison = `Stable : budget validé mais ${prec.rouges ? `${prec.rouges} jour rouge, ` : ''}${prec.oranges} jour(s) orange`
    }
  }
  const borne = Math.min(plafond, Math.max(nominal * 0.6, ref))
  if (borne < ref) raison += ' (plafonné par tes créneaux)'
  ref = Math.round(borne)
  return { budgetRef: ref, budget: Math.round(allegee ? ref * 0.65 : ref), raison: allegee ? `${raison} · ${raisonAllegee} : −35 %` : raison }
}

/** Minutes de Z2 pour produire un travail donné. */
export const minutesPourKj = (kj: number, z2W: number) => (kj * 1000) / z2W / 60

// ——— Placement dans la semaine ———

export interface Occupation {
  date: string
  /** Séance dure (seuil 60 et au-dessus, test, compétition) */
  dure: boolean
}

export interface Placement {
  intensite?: string
  long?: string
  z2: string[]
}

export interface OptionsPlacement {
  competitions?: string[]
  dateTest?: string
  /** Faut-il encore placer la séance d'intensité / la sortie longue (déjà faites sinon) ? */
  intensite?: boolean
  long?: boolean
  /** Nombre de séances Z2 (hors sortie longue) à placer */
  nZ2?: number
}

/**
 * Place les séances vélo sur les jours libres :
 *  - jamais deux séances le même jour ;
 *  - la séance d'intensité jamais la veille ni le lendemain d'une séance dure (course) ;
 *  - ni dans les 2 jours avant une compétition, ni le lendemain.
 */
export function placer(semaine: string[], roles: Role[], autres: Occupation[], indispos: Set<string>, aPartirDe: string, o: OptionsPlacement = {}): Placement {
  const competitions = o.competitions ?? []
  const pris = new Set(autres.map((x) => x.date))
  const libre = (d: string) => d >= aPartirDe && !indispos.has(d) && !pris.has(d)
  const dur = new Set(autres.filter((x) => x.dure).map((x) => x.date))
  const procheDur = (d: string) =>
    dur.has(decaler(d, -1)) || dur.has(decaler(d, 1)) || competitions.some((c) => c === decaler(d, 1) || c === decaler(d, 2) || c === decaler(d, -1))
  const role = (d: string) => roles[semaine.indexOf(d)]
  const utilises = new Set<string>()
  const prendre = (d?: string) => (d && utilises.add(d), d)

  let intensite: string | undefined
  if (o.intensite !== false) {
    if (o.dateTest && semaine.includes(o.dateTest) && libre(o.dateTest)) intensite = prendre(o.dateTest)
    else {
      // Jour prévu d'abord, puis les autres jours vélo de semaine, puis n'importe quel jour libre (sauf celui de la sortie longue)
      const ordre = [
        ...semaine.filter((d) => role(d) === 'velo-dur'),
        ...semaine.filter((d) => role(d) === 'velo-z2'),
        ...semaine.filter((d) => !['velo-dur', 'velo-z2', 'velo-long'].includes(role(d))),
      ]
      intensite = prendre(ordre.find((d) => libre(d) && !procheDur(d)))
    }
  }

  const weekend = (d: string) => semaine.indexOf(d) >= 5
  const long = o.long === false ? undefined : prendre(
    semaine.find((d) => role(d) === 'velo-long' && libre(d) && !utilises.has(d)) ??
      semaine.find((d) => weekend(d) && libre(d) && !utilises.has(d)),
  )
  const z2: string[] = []
  const nZ2 = (o.nZ2 ?? roles.filter((r) => r === 'velo-z2').length) + (o.intensite !== false && !intensite ? 1 : 0) + (o.long !== false && !long ? 1 : 0)
  const candidats = [
    ...semaine.filter((d) => role(d) === 'velo-z2' || role(d) === 'velo-dur'),
    ...semaine.filter((d) => !['velo-dur', 'velo-z2'].includes(role(d))),
  ]
  for (const d of candidats) {
    if (z2.length >= nZ2) break
    if (libre(d) && !utilises.has(d)) z2.push(prendre(d)!)
  }
  return { intensite, long, z2: z2.sort() }
}
