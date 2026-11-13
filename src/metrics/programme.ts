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
// Extrait léger du catalogue (séances du programme seulement, catalogue/generer.py) : le catalogue entier pèse 250 Ko
import catalogue from '../../catalogue/programme.json'
import { decaler } from './vfc'
import { montee, puissanceTenable, vitesseMontee } from './col'

export type Famille = 'vo2-courts' | 'vo2-longs' | 'seuil-plus' | 'seuil' | 'seuil-variable' | 'sweet-spot' | 'tempo' | 'relances' | 'sprints'
/** Discipline visée : route (programme d'origine) ou une discipline VTT (catalogue, profils de discipline). */
export type Discipline = 'route' | 'xco' | 'xcc' | 'xcm' | 'enduro' | 'dh'
export const NOMS_DISCIPLINES: Record<Discipline, string> = {
  route: 'Route', xco: 'VTT cross-country (XCO)', xcc: 'VTT short track (XCC)', xcm: 'VTT marathon (XCM)', enduro: 'VTT enduro', dh: 'VTT descente',
}
/** Disciplines proposées (enduro et descente mis de côté le 5/11/2026 : le code reste, on ne les propose plus). */
export const DISCIPLINES_PROPOSEES: Discipline[] = ['route', 'xco', 'xcc', 'xcm']
/**
 * Phases. Saisons calculées (depuis le 6/11/2026, forme de l'entraîneur Mathias Chauvin, contenu relu par la science) :
 * reprise → seuil-tirage (tirer le seuil) → seuil-maintien (allonger le seuil) → fin-prepa (sweet spot + VO2) →
 * specifique → affutage → recuperation. 'vo2' et 'seuil' restent pour la saison écrite à la main de Titouan.
 */
export type TypePhase = 'reprise' | 'base' | 'vo2' | 'seuil' | 'entretien' | 'seuil-tirage' | 'seuil-maintien' | 'fin-prepa' | 'specifique' | 'affutage' | 'recuperation'
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
  /** Fiche du catalogue scientifique d'où vient le format */
  catalogueId: string
  /** Efforts à fond : pas de cible en watts (allure libre sur Zwift), `pct` sert seulement à estimer les kJ */
  aFond?: boolean
  /** Disciplines où le format sert (catalogue) */
  disciplines: string[]
}

/** Paramètres « programme » d'une séance du catalogue (catalogue/generer.py, fonction prog). */
interface ProgrammeCatalogue extends Omit<Format, 'paliers' | 'catalogueId' | 'disciplines'> {
  paliers: [number, number, number?][]
  ordre: number
}

/**
 * Banque de séances d'intensité : piochée dans le catalogue scientifique (catalogue/seances.json), parmi les séances
 * qui ont des paramètres « programme ». Une séance ajoutée au catalogue avec ces paramètres entre dans le programme.
 * Les % de CP sont des points de départ, ajustés ensuite par la progression.
 */
export const FORMATS: Format[] = (catalogue.seances as { id: string; disciplines?: string[]; programme?: ProgrammeCatalogue }[])
  .filter((s) => s.programme)
  .sort((x, y) => x.programme!.ordre - y.programme!.ordre)
  .map((s) => {
    const { ordre: _ordre, paliers, recupSerieSec, continu, aFond, ...f } = s.programme!
    return {
      ...f,
      ...(recupSerieSec !== undefined ? { recupSerieSec } : {}),
      ...(continu ? { continu } : {}),
      ...(aFond ? { aFond } : {}),
      disciplines: s.disciplines ?? ['route'],
      paliers: paliers.map(([series, reps, travailSec]) => ({ series, reps, travailSec })) as Format['paliers'],
      catalogueId: s.id,
    }
  })

export const formatDe = (id: string) => FORMATS.find((f) => f.id === id)

/**
 * Échauffement et retour au calme des séances d'intensité, selon la qualité travaillée :
 *  - seuil, sweet spot, tempo : 15' progressives avec 1' à 95 % (Burnley 2005) ;
 *  - VO2 : 20', dont 3 × 30" à 110 % puis 5' faciles avant la 1re répétition (Bailey 2009 : le « priming »
 *    aide si l'on récupère assez, il gêne avec 3' seulement) ;
 *  - retour au calme dégressif de 55 à 45 % (Van Hooren & Peake 2018 : confort, peu d'effet sur le lendemain).
 */
export type Preparation = 'seuil' | 'vo2'
/** Repère de cadence (Hansen & Rønnestad 2017, Lucía 2004 : plus haute sur les efforts durs, jamais imposée). */
export const CADENCE_VO2 = '90-105'
export const CADENCE_SEUIL = '85-95'
export const preparationDe = (f: Format): Preparation => (f.famille.startsWith('vo2') || f.famille === 'relances' || f.famille === 'sprints' ? 'vo2' : 'seuil')
type Morceau = [dureeSec: number, pctCp: number, libelle: string]
const BASE: Morceau[] = [[300, 0.5, 'Échauffement, très facile'], [240, 0.65, 'Échauffement, facile'], [180, 0.8, 'Échauffement, modéré']]
const CADENCES_ECHAUFFEMENT: Record<number, string> = { 0.95: CADENCE_SEUIL, 1.1: CADENCE_VO2 }
const ECHAUFFEMENTS: Record<Preparation, Morceau[]> = {
  seuil: [...BASE, [60, 0.95, "Échauffement : 1' au rythme du seuil"], [120, 0.55, 'Souffle, pédale souple avant le premier bloc']],
  vo2: [
    ...BASE,
    ...[1, 2, 3].flatMap((i): Morceau[] => [[30, 1.1, `Échauffement : accélération ${i}/3 (30")`], [30, 0.55, '30" facile']]),
    [300, 0.55, 'Souffle cinq minutes, pédale souple avant la première répétition'],
  ],
}
const RETOURS: Record<Preparation, Morceau[]> = {
  seuil: [[180, 0.55, 'Retour au calme, en relâchant peu à peu'], [240, 0.45, 'Retour au calme, très facile']],
  vo2: [[180, 0.55, 'Retour au calme, en relâchant peu à peu'], [180, 0.5, 'Retour au calme, facile'], [240, 0.45, 'Retour au calme, très facile']],
}
const somme = (l: Morceau[]) => l.reduce((t, [d]) => t + d, 0)
export const echauffementSec = (pr: Preparation) => somme(ECHAUFFEMENTS[pr])
export const retourSec = (pr: Preparation) => somme(RETOURS[pr])
/** Ancien échauffement + retour au calme (25') : sert à choisir le palier, pour qu'un échauffement plus long
 *  ne retire pas de répétition. */
const ENCADREMENT_PALIER_SEC = 25 * 60

const arrondi5 = (w: number) => Math.round(w / 5) * 5
const enMin = (sec: number) => (sec % 60 ? `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, '0')}` : `${sec / 60}'`)
const enDuree = (sec: number) => (sec < 60 ? `${sec}"` : enMin(sec))

/** Une étape du déroulé (à suivre minute par minute sur le compteur). */
export interface Etape {
  /** Début de l'étape (s depuis le départ) */
  debutSec: number
  dureeSec: number
  libelle: string
  /** Watts cibles (absent : à fond ou libre) : le milieu de la plage, envoyé à Zwift */
  w?: number
  /** Plage de watts à viser (moyenne de l'étape), sur les efforts */
  wMin?: number
  wMax?: number
  /** Repère de cadence en tr/min (« 85-95 »), pas une consigne ; absent : cadence libre */
  cadence?: string
  /**
   * Série répétée : `fois` × (sous-étapes), envoyée telle quelle à Zwift / Garmin et dessinée répétition par répétition.
   * `derniere` : nombre de sous-étapes gardées dans la dernière répétition (ex. 1 : pas de récup avant la suite).
   */
  repetition?: { fois: number; etapes: SousEtape[]; derniere?: number }
}

/** Une sous-étape d'une série répétée (w absent : à fond). */
export interface SousEtape {
  dureeSec: number
  libelle: string
  w?: number
  wMin?: number
  wMax?: number
  cadence?: string
}

/** Étapes à plat, répétitions déroulées (pour le profil et l'envoi). */
export function deplier(etapes: Etape[]): Etape[] {
  const out: Etape[] = []
  for (const e of etapes) {
    if (!e.repetition) {
      out.push(e)
      continue
    }
    let h = e.debutSec
    const { fois, etapes: sous, derniere = sous.length } = e.repetition
    for (let i = 0; i < fois; i++) {
      for (let j = 0; j < sous.length; j++) {
        if (i === fois - 1 && j >= derniere) break
        out.push({ ...sous[j], debutSec: h })
        h += sous[j].dureeSec
      }
    }
  }
  return out
}

/**
 * Plage autour de la cible, par famille (relecture du 29/10 : Liedl 1999, Bossi 2020 ; largeurs = choix d'entraîneur) :
 * on juge la puissance moyenne de chaque répétition, pas la puissance seconde par seconde.
 */
const PLAGES: Record<Famille | 'z2', [number, number]> = {
  'vo2-courts': [-0.03, 0.05], 'vo2-longs': [-0.03, 0.05], 'seuil-plus': [-0.03, 0.04], seuil: [-0.02, 0.03], 'seuil-variable': [-0.03, 0.03],
  'sweet-spot': [-0.03, 0.03], tempo: [-0.03, 0.03], relances: [-0.03, 0.05], sprints: [0, 0], z2: [-0.05, 0.05],
}
/** Familles où dépasser la plage compte comme « pas tenu » (on passerait au-dessus du seuil). */
export const FAMILLES_PLAFONNEES = new Set<string>(['seuil', 'sweet-spot', 'tempo'])
export const plage = (w: number, famille: Famille | 'z2') =>
  ({ wMin: arrondi5(w * (1 + PLAGES[famille][0])), wMax: arrondi5(w * (1 + PLAGES[famille][1])) })
const cadenceDe = (f: Famille) => (f === 'sprints' ? CADENCE_SPRINT : f.startsWith('vo2') || f === 'relances' ? CADENCE_VO2 : CADENCE_SEUIL)
export const CADENCE_SPRINT = '100-120'

/** Une séance vélo générée (stockée dans la séance prévue). */
export interface SeanceVelo {
  /** vtt-terrain : sortie VTT technique ; vtt-speciales : spéciales d'enduro (sur le terrain, sans cible en watts) */
  famille: Famille | 'z2' | 'z2-long' | 'test' | 'vtt-terrain' | 'vtt-speciales' | 'simulation-ligne' | 'cyclo-montees' | 'simulation-xco' | 'course'
  formatId?: string
  palier?: number
  allegee?: boolean
  /** Watts du travail (intervalles) ou de la Z2 */
  cibleW?: number
  /** CP utilisée pour construire la séance (version raccourcie d'un jour orange) */
  cpW?: number
  /** Sortie avec blocs au 1er seuil : watts et nombre de blocs */
  sv1W?: number
  blocsSv1?: number
  /** Plage de FC visée sur les blocs au 1er seuil (bpm) */
  fcSv1?: [number, number]
  /** W' (kJ) qui a limité les watts du travail (garde-fou : une répétition ne vide pas plus de 80 % du W') */
  wPrimeKj?: number
  /** Explication du choix (phase, alternance, progression) */
  pourquoi?: string
  /** Déroulé détaillé */
  etapes?: Etape[]
}

export interface SeanceConstruite {
  titre: string
  detail: string
  dureeMin: number
  kj: number
  velo: SeanceVelo
}

const lePalier = (f: Format, palier: number | Palier) => (typeof palier === 'number' ? f.paliers[palier] : palier)

/** Part du W' qu'une répétition peut vider au plus (choix d'entraîneur, relecteur scientifique du 5/11/2026). */
export const PART_WPRIME_MAX = 0.8

/**
 * Garde-fou W' : travail au-dessus de la CP d'une répétition = (P − CP) × durée. S'il dépasse 80 % du W',
 * les watts baissent juste assez (jamais sous la CP). Over-unders et relances avec une récupération à 90 % de la CP
 * ou plus : le W' ne se recharge presque pas, on compte tout le bloc. Pas de modèle de recharge (W'bal) :
 * trop variable d'une personne à l'autre (Bartram 2018, Caen 2019, Chorley 2022).
 */
export function plafondWPrime(f: Format, palier: number | Palier, cpW: number, wT: number, wR: number, wPrimeKj?: number) {
  if (!wPrimeKj || wPrimeKj <= 0 || f.aFond || wT <= cpW) return wT
  const pa = lePalier(f, palier)
  const t = pa.travailSec ?? f.travailSec
  const n = f.continu && wR >= cpW * 0.9 ? pa.reps : 1
  const max = PART_WPRIME_MAX * wPrimeKj * 1000
  if ((wT - cpW) * t * n <= max) return wT
  return Math.max(Math.ceil(cpW / 5) * 5, Math.floor((cpW + max / (t * n)) / 5) * 5)
}

/** Durée totale (s) d'un format à un palier. */
export function dureeFormat(f: Format, palier: number | Palier) {
  const pa = lePalier(f, palier)
  const t = pa.travailSec ?? f.travailSec
  const bloc = f.continu ? pa.reps * (t + f.recupSec) : pa.reps * t + (pa.reps - 1) * f.recupSec
  const corps = pa.series * bloc + (pa.series - 1) * (f.recupSerieSec ?? 0)
  const pr = preparationDe(f)
  return { totalSec: echauffementSec(pr) + corps + retourSec(pr), corpsSec: corps, travailSec: pa.series * pa.reps * t }
}

/** Plus haut palier (≤ visé) qui tient dans le créneau (avec l'encadrement de 25', voir plus haut). */
export function palierPossible(f: Format, vise: number, maxMin: number) {
  for (let i = vise; i > 0; i--) if (dureeFormat(f, i).corpsSec + ENCADREMENT_PALIER_SEC <= maxMin * 60) return i
  return 0
}

/** Version raccourcie (feu orange) : une série de moins, ou un tiers de répétitions en moins. Mêmes watts. */
export function palierRaccourci(f: Format, palier: number): Palier {
  const pa = f.paliers[palier]
  return pa.series > 1 ? { ...pa, series: pa.series - 1 } : { ...pa, reps: Math.max(1, Math.round(pa.reps * 0.66)) }
}

/** Échauffement détaillé des séances d'intensité. */
function echauffement(pr: Preparation, cpW: number): Etape[] {
  let h = 0
  return ECHAUFFEMENTS[pr].map(([d, x, libelle]) => {
    const e: Etape = { debutSec: h, dureeSec: d, libelle, w: arrondi5(cpW * x), ...(CADENCES_ECHAUFFEMENT[x] ? { cadence: CADENCES_ECHAUFFEMENT[x] } : {}) }
    h += d
    return e
  })
}

