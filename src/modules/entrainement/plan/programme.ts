import { db } from '../../../core/db'
import { estMineur, type Profil } from '../../../core/profil'
import { dureeForce, exosDe, joursMuscu, NOMS_PERIODES, planForce, semainesApprentissage, type ReglagesForce, type SeanceForce } from '../muscu/force'
import { signalerErreur } from '../../../core/erreurs'
import { calculEnCours, debutCalcul, finCalcul, oublierPhoto, photoInterrompue } from '../../../core/calcul'
import { aujourdhui, decalerJour, depuisJour, ecartJours, NOMS_JOURS, versJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import {
  ajustementZ2, departSelonHeures, PALIERS_SV1_DEDIE, meilleurLevier, pistesDeblocage, BLOCS_SV1, signalSv1, signalFcSv1, plageFcSv1, sprintsDeLaPhase, SV1_DEPART_PCT, SV1_MAX_PCT, budgetDePhase, budgetSemaine, plafondEtNominal, formatDe, NOMS_FAMILLES, plafondsReprise, projeterSaison, choisirFormat, construireIntervalles, construireTest, construireZ2, coefficientPhase, estSemaineAllegee, etatProgression, palierRaccourci, tenirDansCreneau,
  construireCycloMontees, construireLongueCotes, construireSimulationLigne, construireSimulationXco, construireSpeciales, construireTerrain, cotesDe, minutesPourKj, NOMS_DISCIPLINES, NOMS_PHASES, deuxIntensitesPossibles, formatsPour, hausseBudget, heuresDe, jourDeuxiemeIntensite, niveauDuProfil, palierPossible, phaseDe, placer, retourDeCoupure, semainesChamboulees, type BilanSemaine, type Famille, type HistoIntensite,
  cibleSortieLongue, dureeLongueVisee, type SeanceConstruite, type TypePhase,
  construireCourse, construireDepartsXco, construireOuverture, construireSv1Dediee, specifiqueCols, testProcheCourse, delaiApresCourse, dureeDeCourse, epreuveDe, facteursVitesse, type CourseReference, niveauxCourses, procheCourse,
} from '../../../metrics/programme'
import { fusionnerSemainesPassees, heuresAu, programmeAu, programmeDe } from '../reglagesEntrainement'
import type { ProfilSportif } from '../reglages/ProfilSportif'
import { chargerContexte, domaineDe, lundiDe } from '../seances/donnees'
import type { ReglagesEntrainement, ReglagesProgramme, Seance, SeancePrevue } from '../types'
import { chargesSemaine, joursDe, semaineComptee } from './donnees'
import { joursPanneVelo } from './imprevus'
import { lireSemaineChargee, passerSemaineChargee } from './semaineChargee'
import { chargeDeDepart } from './depart'
import { deriveSeance } from './controleFc'

/** Semaines d'une course B (elles remettent à zéro le compteur des semaines chargées). */
const semaineB = (prog: Pick<ReglagesProgramme, 'competitions' | 'phases'>) => {
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  return (lundi: string) => prog.competitions.some((c) => c.date >= lundi && c.date <= decalerJour(lundi, 6) && niveaux.get(c.date) === 'B')
}

/** Familles de séances d'intensité (hors Z2 et test). */
const INTENSITES: Famille[] = ['vo2-courts', 'vo2-longs', 'seuil-plus', 'seuil', 'seuil-variable', 'sweet-spot', 'tempo', 'relances', 'sprints']
export const estIntensite = (p: SeancePrevue) => !!p.velo && (INTENSITES as string[]).includes(p.velo.famille)
/** Séance d'intensité de la semaine : intervalles, ou simulation et départs XCO (pas une sortie longue, même en côtes ou en simulation). */
const estIntensiteSemaine = (p: SeancePrevue) => estIntensite(p) || p.velo?.famille === 'simulation-xco'

/** CP par défaut tant qu'aucun test n'est saisi (CP provisoire de la prépa). */
export const CP_DEFAUT = 260

/** Bilan enregistré pour chaque semaine générée (réglage « semaine-AAAA-MM-JJ »). */
export interface MetaSemaine {
  budgetRef: number
  budget: number
  raison: string
  allegee: boolean
  phase: string
  semaineDansPhase: number
  z2W: number
  genereeLe: string
  /** Construite avant la fin de la semaine d'avant (comptée à 100 %) : recalculée une fois celle-ci finie */
  bilanProvisoire?: boolean
  /** Budget calculé par les règles, quand le total prévu (`budget`) n'a pas pu le suivre */
  budgetVise?: number
  /** 2 (17/11/2026) : `budget` = total des séances prévues, et les séances suivent le budget */
  version?: number
  /** Bridée (25/11/2026) : tes créneaux n'ont pas permis d'atteindre la référence ; la référence est gardée */
  bridee?: boolean
  /**
   * Réglages avec lesquels la semaine a été construite (25/11/2026, demande de Titouan) : un changement de réglage
   * s'applique à partir de la semaine suivante ; la semaine en cours se recalcule toujours avec ceux-là
   */
  reglagesSemaine?: ReglagesFiges
  /** En remontée (26/11/2026) : limitée à +10 % sur la semaine d'avant, pas raccourcie (ce n'est ni un affûtage ni une récup) */
  remontee?: boolean
}

interface ReglagesFiges {
  semaineType: ReglagesProgramme['semaineType']
  maxSemaineMin: number
  maxLongMin: number
  minLongMin?: number
  heuresSemaine?: string
  force?: ReglagesForce
}

/**
 * Référence de la semaine pour la suivante. Semaines construites avant la 14.8 (le budget ne commandait pas les séances) :
 * la référence est ce qui était vraiment prévu, sinon la semaine suivante chuterait d'un coup.
 */
/** Semaine réduite sous sa référence (affûtage, récupération, garde-fou) : la suivante y revient, sans hausse en plus. */
// Semaine bridée par tes créneaux (25/11/2026) ; avant le drapeau, reconnue à sa raison
const estBridee = (meta: MetaSemaine) => meta.bridee ?? (meta.version === 2 && !meta.allegee && meta.budget < meta.budgetRef * 0.95 && /plafonné par tes créneaux|limité par tes créneaux/.test(meta.raison))
const estReduite = (meta: MetaSemaine) => meta.version === 2 && !meta.allegee && !estBridee(meta) && !meta.remontee && (meta.budgetVise ?? meta.budget) < meta.budgetRef * 0.9
/** Reprise des réductions et des bridages dans le bilan de la semaine */
const drapeaux = (meta: MetaSemaine) => ({ ...(estReduite(meta) ? { reduite: true } : {}), ...(estBridee(meta) ? { bridee: true } : {}), budgetPrevu: Math.min(meta.budget, meta.budgetVise ?? meta.budget) })
const referenceDe = (meta: MetaSemaine, kjPrevus: number) => (meta.version === 2 || meta.allegee ? meta.budgetRef : Math.max(meta.budgetRef, Math.round(kjPrevus)))

const cleSemaine = (lundi: string) => `semaine-${lundi}`
export const lireMeta = async (lundi: string) => (await db.reglages.get(cleSemaine(lundi)))?.valeur as MetaSemaine | undefined

async function lireReglages() {
  const r = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined
  // W' utilisé seulement s'il vient d'un test complet 12-7-3 et pas du tout premier test CP (Triska 2017, Karsten 2014)
  const wPrimeKj = r?.wPrimeComplet && (r.tests ?? []).filter((t) => t.type === 'cp').length >= 2 ? r.wPrimeKj : undefined
  // CP absente ou absurde (0, effacée) : valeur par défaut, sinon des séances de « NaN min » (audit du 14/11/2026)
  return { cpW: r?.cpW && r.cpW >= 50 ? r.cpW : CP_DEFAUT, wPrimeKj, zones: r?.zonesVelo, tests: r?.tests ?? [], programme: programmeDe(r?.programme) }
}

/** Dates des tests CP réalisés (résultats saisis). */
const datesTests = (tests: { date: string; type: string }[]) => tests.filter((t) => t.type === 'cp').map((t) => t.date)

/**
 * Garde-fou de l'audit du 18/11/2026 : une séance auto garde son nom (`auto-<date d'origine>-velo`) quand elle est déplacée
 * ou faite un autre jour. Les anciennes séances à refaire sont déjà supprimées : si le nom existe encore, c'est une séance
 * faite, déplacée ou gardée, qu'il ne faut jamais écraser. La nouvelle séance prend alors un autre nom.
 */
async function idAuto(date: string, sport: 'velo' | 'muscu') {
  const base = `auto-${date}-${sport}`
  for (let i = 0; ; i++) {
    const id = i ? `${base}-${i + 1}` : base
    if (!(await db.prevues.get(id))) return id
  }
}

const actives = (p: SeancePrevue) => p.statut === 'prevue' || p.statut === 'faite' || p.statut === 'reportee'
const arrondi5 = (n: number) => Math.round(n / 5) * 5

/** Séances prévues marquées « réalisée différente » : la séance faite à leur place ne compte que pour ses kJ (12/11/2026). */
export async function idsPrevuesDifferentes() {
  return new Set((await db.prevues.toArray()).filter((p) => p.realiseDifferent).map((p) => p.id))
}

/** Séances d'intensité générées (passées et prévues) : alternance des formats et progression. */
async function histoIntensite(): Promise<HistoIntensite[]> {
  const autos = (await db.prevues.toArray()).filter((p) => p.origine === 'auto' && estIntensite(p) && actives(p) && !p.realiseDifferent)
  // Jour orange ou rouge (sans « je maintiens ») : séance raccourcie ou supprimée, elle ne fait pas progresser
  const adaptes = new Set((await db.decisions.toArray()).filter((d) => d.couleur !== 'vert' && !d.force).map((d) => d.date))
  return autos.map((p) => ({
    date: p.date, famille: p.velo!.famille as Famille, formatId: p.velo!.formatId!, palier: p.velo!.palier ?? 0,
    allegee: p.velo!.allegee || adaptes.has(p.date), resultat: p.resultat,
  }))
}

/**
 * Puissance Z2 actuelle : point de départ (réglage, sinon 62 % de la CP), puis ±5 W selon les sorties Z2
 * du programme depuis le dernier test CP : découplage < 5 % et RPE ≤ 3 → +5 W ; découplage > 5 % ou RPE > 3 → −5 W.
 * Toujours bornée par ta zone 2.
 */
export async function z2Actuel() {
  const r = await lireReglages()
  const depart = r.programme.z2W ?? arrondi5(r.cpW * 0.62)
  const dernierTest = r.tests.filter((t) => t.type === 'cp').map((t) => t.date).sort().pop() ?? ''
  const z2Ids = new Set((await db.prevues.toArray()).filter((p) => !p.realiseDifferent && ((p.velo?.famille === 'z2' && p.velo.formatId !== 'ouverture' && p.velo.formatId !== 'sv1-dedie') || p.velo?.famille === 'z2-long')).map((p) => p.id))
  const seances = (await db.seances.where('date').above(dernierTest).toArray()).filter((s) => s.prevueId && z2Ids.has(s.prevueId))
  // Chaque sortie Z2 donne un signal (+1 facile et stable, −1 trop dur) ; on ne bouge de ±5 W
  // que lorsque 2 sorties de suite vont dans le même sens (une sortie isolée est trop bruitée)
  const signaux = seances.sort((a, b) => a.date.localeCompare(b.date)).flatMap((s) => {
    // Même dérive que la carte du jour : entre les blocs au 1er seuil, ou sur la partie Z2 seule (23/11/2026)
    const d = deriveSeance(s)?.valeur
    if (d === undefined || s.rpe === undefined || s.sansCeinture) return []
    if (d < 5 && s.rpe <= 3) return [1]
    if (d > 5 || s.rpe > 3) return [-1]
    return []
  })
  const ajustement = ajustementZ2(signaux)
  const z2 = r.zones?.[1]
  const min = z2?.wMin ?? 0
  const max = z2?.wMax ?? Infinity
  return { w: Math.min(max, Math.max(min, depart + ajustement)), depart, ajustement }
}

/**
 * 1er seuil (blocs de la sortie longue) : 70 % de la CP au départ, puis les watts suivent le cœur (relecture du
 * 9/11/2026) : FC moyenne des blocs sous la plage visée → +5 W, au-dessus → −5 W, après 2 sorties de suite
 * (signalFcSv1), entre la Z2 + 5 W et 85 % de la CP. Sorties d'avant la plage de FC : découplage (signalSv1).
 * Palier des blocs (sorties longues seulement, 7 crans : 2 × 15 → 2 × 40) : découplage < 4 % et effort ≤ 6/10 = un cran
 * de plus, neutre = même palier, découplage > 5 % ou effort ≥ 7/10 = un cran de moins.
 * `nFaites` : sorties longues au 1er seuil faites (cycle de la plage de FC, plageFcSv1).
 */
export async function sv1Actuel(z2W: number) {
  const r = await lireReglages()
  const dernierTest = r.tests.filter((t) => t.type === 'cp').map((t) => t.date).sort().pop() ?? ''
  const prevues = new Map((await db.prevues.toArray()).filter((p) => p.velo?.blocsSv1 && !p.realiseDifferent).map((p) => [p.id, p]))
  const seances = (await db.seances.toArray()).filter((s) => s.prevueId && prevues.has(s.prevueId)).sort((a, b) => a.date.localeCompare(b.date))
  const blocs = (s: Seance) => (s.controle?.lignes ?? []).filter((l) => l.libelle.startsWith('1er seuil') && l.fc).map((l) => ({ fc: l.fc!, w: l.w }))
  const signal = (s: Seance) => signalSv1(blocs(s), s.rpe)
  const signalW = (s: Seance) => {
    const plage = prevues.get(s.prevueId!)?.velo?.fcSv1
    return plage ? signalFcSv1(blocs(s).map((b) => b.fc), plage) : signal(s)
  }
  const signaux = seances.filter((s) => s.date > dernierTest).map(signalW).filter((x) => x !== 0)
  const w = Math.min(arrondi5(r.cpW * SV1_MAX_PCT), Math.max(z2W + 5, arrondi5(r.cpW * SV1_DEPART_PCT) + ajustementZ2(signaux)))
  const longues = seances.filter((s) => prevues.get(s.prevueId!)?.velo?.famille === 'z2-long')
  const palier = longues.reduce((n, s) => Math.max(0, Math.min(BLOCS_SV1.length - 1, n + signal(s))), 0)
  // Séance dédiée (15/11/2026) : un cran de plus à chaque séance faite sans mauvais signal (sans ceinture, le découplage
  // manque : avant, la séance restait au même palier des semaines durant), un de moins si le cœur a dérivé ou RPE ≥ 7
  const dediees = seances.filter((s) => prevues.get(s.prevueId!)?.velo?.formatId === 'sv1-dedie')
  const palierDedie = dediees.reduce((n, s) => Math.max(0, Math.min(PALIERS_SV1_DEDIE.length - 1, n + (signal(s) < 0 ? -1 : 1))), 0)
  return { w, palier, palierDedie, nFaites: longues.length }
}

/** 150 → « 2 h 30 », 120 → « 2 h » */
const heuresMin = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`

/**
 * Sortie longue de la semaine qui commence `lundi` (relecture du 9/11/2026, choix d'entraîneur) : elle s'allonge de
 * 10 min par semaine vers la durée visée par ta course (`cibleSortieLongue`), hors reprise, affûtage et récupération,
 * sans dépasser ton maximum. Renvoie la cible et la durée minimale de la semaine (undefined : règle habituelle).
 */
export async function longueDeLaSemaine(lundi: string, prog: ReglagesProgramme, phase: TypePhase) {
  const cible = cibleSortieLongue(prog.discipline ?? 'route', prog.typeCourse, prog.dureeCourseMin)
  // Garde-fou (audit du 18/11/2026, relu : choix d'entraîneur prudent, Frandsen 2025 en course à pied) : la sortie longue
  // ne dépasse jamais de plus de 10 % la plus longue des 4 dernières semaines (faite ou prévue, hors semaines allégées)
  const precedentes = (await db.prevues.where('date').between(decalerJour(lundi, -28), lundi, true, false).toArray())
    .filter((p) => p.velo?.famille === 'z2-long' && (p.statut === 'faite' || p.statut === 'prevue') && !p.velo?.allegee).map((p) => p.dureeMin)
  const plafond10 = precedentes.length ? Math.max(60, Math.round((Math.max(...precedentes) * 1.1) / 5) * 5) : undefined
  if (!cible || phase === 'reprise' || phase === 'affutage' || phase === 'recuperation') return { cible, visee: undefined, plafond10 }
  // Référence : la plus longue des 4 dernières semaines (relecture du 15/11/2026 : le risque monte quand une séance dépasse
  // de plus de 10 % la plus longue des 30 derniers jours, Frandsen 2025, course à pied)
  const recentes = (await db.prevues.where('date').between(decalerJour(lundi, -28), lundi, true, false).toArray())
    .filter((p) => p.velo?.famille === 'z2-long' && p.statut === 'faite').map((p) => p.dureeMin)
  return { cible, visee: dureeLongueVisee(cible, prog.minLongMin, recentes.length ? Math.max(...recentes) : undefined), plafond10 }
}

/** Bilan de la semaine précédente (si elle a été générée). */
async function bilanPrecedent(lundi: string, reel = false): Promise<BilanSemaine | undefined> {
  return bilanDe(decalerJour(lundi, -7), reel)
}

/** Semaines des 6 dernières faites à moins de 80 % de ce qui était prévu : elles ne comptent pas comme « chargées » (15/11/2026). */
async function semainesPeuFaites(lundi: string) {
  const parts = await partsRealisees(lundi)
  const peu = new Set(parts.flatMap((p, i) => (p !== undefined && p < 0.8 ? [decalerJour(lundi, -7 * (i + 1))] : [])))
  return (l: string) => peu.has(l)
}

/** Part des kJ prévus réalisée, semaine par semaine, en remontant depuis la semaine d'avant `lundi` (6 au plus). */
export async function partsRealisees(lundi: string) {
  const parts: (number | undefined)[] = []
  for (let i = 1; i <= 6; i++) {
    const b = await bilanDe(decalerJour(lundi, -7 * i))
    parts.push(b && b.kjPrevus ? b.kjRealises / b.kjPrevus : undefined)
  }
  return parts
}

async function bilanDe(precedent: string, reel = false): Promise<BilanSemaine | undefined> {
  const meta = await lireMeta(precedent)
  if (!meta) return undefined
  const fin = decalerJour(precedent, 6)
  // Séances rattrapées la semaine d'après : comptées ici, dans leur semaine d'origine (23/11/2026)
  const compte = await semaineComptee(precedent, await db.prevues.where('date').between(precedent, fin, true, true).toArray(), await db.seances.where('date').between(precedent, fin, true, true).toArray())
  const prevues = compte.prevues.filter((p) => p.origine === 'auto' && p.statut !== 'abandonnee')
  const seances = compte.seances
  const decisions = await db.decisions.where('date').between(precedent, fin, true, true).toArray()
  // Semaine pas encore finie (13/11/2026) : comptée comme si elle se passait à 100 %, sans jour rouge ni orange ; la
  // semaine d'après se recalcule avec le vrai bilan une fois celle-ci finie
  // Le dimanche (dernier jour), c'est le vrai bilan : la séance du jour encore prévue compte comme faite (voir plus bas)
  if (!reel && fin > aujourdhui()) {
    const kjPrevus = prevues.reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
    return { budgetRef: referenceDe(meta, kjPrevus), kjPrevus, kjRealises: kjPrevus, rouges: 0, oranges: 0, allegee: meta.allegee, ...drapeaux(meta), chargee: !!(await lireSemaineChargee(precedent)), provisoire: true }
  }
  // Bilan du dimanche (15/11/2026, demande de Titouan) : une séance encore prévue aujourd'hui (ou plus tard) compte
  // comme faite tant que la semaine n'est pas finie : pas de « semaine pas validée » avant ta séance du dimanche
  const restantes = fin >= aujourdhui() ? prevues.filter((p) => p.date >= aujourdhui() && p.statut === 'prevue') : []
  const kjPrevus = prevues.reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  return {
    budgetRef: referenceDe(meta, kjPrevus),
    kjPrevus,
    // Sortie dehors sans capteur de puissance : on compte les kJ prévus de la séance qu'elle a remplie
    kjRealises: seances.filter((s) => s.sport === 'velo').reduce((a, s) => a + (s.kj ?? prevues.find((p) => p.id === s.prevueId)?.kjPrevu ?? 0), 0)
      + restantes.reduce((a, p) => a + (p.kjPrevu ?? 0), 0),
    ...(restantes.length ? { kjAVenir: restantes.reduce((a, p) => a + (p.kjPrevu ?? 0), 0) } : {}),
    rouges: decisions.filter((d) => d.couleur === 'rouge').length,
    oranges: decisions.filter((d) => d.couleur === 'orange').length,
    allegee: meta.allegee,
    ...drapeaux(meta),
    chargee: !!(await lireSemaineChargee(precedent)),
    ...(await semaineAvecCourseC(precedent) ? { courseC: true } : {}),
  }
}

/** Une course C dans la semaine (une B rend déjà la semaine allégée, donc sans hausse ensuite). */
async function semaineAvecCourseC(lundi: string) {
  const prog = (await lireReglages()).programme
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  return prog.competitions.some((c) => c.date >= lundi && c.date <= decalerJour(lundi, 6) && niveaux.get(c.date) === 'C')
}

/** Type de séance (affichage, historique) et domaine d'intensité selon la famille. */
function champsVelo(c: SeanceConstruite): Pick<SeancePrevue, 'type' | 'intensite' | 'priorite' | 'longue'> {
  const f = c.velo.famille
  if (f === 'z2') return { type: 'Endurance', intensite: 'basse', priorite: 'normale' }
  // Sortie longue en côtes (marathon VTT) : jusqu'à 90 min près du seuil, elle compte comme une séance dure
  if (f === 'z2-long') return { type: 'Sortie longue', intensite: c.velo.etapes?.some((e) => e.repetition?.etapes.some((x) => x.libelle === 'Montée')) ? 'haute' : 'basse', priorite: 'cle', longue: true }
  if (f === 'vtt-terrain') return { type: 'Endurance', intensite: 'basse', priorite: 'normale' }
  if (f === 'vtt-speciales') return { type: 'Fractionné / VMA', intensite: 'haute', priorite: 'cle' }
  // Séances de course (relues le 6/11/2026) : séances dures ; les deux premières remplacent la sortie longue
  if (f === 'simulation-ligne' || f === 'cyclo-montees') return { type: 'Sortie longue', intensite: 'haute', priorite: 'cle', longue: true }
  if (f === 'simulation-xco') return { type: 'Compétition', intensite: 'haute', priorite: 'cle' }
  if (f === 'test') return { type: 'Test', intensite: 'haute', priorite: 'cle' }
  if (f === 'course') return { type: 'Compétition', intensite: 'haute', priorite: 'cle', longue: c.dureeMin > 120 }
  return { type: f.startsWith('vo2') || f === 'sprints' || f === 'relances' ? 'Fractionné / VMA' : 'Seuil', intensite: f === 'sweet-spot' || f === 'tempo' ? 'moyenne' : 'haute', priorite: 'cle' }
}

const nomJour = (d: string) => NOMS_JOURS[depuisJour(d).getDay()]

export const NOTE_GENOUX = 'Genoux : garde une cadence d’au moins 80 tr/min, surtout en côte et à haute puissance.'

/**
 * Génère (ou regénère) les séances vélo de la semaine autour des séances déjà saisies (course Campus, renfo).
 * Les séances déjà faites sont gardées ; seules les séances auto encore à faire sont remplacées.
 */
/**
 * Courses qui calent ta vitesse : celles données à la main, plus chaque course prévue (avec sa discipline) faite et
 * importée (distance, dénivelé et temps réels de l'activité ; au moins 30 min pour écarter un import partiel).
 */
export async function referencesVitesse(prog: ReglagesProgramme): Promise<CourseReference[]> {
  const auto: CourseReference[] = []
  for (const c of prog.competitions.filter((x) => x.epreuve && x.date < aujourdhui())) {
    const s = (await db.seances.where('date').equals(c.date).toArray()).filter((x) => x.sport === 'velo' && x.dureeSec >= 1800)
      .sort((a, b) => b.dureeSec - a.dureeSec)[0]
    const distanceKm = s?.distanceKm ?? c.distanceKm
    if (s && distanceKm) auto.push({ epreuve: c.epreuve!, distanceKm, deniveleM: s.deniveleM ?? c.deniveleM ?? 0, dureeMin: Math.round(s.dureeSec / 60), date: c.date })
  }
  return [...(prog.coursesReference ?? []), ...auto]
}

/** Poids du dernier test CP (pour l'estimation des montées). */
export const poidsDesTests = (r: Pick<ReglagesEntrainement, 'tests'>) => [...r.tests].reverse().find((t) => t.poidsKg)?.poidsKg

/** Facteurs de vitesse personnels (route, VTT), prêts pour dureeDeCourse. */
export async function facteursPersonnels(r: Pick<ReglagesEntrainement, 'tests' | 'programme' | 'cpW'>) {
  const f = facteursVitesse(await referencesVitesse(r.programme), { cpW: r.cpW, poidsKg: poidsDesTests(r) })
  return { route: f.route?.facteur, vtt: f.vtt?.facteur }
}

/**
 * Génère (ou regénère) le vélo d'une semaine. Filet de sécurité (audit du 11/11/2026) : la génération supprime d'abord
 * les anciennes séances ; si elle échoue en route (chargement impossible hors ligne, données incohérentes), la semaine
 * d'avant est remise telle quelle au lieu de rester vide, et l'erreur est remontée.
 */
/**
 * Un seul calcul de semaine à la fois (25/11/2026) : deux calculs en même temps de la même semaine (saison reconstruite au
 * lancement et après un changement de réglage) écrivaient chacun ses séances, d'où des semaines entières en double.
 */
let fileCalculs: Promise<unknown> = Promise.resolve()
export function genererSemaineVelo(lundi: string): Promise<string[]> {
  const tache = fileCalculs.then(() => genererSemaineVeloSeule(lundi))
  fileCalculs = tache.catch(() => {})
  return tache
}

/** Erreur passagère de la base locale (Safari / iPhone), qui passe en réessayant. */
const estErreurPassagere = (e: unknown) => {
  const n = (e as { name?: string; inner?: { name?: string } })?.name ?? ''
  const m = e instanceof Error ? e.message : String(e)
  return /UnknownError|TransactionInactive|AbortError/.test(n) || /cursor that doesn't exist|connection is closing|transaction/i.test(m)
}

async function genererSemaineVeloSeule(lundi: string) {
  const avant = await db.prevues.where('date').aboveOrEqual(lundi).toArray()
  // Photo de la semaine d'avant gardée pendant le calcul : remise au démarrage si l'appli est coupée en plein calcul
  debutCalcul(lundi, avant)
  try {
    const phrases = await genererSemaineVeloBrute(lundi).catch(async (e) => {
      // 25/11/2026 : sur iPhone, la base locale coupe parfois une lecture quand l'appli passe en arrière-plan
      // (« Attempt to iterate a cursor that doesn't exist ») : on remet la semaine et on réessaie une fois
      if (!estErreurPassagere(e)) throw e
      await remettreSemaine(lundi, avant)
      await new Promise((r) => setTimeout(r, 1500))
      return genererSemaineVeloBrute(lundi)
    })
    // Séances déjà envoyées (Zwift, montre, compteur) et changées par ce calcul : la nouvelle version part toute seule
    void mettreAJourTousEnvois()
    return phrases
  } catch (e) {
    await remettreSemaine(lundi, avant)
    signalerErreur(e, `Semaine du ${lundi} non recalculée (semaine d'avant gardée)`)
    throw e
  } finally {
    finCalcul()
  }
}

/** Séances déjà envoyées puis recalculées : mises à jour sur Zwift / la montre (Intervals) et le compteur iGPSPORT. */
export async function mettreAJourTousEnvois() {
  if (typeof window === 'undefined') return
  await import('../import/envoi').then((m) => m.mettreAJourEnvois()).catch(() => {})
  await import('../import/igpsport').then((m) => m.mettreAJourEnvoisIgpsport()).catch(() => {})
}

/** Remet les séances d'avant le calcul (et retire celles créées entre-temps). */
async function remettreSemaine(lundi: string, avant: SeancePrevue[]) {
  const ids = new Set(avant.map((p) => p.id))
  for (const p of await db.prevues.where('date').aboveOrEqual(lundi).toArray()) if (!ids.has(p.id)) await supprimer(db.prevues, p.id)
  for (const p of avant) await enregistrer(db.prevues, p)
}

/**
 * Au démarrage (16/11/2026) : un calcul de semaine coupé en plein milieu (appli fermée, mise à jour) a laissé une semaine
 * à moitié écrite. On remet la semaine d'avant, puis on la recalcule.
 */
export async function reprendreCalculInterrompu() {
  const photo = photoInterrompue<SeancePrevue>()
  if (!photo || calculEnCours()) return
  await remettreSemaine(photo.lundi, photo.avant)
  oublierPhoto()
  if (decalerJour(photo.lundi, 6) >= aujourdhui()) await genererSemaineVelo(photo.lundi).catch(() => {})
}