/** Construit une séance d'intervalles : structure, déroulé, watts, durée, kJ. */
export function construireIntervalles(f: Format, palier: number | Palier, cpW: number, bonus: number, wPrimeKj?: number): SeanceConstruite {
  const pa = lePalier(f, palier)
  const t = pa.travailSec ?? f.travailSec
  const { totalSec, corpsSec, travailSec } = dureeFormat(f, palier)
  // À fond : pas de bonus de watts (on progresse par les répétitions) ; la cible sert seulement aux kJ
  const wR = arrondi5(cpW * (f.pctRecup / 100) * (f.continu ? 1 + bonus : 1))
  const wPrevu = arrondi5(cpW * (f.pct / 100) * (f.aFond ? 1 : 1 + bonus))
  const wT = plafondWPrime(f, palier, cpW, wPrevu, wR, wPrimeKj)
  const wFacile = arrondi5(cpW * 0.5)
  const pr = preparationDe(f)
  const kjEncadrement = [...ECHAUFFEMENTS[pr], ...RETOURS[pr]].reduce((t, [d, x]) => t + d * cpW * x, 0)
  const kj = (kjEncadrement + travailSec * wT + (corpsSec - travailSec) * wR) / 1000

  // Déroulé : échauffement, séries / répétitions, récupérations, retour au calme
  const etapes = echauffement(pr, cpW)
  let h = echauffementSec(pr)
  const ajouter = (dureeSec: number, libelle: string, w?: number, effort?: boolean) => {
    etapes.push({ debutSec: h, dureeSec, libelle, ...(w !== undefined ? { w } : {}), ...(effort ? { ...(w ? plage(w, f.famille) : {}), cadence: cadenceDe(f.famille) } : {}) })
    h += dureeSec
  }
  const recupSerie = f.recupSerieSec ?? 0
  for (let si = 1; si <= pa.series; si++) {
    const effort = (dureeSec: number, w: number, libelle: string): SousEtape => ({ dureeSec, libelle, w, ...plage(w, f.famille), cadence: cadenceDe(f.famille) })
    const relances = f.famille === 'relances'
    if (f.continu) {
      ajouter(pa.reps * (t + f.recupSec), relances
        ? `Bloc ${si}/${pa.series} : ${enMin(pa.reps * (t + f.recupSec))} à ${wR} W avec une relance de ${enDuree(t)} à ${wT} W toutes les ${enDuree(t + f.recupSec)}`
        : `Bloc ${si}/${pa.series} : ${pa.reps} × (${enDuree(f.recupSec)} à ${wR} W puis ${enDuree(t)} à ${wT} W), sans pause`, wT, true)
      etapes[etapes.length - 1].repetition = { fois: pa.reps, etapes: [effort(f.recupSec, wR, relances ? 'Fond' : 'Sous la CP'), relances ? { dureeSec: t, libelle: 'Relance', w: wT, cadence: CADENCE_VO2 } : effort(t, wT, 'Au-dessus')] }
    } else if (f.aFond) {
      const bloc = pa.reps * t + (pa.reps - 1) * f.recupSec
      ajouter(bloc, `${pa.series > 1 ? `Série ${si}/${pa.series} : ` : ''}${pa.reps} × ${enDuree(t)} à fond, ${enDuree(f.recupSec)} très facile entre`, undefined, true)
      etapes[etapes.length - 1].repetition = {
        fois: pa.reps, derniere: 1,
        etapes: [{ dureeSec: t, libelle: 'Sprint à fond', cadence: CADENCE_SPRINT }, { dureeSec: f.recupSec, libelle: 'Très facile', w: wR }],
      }
    } else if (f.famille === 'vo2-courts') {
      const bloc = pa.reps * t + (pa.reps - 1) * f.recupSec
      ajouter(bloc, `Série ${si}/${pa.series} : ${pa.reps} × (${enDuree(t)} à ${wT} W puis ${enDuree(f.recupSec)} à ${wR} W)`, wT, true)
      etapes[etapes.length - 1].repetition = { fois: pa.reps, etapes: [effort(t, wT, 'Effort'), { dureeSec: f.recupSec, libelle: 'Récup', w: wR }], derniere: 1 }
    } else {
      for (let ri = 1; ri <= pa.reps; ri++) {
        ajouter(t, `${pa.reps > 1 ? `Répétition ${ri}/${pa.reps}` : 'Bloc'} : ${enMin(t)} régulier`, wT, true)
        if (ri < pa.reps) ajouter(f.recupSec, 'Récupération, pédale souple', wR)
      }
    }
    if (si < pa.series) ajouter(recupSerie, 'Récupération entre séries, pédale souple', wFacile)
  }
  RETOURS[pr].forEach(([d, x, libelle]) => ajouter(d, libelle, arrondi5(cpW * x)))

  let titre: string
  let corps: string
  if (f.aFond) {
    titre = `${pa.series > 1 ? `${pa.series} × ` : ''}${pa.reps} sprints de ${enDuree(t)}`
    corps = `${pa.series > 1 ? `${pa.series} séries de ` : ''}${pa.reps} × ${enDuree(t)} à fond (allure libre), ${enDuree(f.recupSec)} très facile entre${pa.series > 1 ? `, ${enMin(recupSerie)} facile entre les séries` : ''}`
  } else if (f.famille === 'relances') {
    titre = `${pa.series} × ${enMin(pa.reps * (t + f.recupSec))} à relances`
    corps = `${pa.series} × ${enMin(pa.reps * (t + f.recupSec))} à ${wR} W avec ${pa.reps} relances de ${enDuree(t)} à ${wT} W, ${enMin(recupSerie)} facile entre les blocs`
  } else if (f.continu) {
    titre = `${pa.series} × ${pa.reps} cycles over-unders`
    corps = `${pa.series} × [${pa.reps} × (${enDuree(f.recupSec)} à ${wR} W + ${enDuree(t)} à ${wT} W)], ${enMin(recupSerie)} facile entre les blocs`
  } else if (f.famille === 'vo2-courts') {
    titre = `${pa.series} × ${pa.reps} × ${f.nom}`
    corps = `${pa.series} séries de ${pa.reps} × (${enDuree(t)} à ${wT} W / ${enDuree(f.recupSec)} à ${wR} W), ${enMin(recupSerie)} facile entre les séries`
  } else if (pa.reps === 1 && pa.series === 1) {
    titre = `${enMin(t)} ${f.nom}`
    corps = `${enMin(t)} à ${wT} W`
  } else {
    titre = `${pa.reps} × ${enMin(t)} ${f.famille === 'seuil' ? 'seuil' : f.nom.replace(/^intervalles de .*/, 'VO2')}`
    corps = `${pa.reps} × ${enMin(t)} à ${wT} W, ${enMin(f.recupSec)} à ${wR} W entre`
  }
  const limite = wT < wPrevu
  const detail = `Échauffement ${enMin(echauffementSec(pr))} · ${corps} · Retour au calme ${enMin(retourSec(pr))}${limite ? ` · Watts ramenés de ${wPrevu} à ${wT} W : sinon chaque effort viderait presque toute ta réserve au-dessus de la CP (W')` : ''}`
  return {
    titre, detail, dureeMin: Math.round(totalSec / 60), kj: Math.round(kj),
    velo: { famille: f.famille, formatId: f.id, palier: typeof palier === 'number' ? palier : undefined, ...(f.aFond ? {} : { cibleW: wT }), cpW, ...(limite ? { wPrimeKj } : {}), etapes },
  }
}

/** Sprints de la sortie longue (Almquist 2020) : de plus en plus nombreux, puis plus longs. */
export const SPRINTS = [
  { n: 6, sec: 10 }, { n: 8, sec: 10 }, { n: 6, sec: 15 }, { n: 8, sec: 15 },
]

/** Montées de la sortie longue en côtes (marathon VTT) : plus nombreuses puis plus longues d'une sortie à l'autre. */
export const COTES = [
  { n: 4, min: 8 }, { n: 4, min: 10 }, { n: 5, min: 12 }, { n: 6, min: 15 },
]
/** Montées de la n-ième sortie en côtes : 6 × 15' seulement dans les 3 semaines avant une course. */
export const cotesDe = (nLongs: number, courseProche: boolean) => COTES[courseProche ? 3 : Math.min(nLongs, 2)]

/** Enchaîne des étapes (sans debutSec) et calcule les kJ ; les efforts à fond sans cible comptent pour 2,5 × la Z2. */
function enchainer(blocs: Omit<Etape, 'debutSec'>[], z2W: number) {
  let h = 0
  const etapes: Etape[] = blocs.map((b) => {
    const e = { ...b, debutSec: h } as Etape
    h += b.dureeSec
    return e
  })
  const kjDe = (e: { dureeSec: number; w?: number }) => e.dureeSec * (e.w ?? z2W * 2.5)
  const kj = etapes.reduce((t, e) => {
    if (!e.repetition) return t + kjDe(e)
    const { fois, etapes: sous, derniere = sous.length } = e.repetition
    return t + sous.reduce((a, x) => a + kjDe(x), 0) * (fois - 1) + sous.slice(0, derniere).reduce((a, x) => a + kjDe(x), 0)
  }, 0) / 1000
  return { etapes, dureeMin: Math.round(h / 60), kj: Math.round(kj) }
}
const p = (w: number, lo: number, hi: number) => ({ w, wMin: arrondi5(w * lo), wMax: arrondi5(w * hi) })

/**
 * Équivalent vélo d'une séance de course à pied (relu le 6/11/2026 : Tanaka 1994, Millet 2009, Menges 2026 ;
 * pourcentages : choix d'entraîneur appuyés sur la physiologie). Le vélo garde le moteur (cœur, VO2max), pas la foulée,
 * les tendons ni l'économie de course : à l'approche d'une course, mieux vaut décaler la séance.
 *  - seuil 30 (≈ la vitesse critique, l'équivalent de la CP) → 103 % de la CP, même structure (ex. 8 × 1') ou blocs de 7' ;
 *  - VMA, côtes, fractionné → 117 % de la CP, 1' par minute à l'allure clé (16 au plus) ou même structure ;
 *  - seuil 60 → 3 blocs à 95 % de la CP ;
 *  - endurance → Z2 environ 1,4 fois plus longue (FC plus basse à vélo à effort égal ; aucun facteur publié).
 * Pas compté dans la progression des formats vélo (marqué comme allégé).
 */
export function construireEquivalentCourse(c: { intensite: string; typeCourse?: string; minutesCle?: number; dureeMin: number; titre?: string; detail?: string }, cpW: number, z2W: number): SeanceConstruite {
  if (c.intensite !== 'haute' || !c.minutesCle) {
    const s = construireZ2(Math.min(180, arrondi5(c.dureeMin * 1.4)), z2W)
    return { ...s, titre: `Z2 à la place de la course (${s.dureeMin} min)`, velo: { ...s.velo, allegee: true, pourquoi: 'Équivalent vélo de ta séance de course : endurance environ 1,4 fois plus longue.' } }
  }
  const wEch = arrondi5(z2W * 0.85)
  const facile = arrondi5(cpW * 0.5)
  const seuil60 = /seuil 60/i.test(c.typeCourse ?? '')
  const seuil30 = /seuil 30/i.test(c.typeCourse ?? '')
  // Structure de la séance de course si elle est écrite (« 8 × 1' », « 3 × 8′ »)
  const m = `${c.titre ?? ''} ${c.detail ?? ''}`.match(/(\d+)\s*[×x]\s*(\d+)\s*['′]/)
  let reps: number
  let min: number
  let recup: number
  let pct: number
  let famille: Famille
  if (seuil60) {
    reps = 3; min = Math.max(5, Math.round(c.minutesCle / 3)); recup = 180; pct = 0.95; famille = 'seuil'
  } else if (seuil30) {
    if (m) { reps = Number(m[1]); min = Number(m[2]) } else { min = 7; reps = Math.max(2, Math.round(c.minutesCle / 7)) }
    recup = min <= 2 ? 60 : 120; pct = 1.03; famille = 'seuil-plus'
  } else {
    if (m) { reps = Math.min(16, Number(m[1])); min = Number(m[2]) } else { min = 1; reps = Math.min(16, Math.max(4, Math.round(c.minutesCle))) }
    recup = Math.max(60, min * 60); pct = 1.17; famille = 'vo2-courts'
  }
  const w = arrondi5(cpW * pct)
  const plageFamille = famille === 'vo2-courts' ? 'vo2-courts' : famille === 'seuil' ? 'seuil' : 'seuil-plus'
  const { etapes, dureeMin, kj } = enchainer([
    { dureeSec: 900, libelle: 'Échauffement progressif, 2 accélérations de 30" à la fin', w: wEch },
    {
      dureeSec: reps * min * 60 + (reps - 1) * recup, w, libelle: `${reps} × ${min}' à ${w} W, ${Math.round(recup / 60)}' faciles entre`,
      repetition: { fois: reps, derniere: 1, etapes: [{ dureeSec: min * 60, libelle: 'Effort', w, ...plage(w, plageFamille), cadence: '90-105' }, { dureeSec: recup, libelle: 'Facile', w: facile }] },
    },
    { dureeSec: 600, libelle: 'Retour au calme', w: wEch },
  ], z2W)
  const titre = `${reps} × ${min}' à ${w} W (à la place de la course)`
  return {
    titre, dureeMin, kj, detail: `Équivalent vélo de ta séance de course · ${reps} × ${min}' à ${Math.round(pct * 100)} % de ta CP`,
    velo: { famille, formatId: 'equivalent-course', palier: 0, allegee: true, cpW, etapes, pourquoi: 'Équivalent vélo de ta séance de course : même structure, intensité équivalente. Le vélo garde ton moteur, pas ta foulée.' },
  }
}

/**
 * Simulation de course en ligne (course FFC, relue le 6/11/2026 : Sanders & van Erp 2021, Spragg 2024, Leo 2022 ;
 * format : choix d'entraîneur) : Z2, 3 blocs de 12' à 80-90 % de la CP avec une attaque de 30" toutes les 3', une
 * échappée de 5', puis en finale 2 × (1' à 110-120 % + sprint de 15") fatigué. Séance dure, à la place de la sortie longue.
 */
export function construireSimulationLigne(cpW: number, z2W: number, maxMin = 150): SeanceConstruite {
  const wEch = arrondi5(z2W * 0.85)
  const z2Min = Math.max(20, Math.min(60, maxMin - 90))
  const z2 = (min: number, libelle = 'Z2') => ({ dureeSec: min * 60, libelle, w: z2W, ...plage(z2W, 'z2') })
  const t = arrondi5(cpW * 0.85)
  const { etapes, dureeMin, kj } = enchainer([
    { dureeSec: 900, libelle: 'Échauffement progressif', w: wEch },
    z2(z2Min, 'Z2 : le peloton roule'),
    ...[0, 1, 2].flatMap((b) => [
      {
        dureeSec: 12 * 60, w: t, libelle: `Bloc ${b + 1}/3 : 12' à ${t} W avec une attaque de 30" à fond toutes les 3'`,
        repetition: {
          fois: 4,
          etapes: [
            { dureeSec: 150, libelle: 'Peloton', ...p(t, 0.94, 1.06) },
            { dureeSec: 30, libelle: 'Attaque à fond', cadence: '95-115' },
          ],
        },
      },
      ...(b < 2 ? [{ dureeSec: 300, libelle: 'Facile', w: wEch }] : []),
    ]),
    { dureeSec: 300, libelle: 'Échappée ou bosse', ...p(arrondi5(cpW * 1.02), 0.98, 1.04), cadence: '85-95' },
    z2(10),
    {
      dureeSec: 2 * (60 + 15) + 180, w: arrondi5(cpW * 1.15), libelle: 'Finale : 2 × (1\' à 110-120 % puis sprint de 15" à fond), 3\' faciles entre',
      repetition: {
        fois: 2, derniere: 2,
        etapes: [
          { dureeSec: 60, libelle: 'Placement', ...p(arrondi5(cpW * 1.15), 0.96, 1.04), cadence: '90-105' },
          { dureeSec: 15, libelle: 'Sprint final à fond', cadence: '100-120' },
          { dureeSec: 180, libelle: 'Facile', w: wEch },
        ],
      },
    },
    { dureeSec: 600, libelle: 'Retour au calme', w: wEch },
  ], z2W)
  return {
    titre: 'Simulation de course en ligne', dureeMin, kj,
    detail: `${z2Min}' de Z2 · 3 × 12' à ${t} W avec une attaque de 30" toutes les 3' (les attaques à fond) · 5' d'échappée · finale : 2 × (1' fort + sprint de 15") · mange comme en course`,
    velo: { famille: 'simulation-ligne', cibleW: t, etapes },
  }
}

/**
 * Sortie longue + montées en fin de sortie (cyclosportive ; Mateo-March 2022, 2024, Barsumyan 2025, Van Erp 2021 ;
 * durées : choix d'entraîneur) : Z2 puis 2-3 montées de 20-30' à 85-92 % de la CP dans la dernière heure.
 * Séance dure (48 h sans autre intensité).
 */
export function construireCycloMontees(duree: number, z2W: number, cpW: number, n = 2, minMontee = 20): SeanceConstruite {
  const dureeMin = Math.round(duree)
  const wEch = arrondi5(z2W * 0.85)
  const wM = arrondi5(cpW * 0.88)
  // Sortie trop courte pour toutes les montées : une de moins (au moins 30' de Z2 avant)
  while (n > 1 && n * minMontee + (n - 1) * 10 + 55 > dureeMin) n--
  const montees = n * minMontee + (n - 1) * 10
  const z2Min = Math.max(30, dureeMin - 15 - montees - 10)
  const { etapes, kj } = enchainer([
    { dureeSec: 900, libelle: 'Mise en route progressive', w: wEch },
    { dureeSec: z2Min * 60, libelle: 'Z2 régulière : mange 60-90 g de glucides par heure dès la 1re heure', w: z2W, ...plage(z2W, 'z2') },
    {
      dureeSec: montees * 60, w: wM, libelle: `${n} montées de ${minMontee}' à ${arrondi5(cpW * 0.85)}-${arrondi5(cpW * 0.92)} W, 10' faciles entre : la dernière aussi forte que la première`,
      repetition: {
        fois: n, derniere: 1,
        etapes: [
          { dureeSec: minMontee * 60, libelle: 'Montée', w: wM, wMin: arrondi5(cpW * 0.85), wMax: arrondi5(cpW * 0.92), cadence: '70-90' },
          { dureeSec: 600, libelle: 'Facile', w: wEch },
        ],
      },
    },
    { dureeSec: 600, libelle: 'Retour au calme', w: wEch },
  ], z2W)
  const total = 15 + z2Min + montees + 10
  return {
    titre: `Sortie longue + ${n} montées en fin de sortie`, dureeMin: total, kj,
    detail: `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} : Z2 à ${z2W} W puis ${n} × ${minMontee}' à ${wM} W dans la dernière heure · 60-90 g de glucides par heure · teste ta nutrition de course`,
    velo: { famille: 'cyclo-montees', cibleW: wM, etapes },
  }
}

/**
 * Simulation de course XCO (Næss 2021, Prinz 2021, Granier 2018, Bailey 2009 ; format : choix d'entraîneur) :
 * pré-effort de 5' puis 10' faciles, départ de 1'30 très fort, 4 tours de 8' à relances. Séance dure.
 */
export function construireSimulationXco(cpW: number, z2W: number, tours = 4): SeanceConstruite {
  const wEch = arrondi5(z2W * 0.85)
  const fond = arrondi5(cpW * 0.85)
  const relance = arrondi5(cpW * 1.6)
  const { etapes, dureeMin, kj } = enchainer([
    { dureeSec: 900, libelle: 'Échauffement progressif', w: wEch },
    { dureeSec: 300, libelle: 'Pré-effort', ...p(arrondi5(cpW * 0.92), 0.98, 1.03) },
    { dureeSec: 600, libelle: 'Facile (au moins 10\')', w: wEch },
    { dureeSec: 90, libelle: 'Départ très rapide', ...p(arrondi5(cpW * 1.55), 0.97, 1.1), cadence: '90-110' },
    ...Array.from({ length: tours }, (_, k) => [
      {
        dureeSec: 480, w: fond, libelle: `Tour ${k + 1}/${tours} : 8' à ${fond} W avec une relance de 8" à ${relance} W toutes les 30"`,
        repetition: { fois: 16, etapes: [{ dureeSec: 22, libelle: 'Fond', ...p(fond, 0.94, 1.06) }, { dureeSec: 8, libelle: 'Relance', w: relance, cadence: '90-110' }] },
      },
      ...(k < tours - 1 ? [{ dureeSec: 120, libelle: 'Facile', w: wEch }] : []),
    ]).flat(),
    { dureeSec: 600, libelle: 'Retour au calme', w: wEch },
  ], z2W)
  return {
    titre: `Simulation de course XCO (${tours} tours)`, dureeMin, kj,
    detail: `Pré-effort de 5' puis 10' faciles · départ de 1'30 à ${arrondi5(cpW * 1.55)} W · ${tours} tours de 8' à ${fond} W avec une relance de 8" toutes les 30"`,
    velo: { famille: 'simulation-xco', cibleW: fond, etapes },
  }
}

/**
 * Sortie longue en côtes (marathon VTT : Engelbrecht 2018, Reinpõld 2022) : Z2 avec des montées à 85-95 % de la CP,
 * régulièrement espacées (au moins 10 min de Z2 entre deux montées ; moins de montées si la sortie est courte).
 */
export function construireLongueCotes(duree: number, z2W: number, cpW: number, cotes: { n: number; min: number }): SeanceConstruite {
  const dureeMin = Math.round(duree)
  let n = cotes.n
  const libre = dureeMin - 15
  while (n > 1 && (libre - n * cotes.min) / (n + 1) < 10) n--
  const ecart = Math.floor((libre - n * cotes.min) / (n + 1))
  const fin = dureeMin * 60
  const wEch = arrondi5(z2W * 0.85)
  const wM = arrondi5(cpW * 0.9)
  const montee = { wMin: arrondi5(cpW * 0.85), wMax: arrondi5(cpW * 0.95) }
  const etapes: Etape[] = [{ debutSec: 0, dureeSec: 600, libelle: 'Mise en route progressive', w: wEch }]
  let h = 600
  etapes.push({
    debutSec: h, dureeSec: n * (ecart + cotes.min) * 60, w: z2W,
    libelle: `${n} montées de ${cotes.min}' à ${montee.wMin}-${montee.wMax} W, ${ecart}' de Z2 entre (en côte dehors, ou en résistance sur le home trainer)`,
    repetition: {
      fois: n,
      etapes: [
        { dureeSec: ecart * 60, libelle: 'Z2', w: z2W, ...plage(z2W, 'z2') },
        { dureeSec: cotes.min * 60, libelle: 'Montée', w: wM, ...montee, cadence: '70-90' },
      ],
    },
  })
  h += n * (ecart + cotes.min) * 60
  etapes.push({ debutSec: h, dureeSec: fin - h - 300, libelle: 'Z2 régulière', w: z2W, ...plage(z2W, 'z2') })
  etapes.push({ debutSec: fin - 300, dureeSec: 300, libelle: 'Retour au calme', w: wEch })
  const kj = etapes.reduce((t, e) => t + (e.repetition ? e.repetition.etapes.reduce((a, x) => a + x.dureeSec * (x.w ?? 0), 0) * e.repetition.fois : e.dureeSec * (e.w ?? 0)), 0) / 1000
  return {
    titre: `Sortie longue en côtes ${Math.floor(dureeMin / 60)} h ${String(dureeMin % 60).padStart(2, '0')}`,
    detail: `Z2 à ${z2W} W avec ${n} montées de ${cotes.min}' à ${montee.wMin}-${montee.wMax} W · tiens les dernières montées aussi bien que les premières · 60-90 g de glucides par heure`,
    dureeMin, kj: Math.round(kj),
    velo: { famille: 'z2-long', cibleW: z2W, etapes },
  }
}

/** Sorties VTT sur le terrain : pas de cible en watts (monotrace), jugées sur l'effort perçu. */
const TERRAIN: Record<Exclude<Discipline, 'route'>, string> = {
  xco: 'virages, relances en sortie de virage, montées et descentes techniques',
  xcc: 'virages rapides, départs et relances',
  xcm: 'pilotage sur un long parcours varié, en mangeant comme en course',
  enduro: 'virages, freinage, lignes en descente, remontées tranquilles',
  dh: 'lignes, freinage, sauts et virages, en répétant une même section',
}

/**
 * Sortie VTT technique (une Z2 de la semaine) : 60 min au plus de technique (fiche du catalogue : 45-60 min),
 * complétée en Z2 si le créneau est plus long. kJ prévus estimés plus bas qu'une Z2 (arrêts, retours au départ).
 */
export function construireTerrain(discipline: Exclude<Discipline, 'route'>, duree: number, z2W: number): SeanceConstruite {
  const dureeMin = Math.round(duree)
  const tech = Math.min(60, dureeMin)
  const z2 = dureeMin - tech
  return {
    titre: `VTT technique ${tech}'${z2 >= 10 ? ` + ${z2}' Z2` : ''}`,
    detail: `Sur le terrain, intensité basse (tu peux parler) : ${TERRAIN[discipline]}. Répète les passages plutôt qu'un long parcours${z2 >= 10 ? `, puis ${z2}' de Z2 tranquille` : ''}. Note ton effort perçu à la fin.`,
    dureeMin, kj: Math.round((tech * 60 * z2W * 0.6 + z2 * 60 * z2W) / 1000),
    velo: { famille: 'vtt-terrain', pourquoi: 'Une sortie Z2 sur le terrain : la technique compte beaucoup en VTT (Impellizzeri 2005, Kirkwood 2017).' },
  }
}

/** Spéciales d'enduro (une semaine sur deux à la place des intervalles) : 4 à 6 descentes chronométrées. */
export const SPECIALES = [
  { n: 4, min: 3 }, { n: 5, min: 4 }, { n: 5, min: 6 }, { n: 6, min: 8 },
]
export function construireSpeciales(palier: number, cpW: number): SeanceConstruite {
  const { n, min } = SPECIALES[Math.min(3, Math.max(0, palier))]
  const dureeMin = 20 + n * (min + 12) + 10
  return {
    titre: `${n} spéciales de ${min}'`,
    detail: `Échauffement 20' · ${n} spéciales chronométrées de ${min}' : relances à fond, descente technique engagée · remontées tranquilles (≈ 12') entre · retour au calme 10'. Le chrono compte plus que les watts. Protections !`,
    dureeMin, kj: Math.round((dureeMin * 60 * cpW * 0.6) / 1000),
    velo: { famille: 'vtt-speciales', palier, pourquoi: 'Spéciales d’enduro : effort court très intense, chrono en descente technique (Kirkwood 2017, West 2021).' },
  }
}

/** Séance d'endurance (Z2), avec sprints pour la sortie longue. */
/**
 * Blocs au 1er seuil de la sortie longue, palier 0 → 6 : 30 → 80 min au total (relecture du 9/11/2026 : aucun essai
 * sur la dose ; 2 h à 90 % du 1er seuil sont tenables par des cyclistes entraînés, Stevenson 2022 ; paliers = choix
 * d'entraîneur). Au plus 60 % de la sortie (PART_MAX_SV1), après 20 min de Z2, 10 min de Z2 après.
 */
export const BLOCS_SV1: { reps: number; min: number }[] = [
  { reps: 2, min: 15 }, { reps: 3, min: 15 }, { reps: 2, min: 25 }, { reps: 3, min: 20 }, { reps: 2, min: 30 }, { reps: 3, min: 25 }, { reps: 2, min: 40 },
]
export const PART_MAX_SV1 = 0.6

/** Durées de course par défaut quand elle n'est pas donnée (min) : choix d'entraîneur. */
export const DUREE_COURSE_DEFAUT = { 'en-ligne': 180, cyclo: 300, xcm: 300 } as const
/** Allongement de la sortie longue d'une semaine sur l'autre (min) : même pas que la reprise (choix d'entraîneur). */
export const PAS_LONGUE_MIN = 10

/**
 * Durée visée de la sortie longue en fin de prépa, selon la course (relecture du 9/11/2026 : aucune étude ne fixe la
 * durée de la sortie longue par rapport à l'épreuve ; conseils publiés ≈ 70-80 % de la durée de course ; choix
 * d'entraîneur) : route en ligne = durée de course (2 h à 4 h) ; cyclosportive et marathon VTT = 75 % (3 h à 5 h) ;
 * XCO 2 h 30 ; XCC 2 h ; enduro / DH : pas de cible.
 */
export function cibleSortieLongue(discipline: Discipline, typeCourse?: 'en-ligne' | 'cyclo', dureeCourseMin?: number) {
  const borne = (min: number, max: number, v: number) => Math.round(Math.min(max, Math.max(min, v)) / 5) * 5
  if (discipline === 'route') return typeCourse === 'en-ligne'
    ? borne(120, 240, dureeCourseMin ?? DUREE_COURSE_DEFAUT['en-ligne'])
    : borne(180, 300, 0.75 * (dureeCourseMin ?? DUREE_COURSE_DEFAUT.cyclo))
  if (discipline === 'xcm') return borne(180, 300, 0.75 * (dureeCourseMin ?? DUREE_COURSE_DEFAUT.xcm))
  if (discipline === 'xco') return 150
  if (discipline === 'xcc') return 120
  return undefined
}

/**
 * Durée minimale de la sortie longue cette semaine : la plus longue faite ces 3 dernières semaines (une semaine allégée
 * ne fait pas reculer) + 10 min, sans dépasser la cible ni descendre sous ton minimum habituel.
 */
export function dureeLongueVisee(cible: number, minLong: number, plusLongueRecente?: number) {
  return Math.min(Math.max(cible, minLong), Math.max(minLong, (plusLongueRecente ?? minLong - PAS_LONGUE_MIN) + PAS_LONGUE_MIN))
}
const RECUP_SV1_MIN = 5

/**
 * Sortie Z2. Options :
 *  - `sprints` : sprints à fond, un toutes les `espacementSec` (10 min par défaut) à partir de la 20e minute ;
 *  - `sv1` : blocs au 1er seuil (haut de la Z2, jamais en Z3), 5 min de Z2 entre, au plus 60 % de la sortie, après
 *    20 min de Z2 au moins et 10 min avant le retour au calme (relectures des 6 et 9/11/2026) ; si le palier demandé ne
 *    rentre pas, les paliers de `repli` (du plus haut au plus bas), puis moins de blocs ;
 *  - `rappelSv1` : 2 × 10 min au 1er seuil (lendemain d'une séance intensive, confirmé et plus) ;
 *  - Z2 de 90 min ou plus sans rien d'autre : découpée en 8 min de Z2 + 2 min plus faciles (monotonie, home trainer).
 * Une sortie avec `sprints` ou `longue` est la sortie longue (famille z2-long).
 */
export function construireZ2(duree: number, z2W: number, sprints?: { n: number; sec: number }, o: { longue?: boolean; sv1?: { w: number; reps: number; min: number; repli?: { reps: number; min: number }[]; fc?: [number, number] }; espacementSec?: number } = {}): SeanceConstruite {
  const dureeMin = Math.round(duree)
  const ech = Math.min(10, dureeMin) * 60
  const wEch = arrondi5(z2W * 0.85)
  const fin = dureeMin * 60
  const z2 = (debutSec: number, dureeSec: number, libelle = 'Z2 régulière : RPE ≤ 3, tu peux parler en phrases'): Etape => ({ debutSec, dureeSec, libelle, w: z2W, ...plage(z2W, 'z2') })
  const etapes: Etape[] = [{ debutSec: 0, dureeSec: ech, libelle: 'Mise en route progressive', w: wEch }]
  const corpsFin = fin - 300
  // Sans précision, une sortie avec sprints est la sortie longue (comportement d'origine)
  const longue = o.longue ?? !!sprints
  let titre = longue ? 'Z2 longue' : 'Endurance Z2'
  let detailPlus = ''
  let kjPlus = 0

  // Blocs au 1er seuil : au plus 60 % de la sortie, 20 min de Z2 avant (mise en route comprise) et 10 min après
  let sv1: { w: number; reps: number; min: number } | undefined
  const fcSv1 = o.sv1?.fc
  if (o.sv1) {
    const rentre = (reps: number, min: number) =>
      reps * min * 60 <= fin * PART_MAX_SV1 && (reps * min + (reps - 1) * RECUP_SV1_MIN) * 60 <= corpsFin - ech - 10 * 60 - 10 * 60
    const essais = [{ reps: o.sv1.reps, min: o.sv1.min }, ...(o.sv1.repli ?? [])]
    const choisi = essais.find((x) => rentre(x.reps, x.min))
    if (choisi) sv1 = { w: o.sv1.w, ...choisi }
    else {
      // Sortie courte (semaine allégée) : moins de blocs du plus petit palier
      const dernier = essais[essais.length - 1]
      let reps = dernier.reps
      while (reps > 1 && !rentre(reps, dernier.min)) reps--
      if (rentre(reps, dernier.min)) sv1 = { w: o.sv1.w, reps, min: dernier.min }
    }
  }
  // Sortie longue : premier sprint à la 20e minute ; Z2 de semaine (plus courte) : dès la 15e
  const premier = longue ? 20 : 15
  const minutes = sprints && !sv1 ? Array.from({ length: sprints.n }, (_, i) => premier + i * Math.round((o.espacementSec ?? 600) / 60)).filter((m) => m <= dureeMin - 10) : []

  if (sv1) {
    const total = (sv1.reps * sv1.min + (sv1.reps - 1) * RECUP_SV1_MIN) * 60
    const debut = Math.max(ech + 10 * 60, Math.min(45 * 60, corpsFin - 10 * 60 - total))
    const p = plage(sv1.w, 'tempo')
    etapes.push(z2(ech, debut - ech), {
      debutSec: debut, dureeSec: total, w: sv1.w,
      libelle: `${sv1.reps} × ${sv1.min}' au 1er seuil (${sv1.w} W${fcSv1 ? ` · FC ${fcSv1[0]}-${fcSv1[1]}` : ''}) : haut de ta Z2, tu parles encore en phrases (effort 4-6/10), le cœur ne dérive pas ; ${RECUP_SV1_MIN}' de Z2 entre`,
      repetition: {
        fois: sv1.reps, derniere: 1,
        etapes: [{ dureeSec: sv1.min * 60, libelle: 'Bloc 1er seuil', w: sv1.w, wMin: p.wMin, wMax: Math.min(p.wMax, sv1.w + 5), cadence: '85-95' }, { dureeSec: RECUP_SV1_MIN * 60, libelle: 'Z2', w: z2W, ...plage(z2W, 'z2') }],
      },
    }, z2(debut + total, corpsFin - debut - total, 'Z2 régulière jusqu’au retour au calme'))
    titre = `${titre} + ${sv1.reps} × ${sv1.min}' au 1er seuil`
    detailPlus = ` · ${sv1.reps} × ${sv1.min}' au 1er seuil (${sv1.w} W${fcSv1 ? `, FC ${fcSv1[0]}-${fcSv1[1]}` : ''})`
    kjPlus = (sv1.reps * sv1.min * 60 * (sv1.w - z2W)) / 1000
  } else if (sprints && minutes.length) {
    const sec = sprints.sec
    const pas = Math.round((o.espacementSec ?? 600) / 60) * 60
    const facile = Math.min(pas - sec - 60, sec >= 30 ? 300 : 120)
    const debut = minutes[0] * 60
    const finSprints = minutes[minutes.length - 1] * 60 + sec + facile
    etapes.push(z2(ech, debut - ech), {
      debutSec: debut, dureeSec: finSprints - debut, w: wEch,
      libelle: `${minutes.length} sprints de ${sec}" à fond (à ${minutes.map((m) => `${m}'`).join(', ')}), assis puis debout en alternance ; ${Math.round(facile / 60)}' très facile après chacun, puis Z2`,
      // La dernière répétition s'arrête après la récupération très facile : la Z2 reprend ensuite jusqu'au retour au calme
      repetition: {
        fois: minutes.length, derniere: 2,
        etapes: [
          { dureeSec: sec, libelle: 'Sprint à fond', cadence: '100-120' },
          { dureeSec: facile, libelle: 'Très facile', w: wEch },
          { dureeSec: pas - sec - facile, libelle: 'Z2', w: z2W, ...plage(z2W, 'z2') },
        ],
      },
    }, z2(finSprints, corpsFin - finSprints, 'Z2 régulière jusqu’au retour au calme'))
    titre = `${titre} + ${minutes.length} sprints${sec >= 30 ? ` de ${sec}"` : ''}`
    detailPlus = ` · ${minutes.length} sprints de ${sec}"`
    kjPlus = (minutes.length * sec * z2W * 2.5) / 1000
  } else if (!longue && !sprints && dureeMin >= 90) {
    // Z2 découpée : 8 min de Z2, 2 min plus faciles (monotonie sur home trainer ; choix d'entraîneur)
    const n = Math.floor((corpsFin - ech) / 600)
    const wFacile = arrondi5(z2W * 0.8)
    etapes.push({
      debutSec: ech, dureeSec: n * 600, w: z2W, libelle: `${n} × (8' Z2 + 2' plus facile) : casse la monotonie`,
      repetition: { fois: n, etapes: [{ dureeSec: 480, libelle: 'Z2', w: z2W, ...plage(z2W, 'z2') }, { dureeSec: 120, libelle: 'Plus facile', w: wFacile }] },
    })
    if (corpsFin - ech - n * 600 > 0) etapes.push(z2(ech + n * 600, corpsFin - ech - n * 600, 'Z2 régulière'))
    kjPlus = -(n * 120 * (z2W - wFacile)) / 1000
  } else etapes.push(z2(ech, corpsFin - ech))
  etapes.push({ debutSec: corpsFin, dureeSec: 300, libelle: 'Retour au calme', w: wEch })
  const kj = (ech * wEch + (fin - ech - 300) * z2W + 300 * wEch) / 1000 + kjPlus
  return {
    titre,
    detail: `10' progressif puis Z2 à ${z2W} W (RPE ≤ 3)${detailPlus}`,
    dureeMin, kj: Math.round(kj),
    velo: { famille: longue ? 'z2-long' : 'z2', cibleW: z2W, etapes, ...(sv1 ? { sv1W: sv1.w, blocsSv1: sv1.reps, ...(fcSv1 ? { fcSv1 } : {}) } : {}) },
  }
}

/**
 * Test CP (Karsten et al. 2015 : efforts à fond de 12, 7 et 3 min, 30 min de récupération entre les efforts).
 * Version courte : seulement 3' et 12' (2 points suffisent au modèle de CP, un peu moins précis).
 */
export function construireTest(cpW: number, court = false): SeanceConstruite {
  const facile = arrondi5(cpW * 0.45)
  const etapes: Etape[] = []
  let h = 0
  const ajouter = (dureeSec: number, libelle: string, w?: number) => {
    etapes.push({ debutSec: h, dureeSec, libelle, w })
    h += dureeSec
  }
  ajouter(600, 'Échauffement progressif', arrondi5(cpW * 0.55))
  ajouter(60, "Éveil : 1' soutenu", arrondi5(cpW * 1.1))
  ajouter(240, 'Facile', facile)
  ajouter(60, "Éveil : 1' soutenu", arrondi5(cpW * 1.1))
  ajouter(240, 'Facile', facile)
  const efforts = court ? [3, 12] : [12, 7, 3]
  efforts.forEach((m, i) => {
    ajouter(m * 60, `EFFORT ${m}' À FOND : ${m >= 7 ? 'départ prudent, régulier, finis fort' : 'tout donner, régulier'}`)
    ajouter(i < efforts.length - 1 ? 1800 : 600, i < efforts.length - 1 ? 'Récupération très facile (30\' : indispensable pour un test juste)' : 'Retour au calme', facile)
  })
  const travail = efforts.reduce((a, m) => a + m * 60 * cpW * (m >= 12 ? 1.02 : m >= 7 ? 1.1 : 1.25), 0)
  return {
    titre: court ? "Test CP court 3' + 12'" : 'Test CP complet 12-7-3',
    detail: `Note la puissance moyenne de chaque effort, puis Réglages → Vélo → Calculer depuis mon test${court ? " (remplis 3' et 12')" : ''} : zones et watts recalés.`,
    dureeMin: Math.round(h / 60),
    kj: Math.round((1200 * cpW * 0.6 + travail + (h - 1200 - efforts.reduce((a, m) => a + m * 60, 0)) * cpW * 0.45) / 1000),
    velo: { famille: 'test', etapes },
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
  base: 'Cycle 1er seuil',
  'seuil-tirage': '2e seuil · tirée',
  'seuil-maintien': '2e seuil · poussée',
  'fin-prepa': 'Cycle VO2max',
  specifique: 'Proche de ta course',
  affutage: 'Affûtage',
  recuperation: 'Récupération',
}

/** Phase d'une semaine et numéro de la semaine dans la phase (0 = première). */
export function phaseDe(lundi: string, phases: Phase[]) {
  const triees = [...phases].sort((a, b) => a.debut.localeCompare(b.debut))
  // Aucune phase (données abîmées) : entretien, plutôt qu'une erreur qui bloquait toute la génération
  if (!triees.length) return { phase: { debut: lundi, type: 'entretien' as TypePhase }, semaine: 0 }
  const phase = [...triees].reverse().find((ph) => ph.debut <= lundi) ?? triees[0]
  const semaine = Math.max(0, Math.floor((Date.parse(lundi) - Date.parse(phase.debut)) / (7 * 86_400_000)))
  return { phase, semaine }
}

/**
 * Semaine allégée, comptée en continu sur toute la saison (relecteur, 10/11/2026) : au plus 3 semaines chargées d'affilée,
 * puis une allégée (cycle 3 + 1 : choix d'entraîneur, aussi utilisé par Rønnestad 2014), quelle que soit la phase. Le
 * compteur repart à zéro après une semaine basse : allégée, récupération, affûtage, ou semaine d'une course B
 * (`semaineB`). Jamais d'allégée juste avant l'affûtage (4 semaines chargées au plus) ni en affûtage ou en récupération.
 */
export function estSemaineAllegee(lundi: string, phases: Phase[], semaineB?: (lundi: string) => boolean) {
  const triees = [...phases].sort((a, b) => a.debut.localeCompare(b.debut))
  // Tout est ramené au lundi (une phase saisie un mercredi faisait sauter toutes les semaines allégées)
  const auLundi = (d: string) => decaler(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7))
  lundi = auLundi(lundi)
  const premier = auLundi(triees[0]?.debut ?? lundi)
  if (!triees.length || lundi < premier) return false
  let chargees = 0
  for (let l = premier; l <= lundi; l = decaler(l, 7)) {
    const type = phaseDe(l, triees).phase.type
    let allegee = false
    if (type === 'affutage' || type === 'recuperation' || semaineB?.(l)) chargees = 0
    else if (chargees >= 3 && phaseDe(decaler(l, 7), triees).phase.type !== 'affutage') {
      allegee = true
      chargees = 0
    } else chargees++
    if (l === lundi) return allegee
  }
  return false
}

/**
 * Volume de l'affûtage et de la récupération, en part du budget de référence (sans hausse ni −35 % en plus) :
 * affûtage 0,65 puis 0,45 la semaine de la course (Bosquet 2007 : volume −41 à −60 %, intensité gardée ;
 * coefficients : choix d'entraîneur) ; récupération après la course 0,6, sans intensité.
 */
export function coefficientPhase(lundi: string, phases: Phase[], competitions: { date: string }[]) {
  const { phase } = phaseDe(lundi, phases)
  const fin = decaler(lundi, 6)
  if (phase.type === 'affutage') return competitions.some((c) => c.date >= lundi && c.date <= fin) ? 0.45 : 0.65
  if (phase.type === 'recuperation') return 0.6
  return undefined
}

/** Dominante de chaque phase : enchaînement des types de séance d'une semaine sur l'autre. */
const CYCLES: Record<TypePhase, ('vo2' | 'seuil' | 'sous-seuil')[]> = {
  reprise: ['sous-seuil', 'vo2'],
  vo2: ['vo2', 'vo2', 'seuil'],
  seuil: ['seuil', 'seuil', 'vo2'],
  entretien: ['vo2', 'seuil'],
  base: ['vo2'],
  // Phases des saisons calculées : choix par semaine et par rang (choisirFormatSaison), ces cycles ne servent qu'en secours
  'seuil-tirage': ['seuil'],
  'seuil-maintien': ['seuil'],
  'fin-prepa': ['vo2', 'seuil'],
  specifique: ['vo2', 'seuil'],
  affutage: ['vo2', 'seuil'],
  recuperation: ['sous-seuil'],
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

/**
 * Famille de la séance selon la dominante et la discipline visée (profils de discipline du catalogue, relus le 3/11/2026) :
 *  - route, marathon : programme d'origine ;
 *  - XCO, short track : VO2 courts → VO2 longs (dont les intervalles longs d'Inoue 2016) → sprints de 30" en séries ;
 *    au seuil, 1 séance sur 3 en relances (à la place des over-unders) ;
 *  - enduro : VO2 courts et sprints courts en alternance ; seuil inchangé ;
 *  - descente : sprints courts, et VO2 courts les semaines « seuil » (entretien aérobie).
 */
function familleVtt(discipline: Discipline, dominante: 'vo2' | 'seuil', avant: HistoIntensite[]): Famille | undefined {
  const derniere = (l: Famille[]) => [...avant].reverse().find((h) => l.includes(h.famille))?.famille
  const suivante = (l: Famille[]) => l[(l.indexOf(derniere(l) ?? l[l.length - 1]) + 1) % l.length]
  if (discipline === 'xco' || discipline === 'xcc') {
    if (dominante === 'vo2') return suivante(['vo2-courts', 'vo2-longs', 'sprints'])
    const nSeuil = avant.filter((h) => h.famille === 'seuil' || h.famille === 'relances').length
    return nSeuil % 3 === 2 ? 'relances' : 'seuil'
  }
  if (discipline === 'enduro' && dominante === 'vo2') return suivante(['vo2-courts', 'sprints'])
  if (discipline === 'dh') return dominante === 'vo2' ? 'sprints' : 'vo2-courts'
  return undefined
}

/** Formats d'une famille pour la discipline (s'il n'y en a aucun, tous ceux de la famille). */
export function formatsPour(famille: Famille, discipline: Discipline = 'route') {
  const tous = FORMATS.filter((f) => f.famille === famille)
  const siens = tous.filter((f) => f.disciplines.includes(discipline))
  return siens.length ? siens : tous
}

/**
 * Saisons calculées (forme Chauvin) : la séance dépend de la phase, de la semaine dans la phase et du rang
 * (0 = 1re séance intensive de la semaine, 1 = 2e). Relu le 6/11/2026 :
 *  - tirer le seuil : 5 × 5 → 5 × 6 → 4 × 8 juste au-dessus de la CP (VTT XCO/XCC : intervalles d'Inoue, même stimulus) ;
 *    2e séance : seuil ;
 *  - allonger le seuil : 4 × 10 → 3 × 15 → 2 × 25 → 2 × 30 (XCO/XCC : seuil, relances 1 fois sur 3) ;
 *    rappel 30/15 léger toutes les 3 semaines pour garder la puissance 5' (Spiering 2021) ; 2e séance : tirer le seuil ;
 *  - fin de prépa : VO2 (VTT : sprints de 30" en séries et Inoue) ; 2e séance : sweet spot les 2 premières semaines,
 *    VO2 la 3e.
 * Retourne undefined pour les autres phases (cycles classiques).
 */
/** Type de course sur route : course en ligne (FFC, UFOLEP, critérium) ou cyclosportive / longue distance. */
export type TypeCourse = 'en-ligne' | 'cyclo'

function familleSaison(type: TypePhase, semaine: number, rang: number, discipline: Discipline, avant: HistoIntensite[], typeCourse: TypeCourse = 'cyclo'):
  { famille: Famille; formatId?: string; palier?: number; dominante: 'vo2' | 'seuil' | 'sous-seuil' } | undefined {
  const vtt = discipline === 'xco' || discipline === 'xcc'
  const derniere = (l: Famille[]) => [...avant].reverse().find((h) => l.includes(h.famille))?.famille
  // Base (relecture du 10/11/2026) : surtout de l'endurance, et 1 rappel d'intensité par semaine pour entretenir la
  // VO2max sans chercher à progresser (Hickson 1985 ; Rønnestad 2014 : 1 séance dure tous les 7-10 j pendant 8 sem
  // fait mieux que la basse intensité seule) : 30/15 et 5 × 3' en alternance, au palier de départ (15-20' d'effort dur)
  if (type === 'base') {
    if (vtt) return derniere(['vo2-courts', 'vo2-longs']) === 'vo2-courts' ? { famille: 'vo2-longs', formatId: 'inoue', palier: 0, dominante: 'vo2' } : { famille: 'vo2-courts', formatId: '30-15', palier: 0, dominante: 'vo2' }
    return derniere(['vo2-courts', 'vo2-longs']) === 'vo2-courts' ? { famille: 'vo2-longs', palier: 0, dominante: 'vo2' } : { famille: 'vo2-courts', formatId: '30-15', palier: 0, dominante: 'vo2' }
  }
  if (type === 'seuil-tirage') {
    if (rang === 1) return { famille: vtt ? familleVtt(discipline, 'seuil', avant)! : 'seuil', dominante: 'seuil' }
    return vtt ? { famille: 'vo2-longs', formatId: 'inoue', dominante: 'vo2' } : { famille: 'seuil-plus', formatId: 'tirage-seuil', dominante: 'seuil' }
  }
  if (type === 'seuil-maintien') {
    if (rang === 0 && semaine % 3 === 2) return { famille: 'vo2-courts', formatId: '30-15', palier: 0, dominante: 'vo2' }
    if (rang === 1) return vtt ? { famille: 'vo2-longs', formatId: 'inoue', dominante: 'vo2' } : { famille: 'seuil-plus', formatId: 'tirage-seuil', dominante: 'seuil' }
    return vtt ? { famille: familleVtt(discipline, 'seuil', avant)!, dominante: 'seuil' } : { famille: 'seuil', formatId: 'seuil-maintien', dominante: 'seuil' }
  }
  // Proche de la course, sur route (relu le 6/11/2026) : course en ligne = VO2 courts et over-unders (efforts de moins de
  // 2 min, Sanders & van Erp 2021) ; cyclosportive = seuil, VO2 longs en rappel, sweet spot long (montées longues)
  if (type === 'specifique' && discipline === 'route') {
    if (typeCourse === 'en-ligne') return rang === 1 ? { famille: 'seuil-variable', dominante: 'seuil' } : { famille: 'vo2-courts', dominante: 'vo2' }
    if (rang === 1) return semaine % 3 === 2 ? { famille: 'seuil', formatId: 'seuil-12-20', dominante: 'seuil' } : { famille: 'sweet-spot', formatId: 'sweet-spot-long', dominante: 'sous-seuil' }
    if (semaine % 3 === 1) return { famille: 'vo2-longs', dominante: 'vo2' }
    if (semaine % 3 === 2) return { famille: 'sweet-spot', formatId: 'sweet-spot-long', dominante: 'sous-seuil' }
    return { famille: 'seuil', formatId: 'seuil-12-20', dominante: 'seuil' }
  }
  // Cycle VO2max (prépa hivernale de Methodic, relue le 10/11/2026 ; blocs VO2 : petit avantage, Mølmen 2019) : des
  // intervalles courts (40/20) vers des plus longs (4 × 4′) ; la 2e séance entretient le seuil (plutôt que du sweet spot)
  if (type === 'fin-prepa' && !vtt) {
    if (rang === 1) return { famille: 'seuil', formatId: 'seuil-maintien', dominante: 'seuil' }
    return semaine === 0 ? { famille: 'vo2-courts', formatId: '40-20', dominante: 'vo2' } : semaine === 1 ? { famille: 'vo2-longs', formatId: '3min', dominante: 'vo2' } : { famille: 'vo2-longs', formatId: '4min', dominante: 'vo2' }
  }
  if (type === 'fin-prepa') {
    if (rang === 1 && semaine < 2) return { famille: 'sweet-spot', formatId: 'sweet-spot-long', dominante: 'sous-seuil' }
    if (vtt) return derniere(['sprints', 'vo2-longs']) === 'sprints' ? { famille: 'vo2-longs', formatId: 'inoue', dominante: 'vo2' } : { famille: 'sprints', formatId: 'sit-series', dominante: 'vo2' }
    return { famille: derniere(['vo2-courts', 'vo2-longs']) === 'vo2-courts' ? 'vo2-longs' : 'vo2-courts', dominante: 'vo2' }
  }
  return undefined
}

/** Choisit la famille et le format de la séance d'intensité de la semaine (`rang` 1 : 2e séance intensive). */
export function choisirFormat(lundi: string, phases: Phase[], histo: HistoIntensite[], discipline: Discipline = 'route', rang = 0, typeCourse?: TypeCourse) {
  const { phase, semaine: semaineDansPhase } = phaseDe(lundi, phases)
  const avantSaison = histo.filter((h) => h.date < lundi).sort((a, b) => a.date.localeCompare(b.date))
  const saison = familleSaison(phase.type, semaineDansPhase, rang, discipline, avantSaison, typeCourse)
  if (saison) {
    const formats = formatsPour(saison.famille, discipline)
    const dernier = [...avantSaison].reverse().find((h) => h.famille === saison.famille)
    const format = (saison.formatId && formats.find((f) => f.id === saison.formatId)) ||
      formats[dernier ? (formats.findIndex((f) => f.id === dernier.formatId) + 1) % formats.length : 0]
    return { famille: saison.famille, format, phase, dominante: saison.dominante, palierImpose: saison.palier }
  }
  const avant = histo.filter((h) => h.date < lundi).sort((a, b) => a.date.localeCompare(b.date))
  const dansPhase = avant.filter((h) => h.date >= phase.debut)
  // Marathon VTT près de la course : seuil et sous le seuil (sortie longue au maximum à côté)
  const cycle = phase.type === 'specifique' && discipline === 'xcm' ? (['seuil', 'sous-seuil'] as const) : CYCLES[phase.type]
  const dominante = cycle[dansPhase.length % cycle.length]
  const derniere = (f: (h: HistoIntensite) => boolean) => [...avant].reverse().find(f)

  let famille: Famille
  const vtt = dominante !== 'sous-seuil' && phase.type !== 'reprise' ? familleVtt(discipline, dominante, avant) : undefined
  if (vtt) famille = vtt
  else if (dominante === 'sous-seuil') {
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
  const formats = formatsPour(famille, discipline)
  const dernier = derniere((h) => h.famille === famille)
  const i = dernier ? (formats.findIndex((f) => f.id === dernier.formatId) + 1) % formats.length : 0
  // En reprise, on commence par le 30/15
  return { famille, format: formats[i], phase, dominante }
}

/**
 * Progression par famille : palier atteint (0 à 3) et bonus de watts.
 * Chaque test CP remet les bonus à zéro (le progrès est alors dans la nouvelle CP) ; les paliers restent acquis.
 */
export function etatProgression(histo: HistoIntensite[], datesTestsCp: string[] = []) {
  const etat = {} as Record<Famille, { palier: number; bonus: number }>
  for (const f of FORMATS) etat[f.famille] = { palier: 0, bonus: 0 }
  const tests = [...datesTestsCp].sort()
  for (const h of [...histo].sort((a, b) => a.date.localeCompare(b.date))) {
    while (tests.length && tests[0] < h.date) {
      tests.shift()
      for (const e of Object.values(etat)) e.bonus = 0
    }
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
  // Test passé après la dernière séance
  if (tests.length) for (const e of Object.values(etat)) e.bonus = 0
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
  /** Semaine passée en « semaine chargée » : on ne rattrape pas, le budget reste stable */
  chargee?: boolean
  /** Semaine pas encore finie : comptée comme faite à 100 % (13/11/2026), recalculée quand elle se termine */
  provisoire?: boolean
}

/**
 * Budget kJ de la semaine (système kJ) à partir du bilan de la précédente.
 * @param nominal semaine type (séance d'intensité + Z2 1 h + Z2 longue 1 h 40)
 * @param plafond tout au maximum du créneau
 */
export function budgetSemaine(prec: BilanSemaine | undefined, nominal: number, plafond: number, allegee: boolean, raisonAllegee = 'semaine allégée (1 sur 4)', hausse = 0.075, raisonDepart = 'Budget de départ (semaine type)') {
  let ref: number
  let raison: string
  if (!prec) {
    ref = nominal
    raison = raisonDepart
  } else if (prec.allegee) {
    ref = prec.budgetRef
    raison = 'Retour au budget d’avant la semaine allégée'
  } else {
    const part = prec.kjPrevus ? prec.kjRealises / prec.kjPrevus : 0
    // 13/11/2026 (demande de Titouan) : le feu adapte la séance du jour ; la semaine d'après suit ce qui a été fait.
    // Des jours rouges ne baissent le budget que si la semaine n'a pas été faite (séances maintenues = semaine validée).
    if (prec.chargee) {
      ref = prec.budgetRef
      raison = 'Stable : semaine chargée la semaine dernière, on ne rattrape pas'
    } else if (prec.provisoire) {
      ref = prec.budgetRef * (1 + hausse)
      raison = `+${(hausse * 100).toLocaleString('fr-FR')} % si ta semaine en cours se passe comme prévu`
    } else if (prec.rouges >= 2 && part < 0.9) {
      ref = prec.budgetRef * 0.85
      raison = `−15 % : ${prec.rouges} jours rouges et budget de la semaine dernière réalisé à ${Math.round(part * 100)} %`
    } else if (part < 0.9) {
      ref = prec.budgetRef
      raison = `Stable : budget de la semaine dernière réalisé à ${Math.round(part * 100)} % (validé à partir de 90 %)`
    } else {
      ref = prec.budgetRef * (1 + hausse)
      raison = `+${(hausse * 100).toLocaleString('fr-FR')} % : budget de la semaine dernière validé`
    }
  }
  const borne = Math.min(plafond, Math.max(nominal * 0.6, ref))
  if (borne < ref) raison += ' (plafonné par tes créneaux)'
  ref = Math.round(borne)
  return { budgetRef: ref, budget: Math.round(allegee ? ref * 0.65 : ref), raison: allegee ? `${raison} · ${raisonAllegee} : −35 %` : raison }
}

/**
 * Budget de référence (nominal) et plafond de kJ d'une semaine (audit du 11/11/2026) : UNE seule formule, utilisée par
 * la vraie semaine, la projection de la Saison et l'aperçu du dimanche (avant, trois versions qui pouvaient différer).
 * Plafond = intensité + chaque endurance au plus long de ton créneau (un 2e jour « dur » compte comme une endurance)
 * + la sortie longue au plus long ; aussi limité par le haut de ta tranche d'heures. Nominal = intensité + une
 * endurance de 60 min + la sortie longue visée (100 min au moins), dans tes créneaux.
 */
export function plafondEtNominal(o: {
  semaineType: Role[]
  kjIntensite: number
  cap: { z2: number; long: number }
  z2W: number
  /** Durée visée de la sortie longue (s'allonge vers la course) */
  longueVisee?: number
  /** Haut de ta tranche d'heures par semaine (profil sportif) */
  heuresMax?: number
  /** Minutes d'autres sports déjà prévues cette semaine (retirées des heures) */
  minutesAutres?: number
}) {
  const kjZ2 = (min: number) => construireZ2(min, o.z2W).kj
  const nZ2 = o.semaineType.filter((x) => x === 'velo-z2').length + Math.max(0, o.semaineType.filter((x) => x === 'velo-dur').length - 1)
  const nominal = o.kjIntensite + kjZ2(Math.min(60, o.cap.z2)) + kjZ2(Math.min(Math.max(100, o.longueVisee ?? 0), o.cap.long))
  const plafondJours = o.kjIntensite + nZ2 * kjZ2(o.cap.z2) + kjZ2(o.cap.long)
  const plafondHeures = o.heuresMax ? Math.max(nominal, Math.round(((o.heuresMax * 60 - (o.minutesAutres ?? 0)) * 60 * o.z2W) / 1000)) : Infinity
  return { nominal, plafond: Math.min(plafondJours, plafondHeures), limite: (plafondHeures < plafondJours ? 'heures' : 'jours') as 'heures' | 'jours' }
}

/**
 * Quand tes jours et durées bloquent la hausse (12/11/2026) : quel réglage débloque le plus de kJ ? +15 min sur chaque
 * sortie d'endurance de semaine, +30 min sur la sortie longue, ou un jour de vélo de plus (s'il reste un jour libre).
 */
export function meilleurLevier(o: { semaineType: Role[]; cap: { z2: number; long: number }; z2W: number }) {
  return pistesDeblocage(o)[0]
}

/** Durées au plus proposées dans les réglages (sorties de semaine, sortie longue). */
export const MAX_SEMAINE_MIN = 150
export const MAX_LONGUE_MIN = 300

/**
 * Toutes les pistes qui débloquent la hausse, de la plus rentable à la moins rentable (13/11/2026 : le conseil de Saison
 * s'applique en un geste, « Pas possible » montre la suivante). Un jour en plus seulement s'il reste au moins 1 jour sans
 * vélo ; durées bornées aux choix des réglages.
 */
export function pistesDeblocage(o: { semaineType: Role[]; cap: { z2: number; long: number }; z2W: number }) {
  const kjZ2 = (min: number) => construireZ2(min, o.z2W).kj
  const nZ2 = o.semaineType.filter((x) => x === 'velo-z2').length + Math.max(0, o.semaineType.filter((x) => x === 'velo-dur').length - 1)
  const libres = o.semaineType.filter((x) => !x.startsWith('velo')).length
  const leviers = [
    ...(o.cap.z2 + 15 <= MAX_SEMAINE_MIN ? [{ levier: 'semaine' as const, gain: nZ2 * (kjZ2(o.cap.z2 + 15) - kjZ2(o.cap.z2)), avant: o.cap.z2, apres: o.cap.z2 + 15 }] : []),
    ...(o.cap.long + 30 <= MAX_LONGUE_MIN ? [{ levier: 'longue' as const, gain: kjZ2(o.cap.long + 30) - kjZ2(o.cap.long), avant: o.cap.long, apres: o.cap.long + 30 }] : []),
    ...(libres > 1 ? [{ levier: 'jour' as const, gain: kjZ2(o.cap.z2), avant: 0, apres: 0, jour: jourAAjouter(o.semaineType) }] : []),
  ].filter((l) => l.gain > 0)
  return leviers.sort((a, b) => b.gain - a.gain)
}

/** Jour de vélo à ajouter : un jour sans vélo, de préférence ni la veille ni le lendemain d'une séance dure ou de la sortie longue. */
export function jourAAjouter(semaineType: Role[]): number | undefined {
  const dur = (i: number) => semaineType[(i + 7) % 7] === 'velo-dur' || semaineType[(i + 7) % 7] === 'velo-long'
  const cout = (i: number) => (dur(i - 1) ? 1 : 0) + (dur(i + 1) ? 1 : 0) + (semaineType[i] === 'renfo' || semaineType[i] === 'course' ? 0.5 : 0)
  return semaineType.map((r, i) => [r, i] as const).filter(([r]) => !r.startsWith('velo')).map(([, i]) => i).sort((a, b) => cout(a) - cout(b) || a - b)[0]
}

/** Affûtage / récupération : budget = part fixe du budget de référence d'avant (pas de hausse, pas de −35 % en plus). */
export function budgetDePhase(prec: BilanSemaine | undefined, nominal: number, coef: number, nomPhase: string) {
  const ref = Math.round(prec?.budgetRef ?? nominal)
  return { budgetRef: ref, budget: Math.round(ref * coef), raison: `${nomPhase} : ${Math.round(coef * 100)} % de ton budget habituel` }
}

/**
 * Reprise progressive : pendant la phase de reprise, les séances Z2 s'allongent semaine après semaine
 * (sortie longue 75 min la 1re semaine puis +10 min par semaine ; Z2 de semaine 50 min puis +5 min),
 * sans dépasser les créneaux. `n` = numéro de semaine dans la reprise (0 = première), absent hors reprise.
 */
export function plafondsReprise(n: number | undefined, maxSemaine: number, maxLong: number, part?: number) {
  if (n === undefined) return { z2: maxSemaine, long: maxLong }
  // Avec une charge habituelle connue (12/11/2026) : on part de la même part de TES durées (au moins 50 min et 1 h 15)
  const z2 = part ? Math.max(50, Math.round((maxSemaine * part) / 5) * 5) : 50
  const long = part ? Math.max(75, Math.round((maxLong * part) / 5) * 5) : 75
  return { z2: Math.min(maxSemaine, z2 + 5 * n), long: Math.min(maxLong, long + 10 * n) }
}

/** Semaine « chamboulée » : moins de la moitié du budget kJ réalisé. */
export const SEUIL_CHAMBOULEE = 0.5

/** Nombre de semaines chamboulées de suite, en partant de la plus récente (`parts` : réalisé / budget, la plus récente en premier). */
export function semainesChamboulees(parts: (number | undefined)[]) {
  let n = 0
  for (const x of parts) {
    if (x === undefined || x >= SEUIL_CHAMBOULEE) break
    n++
  }
  return n
}

/**
 * Retour après des semaines chamboulées (choix d'entraîneur, relu le 27/10/2026) :
 *  - 1 semaine : rien de plus (budget stable, déjà prévu) ;
 *  - 2 semaines de suite : budget −10 % pour éviter un pic de charge à la reprise ;
 *  - 3 semaines ou plus : durées des Z2 plafonnées comme en reprise (semaines 1 et 2), sans relancer toute la phase.
 * `n` : semaines chamboulées juste avant cette semaine ; `nAvant` : celles juste avant la semaine dernière.
 */
export function retourDeCoupure(n: number, nAvant: number): { facteur: number; semaineReprise?: number; raison?: string } {
  if (n >= 3) return { facteur: 1, semaineReprise: 0, raison: `${n} semaines très légères de suite : reprise en douceur (1/2)` }
  if (n === 0 && nAvant >= 3) return { facteur: 1, semaineReprise: 1, raison: 'reprise en douceur (2/2)' }
  if (n === 2) return { facteur: 0.9, raison: '−10 % : 2 semaines très légères de suite, on repart un peu plus bas' }
  return { facteur: 1 }
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
  /** Jours sans séance dure après une course (2 : le lendemain seulement), le même pour toutes ou par course */
  delaiApresCourse?: number | ((course: string) => number)
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
 *  - ni dans les 2 jours avant une compétition, ni avant la fin du délai qui la suit (le lendemain au moins).
 */
export function placer(semaine: string[], roles: Role[], autres: Occupation[], indispos: Set<string>, aPartirDe: string, o: OptionsPlacement = {}): Placement {
  const competitions = o.competitions ?? []
  const pris = new Set(autres.map((x) => x.date))
  const libre = (d: string) => d >= aPartirDe && !indispos.has(d) && !pris.has(d)
  const dur = new Set(autres.filter((x) => x.dure).map((x) => x.date))
  const procheDur = (d: string) =>
    dur.has(decaler(d, -1)) || dur.has(decaler(d, 1)) || procheCourse(d, competitions, o.delaiApresCourse)
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
    // Les jours Z2 d'abord, puis un jour « dur » resté libre (2e jour dur, ou semaine de course sans intensité)
    ...semaine.filter((d) => role(d) === 'velo-z2'),
    ...semaine.filter((d) => role(d) === 'velo-dur'),
    ...semaine.filter((d) => !['velo-dur', 'velo-z2'].includes(role(d))),
  ]
  for (const d of candidats) {
    if (z2.length >= nZ2) break
    if (libre(d) && !utilises.has(d)) z2.push(prendre(d)!)
  }
  return { intensite, long, z2: z2.sort() }
}

/**
 * Profil sportif (réponses du questionnaire) : ce qui règle le moteur (relecture scientifique du 5/11/2026).
 *  - niveau : un débutant monte son budget de +5 % par semaine au lieu de +7,5 % (choix d'entraîneur, Buist 2008 :
 *    aucun pourcentage n'est validé) ;
 *  - confirmé ou expert, au moins 6 h par semaine : 2 séances dures par semaine au total (vélo + course), donc une
 *    2e intensité vélo seulement les semaines sans séance dure de course (Mølmen 2025 : la fréquence compte) ;
 *  - moins de 4 h : pas de sprints en séries, les blocs longs font mieux en contre-la-montre (Rosenblat 2020) ;
 *  - plafond du vélo : le haut de la tranche d'heures, moins la course prévue.
 */
export type Niveau = 'debutant' | 'intermediaire' | 'confirme' | 'expert'
/** Les 3 questions concrètes qui remplacent « Niveau » (relecteur, 5/11/2026 ; seuils : choix d'entraîneur). */
export const ANCIENNETES = ['Moins d’un an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans']
export const HEURES_RECENTES = ['Moins de 3 h', '3 à 6 h', '6 à 10 h', 'Plus de 10 h']
export interface ReponsesNiveau {
  /** Depuis combien de temps tu roules au moins 2 fois par semaine, sans arrêt de plus de 2 mois */
  anciennete?: string
  /** Heures de vélo par semaine en moyenne ces 3 derniers mois */
  heuresRecentes?: string
  /** Déjà suivi un plan avec des intervalles pendant au moins 6 semaines */
  intervalles?: boolean
  /** Ancienne réponse (Débutant, Intermédiaire…), gardée tant que les 3 questions ne sont pas remplies */
  niveau?: string
}
/** Score 0 à 7 : 0-1 débutant, 2-3 intermédiaire, 4-5 confirmé, 6-7 expert. Sans réponse : intermédiaire (prudent). */
export function niveauDuProfil(r?: ReponsesNiveau): Niveau {
  if (!r || r.anciennete === undefined || r.heuresRecentes === undefined || r.intervalles === undefined) return niveauDe(r?.niveau)
  const score = Math.max(0, ANCIENNETES.indexOf(r.anciennete)) + Math.max(0, HEURES_RECENTES.indexOf(r.heuresRecentes)) + (r.intervalles ? 1 : 0)
  return score <= 1 ? 'debutant' : score <= 3 ? 'intermediaire' : score <= 5 ? 'confirme' : 'expert'
}
export function niveauDe(texte?: string): Niveau {
  if (!texte) return 'intermediaire'
  if (/^Débutant/.test(texte)) return 'debutant'
  if (/^Confirmé/.test(texte)) return 'confirme'
  if (/^Expert/.test(texte)) return 'expert'
  return 'intermediaire'
}
/** Tranche d'heures par semaine → [min, max] (valeur par défaut prudente : 4 à 6 h). */
export function heuresDe(texte?: string): [number, number] {
  const t: Record<string, [number, number]> = {
    'Moins de 4 h': [2, 4], '4 à 6 h': [4, 6], '6 à 8 h': [6, 8], '8 à 10 h': [8, 10], '10 à 12 h': [10, 12], 'Plus de 12 h': [12, 16],
  }
  return (texte && t[texte]) || [4, 6]
}
/** Hausse du budget kJ quand la semaine est validée et les signaux au vert. */
export const hausseBudget = (niveau: Niveau) => (niveau === 'debutant' ? 0.05 : 0.075)
/**
 * 2 séances intensives par semaine (forme Chauvin, relue le 6/11/2026) : à partir de 4 jours de vélo, sauf débutant.
 * Avec 3 jours (ou en débutant), 1 seule : la sortie longue avec ses blocs au 1er seuil fait le reste.
 * Toujours 48 h entre deux séances dures (Stanley 2013), et 2 séances dures au total course à pied comprise.
 */
export const deuxIntensitesPossibles = (niveau: Niveau, joursVelo: number) => niveau !== 'debutant' && joursVelo >= 4

/**
 * Jour de la 2e intensité vélo : la sortie Z2 la plus éloignée des séances dures, à au moins 2 jours de chacune
 * (48 h entre deux séances dures). La veille de la sortie longue est permise (semaine type de Chauvin : intensif le
 * samedi, longue le dimanche) : la sortie longue reste en endurance. Undefined si aucun jour ne convient.
 */
export function jourDeuxiemeIntensite(z2: string[], dures: string[], preferes: string[] = []) {
  const ecart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000
  const proche = (d: string) => Math.min(Infinity, ...dures.map((x) => ecart(d, x)))
  const possibles = z2.filter((d) => proche(d) >= 2)
  // Le 2e jour « dur » choisi dans la semaine type passe d'abord, s'il respecte les 48 h
  const choisi = possibles.find((d) => preferes.includes(d))
  return choisi ?? possibles.sort((a, b) => proche(b) - proche(a) || b.localeCompare(a))[0]
}

/**
 * Semaine type : ce qui manque ou gêne, en une phrase (écran « Ta semaine » et Réglages).
 * Bloquant : pas de jour dur, pas de sortie longue, plus d'une sortie longue, plus de 2 jours durs.
 */
export function verifierSemaineType(roles: Role[], debutant = false): { ok: boolean; message: string } {
  const n = (r: Role) => roles.filter((x) => x === r).length
  const velo = roles.filter((x) => x.startsWith('velo')).length
  const durs = n('velo-dur')
  if (!n('velo-long')) return { ok: false, message: 'Il manque ta sortie longue : mets « sortie longue » sur un jour (souvent le dimanche).' }
  if (n('velo-long') > 1) return { ok: false, message: 'Une seule sortie longue par semaine : remets l’autre jour en endurance.' }
  if (!durs) return { ok: false, message: 'Il manque ton jour d’intensité.' }
  if (durs > 2) return { ok: false, message: '2 jours d’intensité au plus : remets les autres en endurance.' }
  if (velo < 3) return { ok: false, message: 'Il faut au moins 3 jours de vélo.' }
  const resume = `✓ ${velo} jours de vélo · ${durs} séance${durs > 1 ? 's' : ''} d’intensité · 1 sortie longue`
  if (durs === 2) {
    const i = roles.indexOf('velo-dur'), j = roles.lastIndexOf('velo-dur')
    if (j - i < 2 || i + 7 - j < 2) return { ok: true, message: `${resume}. Tes 2 jours d’intensité se suivent : laisse au moins un jour entre eux, sinon l'appli déplace le 2e.` }
    if (debutant || velo < 4) return { ok: true, message: `${resume}. ${debutant ? 'En débutant' : 'Avec 3 jours de vélo'}, une seule séance d’intensité : le 2e jour sera en endurance.` }
  }
  if (durs === 1 && velo >= 4 && !debutant) return { ok: true, message: `${resume}. La 2e séance d’intensité se place toute seule sur un jour d’endurance (ou choisis-la en mettant un 2e jour « intensité »).` }
  return { ok: true, message: resume }
}

/**
 * Sprints à fond, une fois par semaine (relecture du 6/11/2026) : courts (10-15 s, force et nerf, peu de lactique :
 * la progression SPRINTS, 8 min entre) ; en VTT XCO / XCC seulement, en fin de préparation et près de la course,
 * 30 s (lactiques, Gastin 2001), récupération longue. Doses : choix d'entraîneur.
 */
export function sprintsDeLaPhase(type: TypePhase, discipline: Discipline, n: number): { n: number; sec: number; espacementSec: number } {
  // Sprints longs (lactiques) seulement là où la course le demande : XCO / XCC en fin de prépa et près de la course
  // (efforts répétés au-dessus de la CP). Ailleurs, les sprints courts suffisent (choix de Titouan, 6/11/2026).
  if ((type === 'fin-prepa' || type === 'specifique') && (discipline === 'xco' || discipline === 'xcc'))
    return { n: 4 + Math.min(2, n % 3), sec: 30, espacementSec: 720 }
  return { ...SPRINTS[Math.min(n, SPRINTS.length - 1)], espacementSec: 480 }
}

/** 1er seuil de départ : 70 % de la CP (SEUIL1_PCT_CP), puis ajusté par la dérive ; jamais plus de 85 % de la CP. */
export const SV1_DEPART_PCT = 0.7
export const SV1_MAX_PCT = 0.85

/**
 * Plage de FC des blocs au 1er seuil (relecture du 9/11/2026 ; repères d'entraîneurs, Méthodic Cycling) : le 1er seuil
 * est personnel, un % fixe le vise mal (Meixner 2025), donc les watts suivent le cœur. Cible en % de la FC max selon
 * le nombre de sorties au 1er seuil déjà faites (cycle de 4 : 78 → 80 → 81 → 82 %, débutant 76 → 78 %), plafonnée à
 * ta FC du 1er seuil + 3 bpm ; la plage va de 2 points de FC max sous la cible jusqu'à la cible. Choix d'entraîneur.
 */
export const CIBLES_FC_SV1 = { confirme: [78, 80, 81, 82], debutant: [76, 77, 78, 78] } as const
export function plageFcSv1(o: { fcMax: number; fcSeuil1?: number; nFaites: number; debutant?: boolean }): [number, number] {
  const t = o.debutant ? CIBLES_FC_SV1.debutant : CIBLES_FC_SV1.confirme
  const pct = t[Math.min(o.nFaites, t.length - 1)]
  let max = Math.round((o.fcMax * pct) / 100)
  if (o.fcSeuil1) max = Math.min(max, o.fcSeuil1 + 3)
  return [max - Math.round(o.fcMax * 0.02), max]
}

/** Watts au 1er seuil pilotés par le cœur : FC moyenne des blocs sous la plage → +1, au-dessus → −1 (±5 W après 2 de suite). */
export function signalFcSv1(fcBlocs: number[], plage: [number, number]) {
  if (!fcBlocs.length) return 0
  const fc = fcBlocs.reduce((a, b) => a + b, 0) / fcBlocs.length
  return fc > plage[1] ? -1 : fc < plage[0] ? 1 : 0
}

/**
 * Signal d'une sortie avec blocs au 1er seuil (palier des blocs) : découplage = baisse du rapport watts / FC du 1er au
 * dernier bloc (repli : dérive de la FC seule quand les watts manquent ou bougent de moins de 3 %). +1 si moins de 4 %
 * (Méthodic) et effort ≤ 6/10 ; −1 si plus de 5 % (Friel, convention) ou effort ≥ 7/10 ; sinon 0. La dérive est un
 * vrai signal d'endurance (Rothschild 2025) et n'est pas excusée après 2 h (Stevenson 2022).
 */
export function signalSv1(blocs: { fc: number; w?: number }[], rpe?: number) {
  if (blocs.length < 2) return 0
  const [a, z] = [blocs[0], blocs[blocs.length - 1]]
  const avecWatts = !!a.w && !!z.w && Math.abs(z.w - a.w) / a.w >= 0.03
  const derive = avecWatts ? ((a.w! / a.fc - z.w! / z.fc) / (a.w! / a.fc)) * 100 : ((z.fc - a.fc) / a.fc) * 100
  if (derive > 5 || (rpe !== undefined && rpe >= 7)) return -1
  if (derive < 4 && (rpe === undefined || rpe <= 6)) return 1
  return 0
}

// ——— Vision de la saison ———

export interface SemaineSaison {
  lundi: string
  phase: TypePhase
  /** Numéro de la semaine dans la phase (1 = première) et nombre de semaines de la phase (absent : phase ouverte) */
  numero: number
  total?: number
  type: 'normale' | 'allegee' | 'competition' | 'test'
  /** Budget kJ estimé (recalculé chaque semaine selon ce qui est fait) */
  budget: number
  /** Séance d'intensité prévue (famille et format) */
  intensite: string
  competition?: string
  /** Semaine normale où la charge aurait dû monter mais bute sur le plafond (jours, durées ou heures) */
  bloquee?: boolean
}

export const NOMS_FAMILLES: Record<Famille, string> = {
  'vo2-courts': 'VO2 courts', 'vo2-longs': 'VO2 longs', 'seuil-plus': 'Tirer le seuil', seuil: 'Seuil', 'seuil-variable': 'Seuil variable', 'sweet-spot': 'Sweet spot', tempo: 'Tempo',
  relances: 'Relances', sprints: 'Sprints',
}

/**
 * Projette les semaines à venir : phase, semaine allégée / course / test, budget estimé et séance d'intensité.
 * Hypothèse : budget validé chaque semaine (+7,5 %, dans la limite des créneaux).
 */
export function projeterSaison(o: {
  lundi: string
  jusquA: string
  phases: Phase[]
  testsCp: string[]
  testsCourts?: string[]
  competitions: Competition[]
  histo: HistoIntensite[]
  budgetDepart: number
  plafond: number
  /** Plafond propre à une semaine (reprise progressive) */
  plafondDe?: (lundi: string) => number
  discipline?: Discipline
  /** Charge habituelle (4 meilleures semaines d'affilée sur 12) : hausse de 10 % tant qu'on est en dessous */
  habituelle?: number
  /** Part de la charge habituelle d'où l'on repart (selon la coupure) : le budget ne descend pas en dessous */
  plancher?: number
  /** Saison calculée : reprise sans intensité */
  repriseSansIntensite?: boolean
  typeCourse?: TypeCourse
}): SemaineSaison[] {
  const triees = [...o.phases].sort((a, b) => a.debut.localeCompare(b.debut))
  const histo = [...o.histo]
  const semaines: SemaineSaison[] = []
  let ref = o.budgetDepart
  let precedenteAllegee = false
  const niveaux = niveauxCourses(o.competitions, triees)
  for (let l = o.lundi; l <= o.jusquA; l = decaler(l, 7)) {
    const fin = decaler(l, 6)
    const { phase, semaine } = phaseDe(l, triees)
    const suivante = triees.find((p) => p.debut > phase.debut)
    const competition = o.competitions.find((c) => c.date >= l && c.date <= fin)
    const test = o.testsCp.find((d) => d >= l && d <= fin)
    const coef = coefficientPhase(l, triees, o.competitions)
    // Seule une course B allège la semaine (A : affûtage ; C : semaine normale)
    const semaineB = (x: string) => o.competitions.some((c) => c.date >= x && c.date <= decaler(x, 6) && niveaux.get(c.date) === 'B')
    const allegee = coef === undefined && (estSemaineAllegee(l, triees, semaineB) || (!!competition && niveaux.get(competition.date) === 'B'))
    const plafond = o.plafondDe?.(l) ?? o.plafond
    const hausse = semaines.length > 0 && !precedenteAllegee && coef === undefined
    if (hausse) ref = ref * (o.habituelle && ref < o.habituelle ? 1.1 : 1.075)
    if (o.plancher && semaines.length > 0 && coef === undefined) ref = Math.max(ref, o.plancher)
    const bloquee = hausse && !allegee && ref > plafond
    ref = Math.min(plafond, ref)
    precedenteAllegee = allegee || coef !== undefined

    let intensite: string
    if (test) intensite = o.testsCourts?.includes(test) ? "Test CP court 3' + 12'" : 'Test CP complet 12-7-3'
    else if (phase.type === 'recuperation') intensite = 'Pas d’intensité (récupération)'
    else if (phase.type === 'reprise' && o.repriseSansIntensite) intensite = 'Base d’endurance (pas d’intensité)'
    else {
      const choix = choisirFormat(l, triees, histo, o.discipline, 0, o.typeCourse)
      const famille = NOMS_FAMILLES[choix.famille]
      intensite = famille.toLowerCase() === choix.format.nom ? famille : `${famille} · ${choix.format.nom}`
      histo.push({ date: decaler(l, 1), famille: choix.famille, formatId: choix.format.id, palier: 0 })
    }
    semaines.push({
      lundi: l, phase: phase.type, numero: semaine + 1,
      total: suivante ? Math.round((Date.parse(suivante.debut) - Date.parse(phase.debut)) / (7 * 86_400_000)) : undefined,
      type: competition ? 'competition' : test ? 'test' : allegee ? 'allegee' : 'normale',
      budget: Math.round((coef !== undefined ? ref * coef : allegee ? ref * 0.65 : ref) / 50) * 50,
      intensite, competition: competition?.nom, ...(bloquee ? { bloquee } : {}),
    })
  }
  return semaines
}

/**
 * Ajustement des watts Z2 : ±5 W seulement quand 2 sorties de suite donnent le même signal
 * (+1 : facile et FC stable ; −1 : trop dur). Une sortie isolée est trop bruitée (chaleur, café, sommeil).
 */
export function ajustementZ2(signaux: number[]) {
  let total = 0
  let precedent = 0
  for (const x of signaux) {
    if (x === precedent) {
      total += 5 * x
      precedent = 0
    } else precedent = x
  }
  return total
}

/**
 * Garde-fou course → vélo (choix d'entraîneur, relu le 27/10/2026 : aucun seuil n'est prouvé contre les blessures,
 * Impellizzeri 2020 ; Frandsen 2025). Course prévue > +30 % par rapport aux 4 semaines précédentes → Z2 vélo −10 % ;
 * pic de charge totale (7 derniers jours > 1,3 × ta moyenne des 4 semaines d'avant) → −15 %. Jamais plus de −15 %,
 * jamais sur la séance d'intensité. Seuil à +30 % : une progression normale (~10 %/sem.) ne le déclenche pas.
 */
export function gardeFouCourse(o: { hausseCoursePct?: number; ratioPic?: number }) {
  const raisons: string[] = []
  let pct = 0
  if (o.hausseCoursePct !== undefined && o.hausseCoursePct > 30) {
    pct = 0.1
    raisons.push(`course en hausse (+${Math.round(o.hausseCoursePct)} %)`)
  }
  if (o.ratioPic !== undefined && o.ratioPic > 1.3) {
    pct = 0.15
    raisons.push(`pic de charge totale (× ${o.ratioPic.toFixed(1).replace('.', ',')})`)
  }
  return pct ? { pct, raison: `−${Math.round(pct * 100)} % sur tes Z2 vélo : ${raisons.join(' et ')}` } : undefined
}

/**
 * Courses : niveaux A / B / C (relecture du 9/11/2026). Le classement vient de Friel (convention d'entraîneur, sans
 * étude) ; A = course principale (saison construite autour) ; B = importante : semaine allégée d'environ un tiers en
 * gardant les watts et le nombre de sorties (Bosquet 2007, Wang 2023 : −41 à −60 % de volume sur les affûtages, même
 * de 7 jours ou moins ; −35 % = choix prudent) ; C = pour s'entraîner : semaine normale. Dans tous les cas la course
 * est la séance dure de la semaine (Metcalfe 2017, Sanders 2019 : les courses sont plus intenses que l'entraînement).
 */
export type NiveauCourse = 'A' | 'B' | 'C'
/** Type d'épreuve d'une course (sa discipline ; route : en ligne ou cyclosportive) */
export type Epreuve = 'en-ligne' | 'cyclo' | 'xco' | 'xcc' | 'xcm'
export const NOMS_EPREUVES: Record<Epreuve, string> = { 'en-ligne': 'Route en ligne', cyclo: 'Cyclo', xco: 'VTT XCO', xcc: 'VTT XCC', xcm: 'Marathon VTT' }
export interface Competition {
  date: string
  nom: string
  niveau?: NiveauCourse
  epreuve?: Epreuve
  distanceKm?: number
  deniveleM?: number
  /** Durée donnée par l'athlète (min) : remplace l'estimation */
  dureeMin?: number
  /** Cols du parcours (option) : longueur, pente moyenne, position dans la course */
  cols?: Col[]
}
export interface Col { longueurKm: number; pentePct: number; aKm?: number }

/** Épreuve par défaut d'une course sans précision : celle de ta discipline visée. */
export const epreuveDe = (discipline: Discipline, typeCourse?: 'en-ligne' | 'cyclo'): Epreuve =>
  discipline === 'route' ? (typeCourse === 'en-ligne' ? 'en-ligne' : 'cyclo') : discipline === 'xco' || discipline === 'xcc' || discipline === 'xcm' ? discipline : 'xco'

/** Écart entre deux courses B (jours) et zone avant la A où une course devient C : choix d'entraîneur. */
export const ECART_B_JOURS = 21
export const AVANT_A_JOURS = 10

/**
 * Niveau effectif de chaque course (par date) :
 *  - sans niveau (anciennes données) : la plus lointaine est la A, les autres des B ;
 *  - une course pendant la reprise, à moins de 10 jours de la A, ou à moins de 3 semaines d'une B : C.
 */
export function niveauxCourses(competitions: Competition[], phases: Phase[]): Map<string, NiveauCourse> {
  const triees = [...competitions].sort((a, b) => a.date.localeCompare(b.date))
  const aExplicite = triees.some((c) => c.niveau === 'A')
  const brut = (c: Competition, i: number): NiveauCourse => c.niveau ?? (!aExplicite && i === triees.length - 1 ? 'A' : 'B')
  const datesA = triees.filter((c, i) => brut(c, i) === 'A').map((c) => c.date)
  const jours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
  const res = new Map<string, NiveauCourse>()
  let derniereB: string | undefined
  let derniereA: string | undefined
  let nA = 0
  triees.forEach((c, i) => {
    let n = brut(c, i)
    // Une A trop proche de la précédente (moins de 3 semaines) ou au-delà de 4 A : comptée comme une B
    if (n === 'A' && derniereA && (jours(derniereA, c.date) < 21 || nA >= 4)) n = 'B'
    if (n === 'A') { derniereA = c.date; nA++ }
    if (n !== 'A') {
      const reprise = phases.length > 0 && phaseDe(c.date, phases).phase.type === 'reprise'
      const procheA = datesA.some((a) => a > c.date && jours(c.date, a) < AVANT_A_JOURS)
      const procheB = !!derniereB && jours(derniereB, c.date) < ECART_B_JOURS
      if (n === 'B' && (reprise || procheA || procheB)) n = 'C'
    }
    if (n === 'B') derniereB = c.date
    res.set(c.date, n)
  })
  return res
}

/** Durée estimée d'une course (min) selon ta discipline : sert au budget et au délai après la course. */
export function dureeEstimeeCourse(discipline: Discipline, typeCourse?: 'en-ligne' | 'cyclo', dureeCourseMin?: number) {
  if (discipline === 'xco') return 90
  if (discipline === 'xcc') return 30
  if (discipline === 'xcm') return dureeCourseMin ?? DUREE_COURSE_DEFAUT.xcm
  if (discipline === 'route') return dureeCourseMin ?? DUREE_COURSE_DEFAUT[typeCourse === 'en-ligne' ? 'en-ligne' : 'cyclo']
  return 60
}

/**
 * Jours sans séance dure après une course (choix d'entraîneur ; Stanley 2013 : 48 h au moins ; Rodrigues 2016 : CK
 * élevée jusqu'à 72 h après 130 km) : course courte (2 h ou moins) → séance dure au plus tôt à J+3 ; longue → J+4.
 */
export const delaiApresCourse = (dureeMin: number) => (dureeMin > 120 ? 4 : 3)

/** Jour bloqué pour une séance dure : les 2 jours avant une course, ou avant la fin du délai qui suit. */
export function procheCourse(d: string, competitions: string[], delai: number | ((course: string) => number) = 2) {
  const delaiDe = (c: string) => (typeof delai === 'number' ? delai : delai(c))
  return competitions.some((c) => c === decaler(d, 1) || c === decaler(d, 2) || Array.from({ length: Math.max(0, delaiDe(c) - 1) }, (_, k) => decaler(d, -(k + 1))).includes(c))
}

/** La course elle-même, dans le plan : séance dure (et sortie longue au-delà de 2 h). Puissance moyenne ~75 % de la CP (choix d'entraîneur). */
export function construireCourse(nom: string, niveau: NiveauCourse, dureeMin: number, cpW: number): SeanceConstruite {
  return {
    titre: `🏁 ${nom} (course ${niveau})`, dureeMin, kj: Math.round((dureeMin * 60 * 0.75 * cpW) / 1000),
    detail: `Ta course ${niveau} : c'est ta séance dure de la semaine${dureeMin > 120 ? ' et ta sortie longue' : ''}.\nÉchauffement de 15' progressif avec 5-6' à 90-100 % de ta CP, puis au moins 10' faciles avant le départ. Mange comme en course (60-90 g de glucides par heure au-delà d'1 h 30).`,
    velo: { famille: 'course', pourquoi: niveau === 'B' ? 'Course B : semaine allégée d’un tiers, mêmes watts.' : niveau === 'C' ? 'Course C : semaine normale, la course remplace ta séance dure.' : 'Ta course principale.' },
  }
}

/**
 * Veille d'une course B (facultatif ; essais à 24 h seulement en sports collectifs, effet nul à léger : choix
 * d'entraîneur) : 45 min de Z2 avec 3 × 1' à ~107 % de la CP (3' entre) et 2 sprints de 10", moins de 5 min au-dessus de la CP.
 */
export function construireOuverture(z2W: number, cpW: number): SeanceConstruite {
  const w = arrondi5(cpW * 1.07)
  const etapes: Etape[] = [
    { debutSec: 0, dureeSec: 600, libelle: 'Mise en route progressive', w: arrondi5(z2W * 0.85) },
    { debutSec: 600, dureeSec: 300, libelle: 'Z2 régulière', w: z2W, ...plage(z2W, 'z2') },
  ]
  let t = 900
  for (let i = 0; i < 3; i++) {
    etapes.push({ debutSec: t, dureeSec: 60, libelle: '1′ un peu au-dessus de ta CP', w }, { debutSec: t + 60, dureeSec: 180, libelle: 'Récup facile', w: arrondi5(z2W * 0.85) })
    t += 240
  }
  for (let i = 0; i < 2; i++) {
    etapes.push({ debutSec: t, dureeSec: 10, libelle: 'Sprint 10″ à fond' }, { debutSec: t + 10, dureeSec: 230, libelle: 'Récup facile', w: arrondi5(z2W * 0.85) })
    t += 240
  }
  etapes.push({ debutSec: t, dureeSec: 2700 - t, libelle: 'Retour au calme', w: arrondi5(z2W * 0.8) })
  const kj = Math.round(etapes.reduce((a, e) => a + e.dureeSec * (e.w ?? cpW * 1.5), 0) / 1000)
  return {
    titre: 'Veille de course (facultatif)', dureeMin: 45, kj,
    detail: `Z2 à ${z2W} W · 3 × 1' à ${w} W (3' faciles entre) · 2 sprints de 10" · facultatif : si tu préfères, repos ou 30' faciles`,
    velo: { famille: 'z2', formatId: 'ouverture', allegee: true, cibleW: z2W, etapes, pourquoi: 'Veille de ta course B : petit rappel d’intensité, moins de 5 min au-dessus de ta CP.' },
  }
}

/**
 * Estimation de la durée d'une course (relecture du 9/11/2026 ; aucune donnée publiée sur les vitesses des amateurs :
 * vitesses et parts de CP = choix d'entraîneur ; montées par le modèle physique de Martin 1998, comme le calculateur
 * de col) : durée = (distance − longueur des montées) / vitesse sur le plat + montées à k × CP (poids + 9 kg de vélo).
 * Les descentes comptent au rythme du plat (ça compense à peu près). Estimation à ±20 % : l'athlète peut la corriger.
 */
export const VITESSES_EPREUVE: Record<Epreuve, { kmh: number; pente: number; partCp: number; crr: number; ajustee: boolean }> = {
  // Vitesses d'amateurs (baissées le 9/11/2026 à la demande de Titouan : celles de la relecture étaient de bons coureurs)
  'en-ligne': { kmh: 35, pente: 0.06, partCp: 0.9, crr: 0.004, ajustee: false },
  cyclo: { kmh: 25, pente: 0.06, partCp: 0.75, crr: 0.004, ajustee: true },
  xco: { kmh: 16, pente: 0.1, partCp: 0.9, crr: 0.012, ajustee: false },
  xcc: { kmh: 18, pente: 0.1, partCp: 0.9, crr: 0.012, ajustee: false },
  xcm: { kmh: 15, pente: 0.1, partCp: 0.75, crr: 0.012, ajustee: true },
}

/** Durée estimée d'une course (min, arrondie à 5, entre 20 min et 10 h). Sans CP ni poids : 3,5 W/kg et 70 kg. */
export function estimerDureeCourse(epreuve: Epreuve, distanceKm: number, deniveleM = 0, athlete?: { cpW?: number; poidsKg?: number }, facteur = 1) {
  // Short track (XCC) : 20-30 min, d'où un plancher à 20 min (la relecture proposait 45 min, trop pour le XCC)
  return Math.min(600, Math.max(20, Math.round(estimerDureeCourseBrute(epreuve, distanceKm, deniveleM, athlete, facteur) / 5) * 5))
}

/** Parcours de montagne : 15 m de dénivelé par km ou plus (moins : roulant ou vallonné). Choix d'entraîneur. */
export const SEUIL_MONTAGNE_M_PAR_KM = 15
export const estMontagne = (distanceKm: number, deniveleM = 0) => deniveleM / Math.max(distanceKm, 0.1) >= SEUIL_MONTAGNE_M_PAR_KM

/** Même calcul, sans arrondi ni plancher (min). */
function estimerDureeCourseBrute(epreuve: Epreuve, distanceKm: number, deniveleM = 0, athlete?: { cpW?: number; poidsKg?: number }, facteur = 1) {
  const v = VITESSES_EPREUVE[epreuve]
  const poids = athlete?.poidsKg ?? 70
  const wkg = Math.min(5.5, Math.max(2, (athlete?.cpW ?? 3.5 * poids) / poids))
  const route = epreuve === 'en-ligne' || epreuve === 'cyclo'
  // Plat : la vitesse suit à peu près la racine cubique de la puissance (air) ; en course en ligne, le peloton la fixe
  const kmhPlat = v.ajustee ? v.kmh * (wkg / 3.5) ** (1 / 3) : v.kmh
  // Ce qui monte redescend : les montées font au plus la moitié de la distance (pente au moins 2 × D+ / distance)
  const pente = deniveleM > 0 ? Math.max(v.pente, (2 * deniveleM) / 1000 / Math.max(distanceKm, 0.1)) : 0
  const kmMontee = pente > 0 ? Math.min(distanceKm, deniveleM / 1000 / pente) : 0
  const kmhMontee = pente > 0 ? vitesseMontee(v.partCp * wkg * poids, poids + 9, pente, v.crr) * 3.6 : kmhPlat
  const plat = (distanceKm - kmMontee) / kmhPlat
  const montees = kmMontee / kmhMontee
  // Bornes de l'estimation de base : vitesse moyenne plausible (route 18-42 km/h, VTT 8-25 km/h)
  const [vMin, vMax] = route ? [18, 42] : [8, 25]
  const borne = (h: number) => Math.min(distanceKm / vMin, Math.max(distanceKm / vMax, h))
  if (facteur === 1) return borne(plat + montees) * 60
  // Facteur personnel (calé sur tes courses faites). Parcours roulant ou vallonné : sur toute la course (en peloton, plat
  // et bosses vont plus vite que le modèle : abri, élan). Route de montagne (15 m/km ou plus) : sur le plat seulement,
  // les cols se montent à ta CP (physique), le peloton n'y change presque rien.
  if (route && estMontagne(distanceKm, deniveleM)) return (plat / facteur + montees) * 60
  return (borne(plat + montees) / facteur) * 60
}

/**
 * Durée d'une course pour le plan : celle que tu as donnée, sinon estimée (distance + dénivelé), sinon la valeur par
 * défaut de ta discipline (ou la durée de ta course principale).
 */
export function dureeDeCourse(c: Competition, o: { discipline: Discipline; typeCourse?: 'en-ligne' | 'cyclo'; dureeCourseMin?: number; cpW?: number; poidsKg?: number; facteurs?: Partial<Record<'route' | 'vtt', number>> }) {
  if (c.dureeMin) return c.dureeMin
  const epreuve = c.epreuve ?? epreuveDe(o.discipline, o.typeCourse)
  if (c.distanceKm) return estimerDureeCourse(epreuve, c.distanceKm, c.deniveleM, o, o.facteurs?.[epreuve === 'en-ligne' || epreuve === 'cyclo' ? 'route' : 'vtt'])
  if (c.epreuve) return dureeEstimeeCourse(epreuve === 'en-ligne' || epreuve === 'cyclo' ? 'route' : epreuve, epreuve === 'en-ligne' ? 'en-ligne' : 'cyclo', epreuveDe(o.discipline, o.typeCourse) === epreuve ? o.dureeCourseMin : undefined)
  return dureeEstimeeCourse(o.discipline, o.typeCourse, o.dureeCourseMin)
}

/** Course déjà faite qui sert à caler les vitesses (donnée à la main, ou course prévue puis importée). */
export interface CourseReference { epreuve: Epreuve; distanceKm: number; deniveleM: number; dureeMin: number; date?: string }
export type FamilleVitesse = 'route' | 'vtt'
export const familleVitesse = (e: Epreuve): FamilleVitesse => (e === 'en-ligne' || e === 'cyclo' ? 'route' : 'vtt')
/** Bornes du facteur et nombre de courses retenues (les plus récentes) : choix d'entraîneur. */
export const FACTEUR_VITESSE_BORNES = [0.6, 1.8] as const
export const COURSES_POUR_FACTEUR = 3

/**
 * Facteur de vitesse personnel par famille (route, VTT) : estimation de base ÷ temps réel, moyenne des 3 courses les
 * plus récentes, borné entre 0,6 et 1,8. Il multiplie ta vitesse sur toute la course, ou seulement sur le plat en montagne.
 */
export function facteursVitesse(refs: CourseReference[], athlete?: { cpW?: number; poidsKg?: number }): Partial<Record<FamilleVitesse, { facteur: number; n: number }>> {
  const res: Partial<Record<FamilleVitesse, { facteur: number; n: number }>> = {}
  for (const f of ['route', 'vtt'] as const) {
    const liste = refs.filter((x) => familleVitesse(x.epreuve) === f && x.dureeMin > 0 && x.distanceKm > 0)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, COURSES_POUR_FACTEUR)
    if (!liste.length) continue
    // Pour chaque course : le facteur qui redonne ton temps, avec le même calcul que pour tes prochaines courses (dichotomie)
    const ratios = liste.map((x) => {
      let [bas, haut] = [0.3, 3]
      for (let i = 0; i < 40; i++) {
        const m = (bas + haut) / 2
        if (estimerDureeCourseBrute(x.epreuve, x.distanceKm, x.deniveleM, athlete, m) > x.dureeMin) bas = m
        else haut = m
      }
      return (bas + haut) / 2
    })
    const moyenne = ratios.reduce((a, b) => a + b, 0) / ratios.length
    res[f] = { facteur: Math.round(Math.min(FACTEUR_VITESSE_BORNES[1], Math.max(FACTEUR_VITESSE_BORNES[0], moyenne)) * 100) / 100, n: liste.length }
  }
  return res
}


/** Durée d'un col (min) à une puissance donnée, vélo compris (+9 kg). */
export const dureeCol = (c: Col, puissanceW: number, poidsKg: number) =>
  montee(c.longueurKm, c.longueurKm * c.pentePct * 10, poidsKg + 9, puissanceW).tempsSec / 60

/**
 * Spécifique selon les cols de la course (relecture du 10/11/2026, choix d'entraîneur appuyé sur la durabilité,
 * Maunder 2021) : T = durée de la plus longue montée à 85 % de la CP, N = nombre de cols. Fin de prépa : montées de
 * 20 à 30 min qui s'allongent vers T ; phase spécifique : min(N ; 3) montées de min(T ; 40 min) en fin de sortie longue.
 */
export function specifiqueCols(cols: Col[] | undefined, cpW: number, poidsKg = 70) {
  if (!cols?.length) return undefined
  const t = Math.max(...cols.map((c) => dureeCol(c, cpW * 0.85, poidsKg)))
  return { n: Math.min(cols.length, 3), minutes: Math.round(Math.min(t, 40) / 5) * 5 || 10, longueMin: Math.round(t) }
}

/**
 * Watts cibles de chaque col pour faire la course « à 100 % théorique » (relecture du 10/11/2026 ; monter un peu plus
 * fort qu'à plat fait gagner du temps : Atkinson 2007, Cangley 2011 ; les watts baissent avec la fatigue : Mateo-March
 * 2022, Clark 2019 ; coefficients = choix d'entraîneur) :
 *   cible = CP × k0(durée du col) × m(durée de l'épreuve, 1 pour le dernier col) × f(kJ/kg déjà faits),
 *   k0 : < 10 min 1,00 · 10-20 0,95 · 20-40 0,92 · 40-60 0,90 · > 60 0,88 ; m : ≤ 4 h 1,00 · 4-6 h 0,97 · > 6 h 0,94 ;
 *   f = max(0,88 ; 1 − 0,02 par 10 kJ/kg) ; jamais au-dessus de la puissance tenable, ni de la CP au-delà de 20 min.
 * Travail avant le col : temps écoulé (position / distance × durée de la course) à environ 70 % de la CP.
 */
export function ciblesCols(o: { cols: Col[]; distanceKm?: number; dureeMin: number; cpW: number; wPrimeKj?: number; poidsKg?: number }) {
  const poids = o.poidsKg ?? 70
  const wPrime = o.wPrimeKj ?? 15
  const k0 = (min: number) => (min < 10 ? 1 : min < 20 ? 0.95 : min < 40 ? 0.92 : min < 60 ? 0.9 : 0.88)
  const m = o.dureeMin <= 240 ? 1 : o.dureeMin <= 360 ? 0.97 : 0.94
  const tries = o.cols.map((c, i) => ({ c, i })).sort((a, b) => (a.c.aKm ?? a.i) - (b.c.aKm ?? b.i))
  return tries.map(({ c, i }, rang) => {
    const avantMin = c.aKm !== undefined && o.distanceKm ? (c.aKm / o.distanceKm) * o.dureeMin : (rang / Math.max(1, tries.length)) * o.dureeMin
    const kjKg = (avantMin * 60 * 0.7 * o.cpW) / 1000 / poids
    const f = Math.max(0.88, 1 - 0.02 * (kjKg / 10))
    const mCol = rang === tries.length - 1 ? 1 : m
    // La durée dépend de la puissance : 3 passes suffisent à se stabiliser
    let w = o.cpW * 0.9
    for (let k = 0; k < 3; k++) {
      const duree = dureeCol(c, w, poids)
      w = o.cpW * k0(duree) * mCol * f
      w = Math.min(w, puissanceTenable(duree * 60, o.cpW, wPrime), duree > 20 ? o.cpW : Infinity)
    }
    return { index: i, col: c, watts: Math.round(w / 5) * 5, minutes: Math.round(dureeCol(c, w, poids)), kjKgAvant: Math.round(kjKg), dernier: rang === tries.length - 1 }
  })
}

/**
 * Test CP trop proche d'une course (relecture du 10/11/2026, repères d'entraîneur : aucune étude ne mesure un test
 * 48 h après une course) : pas dans les 2 jours avant, ni dans les 3 jours après (5 après une course de plus de 3 h).
 */
export function testProcheCourse(d: string, courses: { date: string; dureeMin: number }[]) {
  return courses.some((c) => (d >= decaler(c.date, -2) && d < c.date) || (d >= c.date && d <= decaler(c.date, c.dureeMin > 180 ? 5 : 3)))
}

/**
 * Cycle 1er seuil (prépa hivernale de Methodic Cycling, relue le 10/11/2026) : une séance dédiée au 1er seuil par
 * semaine, en plus de la sortie longue, de 4 × 10′ vers 5 × 20′ ou 3 × 30′, récupérations courtes, effort linéaire sans
 * dérive (même plage de FC que les blocs de la sortie longue). Le travail au 1er seuil ne remplace pas l'intensité
 * (Neal 2013, Stöggl 2014) : le rappel VO2 reste. Progression = choix d'entraîneur.
 */
export const PALIERS_SV1_DEDIE: { reps: number; min: number }[] = [
  { reps: 4, min: 10 }, { reps: 3, min: 15 }, { reps: 4, min: 15 }, { reps: 3, min: 20 }, { reps: 5, min: 20 }, { reps: 3, min: 30 },
]
const recupSv1Dedie = (min: number) => (min >= 20 ? 4 : 3)
export const dureeSv1Dediee = (p: { reps: number; min: number }) => 15 + p.reps * p.min + (p.reps - 1) * recupSv1Dedie(p.min) + 10

export function construireSv1Dediee(palier: number, maxMin: number, sv1W: number, z2W: number, fc?: [number, number]): SeanceConstruite {
  // Le palier visé, sinon le plus grand qui tient dans ton créneau
  let i = Math.min(palier, PALIERS_SV1_DEDIE.length - 1)
  while (i > 0 && dureeSv1Dediee(PALIERS_SV1_DEDIE[i]) > maxMin) i--
  const p = PALIERS_SV1_DEDIE[i]
  const recup = recupSv1Dedie(p.min)
  const wEch = arrondi5(z2W * 0.85)
  const pl = plage(sv1W, 'tempo')
  const { etapes, kj } = enchainer([
    { dureeSec: 900, libelle: 'Mise en route progressive', w: wEch },
    {
      dureeSec: (p.reps * p.min + (p.reps - 1) * recup) * 60, w: sv1W, libelle: `${p.reps} × ${p.min}′ au 1er seuil, ${recup}′ faciles entre`,
      repetition: {
        fois: p.reps, derniere: 1,
        etapes: [
          { dureeSec: p.min * 60, libelle: `1er seuil${fc ? ` (FC ${fc[0]}-${fc[1]})` : ''} : effort linéaire, tu parles en phrases`, w: sv1W, ...pl },
          { dureeSec: recup * 60, libelle: 'Facile', w: wEch },
        ],
      },
    },
    { dureeSec: 600, libelle: 'Retour au calme', w: wEch },
  ], z2W)
  const dureeMin = dureeSv1Dediee(p)
  return {
    titre: `Cycle 1er seuil : ${p.reps} × ${p.min}′ à ${sv1W} W`, dureeMin, kj,
    detail: `${p.reps} × ${p.min}′ à ${sv1W} W${fc ? ` · FC ${fc[0]}-${fc[1]}` : ''} · ${recup}′ faciles entre · effort linéaire, sans dérive du cœur (RPE 4-6)`,
    velo: { famille: 'z2', formatId: 'sv1-dedie', cibleW: sv1W, sv1W, blocsSv1: p.reps, ...(fc ? { fcSv1: fc } : {}), etapes, pourquoi: 'Cycle 1er seuil (prépa hivernale) : la base de tout, une séance dédiée par semaine en plus des blocs de ta sortie longue.' },
  }
}