async function genererSemaineVeloBrute(lundi: string) {
  const jour = aujourdhui()
  const semaine = joursDe(lundi)
  const aPartirDe = jour > lundi ? jour : lundi
  if (aPartirDe > semaine[6]) throw new Error('Cette semaine est terminée.')
  const r = await lireReglages()
  // Semaine type à venir déjà commencée : elle devient la semaine type
  const fusion = fusionnerSemainesPassees(r.programme, lundiDe(jour))
  if (fusion !== r.programme) {
    // Le temps par semaine choisi pour cette date passe dans ton profil sportif
    const psAvant = (await db.reglages.get('profil-sportif'))?.valeur as Partial<ProfilSportif> | undefined
    const heuresNouvelles = heuresAu(r.programme, psAvant?.heuresSemaine, lundiDe(jour))
    if (psAvant && heuresNouvelles && heuresNouvelles !== psAvant.heuresSemaine) await enregistrer(db.reglages, { id: 'profil-sportif', valeur: { ...psAvant, heuresSemaine: heuresNouvelles } })
    const brut = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...brut, programme: fusion } })
  }
  // Semaine en cours déjà construite : ses réglages d'origine (un changement s'applique à partir de lundi prochain)
  const figes = lundi === lundiDe(jour) ? (await lireMeta(lundi))?.reglagesSemaine : undefined
  const progReglages = programmeAu(fusion, lundi)
  const prog = figes
    ? { ...progReglages, semaineType: figes.semaineType, maxSemaineMin: figes.maxSemaineMin, maxLongMin: figes.maxLongMin, ...(figes.minLongMin !== undefined ? { minLongMin: figes.minLongMin } : {}) }
    : progReglages
  const discipline = prog.discipline ?? 'route'
  // Profil sportif (questionnaire) : niveau et heures par semaine règlent le moteur
  const ps = (await db.reglages.get('profil-sportif'))?.valeur as Partial<ProfilSportif> | undefined
  const niveau = niveauDuProfil(ps)
  const heuresSemaine = figes ? figes.heuresSemaine : heuresAu(prog, ps?.heuresSemaine, lundi)
  const heures = heuresDe(heuresSemaine)

  // Anciennes séances à remplacer : séances auto encore à faire, plan importé et propositions de course (anciennes versions)
  for (const p of await db.prevues.where('date').aboveOrEqual(aPartirDe).toArray()) {
    if (p.statut !== 'prevue') continue
    // Une séance changée de jour à la main reste où elle est ; une séance reportée par le feu rouge aussi (26/11/2026 :
    // le recalcul l'effaçait et remettait l'intensité le jour rouge)
    const ancienne = (p.origine === 'auto' && p.date <= semaine[6] && !p.deplacee && !p.reporteeDu) || (p.sport === 'velo' && p.id.startsWith('plan-')) || (p.origine === 'propose' && p.sport === 'course')
    if (ancienne) await supprimer(db.prevues, p.id)
  }

  const c = await chargerContexte()
  const prevues = (await db.prevues.where('date').between(decalerJour(lundi, -1), decalerJour(lundi, 7), true, true).toArray()).filter(actives)
  const seances = await db.seances.where('date').between(decalerJour(lundi, -1), decalerJour(lundi, 7), true, true).toArray()
  const indispos = new Set((await db.indispos.where('date').between(lundi, semaine[6], true, true).toArray()).map((i) => i.date))
  // Vélo en panne : aucun vélo ces jours-là
  for (const d of await joursPanneVelo()) indispos.add(d)
  const dansSemaine = (d: string) => d >= lundi && d <= semaine[6]

  // Courses (A, B, C) : le jour même, la course seulement ; après une course longue (plus de 2 h), repos le lendemain
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  // Durée de chaque course (donnée, ou estimée par sa distance et son dénivelé) : délai après, sortie longue, kJ
  const facteurs = await facteursPersonnels(r)
  const dureeDe = (date: string) => {
    const x = prog.competitions.find((y) => y.date === date)
    return x ? dureeDeCourse(x, { discipline, typeCourse: prog.typeCourse, dureeCourseMin: prog.dureeCourseMin, cpW: r.cpW, poidsKg: poidsDesTests(r), facteurs }) : 90
  }
  const delaiCourse = (date: string) => delaiApresCourse(dureeDe(date))
  const coursesSemaine = prog.competitions.filter((x) => dansSemaine(x.date)).map((x) => ({ ...x, niveau: niveaux.get(x.date) ?? 'B' }))
  const courseFaite = (d: string) => seances.some((x) => x.date === d && x.sport === 'velo') || prevues.some((x) => x.date === d && x.statut === 'faite')
  for (const x of prog.competitions) {
    if (dansSemaine(x.date)) indispos.add(x.date)
    if (dureeDe(x.date) > 120 && dansSemaine(decalerJour(x.date, 1))) indispos.add(decalerJour(x.date, 1))
  }
  const courseSecondaire = coursesSemaine.find((x) => x.niveau !== 'A')
  const courseB = coursesSemaine.find((x) => x.niveau === 'B')

  // Jours occupés (une séance par jour) et séances dures (pour ne pas enchaîner deux jours durs)
  const occupations = [
    ...prevues.filter((p) => p.sport !== 'natation').map((p) => ({ date: p.date, dure: p.intensite === 'haute' })),
    // Le renfo occupe son jour mais n'en fait jamais un jour dur
    ...seances.filter((s) => s.sport !== 'natation').map((s) => ({ date: s.date, dure: s.sport !== 'renfo' && domaineDe(s, c.bornes) === 'haute' })),
  ].filter((o) => dansSemaine(o.date) || o.dure)

  // Ce qui est déjà fait (ou prévu à la main) cette semaine ; une séance rattrapée de la semaine d'avant occupe son jour
  // mais compte pour sa semaine d'origine (23/11/2026) : elle ne remplace ni la sortie longue ni l'intensité d'ici
  const idsRattrapees = new Set(prevues.filter((p) => p.rattrapageDe && !dansSemaine(p.rattrapageDe)).map((p) => p.id))
  const seancesSemaine = seances.filter((s) => !(s.prevueId && idsRattrapees.has(s.prevueId)))
  const veloSemaine = prevues.filter((p) => p.sport === 'velo' && dansSemaine(p.date) && !idsRattrapees.has(p.id))
  // Séance dure hors familles d'intervalles (départs XCO, simulation…) : elle compte aussi (19/11/2026 : refaite au recalcul)
  const intensiteFaite = veloSemaine.some((p) => estIntensiteSemaine(p) || p.velo?.famille === 'test') ||
    seancesSemaine.some((s) => s.sport === 'velo' && dansSemaine(s.date) && domaineDe(s, c.bornes) === 'haute')
  const longFaite = veloSemaine.some((p) => p.velo?.famille === 'z2-long' || (p.longue && p.statut === 'faite'))
  const z2Faites = veloSemaine.filter((p) => p.velo?.famille === 'z2').length
  const roles = prog.semaineType
  // Un 2e jour « dur » compte comme une Z2 (il devient la 2e intensité quand elle est possible)
  const nZ2 = Math.max(0, roles.filter((x) => x === 'velo-z2').length + Math.max(0, roles.filter((x) => x === 'velo-dur').length - 1) - z2Faites)
  const competitions = prog.competitions.map((x) => x.date)
  let dateTest = prog.testsCp.find((d) => dansSemaine(d) && d >= aPartirDe)
  // Test CP trop proche d'une course : la course le remplace si elle montre une CP au moins égale à la tienne
  // (Karsten 2015 : CP de terrain tirée des meilleurs 3, 7 et 12 min, ~5 % d'erreur), sinon il est décalé d'une semaine
  const phrasesTest: string[] = []
  const coursesDurees = prog.competitions.map((x) => ({ date: x.date, dureeMin: dureeDe(x.date) }))
  if (dateTest && testProcheCourse(dateTest, coursesDurees)) {
    const ancien = dateTest
    const courseFaiteAvant = prog.competitions.some((x) => x.date <= ancien && x.date >= decalerJour(ancien, -6) && courseFaite(x.date))
    const { estimerCp } = await import('../analyse/progres')
    const recentes = await db.seances.where('date').between(decalerJour(jour, -42), jour, true, true).toArray()
    const estimee = courseFaiteAvant ? estimerCp(recentes, jour) : undefined
    const reglagesE = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement
    const autres = prog.testsCp.filter((x) => x !== ancien)
    if (estimee && estimee >= r.cpW) {
      await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...reglagesE, cpW: estimee, programme: { ...reglagesE.programme, testsCp: autres }, tests: [...(reglagesE.tests ?? []), { date: jour, type: 'cp', valeur: estimee }] } })
      phrasesTest.push(`Test CP du ${nomJour(ancien)} remplacé par ta course : tes meilleurs efforts donnent une CP de ${estimee} W.`)
    } else {
      const nouvelle = decalerJour(ancien, 7)
      const garde = !testProcheCourse(nouvelle, coursesDurees) && !autres.includes(nouvelle)
      await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...reglagesE, programme: { ...reglagesE.programme, testsCp: [...autres, ...(garde ? [nouvelle] : [])].sort(), ...(reglagesE.programme.testsCourts?.includes(ancien) && garde ? { testsCourts: [...reglagesE.programme.testsCourts.filter((x) => x !== ancien), nouvelle] } : {}) } } })
      phrasesTest.push(`Test CP du ${nomJour(ancien)} trop près d'une course : ${garde ? `décalé au ${nomJour(nouvelle)}` : 'retiré cette fois'}.`)
    }
    dateTest = undefined
  }

  // Test complet (relecture du 15/11/2026) : il prend le jour et la place de la sortie longue de la semaine (jamais le
  // lendemain d'une longue : un test fait fatigué donne une CP fausse ; ~2 h avec l'échauffement, il fait le volume)
  const testComplet = !!dateTest && !prog.testsCourts?.includes(dateTest)
  // Test complet déjà fait cette semaine (recalcul en milieu de semaine, 19/11/2026) : il a fait la sortie longue ; avant,
  // le recalcul remettait une sortie longue et supprimait une endurance (celle de la séance au 1er seuil)
  const testCompletFait = !testComplet && veloSemaine.some((p) => p.velo?.famille === 'test' && p.statut === 'faite' && !/court/i.test(p.titre))
  if (testComplet) {
    const jourLong = semaine.find((d, i) => roles[i] === 'velo-long' && d >= aPartirDe && !indispos.has(d) && !occupations.some((o) => o.date === d))
    if (jourLong && !procheCourse(jourLong, competitions, delaiCourse)) dateTest = jourLong
  }
  // 48 h entre deux séances dures même d'une semaine à l'autre (audit du 18/11/2026, relu : Stanley 2013) : un test le
  // lendemain d'une séance dure (ex. sortie en côtes le dimanche, test le lundi) passe au 1er jour possible après
  if (dateTest && occupations.some((o) => o.dure && o.date === decalerJour(dateTest!, -1))) {
    const t = dateTest
    dateTest = semaine.find((d) => d > t && !indispos.has(d) && !occupations.some((o) => o.date === d || (o.dure && o.date === decalerJour(d, -1))) && !procheCourse(d, competitions, delaiCourse) && !testProcheCourse(d, coursesDurees))
  }
  // Course B ou C : elle est la séance dure de la semaine ; en B, ou si elle dure plus de 2 h, aussi la sortie longue
  const courseRemplaceLong = (!!courseSecondaire && (courseSecondaire.niveau === 'B' || dureeDe(courseSecondaire.date) > 120)) || testComplet || testCompletFait
  // Retour après au moins 10 jours sans vélo, même sans avoir ouvert l'appli (audit du 18/11/2026, relu : désentraînement
  // en 2 à 4 semaines, Mujika et Padilla 2000 ; 10 jours = choix d'entraîneur) : une semaine de reprise sans intensité ni test
  // Compté jusqu'à aujourd'hui, jamais jusqu'à une semaine future (19/11/2026 : une semaine construite à l'avance voyait
  // « 53 jours sans vélo » faute de séances futures, et devenait une reprise sans intensité ; toutes les suivantes
  // baissaient en cascade). Seulement pour la semaine en cours et la suivante : plus loin, rien ne dit qu'il y aura arrêt.
  const veloAvant = (await db.seances.where('date').between(decalerJour(jour, -60), jour, true, true).toArray()).filter((x) => x.sport === 'velo').map((x) => x.date).sort()
  const procheDAujourdhui = lundi <= decalerJour(lundiDe(jour), 7)
  const joursSansVelo = veloAvant.length && procheDAujourdhui ? ecartJours(veloAvant[veloAvant.length - 1], aPartirDe < jour ? aPartirDe : jour) : 0
  const retourArret = joursSansVelo >= 10 && !veloSemaine.some((p) => p.statut === 'faite') && !coursesSemaine.length
  if (retourArret) {
    dateTest = undefined
    phrasesTest.push(`${joursSansVelo} jours sans vélo : semaine de reprise, sans intensité, pour laisser ton corps se réhabituer.`)
  }
  // Phase, semaine allégée
  const { phase, semaine: nSemaine } = phaseDe(lundi, prog.phases)
  // Seule une course B allège la semaine (la A a son affûtage, la C laisse la semaine normale)
  const course = courseB
  // Affûtage et récupération : volume fixé en part du budget de référence (pas de semaine allégée en plus)
  const coefPhase = coefficientPhase(lundi, prog.phases, prog.competitions)
  const allegee = coefPhase === undefined && (estSemaineAllegee(lundi, prog.phases, semaineB(prog), await semainesPeuFaites(lundi)) || !!course)
  const raisonAllegee = course ? `semaine de ta course B (${course.nom}) : allégée d’un tiers, mêmes watts` : 'semaine allégée (1 sur 4)'
  // 1re séance dure faite, 2e possible : son jour (le jour « dur » de ta semaine type) reste réservé (19/11/2026 : il
  // restait vide au recalcul, et la 2e séance dure n'avait plus de jour)
  const dureFaite = veloSemaine.filter((p) => p.statut === 'faite' && estIntensiteSemaine(p))
  const deuxiemeAPlacer = !retourArret && intensiteFaite && dureFaite.length === 1 && !dateTest && !courseSecondaire
    && !['reprise', 'base', 'recuperation'].includes(phase.type) && !allegee
    && deuxIntensitesPossibles(niveau, roles.filter((x) => x.startsWith('velo')).length)
  const placement = placer(semaine, roles, occupations, indispos, aPartirDe, {
    competitions, delaiApresCourse: delaiCourse, dateTest, intensite: !retourArret && (!intensiteFaite || deuxiemeAPlacer) && (!courseSecondaire || dateTest !== undefined), long: !longFaite && !courseRemplaceLong,
    // Semaine du test complet : il est la séance dure et la sortie longue ; le jour « dur » devient une endurance
    nZ2: nZ2 + ((testComplet || testCompletFait) && !longFaite ? 1 : 0) + (retourArret ? 1 : 0),
  })
  // Ce jour-là devient une endurance ; la 2e séance dure le reprend plus bas si la semaine la permet
  const jourReserveDur = deuxiemeAPlacer ? placement.intensite : undefined
  if (deuxiemeAPlacer && placement.intensite) {
    placement.z2 = [...placement.z2, placement.intensite].sort()
    placement.intensite = undefined
  }
  // Pas de sortie longue la veille ou l'avant-veille d'une course : elle devient une Z2
  if (placement.long && procheCourse(placement.long, competitions, 0)) {
    placement.z2 = [...placement.z2, placement.long].sort()
    placement.long = undefined
  }

  const recuperation = phase.type === 'recuperation'
  const { w: z2W } = await z2Actuel()
  const maxDuJour = (d: string) => (roles[semaine.indexOf(d)] === 'velo-long' ? prog.maxLongMin : prog.maxSemaineMin)
  // Reprise progressive : durées des séances Z2 plafonnées les premières semaines (phase de reprise, ou retour après 3 semaines très légères)
  const parts = await partsRealisees(lundi)
  const coupure = retourArret ? { facteur: 1, semaineReprise: 0, raison: `${joursSansVelo} jours sans vélo : reprise en douceur` } : retourDeCoupure(semainesChamboulees(parts), semainesChamboulees(parts.slice(1)))
  // Charge habituelle (4 meilleures semaines d'affilée sur 12) : d'où tu repars, et la reprise part de tes durées
  const depart = await chargeDeDepart(lundi, prog.phases, z2W)
  const cap = plafondsReprise(phase.type === 'reprise' ? nSemaine : coupure.semaineReprise, prog.maxSemaineMin, prog.maxLongMin, depart?.facteur)
  const phrases: string[] = [...phrasesTest]

  // Séance d'intensité
  let intensite: SeanceConstruite | undefined
  const histo = await histoIntensite()
  // Saison calculée : la reprise est une base d'endurance, sans intensité (Z2, pédalage, sprints, blocs au 1er seuil)
  const repriseSansIntensite = prog.modele === 'chauvin' && phase.type === 'reprise'
  if (placement.intensite && (recuperation || repriseSansIntensite) && placement.intensite !== dateTest) {
    // Récupération après la course ou reprise : pas d'intensité, le jour prévu devient une Z2
    placement.z2 = [...placement.z2, placement.intensite].sort()
    placement.intensite = undefined
    phrases.push(recuperation ? 'Semaine de récupération après ta course : pas d’intensité.' : 'Reprise : base d’endurance, pas encore d’intensité.')
  } else if (placement.intensite) {
    if (placement.intensite === dateTest) {
      intensite = construireTest(r.cpW, prog.testsCourts?.includes(dateTest))
      intensite.velo.pourquoi = 'Test prévu : il recale toutes tes cibles en watts.'
    } else if (discipline === 'xco' && phase.type === 'specifique' && !allegee
      // Audit du 18/11/2026 (relu, choix d'entraîneur) : la simulation seulement 7 à 13 jours avant une course A (une par
      // bloc) ; avant, elle revenait chaque semaine de la phase
      && prog.competitions.some((x) => niveaux.get(x.date) === 'A' && ecartJours(placement.intensite!, x.date) >= 7 && ecartJours(placement.intensite!, x.date) <= 13)
      && [4, 3, 2].some((t) => construireSimulationXco(r.cpW, z2W, t).dureeMin <= maxDuJour(placement.intensite!) + 5)) {
      // Simulation de course XCO : autant de tours que ton créneau le permet (audit du 14/11/2026)
      intensite = [4, 3, 2].map((t) => construireSimulationXco(r.cpW, z2W, t)).find((x) => x.dureeMin <= maxDuJour(placement.intensite!) + 5)!
      intensite.velo.pourquoi = 'Proche de ta course · simulation de course XCO (7-10 jours avant)'
    } else if (discipline === 'xco' && phase.type === 'specifique' && !allegee && construireDepartsXco(r.cpW, z2W).dureeMin <= maxDuJour(placement.intensite) + 5) {
      // Les autres semaines de la phase spécifique : départs XCO (la course se joue souvent au départ)
      intensite = construireDepartsXco(r.cpW, z2W)
      intensite.velo.pourquoi = 'Proche de ta course · départs XCO : la course se joue souvent au départ'
    } else {
      let choix = choisirFormat(lundi, prog.phases, histo, discipline, 0, prog.typeCourse)
      // Jamais fait d'intervalles (relecture du 15/11/2026, choix d'entraîneur ; Milanović 2015 : le fractionné se tolère
      // bien) : 3 premières séances pour apprendre à doser, tempo, sweet spot puis 30/30, au palier le plus bas
      const apprises = histo.filter((h) => h.date < lundi).length
      if (ps?.intervalles === false && apprises < 3 && phase.type !== 'specifique' && phase.type !== 'affutage') {
        const fam = (['tempo', 'sweet-spot', 'vo2-courts'] as const)[apprises]
        const formats = formatsPour(fam, discipline)
        const format = formats.find((f) => f.id === '30-30') ?? formats[0]
        if (format) choix = { ...choix, famille: fam, format, dominante: fam === 'vo2-courts' ? 'vo2' : 'sous-seuil', palierImpose: 0 }
      }
      // Moins de 4 h par semaine : pas de sprints en séries, des blocs longs (Rosenblat 2020)
      if (choix.famille === 'sprints' && heures[1] <= 4) choix = { ...choix, famille: 'vo2-longs', format: formatsPour('vo2-longs', discipline)[0] }
      const etat = etatProgression(histo, datesTests(r.tests))[choix.famille]
      const impose = 'palierImpose' in choix ? choix.palierImpose : undefined
      const vise = impose ?? (allegee ? Math.max(0, etat.palier - 1) : etat.palier)
      const palierBrut = palierPossible(choix.format, vise, maxDuJour(placement.intensite))
      // Affûtage : mêmes watts, environ moitié moins de répétitions (Bosquet 2007 : intensité gardée)
      const affutage = phase.type === 'affutage'
      const palier = tenirDansCreneau(choix.format, affutage ? palierRaccourci(choix.format, palierBrut) : palierBrut, maxDuJour(placement.intensite))
      // Enduro : une semaine sur deux (hors reprise), les spéciales sur le terrain remplacent les intervalles
      // (le plus haut palier de spéciales qui tient dans ton créneau ; aucun : intervalles, audit du 14/11/2026)
      const palierSp = [3, 2, 1, 0].find((x) => x <= nSemaine >> 1 && construireSpeciales(x, r.cpW).dureeMin <= maxDuJour(placement.intensite!) + 5)
      const speciales = discipline === 'enduro' && phase.type !== 'reprise' && nSemaine % 2 === 1 && palierSp !== undefined
      intensite = speciales ? construireSpeciales(palierSp!, r.cpW) : construireIntervalles(choix.format, palier, r.cpW, etat.bonus, r.wPrimeKj)
      if (speciales) intensite.velo.pourquoi = `${NOMS_PHASES[phase.type]} · enduro : spéciales une semaine sur deux${allegee ? ` · ${raisonAllegee}` : ''}`
      else {
        const bonus = etat.bonus && !choix.format.aFond ? ` · ${etat.bonus > 0 ? '+' : ''}${(etat.bonus * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de watts (progression)` : ''
        intensite.velo.pourquoi =
          `${NOMS_PHASES[phase.type]} · séance ${choix.dominante === 'vo2' ? 'VO2' : choix.dominante === 'seuil' ? 'seuil' : 'sous le seuil'}${discipline !== 'route' ? ` · ${NOMS_DISCIPLINES[discipline]}` : ''} · palier ${palierBrut + 1}/4${bonus}` +
          (palierBrut < vise ? ' · palier réduit pour tenir dans ton créneau' : '') + (allegee ? ` · ${raisonAllegee}` : '') +
          (affutage ? ' · affûtage : mêmes watts, moins de répétitions' : '')
        // L'historique garde le palier atteint
        intensite.velo.palier = palierBrut
      }
    }
    // Une séance d'affûtage ne fait pas progresser (comme une semaine allégée)
    intensite.velo.allegee = allegee || phase.type === 'affutage'
  } else if (!intensiteFaite) {
    phrases.push('Pas de jour pour l’intensité vélo sans enchaîner deux jours durs (ou sans doubler une séance) : semaine en Z2.')
  }

  // Séance de course à la place de la sortie longue (relu le 6/11/2026), séance dure : pas de 2e intensité ces semaines-là.
  // Route en ligne : simulation de course semaines 1 et 3 du « proche de la course » ; cyclosportive : sortie longue +
  // montées en fin de sortie une semaine sur deux en fin de prépa, semaines 1 et 2 du « proche de la course ».
  const typeCourse = prog.typeCourse ?? 'cyclo'
  let longueCourseChoisie = discipline === 'route' && placement.long && !allegee
    ? typeCourse === 'en-ligne'
      // Phase spécifique : une séance « course » chaque semaine (relecture du 15/11/2026, principe de spécificité)
      ? phase.type === 'specifique' ? 'simulation-ligne' : undefined
      : phase.type === 'specifique' ? 'cyclo-montees' : undefined
    : undefined
  // Marathon VTT : la sortie longue en côtes compte comme une séance dure (48 h avant et après sans autre intensité)
  // Semaine de test CP : sortie longue normale (pas deux jours durs collés)
  let cotes = discipline === 'xcm' && phase.type !== 'reprise' && !allegee && !dateTest
  // Sortie longue dure (côtes, simulation, montées) : 48 h sans autre séance dure. L'intensité est déplacée sur une autre
  // endurance ; un test ou une course à côté, ou pas de jour pour déplacer : sortie longue normale (audit du 14/11/2026)
  if ((cotes || longueCourseChoisie) && placement.long) {
    const long = placement.long
    const colle = (d?: string) => !!d && Math.abs(ecartJours(d, long)) < 2 && d !== long
    if (placement.intensite && colle(placement.intensite) && placement.intensite !== dateTest) {
      // …et à 48 h de toute autre séance dure, y compris le dimanche d'avant (audit du 18/11/2026)
      const loin = placement.z2.find((d) => Math.abs(ecartJours(d, long)) >= 2 && !procheCourse(d, competitions, delaiCourse) && !occupations.some((o) => o.dure && Math.abs(ecartJours(o.date, d)) < 2))
      if (loin) {
        placement.z2 = [...placement.z2.filter((d) => d !== loin), placement.intensite].sort()
        placement.intensite = loin
      }
    }
    const durAcote = colle(placement.intensite) || colle(jourReserveDur) || colle(dateTest) || coursesSemaine.some((x) => colle(x.date))
      || occupations.some((o) => o.dure && colle(o.date))
    if (durAcote) { cotes = false; longueCourseChoisie = undefined }
  }

  // 2e intensité vélo (forme Chauvin) : 4 jours de vélo ou plus, sauf débutant, hors reprise et semaine allégée, et
  // seulement si la semaine n'a pas déjà de séance dure de course (2 séances dures au total par semaine)
  const joursVelo = roles.filter((x) => x.startsWith('velo')).length
  let intensite2: { date: string; s: SeanceConstruite } | undefined
  const courseDure = [...prevues.filter((p) => p.sport === 'course' && p.intensite === 'haute' && dansSemaine(p.date)).map((p) => p.date),
    ...seances.filter((x) => x.sport === 'course' && dansSemaine(x.date) && domaineDe(x, c.bornes) === 'haute').map((x) => x.date)]
  // La 1re séance dure déjà faite cette semaine (recalcul en milieu de semaine, chaque jour) : la 2e reste prévue
  // (19/11/2026 : avant, elle n'existait que si la 1re était encore à placer, et disparaissait au recalcul du mercredi)
  const premiereDure = intensite && placement.intensite && placement.intensite !== dateTest ? intensite.velo
    : !placement.intensite && !dateTest && dureFaite.length === 1 ? dureFaite[0].velo : undefined
  if (premiereDure && deuxIntensitesPossibles(niveau, joursVelo)
    && phase.type !== 'reprise' && phase.type !== 'base' && !allegee && !courseDure.length && !longueCourseChoisie && !coursesSemaine.length) {
    const dures = [...(placement.intensite ? [placement.intensite] : []), ...occupations.filter((o) => o.dure).map((o) => o.date), ...(cotes && placement.long ? [placement.long] : [])]
    const jour2 = jourDeuxiemeIntensite(placement.z2.filter((d) => !procheCourse(d, competitions, delaiCourse)), dures, placement.z2.filter((d) => roles[semaine.indexOf(d)] === 'velo-dur'))
    if (jour2) {
      // L'autre dominante de la phase : la première séance compte comme déjà faite
      const premier = premiereDure
      // Déjà faite : elle est dans l'historique ; à faire : comptée comme faite juste avant la semaine
      const histo2: HistoIntensite[] = dureFaite.length && !intensite ? histo : [...histo, { date: decalerJour(lundi, -1), famille: premier.famille as Famille, formatId: premier.formatId ?? '', palier: premier.palier ?? 0 }]
      const choix2 = choisirFormat(lundi, prog.phases, histo2, discipline, 1, prog.typeCourse)
      const etat2 = etatProgression(histo, datesTests(r.tests))[choix2.famille]
      // Affûtage (audit du 18/11/2026, relu : Bosquet 2007, Wang 2023) : la 2e séance dure raccourcie comme la 1re (moins
      // de répétitions, mêmes watts)
      const palier2Brut = palierPossible(choix2.format, etat2.palier, maxDuJour(jour2))
      const palier2 = phase.type === 'affutage' ? palierRaccourci(choix2.format, palier2Brut) : palier2Brut
      const s2 = construireIntervalles(choix2.format, tenirDansCreneau(choix2.format, palier2, maxDuJour(jour2)), r.cpW, etat2.bonus, r.wPrimeKj)
      if (phase.type === 'affutage') s2.velo.allegee = true
      s2.velo.pourquoi = `2e séance intensive de la semaine (${joursVelo} jours de vélo, pas de séance dure de course ; au moins 48 h après l'autre) · palier ${palier2Brut + 1}/4${phase.type === 'affutage' ? ' · affûtage : mêmes watts, moins de répétitions' : ''}`
      intensite2 = { date: jour2, s: s2 }
      placement.z2 = placement.z2.filter((d) => d !== jour2)
    }
  }

  // Budget kJ de la semaine
  const kjIntensite = (intensite?.kj ?? 0) + (intensite2?.s.kj ?? 0)
  // Sortie longue qui s'allonge vers la durée visée par ta course : le budget de référence suit
  const longue = await longueDeLaSemaine(lundi, prog, phase.type)
  // Plafond aussi limité par tes heures : le haut de ta tranche, moins les autres sports prévus cette semaine
  const minutesAutres = prevues.filter((p) => p.sport === 'course' && dansSemaine(p.date)).reduce((a, p) => a + p.dureeMin, 0)
  // Reprise, récupération : le jour « dur » devient une endurance ; le plafond le compte comme tel (audit du 17/11/2026)
  const rolesPlafond = kjIntensite === 0 ? roles.map((x) => (x === 'velo-dur' ? 'velo-z2' : x)) : roles
  const { nominal, plafond } = plafondEtNominal({ semaineType: rolesPlafond, kjIntensite, cap, z2W, sansLongue: !placement.long, longueVisee: longue.visee, heuresMax: heuresSemaine ? heures[1] : undefined, minutesAutres })
  // 26/11/2026 (demande de Titouan, relu : la dose = durée × intensité relative, Allen & Coggan, Sanders 2017) : ta
  // puissance d'endurance a changé (test CP, ajustement de ta Z2) → les kJ de la semaine d'avant sont remis à l'échelle,
  // pour garder les mêmes durées (sinon une CP en hausse raccourcissait tes séances). Dans les deux sens, ±15 % au plus.
  const precBrut = await bilanPrecedent(lundi)
  const zAvant = (await lireMeta(decalerJour(lundi, -7)))?.z2W
  const rapport = zAvant ? Math.min(1.15, Math.max(0.85, z2W / zAvant)) : 1
  const ech = (x: number) => Math.round(x * rapport)
  const prec = precBrut && rapport !== 1 ? {
    ...precBrut, budgetRef: ech(precBrut.budgetRef), kjPrevus: ech(precBrut.kjPrevus), kjRealises: ech(precBrut.kjRealises),
    ...(precBrut.budgetPrevu ? { budgetPrevu: ech(precBrut.budgetPrevu) } : {}), ...(precBrut.kjAVenir ? { kjAVenir: ech(precBrut.kjAVenir) } : {}),
  } : precBrut
  let b = coefPhase !== undefined
    ? budgetDePhase(prec, nominal, coefPhase, NOMS_PHASES[phase.type])
    : (avecCoupure(avecPlancher(budgetSemaine(prec, !prec && prog.budgetDepart ? prog.budgetDepart : Math.min(nominal, departSelonHeures(ps?.heuresRecentes, z2W) ?? Infinity), plafond, allegee, raisonAllegee, hausseSous(depart, prec, hausseBudget(niveau)), !prec && prog.budgetDepart ? 'Budget de départ : tes kJ des 4 semaines d’avant' : undefined), depart, prec, plafond, allegee), coupure))
  if (rapport !== 1 && coefPhase === undefined) b = { ...b, raison: `${b.raison} · kJ remis à ta puissance d’endurance (${rapport > 1 ? '+' : '−'}${Math.abs(Math.round((rapport - 1) * 100))} %, mêmes durées)` }
  // 25/11/2026 (demande de Titouan) : une semaine ne fait jamais plus de +10 % sur ce qui était vraiment prévu la semaine
  // d'avant (pas de bond le jour où tes créneaux s'ouvrent), sauf au retour d'une semaine allégée, d'affûtage ou de récup
  let remontee = false
  if (prec && !prec.allegee && !prec.reduite && prec.budgetPrevu && !allegee && coefPhase === undefined && b.budget > prec.budgetPrevu * 1.1) {
    remontee = true
    // Pendant la remontée, la référence attend (sinon elle s'envole loin de ce que tu fais vraiment)
    const cap = Math.round(prec.budgetPrevu * 1.1)
    b = { ...b, budget: cap, budgetRef: Math.max(cap, Math.min(b.budgetRef, prec.budgetRef)), raison: `${b.raison} · +10 % au plus sur ta semaine d’avant (${prec.budgetPrevu} kJ prévus)` }
  }
  // Recalcul en milieu de semaine (chaque jour, ou à la main) : le budget fixé à la construction de la semaine est gardé
  // (19/11/2026 : il était recalculé sur ce qui restait, une séance manquée faisait baisser la référence, et la semaine
  // suivante bondissait de 15 à 35 %). Les séances manquées ne sont pas rattrapées : leurs kJ sortent du reste à répartir.
  const ancienneMeta = await lireMeta(lundi)
  const milieu = !retourArret && aPartirDe > lundi && ancienneMeta?.version === 2 && !ancienneMeta.bilanProvisoire && !prec?.provisoire
  // Puissance d'endurance changée en cours de semaine (test CP) : budget fixé remis à l'échelle, mêmes durées
  const rapportSemaine = milieu && ancienneMeta!.z2W ? Math.min(1.15, Math.max(0.85, z2W / ancienneMeta!.z2W)) : 1
  const viseFixe = milieu ? Math.round((ancienneMeta!.budgetVise ?? ancienneMeta!.budget) * rapportSemaine) : undefined
  if (milieu) {
    const manques = veloSemaine.filter((p) => p.date < aPartirDe && p.statut !== 'faite' && p.origine === 'auto').reduce((t, p) => t + (p.kjPrevu ?? 0), 0)
    b = { ...b, budgetRef: Math.round(ancienneMeta!.budgetRef * rapportSemaine), budget: Math.max(0, viseFixe! - manques), raison: ancienneMeta!.raison.replace(/ · tes séances clés.*$/, '') }
  }

  // Répartition du reste du budget en Z2 : 60 % pour la sortie longue
  const kjFaits = seancesSemaine.filter((s) => s.sport === 'velo' && dansSemaine(s.date)).reduce((a, s) => a + (s.kj ?? 0), 0)
  const kjAutresPrevus = veloSemaine.filter((p) => p.statut === 'prevue').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  // La course dans le plan (pas encore faite) : ses kJ estimés comptent dans la semaine
  const coursesAPrevoir = coursesSemaine.filter((x) => x.date >= aPartirDe && !courseFaite(x.date)).map((x) => [x.date, construireCourse(x.nom, x.niveau, dureeDe(x.date), r.cpW)] as [string, SeanceConstruite])
  // Veille d'une course B : petit rappel d'intensité (facultatif) à la place de la Z2 prévue ce jour-là.
  // Course A (relecture du 15/11/2026 : volume en baisse, intensité et fréquence gardées, Bosquet 2007, Wang 2023 ;
  // jours = choix d'entraîneur) : repos à J-2, ouverture à J-1 même si ce n'était pas un jour de vélo
  const courseA = coursesSemaine.find((x) => x.niveau === 'A' && x.date >= aPartirDe)
  if (courseA) placement.z2 = placement.z2.filter((d) => d !== decalerJour(courseA.date, -2))
  const veilleA = courseA && decalerJour(courseA.date, -1) >= aPartirDe && semaine.includes(decalerJour(courseA.date, -1))
    && !indispos.has(decalerJour(courseA.date, -1)) && !occupations.some((o) => o.date === decalerJour(courseA.date, -1)) && placement.intensite !== decalerJour(courseA.date, -1)
    ? decalerJour(courseA.date, -1) : undefined
  const veilleB = veilleA ?? (courseB && placement.z2.includes(decalerJour(courseB.date, -1)) ? decalerJour(courseB.date, -1) : undefined)
  const ouverture = veilleB ? construireOuverture(z2W, r.cpW) : undefined
  if (veilleB) placement.z2 = placement.z2.filter((d) => d !== veilleB)
  const kjCourses = coursesAPrevoir.reduce((a, [, x]) => a + x.kj, 0) + (ouverture?.kj ?? 0)
  // Semaine d'une course A (audit du 18/11/2026, relu : Bosquet 2007, Wang 2023) : l'entraînement baisse d'environ 50 %,
  // la course est comptée à part (avant, elle mangeait le budget et l'entraînement baissait de 75 à 80 %)
  const kjCourseA = phase.type === 'affutage' ? coursesSemaine.filter((x) => x.niveau === 'A').reduce((a, x) => a + construireCourse(x.nom, x.niveau, dureeDe(x.date), r.cpW).kj, 0) : 0
  if (kjCourseA) b = { ...b, budget: b.budget + kjCourseA, raison: `${b.raison} · + ta course` }
  const reste = Math.max(0, b.budget - kjFaits - kjAutresPrevus - kjIntensite - kjCourses)
  const partLong = placement.long ? (placement.z2.length ? 0.6 : 1) : 0
  const borner = (min: number, max: number, v: number) => Math.min(max, Math.max(min, arrondi5(v)))
  const nLongs = (await db.prevues.toArray()).filter((p) => p.velo?.famille === 'z2-long' && p.statut === 'faite' && p.date < lundi).length
  // Séance technique VTT : le thème tourne sur 4 semaines (séances techniques d'avant, faites ou prévues)
  const nTerrain = (await db.prevues.toArray()).filter((p) => p.velo?.famille === 'vtt-terrain' && p.date < lundi && p.statut !== 'abandonnee').length
  // kJ par minute de tes 3 dernières séances techniques faites (avec puissance)
  const idsTerrain = new Set((await db.prevues.toArray()).filter((p) => p.velo?.famille === 'vtt-terrain' && p.statut === 'faite').map((p) => p.id))
  const techFaites = (await db.seances.toArray()).filter((x) => x.prevueId && idsTerrain.has(x.prevueId) && x.kj && x.dureeSec > 600).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const kjParMinTech = techFaites.length ? techFaites.reduce((t, x) => t + x.kj! / (x.dureeSec / 60), 0) / techFaites.length : undefined

  const aCreer: [string, SeanceConstruite][] = []
  if (placement.intensite && intensite) aCreer.push([placement.intensite, intensite])
  aCreer.push(...coursesAPrevoir)
  if (veilleB && ouverture) aCreer.push([veilleB, ouverture])
  if (intensite2) aCreer.push([intensite2.date, intensite2.s])

  // Forme Chauvin (relue le 6/11/2026) : blocs au 1er seuil dans la sortie longue (pas en 1re semaine de reprise, ni en
  // affûtage / récupération), sprints à fond une fois par semaine (dans une Z2, sinon dans la sortie longue),
  // rappel au 1er seuil le lendemain d'une séance intensive (confirmé et plus)
  const sv1 = await sv1Actuel(z2W)
  // La limite Z2 / Z3 suit ton 1er seuil (les blocs au 1er seuil restent en haut de la Z2, jamais en Z3)
  const reglagesE = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  const zones = reglagesE?.zonesVelo
  if (reglagesE && zones && zones[1] && zones[2] && zones[1].wMax !== sv1.w && sv1.w > zones[1].wMin && (zones[2].wMax === undefined || sv1.w < zones[2].wMax)) {
    const nouvelles = zones.map((z, i) => (i === 1 ? { ...z, wMax: sv1.w } : i === 2 ? { ...z, wMin: sv1.w } : z))
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...reglagesE, zonesVelo: nouvelles } })
  }
  const sansBlocs = (phase.type === 'reprise' && nSemaine === 0) || phase.type === 'affutage' || phase.type === 'recuperation' || coupure.semaineReprise === 0
  // Semaine allégée : un cran de moins. Si le palier ne rentre pas dans la sortie, le plus haut qui rentre
  const nPalier = allegee ? Math.max(0, sv1.palier - 1) : sv1.palier
  // Plage de FC des blocs (les watts suivent le cœur) : FC du 1er seuil = haut de ta Z2 de FC
  const fcSv1 = plageFcSv1({ fcMax: c.fcMax, fcSeuil1: c.bornes[1], nFaites: sv1.nFaites, debutant: niveau === 'debutant' })
  // Sortie longue selon la phase (relecture du 15/11/2026, choix d'entraîneur) : blocs au 1er seuil en base et en
  // reprise ; phases seuil, VO2 et entretien = 1 × 15′ au plus (sinon la longue devient une 3e séance dure) ;
  // spécifique = les efforts de la course (ou Z2) ; semaine allégée = Z2 seule, plus courte
  const longueLegere = ['seuil-tirage', 'seuil-maintien', 'fin-prepa', 'entretien'].includes(phase.type)
  const palierSv1 = longueLegere
    ? { reps: 1, min: 15, repli: [], fc: fcSv1 }
    : { ...BLOCS_SV1[nPalier], repli: BLOCS_SV1.slice(0, nPalier).reverse(), fc: fcSv1 }
  const blocsDansLongue = !sansBlocs && !allegee && phase.type !== 'specifique'
  const sprints = sprintsDeLaPhase(phase.type, discipline, nLongs)
  const intensifs = [placement.intensite, intensite2?.date].filter((d): d is string => !!d)
  const lendemains = new Set(intensifs.map((d) => decalerJour(d, 1)))
  // Technique VTT déjà faite (ou manquée : pas rattrapée) cette semaine : pas une 2e au recalcul (19/11/2026 : elle prenait
  // le dernier jour d'endurance, et la séance au 1er seuil sautait)
  const toutesSemaine = (await db.prevues.where('date').between(lundi, semaine[6], true, true).toArray()).filter((p) => p.sport === 'velo' && p.statut !== 'abandonnee')
  const terrainFait = toutesSemaine.some((p) => (p.statut === 'faite' || p.date < aPartirDe) && p.velo?.famille === 'vtt-terrain')
  const terrain = discipline !== 'route' && !terrainFait ? placement.z2[0] : undefined
  // Cycle 1er seuil : une séance dédiée au 1er seuil par semaine, sur un jour d'endurance, à 48 h au moins du rappel VO2
  // si possible (relu le 13/11/2026), sinon pas le lendemain d'une intensité
  const loinDesIntensifs = (d: string) => intensifs.every((i) => Math.abs(ecartJours(d, i)) >= 2)
  // Débutant à 3 sorties (audit du 18/11/2026, relu : polarisé, choix d'entraîneur) : avec une seule endurance dans la
  // semaine, elle reste facile (pas de séance dédiée au 1er seuil : sinon 2 séances soutenues sur 3)
  // Compté sur toute la semaine (semaine type), pas sur les jours qui restent (19/11/2026 : recalculée un jeudi soir, il ne
  // restait qu'une endurance et la séance au 1er seuil du vendredi devenait une Z2 + sprints) ; jamais deux fois la même semaine
  const enduranceSemaine = roles.filter((x) => x === 'velo-z2').length + Math.max(0, roles.filter((x) => x === 'velo-dur').length - 1)
  const sv1DejaFaite = (await db.prevues.where('date').between(lundi, semaine[6], true, true).toArray())
    // Toute séance au 1er seuil encore là (faite, manquée, ou déplacée à la main, gardée par le recalcul) : pas une 2e
    // (24/11/2026 : une séance déplacée au jeudi n'était pas vue, le recalcul en ajoutait une le mercredi)
    .some((p) => p.sport === 'velo' && p.statut !== 'abandonnee' && !idsRattrapees.has(p.id) && p.titre.startsWith('Cycle 1er seuil'))
  // Semaine allégée (19/11/2026, choix de Titouan) : la séance au 1er seuil reste, un cran en dessous (volume en baisse,
  // intensité gardée)
  const jourSv1 = phase.type === 'base' && !sansBlocs && enduranceSemaine >= 2 && placement.z2.length >= 1 && !sv1DejaFaite
    ? [...placement.z2].reverse().find((d) => d !== terrain && loinDesIntensifs(d)) ?? [...placement.z2].reverse().find((d) => d !== terrain && !lendemains.has(d)) ?? placement.z2.find((d) => d !== terrain)
    : undefined
  const jourSprints = placement.z2.find((d) => d !== terrain && d !== jourSv1 && !lendemains.has(d)) ?? placement.z2.find((d) => d !== terrain && d !== jourSv1)
  const rappel = niveau === 'confirme' || niveau === 'expert'

  // Cycle 1er seuil : la séance dédiée peut dépasser ton créneau de semaine (jusqu'à 50 min de plus, 2 h 05 au plus)
  // pour que la progression aille jusqu'à 5 × 20′ ou 3 × 30′ (choix d'entraîneur, validé par Titouan le 10/11/2026)
  // Séance dédiée au 1er seuil : dans ton créneau, 10 min de plus au plus (13/11/2026) ; les blocs plus longs se font
  // dans la sortie longue
  let seanceSv1 = jourSv1 ? construireSv1Dediee(allegee ? Math.max(0, sv1.palierDedie - 1) : sv1.palierDedie, maxDuJour(jourSv1) + 10, sv1.w, z2W, fcSv1) : undefined
  // Tranche d'heures (audit du 14/11/2026) : tests, séances dures et 1er seuil d'abord, puis la sortie longue et les
  // endurances se partagent ce qui reste (30 min au moins par endurance, 1 h au moins pour la sortie longue)
  // Semaine trop courte pour tout (ex. semaine de test avec moins de 4 h) : pas de séance dédiée au 1er seuil cette fois
  const fixesSansSv1 = aCreer.filter(([, x]) => x.velo.famille !== 'course').reduce((t, [, x]) => t + x.dureeMin, 0)
  if (seanceSv1 && heuresSemaine && fixesSansSv1 + seanceSv1.dureeMin + 30 * placement.z2.filter((d) => d !== jourSv1).length + (placement.long ? 60 : 0) > heures[1] * 60) seanceSv1 = undefined
  let nZ2Restants = placement.z2.filter((d) => !(d === jourSv1 && seanceSv1)).length
  const minutesFixes = fixesSansSv1 + (seanceSv1?.dureeMin ?? 0)
  /**
   * Sortie longue et endurances de la semaine. `reduction` (0 à 2, audit des chiffres du 17/11/2026, décision de Titouan) :
   * quand les séances à leur durée habituelle dépassent le budget, la sortie longue raccourcit d'abord, les endurances un
   * peu ; au-delà de 1, les endurances continuent de raccourcir. Planchers (24/11/2026, choix de Titouan) : 60 min pour la
   * sortie longue, 30 min pour une endurance (5′ de mise en route, 20′ de Z2, 5′ de retour au calme) ; si la semaine ne
   * rentre toujours pas, une endurance simple de moins (une au plus) : mêmes kJ, donc même progression, en sorties utiles.
   */
  const LONGUE_MIN = 60, Z2_MIN = 30
  const construireEndurances = (reduction = 0, avecPhrases = true) => {
  const liste: [string, SeanceConstruite][] = []
  let minutesDispo = heuresSemaine ? heures[1] * 60 - minutesFixes : Infinity
  let extraSv1 = 0
  let longueCourse = longueCourseChoisie
  const reduire = (min: number, plancher: number, part: number) => (min <= plancher ? min : Math.max(plancher, arrondi5(min - part * (min - plancher))))
  const partLongue = Math.min(1, reduction)
  const partZ2 = reduction <= 1 ? 0.4 * reduction : 0.4 + 0.6 * (reduction - 1)
  if (placement.long) {
    const kjLong = reste * partLong
    // Cycle 1er seuil : blocs dans la sortie longue en plus de la séance dédiée, même à 4 jours (13/11/2026 : 2 séances au 1er seuil par semaine)
    let blocs = blocsDansLongue && !cotes && !longueCourse ? { w: sv1.w, ...palierSv1 } : undefined
    // Les blocs au 1er seuil coûtent plus de kJ par minute : ce surplus est pris sur les Z2 de semaine, pas sur la
    // durée de la sortie longue (sinon plus le palier monte, plus la sortie raccourcit et les blocs ne rentrent plus)
    // Semaine allégée, affûtage, récupération : la sortie longue peut descendre sous son minimum habituel
    // Près de la course, sortie longue plafonnée en XCO (2 h 30) et en short track (2 h) ; au moins 3 h en cyclosportive
    // Affûtage : dernière vraie sortie longue à ~55 % de la durée visée, semaine de course 90 min au plus
    // (relecture du 9/11/2026 : volume en baisse, intensité gardée, Bosquet 2007 ; durées = choix d'entraîneur)
    const semaineCourse = prog.competitions.some((x) => x.date >= lundi && x.date <= semaine[6])
    const affutage = phase.type === 'affutage' && longue.cible ? (semaineCourse ? Math.min(90, longue.cible) : arrondi5(longue.cible * 0.55)) : undefined
    const capLong = Math.max(Math.min(60, cap.long), Math.min(affutage ?? Infinity, longue.plafond10 ?? Infinity, minutesDispo - 30 * nZ2Restants, phase.type === 'specifique' && discipline === 'xco' ? Math.min(cap.long, 150) : phase.type === 'specifique' && discipline === 'xcc' ? Math.min(cap.long, 120) : cap.long))
    // Simulation de course plus longue que ta sortie longue possible : sortie longue normale (audit du 14/11/2026)
    if (longueCourse === 'simulation-ligne' && construireSimulationLigne(r.cpW, z2W, capLong).dureeMin > capLong + 5) {
      longueCourse = undefined
      blocs = blocsDansLongue && !cotes ? { w: sv1.w, ...palierSv1 } : undefined
    }
    const minLong = Math.min(capLong, Math.max(longueCourse === 'cyclo-montees' ? 180 : prog.minLongMin, longue.visee ?? 0))
    const minHabituel = affutage
      ? borner(Math.min(affutage, capLong), capLong, minutesPourKj(kjLong, z2W))
      : borner(minLong * (coefPhase ?? (allegee ? 0.7 : 1)), capLong, minutesPourKj(kjLong, z2W))
    if (longue.visee && longue.cible && longue.cible > prog.maxLongMin && !allegee)
      (avecPhrases ? phrases : []).push(`Ta course demande une sortie longue d'environ ${heuresMin(longue.cible)} ; ton maximum est ${heuresMin(prog.maxLongMin)} : allonge-le dans Réglages (Ma semaine type) si tu peux.`)
    // Conseil (pas une règle, relecture du 15/11/2026) : entre 8 et 3 semaines avant la course A, 2 sorties d'au moins 75 %
    // de la durée de course quand ta sortie longue habituelle n'y arrive pas
    const coursA = prog.competitions.filter((x) => x.date > lundi && niveaux.get(x.date) === 'A').sort((x, y) => x.date.localeCompare(y.date))[0]
    if (coursA && !allegee) {
      const avant = ecartJours(lundi, coursA.date)
      const visee75 = arrondi5(0.75 * dureeDe(coursA.date))
      if (avant >= 21 && avant <= 56 && visee75 > capLong && visee75 > 120)
        (avecPhrases ? phrases : []).push(`D'ici 3 semaines avant ta course, prévois 2 sorties d'au moins ${heuresMin(visee75)} (75 % de ta course) un jour où tu as le temps : ta sortie longue habituelle n'y arrive pas.`)
    }
    if (longueCourse === 'cyclo-montees' && capLong < 180) (avecPhrases ? phrases : []).push('Ta sortie longue maximale est sous 3 h : la sortie avec montées en fin de sortie sera plus courte que conseillé pour une cyclosportive.')
    // Marathon VTT (hors reprise et semaine allégée) : sortie longue en côtes
    const courseProche = prog.competitions.some((x) => x.date >= lundi && x.date <= decalerJour(lundi, 20))
    // La sortie longue reste la plus longue de la semaine (audit du 18/11/2026) : réduite, jamais sous la plus longue des
    // autres séances
    const plusLongueAutre = Math.max(0, ...aCreer.filter(([, x]) => x.velo.famille !== 'course').map(([, x]) => x.dureeMin), seanceSv1?.dureeMin ?? 0)
    const min = reduire(minHabituel, Math.min(Math.max(LONGUE_MIN, plusLongueAutre), minHabituel), partLongue)
    liste.push([placement.long, longueCourse === 'simulation-ligne'
      ? construireSimulationLigne(r.cpW, z2W, reduction > 0 ? min : capLong)
      : longueCourse === 'cyclo-montees'
        ? (() => {
          // Cols de ta prochaine course A : nombre et durée des montées calés dessus (sinon 2-3 montées de 20-25')
          const aVenir = prog.competitions.filter((x) => x.date >= lundi && niveaux.get(x.date) === 'A').sort((x, y) => x.date.localeCompare(y.date))[0]
          const spec = specifiqueCols(aVenir?.cols, r.cpW, poidsDesTests(r))
          if (!spec) return construireCycloMontees(min, z2W, r.cpW, min >= 240 ? 3 : 2, phase.type === 'specifique' && nSemaine === 1 ? 25 : 20)
          const minutes = phase.type === 'specifique' ? spec.minutes : Math.min(spec.minutes, Math.max(20, Math.min(30, 20 + 5 * nSemaine)))
          return construireCycloMontees(min, z2W, r.cpW, spec.n, minutes)
        })()
        : cotes
      ? construireLongueCotes(min, z2W, r.cpW, cotesDe(nLongs, courseProche))
      : construireZ2(min, z2W, jourSprints || blocs ? undefined : sprints, { longue: true, sv1: blocs, espacementSec: sprints.espacementSec })])
    const sl = liste[liste.length - 1][1]
    minutesDispo -= sl.dureeMin
    // Ce que la sortie longue prend au-delà de sa part (blocs au 1er seuil, allongement) est pris sur les Z2 de semaine
    extraSv1 = Math.max(0, sl.kj - kjLong)
  }
  placement.z2.forEach((d) => {
    // Séance 1er seuil allongée au-delà de ton créneau : les autres endurances peuvent descendre à 30 min pour compenser
    const minZ2 = seanceSv1 && seanceSv1.dureeMin > maxDuJour(jourSv1!) ? 30 : 45
    const maxZ2 = Math.max(30, Math.min(maxDuJour(d), cap.z2, nZ2Restants ? Math.floor(minutesDispo / nZ2Restants / 5) * 5 : Infinity))
    const min = reduire(borner(Math.min(minZ2, cap.z2, maxZ2), maxZ2, minutesPourKj((reste * (1 - partLong) - extraSv1) / placement.z2.length, z2W)), Z2_MIN, partZ2)
    // VTT : la première Z2 de la semaine se fait sur le terrain (technique), jamais la sortie longue
    if (d === jourSv1 && seanceSv1) liste.push([d, seanceSv1])
    else if (d === terrain && discipline !== 'route') liste.push([d, construireTerrain(discipline, min, z2W, nTerrain, kjParMinTech)])
    else if (d === jourSprints) liste.push([d, construireZ2(min, z2W, sprints, { longue: false, espacementSec: sprints.espacementSec })])
    else liste.push([d, construireZ2(min, z2W, undefined, lendemains.has(d) && rappel && !sansBlocs ? { sv1: { w: sv1.w, reps: 2, min: 10, fc: fcSv1 } } : {})])
  })
  return liste
  }

  // Le budget commande la semaine : à leur durée habituelle, les séances dépassent-elles le budget ?
  const kjAvant = kjFaits + kjAutresPrevus + aCreer.reduce((a, [, x]) => a + x.kj, 0)
  const totalAvec = (l: [string, SeanceConstruite][]) => kjAvant + l.reduce((a, [, x]) => a + x.kj, 0)
  let endurances = construireEndurances()
  // Toute première semaine sans historique : la semaine type à ses durées habituelles devient le point de départ
  const premiere = !prec && !prog.budgetDepart
  if (!premiere && totalAvec(endurances) > b.budget * 1.02 && endurances.length) {
    // Plus petite réduction qui fait rentrer la semaine dans le budget (recherche par dichotomie, 12 essais)
    let bas = 0, haut = 2
    if (totalAvec(construireEndurances(2, false)) > b.budget) bas = 2
    else for (let i = 0; i < 12; i++) {
      const m = (bas + haut) / 2
      if (totalAvec(construireEndurances(m, false)) > b.budget) bas = m
      else haut = m
    }
    endurances = construireEndurances(bas >= 2 ? 2 : haut)
    // Toujours trop aux planchers : une endurance simple de moins (d'abord le lendemain d'une séance dure), une au plus ;
    // jamais la sortie longue, la séance dure, la séance au 1er seuil ni la technique VTT
    const retirables = placement.z2.filter((d) => d !== jourSv1 && d !== jourSprints && d !== terrain)
    // Jamais en semaine allégée, affûtage ou récupération : moins de kJ y est voulu (25/11/2026)
    if (bas >= 2 && !allegee && coefPhase === undefined && totalAvec(endurances) > b.budget * 1.02 && retirables.length) {
      const d = retirables.find((x) => lendemains.has(x)) ?? retirables[retirables.length - 1]
      placement.z2 = placement.z2.filter((x) => x !== d)
      nZ2Restants = placement.z2.filter((x) => !(x === jourSv1 && seanceSv1)).length
      let lo = 0, hi = 2
      if (totalAvec(construireEndurances(2, false)) > b.budget) lo = 2
      else for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (totalAvec(construireEndurances(m, false)) > b.budget) lo = m; else hi = m }
      endurances = construireEndurances(lo >= 2 ? 2 : hi)
      phrases.push('Budget trop bas pour toutes tes endurances à 30 min au moins : une sortie de moins cette semaine (jour de repos), mêmes kJ.')
    }
  }
  aCreer.push(...endurances)

  // Genoux sensibles : pédaler souple, la charge sur le genou baisse quand la cadence monte (Kutzner 2012 ; résultats mitigés)
  const genoux = /genou/i.test(ps?.pointsSensibles ?? '')
  // Veille d'une course courte et très dure (XCO, XCC, course en ligne) : rappel de l'échauffement de course (Bailey 2009)
  const veilleCourse = (d: string) => prog.competitions.some((x) => x.date === decalerJour(d, 1) && ['xco', 'xcc', 'en-ligne'].includes(x.epreuve ?? epreuveDe(discipline, typeCourse)))
  for (const [date, s] of aCreer) {
    if (veilleCourse(date)) s.detail = `${s.detail}\nDemain, ta course : échauffement de 15' progressif, 5-6' à 90-100 % de ta CP, puis au moins 10' faciles avant le départ.`
    s.velo.allegee = s.velo.allegee || allegee
    await enregistrer(db.prevues, {
      id: await idAuto(date, 'velo'), date, sport: 'velo', titre: s.titre, detail: genoux && s.detail ? `${s.detail}\n${NOTE_GENOUX}` : s.detail, dureeMin: s.dureeMin, kjPrevu: s.kj,
      statut: 'prevue', origine: 'auto', velo: s.velo, ...champsVelo(s),
    } satisfies SeancePrevue)
  }

  // Muscu reliée à l'Entraînement (13/11/2026) : un jour sans vélo, jamais la veille d'une séance clé
  const force = figes ? figes.force : (await db.reglages.get('force'))?.valeur as ReglagesForce | undefined
  // Mineur (19/11/2026, choix de Titouan) : pas de muscu lourde sans encadrement ni accord d'un parent (Faigenbaum 2009)
  const profilMuscu = (await db.reglages.get('profil'))?.valeur as Profil | undefined
  if (force?.actif && !(profilMuscu && estMineur(profilMuscu, jour))) {
    // Le programme avance avec les semaines vraiment faites ; un arrêt se rattrape (charges et reprise)
    // Semaines à venir construites à l'avance : les séances prévues d'ici là comptent comme faites (comme le vélo à 100 %)
    const faitesAvant = (await db.prevues.where('date').below(lundi).toArray()).filter((p) => p.muscu && (p.statut === 'faite' || (p.statut === 'prevue' && p.date >= jour))).sort((a, b) => a.date.localeCompare(b.date))
    const semainesFaites = new Set(faitesAvant.map((p) => lundiDe(p.date))).size
    const derniere = faitesAvant.at(-1)
    const semainesSans = derniere ? Math.max(0, Math.round(ecartJours(lundiDe(derniere.date), lundi) / 7) - 1) : 0
    const plan = planForce({ semainesFaites, semainesSans, repriseEnCours: !!derniere?.muscu?.longue && semainesSans === 0, phase: phase.type, allegee, seancesVoulues: force.seances, apprentissage: semainesApprentissage(force.experience) })
    const muscuSemaine = (await db.prevues.where('date').between(decalerJour(lundi, -1), semaine[6], true, true).toArray()).filter((p) => p.sport === 'renfo' && p.muscu && p.date >= lundi)
    const faitesForce = muscuSemaine.filter((p) => p.statut === 'faite').length
    // Muscu déjà là cette semaine (faite, ou déplacée à la main et gardée) : comptée, et son jour n'est plus proposé
    const gardees = muscuSemaine.filter((p) => p.statut === 'faite' || (p.statut === 'prevue' && p.date >= aPartirDe))
    // La muscu du dimanche d'avant compte pour l'écart de 2 jours (pas de muscu dimanche puis lundi)
    const dimancheAvant = (await db.prevues.where('date').equals(decalerJour(lundi, -1)).toArray()).filter((p) => p.sport === 'renfo' && p.muscu && p.statut !== 'abandonnee').map((p) => p.date)
    const cles = [placement.intensite, intensite2?.date, placement.long, dateTest, ...competitions].filter((d): d is string => !!d)
    const jours = joursMuscu({
      roles, dates: semaine, n: plan.seances - gardees.length, avant: aPartirDe, deja: [...dimancheAvant, ...gardees.map((p) => p.date)], cles, durs: [placement.intensite, intensite2?.date].filter((d): d is string => !!d && d !== dateTest),
      courses: prog.competitions.map((x) => x.date), indispos: [...indispos], velo: aCreer.map(([d]) => d),
    })
    const dejaFaites = faitesAvant.length + faitesForce
    for (const [k, j] of jours.entries()) {
      // 2e séance ailleurs si tu l'as choisi (1 salle + 1 maison) ; soulevé et leg curl en alternance (15/11/2026)
      const lieu = k === 1 && force.lieu2 ? force.lieu2 : force.lieu
      const series = j.reduite ? Math.min(2, plan.series) : plan.series
      const sf: SeanceForce = {
        periode: plan.periode, semaine: plan.semaine, series, reps: plan.reps, lieu, legere: plan.legere, soir: j.soir,
        variante: (dejaFaites + k) % 2 === 0 ? 'souleve' : 'curl', ...(j.reduite ? { reduite: true } : {}), ...(genoux ? { genoux: true } : {}), ...(discipline !== 'route' ? { vtt: true } : {}),
        ...(plan.facteur ? { facteur: plan.facteur } : {}), ...(plan.longue ? { longue: true } : {}),
      }
      await enregistrer(db.prevues, {
        id: await idAuto(j.date, 'muscu'), date: j.date, sport: 'renfo', titre: `Muscu · ${NOMS_PERIODES[plan.periode]}${j.reduite ? ' (réduite)' : ''}`,
        detail: `${series} × ${plan.reps} répétitions${plan.legere ? ' légères' : ' lourdes'} · ${exosDe(sf).length} exercices + prévention${lieu !== force.lieu ? (lieu === 'maison' ? ' · à la maison' : ' · en salle') : ''}${plan.facteur ? ` · reprise : charges à ${Math.round(plan.facteur * 100)} %` : ''}${j.soir ? ' · le soir, 3 h après le vélo au moins' : ''}${j.reduite ? ' · version réduite : demain, séance clé' : ''}`,
        dureeMin: dureeForce(sf), intensite: 'moyenne', priorite: 'normale', statut: 'prevue', origine: 'auto', muscu: sf,
      } satisfies SeancePrevue)
    }
  }

  // Audit des chiffres (17/11/2026) : le budget affiché est le total des séances prévues, un seul chiffre partout.
  // Écart avec le budget calculé : dit dans la raison (créneaux trop courts, ou séances clés qui le dépassent à elles seules)
  const total = Math.round(kjFaits + kjAutresPrevus + aCreer.reduce((a, [, s]) => a + s.kj, 0))
  const limite = !premiere && total < b.budget * 0.95
  const depasse = !premiere && total > b.budget * 1.02
  const raison = premiere ? 'Point de départ : ta semaine type à ses durées habituelles' : b.raison.includes('limité par tes créneaux') ? b.raison : limite ? `${b.raison} · limité par tes créneaux et jours libres (${b.budget} kJ visés)`
    : depasse ? `${b.raison} · tes séances clés dépassent à elles seules le budget visé (${b.budget} kJ)` : b.raison
  // Référence pour la semaine suivante (25/11/2026, demande de Titouan) : elle ne baisse que si tu fais moins (bilan).
  // Semaine limitée par tes créneaux : la référence est gardée sans monter (avant, elle tombait à ce qui avait pu être
  // placé, −6 à −10 % à chaque fois) ; la semaine d'après fait au plus +10 % sur ce qui était prévu (voir plus haut).
  // Semaine allégée ou réduite (affûtage, récupération) : on garde la référence d'avant, on y revient ensuite
  const refFinale = milieu ? Math.round(ancienneMeta!.budgetRef * rapportSemaine) : premiere ? total
    : limite && !allegee && coefPhase === undefined ? Math.max(total, Math.min(b.budgetRef, prec?.budgetRef ?? b.budgetRef)) : b.budgetRef
  // Décidé à la construction de la semaine : un recalcul en cours de semaine (séance manquée) ne la rend pas « bridée »
  // Bridée = tes créneaux ont vraiment limité la semaine (plafond, ou séances qui n'atteignent pas le budget) ; jamais un
  // simple arrondi des durées (26/11/2026 : une semaine à 97 % était prise pour bridée, et la référence restait figée)
  const bridee = milieu ? !!ancienneMeta!.bridee : !premiere && !allegee && coefPhase === undefined && (limite || ('plafonne' in b && !!b.plafonne))
  const meta: MetaSemaine = {
    budgetRef: refFinale, budget: total, budgetVise: viseFixe ?? b.budget, raison, allegee, phase: NOMS_PHASES[phase.type],
    semaineDansPhase: nSemaine + 1, z2W, genereeLe: new Date().toISOString(), version: 2, ...(prec?.provisoire || prec?.kjAVenir ? { bilanProvisoire: true } : {}),
    bridee,
    remontee: milieu ? !!ancienneMeta!.remontee : remontee,
    reglagesSemaine: { semaineType: prog.semaineType, maxSemaineMin: prog.maxSemaineMin, maxLongMin: prog.maxLongMin, minLongMin: prog.minLongMin, heuresSemaine, force },
  }
  await enregistrer(db.reglages, { id: cleSemaine(lundi), valeur: meta })
  // Semaine chargée déjà déclarée : on garde le minimum, même après un recalcul
  if (await lireSemaineChargee(lundi)) await passerSemaineChargee(lundi)

  phrases.unshift(
    ...aCreer.sort((x, y) => x[0].localeCompare(y[0])).map(([d, s]) => `${nomJour(d)} : ${s.titre} (${s.dureeMin} min, ${s.kj} kJ)`),
    `Total vélo prévu : ${total} kJ${total !== b.budget ? ` (budget visé ${b.budget} kJ)` : ''}.`,
  )
  if (limite) phrases.push('Budget pas atteignable avec tes créneaux et jours libres : on garde ce qui rentre.')
  return phrases
}

/** Blocs tous tenus ou non : fait avancer (ou recule) la progression de la famille. */
export async function noterResultat(p: SeancePrevue, resultat: SeancePrevue['resultat']) {
  await enregistrer(db.prevues, { ...p, resultat })
}

/**
 * Séances clés sautées (13/11/2026) : la séance d'intensité, ou la séance dédiée au 1er seuil, prévue et pas faite (ou
 * faite autrement) les 2 semaines complètes d'avant. Une alerte, rien ne change dans le plan.
 */
export async function seancesClesSautees(lundi: string) {
  const sautee = async (l: string, cle: (p: SeancePrevue) => boolean) => {
    const prevues = (await db.prevues.where('date').between(l, decalerJour(l, 6), true, true).toArray()).filter((p) => p.origine === 'auto' && cle(p))
    return prevues.length > 0 && !prevues.some((p) => p.statut === 'faite' && !p.realiseDifferent)
  }
  const deuxFois = async (cle: (p: SeancePrevue) => boolean) => (await sautee(decalerJour(lundi, -7), cle)) && (await sautee(decalerJour(lundi, -14), cle))
  const res: ('intensite' | 'sv1')[] = []
  if (await deuxFois(estIntensite)) res.push('intensite')
  if (await deuxFois((p) => p.velo?.formatId === 'sv1-dedie')) res.push('sv1')
  return res
}

/** Dernière séance d'intensité faite sans résultat noté (4 derniers jours). */
export async function intensiteANoter() {
  const jour = aujourdhui()
  const recentes = await db.prevues.where('date').between(decalerJour(jour, -4), jour, true, true).toArray()
  return recentes.filter((p) => estIntensite(p) && p.statut === 'faite' && !p.resultat).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

/**
 * Alertes de cumul de la semaine :
 * deux jours durs d'affilée, trop de séances dures, deux séances le même jour, hausse brutale de la course.
 */
export async function alertesCumul(lundi: string) {
  const c = await chargerContexte()
  const semaine = joursDe(lundi)
  const fin = semaine[6]
  const prevues = (await db.prevues.where('date').between(decalerJour(lundi, -1), fin, true, true).toArray()).filter(actives)
  const seances = await db.seances.where('date').between(decalerJour(lundi, -30), fin, true, true).toArray()
  const ps = (await db.reglages.get('profil-sportif'))?.valeur as Partial<ProfilSportif> | undefined
  const alertes: string[] = []

  const dur = new Set([
    ...prevues.filter((p) => p.intensite === 'haute').map((p) => p.date),
    ...seances.filter((s) => s.date >= decalerJour(lundi, -1) && domaineDe(s, c.bornes) === 'haute').map((s) => s.date),
  ])
  for (const d of [decalerJour(lundi, -1), ...semaine.slice(0, 6)]) {
    const lendemain = decalerJour(d, 1)
    if (dur.has(d) && dur.has(lendemain)) alertes.push(`Deux jours durs d'affilée : ${nomJour(d)} et ${nomJour(lendemain)}. Garde au moins 48 h entre deux séances dures.`)
  }
  const nDurs = semaine.filter((d) => dur.has(d)).length
  if (nDurs > 3) alertes.push(`${nDurs} jours durs cette semaine (vélo + renfo) : 2 à 3 maximum (règle « stress » du système kJ).`)

  // Deux séances le même jour (hors natation) : la séance faite remplace sa séance prévue
  for (const d of semaine) {
    const faites = seances.filter((s) => s.date === d && s.sport !== 'natation')
    const reste = prevues.filter((p) => p.date === d && p.sport !== 'natation' && p.statut === 'prevue' && !faites.some((s) => s.prevueId === p.id))
    if (faites.length + reste.length >= 2) alertes.push(`Deux séances le ${nomJour(d)} : tu préfères une seule séance par jour.`)
  }

  // Alerte « Course : charge prévue » retirée le 19/11/2026 (vélo seul : la course à pied n'est plus planifiée)

  // Muscu (si tu en fais) : pas le jour de l'intensité vélo, ni la veille de l'intensité ou de la sortie longue
  // (Schumann 2022 : interférence surtout dans la même séance, pas à ≥ 3 h d'écart ; la veille : choix d'entraîneur)
  if (/séance/.test(ps?.muscu ?? '')) {
    const exigeants = new Set(prevues.filter((p) => p.sport === 'velo' && (p.intensite === 'haute' || p.longue)).map((p) => p.date))
    for (const m of prevues.filter((p) => p.sport === 'renfo' && p.statut === 'prevue' && p.date >= lundi)) {
      const v = prevues.find((p) => p.sport === 'velo' && p.date === m.date && p.intensite === 'haute')
      if (v) alertes.push(`Muscu le ${nomJour(m.date)}, le même jour que l'intensité vélo : fais-la au moins 3 h après le vélo, ou change de jour.`)
      else if (exigeants.has(decalerJour(m.date, 1)))
        alertes.push(`Muscu le ${nomJour(m.date)}, la veille d'une séance dure ou de la sortie longue : tes jambes seront moins fraîches. Change-la de jour si tu peux.`)
    }
  }

  return alertes
}

/** Vision de la saison : semaines à venir jusqu'à 3 semaines après le début de la dernière phase. */
export async function saison() {
  const r = await lireReglages()
  const prog = r.programme
  const phases = [...prog.phases].sort((a, b) => a.debut.localeCompare(b.debut))
  // Avant la première phase : la projection commence au démarrage du programme
  const lundi = lundiDe(aujourdhui()) < phases[0].debut ? phases[0].debut : lundiDe(aujourdhui())
  const { w: z2W } = await z2Actuel()
  const kjIntensite = construireIntervalles(formatDe('30-15')!, 0, r.cpW, 0).kj
  // Semaine type de chaque semaine : les semaines types à venir font monter le plafond à leur date
  const ps = (await db.reglages.get('profil-sportif'))?.valeur as Partial<ProfilSportif> | undefined
  const heuresMax = (l: string) => {
    const h = heuresAu(prog, ps?.heuresSemaine, l)
    return h ? heuresDe(h)[1] : undefined
  }
  const depart = await chargeDeDepart(lundi, prog.phases, z2W)
  const capDe = (l: string) => {
    const { phase, semaine } = phaseDe(l, prog.phases)
    const pl = programmeAu(prog, l)
    return plafondsReprise(phase.type === 'reprise' ? semaine : undefined, pl.maxSemaineMin, pl.maxLongMin, depart?.facteur)
  }
  const calcul = (l: string) => plafondEtNominal({ semaineType: programmeAu(prog, l).semaineType, kjIntensite, cap: capDe(l), z2W, heuresMax: heuresMax(l) })
  const { nominal, plafond } = calcul(lundi)
  const plafondDe = (l: string) => calcul(l).plafond
  const meta = await lireMeta(lundi)
  const derniere = [...prog.phases].sort((a, b) => a.debut.localeCompare(b.debut)).pop()!
  const semaines = projeterSaison({
    lundi, jusquA: decalerJour(derniere.debut, 21), phases: prog.phases, testsCp: prog.testsCp, testsCourts: prog.testsCourts, competitions: prog.competitions,
    histo: (await histoIntensite()).filter((h) => h.date < lundi), budgetDepart: meta?.budgetRef ?? nominal, plafond, plafondDe, discipline: prog.discipline, repriseSansIntensite: prog.modele === 'chauvin', typeCourse: prog.typeCourse,
    habituelle: depart?.habituelle, plancher: depart?.plancher,
  })
  // Semaine en cours déjà générée : on montre la vraie séance et le vrai budget
  const reelle = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray())
    .find((p) => p.origine === 'auto' && (estIntensite(p) || p.velo?.famille === 'test'))
  if (semaines[0] && reelle) semaines[0].intensite = reelle.titre
  // Semaines déjà construites (cette semaine et les 2 suivantes) : le même chiffre que dans Semaine, ce qui est fait
  // plus ce qui reste prévu (12/11/2026 : avant, Saison montrait le budget et Semaine le prévu, deux chiffres différents)
  // 19/11/2026 : toutes les semaines déjà construites, pas seulement les 3 premières (la Semaine et le graphique disaient
  // deux chiffres différents pour une semaine construite à l'avance)
  for (const [i, x] of semaines.entries()) {
    const m = await lireMeta(x.lundi)
    if (!m && i > 0) continue
    const prevu = (await chargesSemaine(x.lundi)).kjPrevus
    if (m || prevu > 0) x.budget = Math.round(prevu)
    // Semaine déjà construite allégée : elle ne « bute » pas sur le plafond (13/11/2026)
    if (m?.allegee) x.bloquee = false
    // Semaine déjà construite : elle bute si elle a vraiment été bridée par tes créneaux (25/11/2026)
    else if (m?.version === 2) x.bloquee = estBridee(m)
  }
  // Chaque période où la hausse bute (hors semaine en cours, 3 au plus) : quelle limite, jusqu'à quand (une semaine type
  // à venir peut la relever), et le réglage qui débloque le plus (12/11/2026 : avant, seule la 1re période était dite)
  type Blocage = { lundi: string; jusquA?: string; par: 'heures' | 'jours'; heures?: string; besoin: number; levier?: ReturnType<typeof meilleurLevier>; pistes: ReturnType<typeof pistesDeblocage> }
  const blocages: Blocage[] = []
  for (let i = 1; i < semaines.length && blocages.length < 3; i++) {
    if (!semaines[i].bloquee) continue
    const l = semaines[i].lundi
    const p = calcul(l).plafond
    const k = semaines.findIndex((x, j) => j > i && calcul(x.lundi).plafond > p * 1.02)
    const par = calcul(l).limite
    // Hausse voulue sur la période bloquée : +10 % par semaine normale, sur un cycle de 4 semaines au plus (13/11/2026)
    const nBloquees = semaines.slice(i, k > 0 ? k : undefined).filter((x) => x.bloquee).length
    // Une seule semaine qui bute (13/11/2026) : pas d'alerte, la charge repart la semaine d'après
    if (nBloquees < 2) {
      if (k < 0) break
      i = k - 1
      continue
    }
    const besoin = Math.round(p * (Math.pow(1.1, Math.min(4, Math.max(1, nBloquees))) - 1))
    blocages.push({ lundi: l, jusquA: k > 0 ? semaines[k].lundi : undefined, par, heures: heuresAu(prog, ps?.heuresSemaine, l), besoin, ...(() => {
      const pistes = par === 'jours' ? pistesDeblocage({ semaineType: programmeAu(prog, l).semaineType, cap: capDe(l), z2W, besoin }) : []
      return { pistes, levier: pistes[0] }
    })() })
    if (k < 0) break
    i = k - 1
  }
  return { semaines, phases, blocages, fin: decalerJour(derniere.debut, 27), demarrage: lundi > lundiDe(aujourdhui()) ? lundi : undefined }
}

/** Progression de chaque famille de séances d'intensité déjà travaillée : palier (1 à 4) et bonus de watts. */
export async function progressionFamilles() {
  const histo = await histoIntensite()
  const r = await lireReglages()
  const etat = etatProgression(histo, datesTests(r.tests))
  const vues = [...new Set(histo.map((h) => h.famille))]
  return vues.map((f) => ({ famille: f, palier: etat[f].palier + 1, bonus: etat[f].bonus, seances: histo.filter((h) => h.famille === f && h.resultat).length }))
}

/**
 * Après un test CP : les séances vélo encore à faire (semaine en cours et semaines déjà générées)
 * sont recalculées avec la nouvelle CP.
 */
/**
 * Séances à venir créées avant la v0.62 (séries 30/15, over-unders et sprints en un seul bloc) :
 * on régénère leur semaine pour qu'elles aient leurs répétitions (profil, envoi à Zwift / Garmin).
 */
export async function mettreAJourFormatSeances() {
  const jour = aujourdhui()
  const aRefaire = new Set<string>()
  for (const p of await db.prevues.where('date').aboveOrEqual(jour).toArray()) {
    const v = p.velo
    if (p.origine !== 'auto' || p.statut !== 'prevue' || !v?.etapes) continue
    const aDesSeries = v.famille === 'vo2-courts' || v.famille === 'seuil-variable' || (v.famille === 'z2-long' && / sprints?/.test(p.titre))
    if (aDesSeries && !v.etapes.some((e) => e.repetition)) aRefaire.add(lundiDe(p.date))
  }
  for (const l of aRefaire) if (await lireMeta(l)) await genererSemaineVelo(l).catch(() => {}) // erreur déjà journalisée, semaine d'avant gardée
}

/**
 * À l'ouverture (13/11/2026) : la semaine en cours construite avant la fin de la précédente (comptée à 100 %) est
 * recalculée une fois avec le vrai bilan.
 */
/**
 * Semaine à jour toute seule (17/11/2026, demande de Titouan : un élève qui oublie le bouton ↻ doit quand même avoir la
 * bonne semaine) : la semaine en cours et les 2 suivantes sont recalculées une fois par jour, à l'ouverture ou quand on
 * arrive dessus (séances faites gardées, envois à la montre et à Zwift mis à jour). Une seule à la fois.
 */
let miseAJourEnCours: Promise<unknown> = Promise.resolve()
export function mettreSemaineAJour(lundi: string) {
  miseAJourEnCours = miseAJourEnCours.then(async () => {
    const actuel = lundiDe(aujourdhui())
    if (lundi < actuel || lundi > decalerJour(actuel, 14)) return
    const m = await lireMeta(lundi)
    // Semaine en cours (19/11/2026, choix de Titouan) : jamais recalculée toute seule tant qu'elle n'est pas finie ; elle
    // ne change que par tes actions (↻, imprévu, panne, déplacement, test). Seulement construite si elle ne l'est pas.
    if (m && lundi === actuel) return
    if (m && versJour(new Date(m.genereeLe)) >= aujourdhui()) return
    // Semaine jamais construite : seulement la semaine en cours (si le programme existe) ; les suivantes sont construites d'avance
    if (!m && lundi !== actuel) return
    if (!m && !(await db.reglages.get('entrainement'))?.valeur) return
    await genererSemaineVelo(lundi).catch(() => {})
  }).catch(() => {})
  return miseAJourEnCours
}

/**
 * Recalcule une semaine en gardant la chaîne cohérente (19/11/2026) : chaque semaine part du budget de la précédente,
 * donc les semaines d'avant pas encore construites le sont d'abord (dans l'ordre), et celles d'après déjà construites
 * sont refaites ensuite. Avant, recalculer une semaine lointaine la faisait partir d'un budget « de départ », et les
 * suivantes gardaient l'ancien calcul : la Semaine et le graphique de la Saison ne disaient plus la même chose.
 */
export async function genererSemaineEtSuite(lundi: string) {
  const enCours = lundiDe(aujourdhui())
  for (let l = decalerJour(enCours, 7); l < lundi; l = decalerJour(l, 7))
    if (!(await lireMeta(l))) await genererSemaineVelo(l)
  const phrases = await genererSemaineVelo(lundi)
  await refaireSemainesApres(lundi)
  return phrases
}

/**
 * Toute la saison à venir construite avec le vrai moteur (19/11/2026, option A choisie par Titouan) : de la semaine
 * prochaine jusqu'à 3 semaines après le début de la dernière phase, dans l'ordre, chaque semaine en partant de la
 * précédente comptée comme faite à 100 % (sans le feu du jour). Une fois par jour : le graphique de la Saison et la
 * Semaine disent les mêmes chiffres, jusqu'à la course. La semaine en cours n'est pas touchée.
 */
/** Reconstruction de la saison : une seule à la fois ; une demande pendant qu'elle tourne la relance une fois à la fin. */
let saisonEnCours: Promise<void> | undefined
let saisonARefaire = false
export function construireSaison(forcer = false): Promise<void> {
  if (saisonEnCours) {
    if (forcer) saisonARefaire = true
    return saisonEnCours
  }
  saisonEnCours = (async () => {
    try {
      await construireSaisonSeule(forcer)
      while (saisonARefaire) { saisonARefaire = false; await construireSaisonSeule(true) }
    } finally {
      saisonEnCours = undefined
      evenementsSaison.dispatchEvent(new Event('etat'))
    }
  })()
  evenementsSaison.dispatchEvent(new Event('etat'))
  return saisonEnCours
}
const evenementsSaison = new EventTarget()
/** Vrai pendant la reconstruction de la saison (écran Saison : « Mise à jour de ta saison… »). */
export const saisonEnConstruction = () => !!saisonEnCours
/** Prévenu au début et à la fin de chaque reconstruction de la saison. */
export function ecouterSaison(f: () => void) {
  evenementsSaison.addEventListener('etat', f)
  return () => evenementsSaison.removeEventListener('etat', f)
}

async function construireSaisonSeule(forcer: boolean) {
  const jour = aujourdhui()
  const fait = (await db.reglages.get('saison-construite'))?.valeur as string | undefined
  if (!forcer && fait === jour) return
  const e = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  const phases = e?.programme?.phases
  if (!phases?.length) return
  const actuel = lundiDe(jour)
  if (!(await lireMeta(actuel))) return
  const fin = decalerJour([...phases].map((p) => p.debut).sort().pop()!, 21)
  for (let l = decalerJour(actuel, 7); l <= fin; l = decalerJour(l, 7)) await genererSemaineVelo(l).catch(() => {})
  await enregistrer(db.reglages, { id: 'saison-construite', valeur: jour })
}

/** Refait, dans l'ordre, les semaines déjà construites après `lundi`. */
async function refaireSemainesApres(lundi: string) {
  const metas = (await db.reglages.where('id').startsWith('semaine-').toArray()).map((x) => x.id.slice(8)).filter((l) => l > lundi).sort()
  if (!metas.length) return
  for (let l = decalerJour(lundi, 7); l <= metas[metas.length - 1]; l = decalerJour(l, 7)) await genererSemaineVelo(l).catch(() => {})
}

export async function actualiserSemaineEnCours() {
  // Zones de puissance enregistrées avec des trous entre elles (avant le 17/11/2026) : chaque zone repart 1 W au-dessus de la précédente
  const e = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  const z = e?.zonesVelo
  if (e && z?.some((x, i) => i > 0 && z[i - 1].wMax !== undefined && x.wMin !== z[i - 1].wMax! + 1))
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...e, zonesVelo: z.map((x, i) => (i > 0 && z[i - 1].wMax !== undefined ? { ...x, wMin: z[i - 1].wMax! + 1 } : x)) } })
  // 14.8 : les semaines à venir déjà construites par l'ancien calcul (séances au-dessus du budget) sont refaites une fois
  for (const l of [7, 14].map((n) => decalerJour(lundiDe(aujourdhui()), n))) {
    const m = await lireMeta(l)
    if (m && m.version !== 2) await genererSemaineVelo(l).catch(() => {})
  }
  // Semaine en cours construite si elle ne l'est pas ; puis, une fois par jour, toute la saison à venir (option A du
  // 19/11/2026)
  // 23/11/2026, une fois : séance manquée faite la semaine suivante avec la 14.21 (avant que la semaine d'origine soit
  // retenue) : rattachée à sa semaine d'origine (date dans son identifiant), puis la semaine en cours recalculée
  if (!(await db.reglages.get('rattrapages-1422'))) {
    let corrigees = 0
    for (const p of await db.prevues.filter((x) => !!x.deplacee && !x.rattrapageDe && x.date >= '2026-11-23').toArray()) {
      const origine = /^auto-(\d{4}-\d{2}-\d{2})-/.exec(p.id)?.[1]
      if (origine && lundiDe(origine) < lundiDe(p.date)) { await enregistrer(db.prevues, { ...p, rattrapageDe: origine }); corrigees++ }
    }
    await enregistrer(db.reglages, { id: 'rattrapages-1422', valeur: true })
    if (corrigees) await recalculerSemainesAVenir()
  }
  await mettreSemaineAJour(lundiDe(aujourdhui()))
  // Nouvelle semaine construite d'avance (semaine d'avant comptée à 100 %) : recalculée une fois avec le vrai bilan,
  // avant de reconstruire la saison à partir d'elle
  const lundi = lundiDe(aujourdhui())
  if ((await lireMeta(lundi))?.bilanProvisoire) await genererSemaineVelo(lundi).catch(() => {})
  // 25/11/2026, une fois : semaines en double (deux reconstructions en même temps) refaites proprement
  // 25/11/2026, une fois : une semaine bridée par les créneaux (ou une fausse reprise) avait fait baisser la référence ;
  // la semaine en cours garde ses séances, seule sa référence remonte à celle d'avant, puis la saison est refaite
  let refaire = !(await db.reglages.get('doublons-1425'))
  if (!(await db.reglages.get('reference-1425'))) {
    const m = await lireMeta(lundi), avant = await lireMeta(decalerJour(lundi, -7))
    if (m && avant && !m.allegee && !avant.allegee && /plafonné|sans vélo/.test(m.raison) && avant.budgetRef > m.budgetRef) {
      await enregistrer(db.reglages, { id: cleSemaine(lundi), valeur: { ...m, budgetRef: avant.budgetRef } })
      refaire = true
    }
    await enregistrer(db.reglages, { id: 'reference-1425', valeur: true })
  }
  // 25/11/2026, une fois : saison refaite avec les règles des semaines bridées (référence gardée, +10 % au plus)
  if (!(await db.reglages.get('bridage-1431'))) {
    await enregistrer(db.reglages, { id: 'bridage-1431', valeur: true })
    refaire = true
  }
  if (refaire) {
    await enregistrer(db.reglages, { id: 'doublons-1425', valeur: true })
    void construireSaison(true)
  } else void construireSaison()
}

export const recalculerApresTest = () => recalculerSemainesAVenir()

/**
 * Après un changement de réglage (jours, durées, profil sportif, muscu, conseil de Saison) : à partir de la semaine
 * suivante seulement (25/11/2026, demande de Titouan) ; la semaine en cours garde ses réglages d'origine.
 */
export async function recalculerApresReglage() {
  const suivante = decalerJour(lundiDe(aujourdhui()), 7)
  if (await lireMeta(suivante)) await genererSemaineVelo(suivante).catch(() => {})
  void construireSaison(true)
}

/** Recalcule la semaine en cours puis toute la saison à venir (après un test, ou un changement de semaine type / durées). */
export async function recalculerSemainesAVenir() {
  const lundi = lundiDe(aujourdhui())
  if (await lireMeta(lundi)) await genererSemaineVelo(lundi).catch(() => {}) // erreur déjà journalisée, semaine d'avant gardée
  const suivante = decalerJour(lundi, 7)
  if (await lireMeta(suivante)) await genererSemaineVelo(suivante).catch(() => {})
  // Puis le reste de la saison en arrière-plan (25/11/2026 : attendre les 30 semaines bloquait l'écran, noir)
  void construireSaison(true)
}

/**
 * Bilan du dimanche, en 3 lignes : ce qui a été fait, ce qui change la semaine suivante, et pourquoi.
 * La semaine suivante est lue telle qu'elle est générée (CarteBilan la recalcule avec le vrai bilan le dimanche).
 */
export async function bilanDimanche(lundi: string) {
  const fin = decalerJour(lundi, 6)
  const suivant = decalerJour(lundi, 7)
  // Tout ce qui était prévu au départ, séances pas faites comprises (même total que l'écran Semaine)
  const { prevues, seances } = await semaineComptee(lundi, await db.prevues.where('date').between(lundi, fin, true, true).toArray(), await db.seances.where('date').between(lundi, fin, true, true).toArray())
  const decisions = await db.decisions.where('date').between(lundi, fin, true, true).toArray()
  if (!prevues.length && !seances.length) return undefined

  // 1. Ce qui a été fait
  const faites = prevues.filter((p) => p.statut === 'faite').length
  const kjVelo = seances.filter((s) => s.sport === 'velo').reduce((a, s) => a + (s.kj ?? prevues.find((p) => p.id === s.prevueId)?.kjPrevu ?? 0), 0)
  const kjPrevus = prevues.filter((p) => p.sport === 'velo').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  const minCourse = Math.round(seances.filter((s) => s.sport === 'course').reduce((a, s) => a + s.dureeSec, 0) / 60)
  const heures = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  const fait = [
    prevues.length ? `${faites}/${prevues.length} séance${prevues.length > 1 ? 's prévues faites' : ' prévue faite'}` : 'pas de séance prévue cette semaine',
    kjPrevus ? `vélo ${Math.round(kjVelo)} / ${kjPrevus} kJ (${Math.round((kjVelo / kjPrevus) * 100)} %)` : kjVelo ? `vélo ${Math.round(kjVelo)} kJ` : undefined,
    minCourse ? `course ${heures(minCourse)}` : undefined,
  ].filter(Boolean).join(' · ')

  // 2. Ce qui change la semaine suivante : lu dans la semaine suivante telle qu'elle est générée (audit des chiffres du
  // 17/11/2026 : plus de second calcul qui pouvait annoncer autre chose que ce que le lundi construit)
  const metaS = await lireMeta(suivant)
  const prevuesS = (await db.prevues.where('date').between(suivant, decalerJour(suivant, 6), true, true).toArray())
    .filter((p) => p.sport === 'velo' && p.statut !== 'abandonnee').sort((x, y) => x.date.localeCompare(y.date))
  const histo = await histoIntensite()
  let change: string
  if (!metaS) change = 'elle se calcule dès que tu ouvres la semaine prochaine'
  else {
    const totalS = prevuesS.reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
    const ecart = kjPrevus ? Math.round(((totalS - kjPrevus) / kjPrevus) * 100) : undefined
    const dures = prevuesS.filter((p) => p.velo && (estIntensite(p) || p.velo.famille === 'test' || p.velo.famille === 'course'))
    const longueS = prevuesS.find((p) => p.velo?.famille === 'z2-long')
    const testS = prevuesS.find((p) => p.velo?.famille === 'test')
    change = [
      `vélo ${Math.round(totalS)} kJ prévus${ecart !== undefined ? ` (${ecart >= 0 ? '+' : ''}${ecart} % par rapport à cette semaine)` : ''}`,
      ...(dures.length ? [`${dures.length > 1 ? 'séances dures' : 'séance dure'} : ${dures.map((p) => `${p.titre} (${nomJour(p.date)})`).join(', ')}`] : []),
      `${metaS.phase}, semaine ${metaS.semaineDansPhase}${metaS.allegee ? ' (allégée)' : ''}`,
      longueS ? `sortie longue de ${longueS.dureeMin} min (${nomJour(longueS.date)})` : testS ? 'pas de sortie longue : le test CP la remplace' : 'pas de sortie longue',
    ].join(' · ')
  }

  // 3. Pourquoi
  const rouges = decisions.filter((d) => d.couleur === 'rouge').length
  const oranges = decisions.filter((d) => d.couleur === 'orange').length
  const verts = decisions.length - rouges - oranges
  const tenues = histo.filter((h) => h.date >= lundi && h.date <= fin && h.resultat)
  const nb = (n: number, mot: string) => `${n} ${mot}${n > 1 && mot !== 'orange' ? 's' : ''}`
  const pourquoi = [
    ...(metaS ? [metaS.raison] : []),
    ...(decisions.length ? [`feu : ${nb(verts, 'vert')}, ${nb(oranges, 'orange')}, ${nb(rouges, 'rouge')}`] : []),
    ...tenues.map((h) => (h.resultat === 'reussie' ? `${NOMS_FAMILLES[h.famille]} tenu → palier suivant` : `${NOMS_FAMILLES[h.famille]} pas tenu → −5 % de watts`)),
    ...(await signauxFc(seances)),
  ].join(' · ')

  return { lundi, fait, change, pourquoi }
}

/**
 * Signaux de la semaine tirés de la FC et du ressenti (repères d'entraîneur, à lire en tendance) :
 * au moins 2 sorties faciles avec une FC qui dérive (> 5 %) ou jugées « pas faciles » → fatigue possible.
 */
async function signauxFc(seances: Seance[]) {
  const c = await chargerContexte()
  const differentes = await idsPrevuesDifferentes()
  const faciles = seances.filter((s) => (s.sport === 'velo' || s.sport === 'course') && !(s.prevueId && differentes.has(s.prevueId)) && domaineDe(s, c.bornes) === 'basse')
  const derive = faciles.filter((s) => !s.sansCeinture && (deriveSeance(s)?.valeur ?? 0) > 5).length
  const dures = faciles.filter((s) => s.reserve === 'non').length
  const r: string[] = []
  if (derive >= 2) r.push(`${derive} sorties faciles avec une FC qui dérive (> 5 %) : fatigue, chaleur ou hydratation ? À croiser avec ta VFC`)
  if (dures >= 2) r.push(`${dures} sorties faciles ressenties comme dures : garde-les vraiment faciles`)
  return r
}

/**
 * Garde-fou course → vélo pour la semaine qui commence `lundi` : course prévue comparée aux 4 semaines
 * précédentes, et pic de charge totale sur les 7 derniers jours. Il faut 35 jours d'historique.
 * Seul le budget de la semaine baisse (pas la base) : la semaine d'après repart normalement.
 */
/** Sous ta charge habituelle, le budget remonte d'au moins 10 % par semaine validée (débutant compris). */
function hausseSous(depart: Awaited<ReturnType<typeof chargeDeDepart>>, prec: BilanSemaine | undefined, hausse: number) {
  return depart && prec && prec.budgetRef < depart.habituelle ? Math.max(hausse, 0.1) : hausse
}

/**
 * Plancher (12/11/2026) : tu ne repars pas plus bas que la part de ta charge habituelle qui va avec ta coupure (90 %
 * après 1 semaine au plus, 75 % après 2-3, 60 % après 4-6, 45 % au-delà). Pas après 2 jours rouges ni une semaine
 * faite aux trois quarts seulement : la prudence l'emporte.
 */
function avecPlancher<B extends { budgetRef: number; budget: number; raison: string }>(b: B, depart: Awaited<ReturnType<typeof chargeDeDepart>>, prec: BilanSemaine | undefined, plafond: number, allegee: boolean): B {
  if (!depart || b.budgetRef >= depart.plancher) return b
  if (prec && (prec.rouges >= 2 || (prec.kjPrevus > 0 && prec.kjRealises / prec.kjPrevus < 0.75))) return b
  // Juste après une semaine allégée ou réduite : on revient au budget d'avant, sans hausse en plus (audit du 17/11/2026)
  if (prec?.allegee || prec?.reduite || prec?.bridee) return b
  // Audit « vraie vie » du 13/11/2026 : en cours de saison, le plancher ne fait pas remonter de plus de 10 % d'un coup
  // (sinon +15 à +22 % après une semaine ratée) ; il s'applique en entier seulement au départ
  const ref = Math.round(Math.min(plafond, depart.plancher, prec ? prec.budgetRef * 1.1 : Infinity))
  if (ref <= b.budgetRef) return b
  const sous = depart.coupure ? `${depart.coupure} semaine${depart.coupure > 1 ? 's' : ''} sous la moitié de ta charge habituelle` : 'sans baisse depuis'
  const visee = `vers ${Math.round(depart.facteur * 100)} % de ta charge habituelle (${depart.plancher.toLocaleString('fr-FR')} kJ sur ${depart.habituelle.toLocaleString('fr-FR')}, ${sous})`
  return {
    ...b, budgetRef: ref, budget: Math.round(allegee ? ref * 0.65 : ref),
    raison: `${ref < depart.plancher ? `+${Math.round((ref / (prec?.budgetRef ?? ref) - 1) * 100)} % ${visee}, 10 % par semaine au plus` : visee}${allegee ? ' · semaine allégée : −35 %' : ''}`,
  }
}

/** Retour après des semaines chamboulées : budget −10 % (la référence aussi, pour repartir plus bas). */
function avecCoupure<B extends { budgetRef: number; budget: number; raison: string }>(b: B, c: ReturnType<typeof retourDeCoupure>): B {
  if (!c.raison) return b
  return { ...b, budgetRef: Math.round(b.budgetRef * c.facteur), budget: Math.round(b.budget * c.facteur), raison: `${b.raison} · ${c.raison}` }
}

// Garde-fou « pic de charge » (−15 % quand les 7 derniers jours dépassent 1,3 × la moyenne) retiré le 19/11/2026
// (audit du 18/11, relu : ACWR sans seuil validé, Impellizzeri 2020 ; les semaines allégées suffisent)
