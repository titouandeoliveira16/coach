import { db } from '../../../core/db'
import { dureeForce, EXOS, joursMuscu, NOMS_PERIODES, planForce, type ReglagesForce, type SeanceForce } from '../muscu/force'
import { signalerErreur } from '../../../core/erreurs'
import { aujourdhui, decalerJour, depuisJour, ecartJours, NOMS_JOURS } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import {
  ajustementZ2, meilleurLevier, pistesDeblocage, BLOCS_SV1, signalSv1, signalFcSv1, plageFcSv1, sprintsDeLaPhase, SV1_DEPART_PCT, SV1_MAX_PCT, budgetDePhase, budgetSemaine, plafondEtNominal, formatDe, gardeFouCourse, NOMS_FAMILLES, plafondsReprise, projeterSaison, choisirFormat, construireIntervalles, construireTest, construireZ2, coefficientPhase, estSemaineAllegee, etatProgression, palierRaccourci, tenirDansCreneau,
  construireCycloMontees, construireLongueCotes, construireSimulationLigne, construireSimulationXco, construireSpeciales, construireTerrain, cotesDe, minutesPourKj, NOMS_DISCIPLINES, NOMS_PHASES, deuxIntensitesPossibles, formatsPour, hausseBudget, heuresDe, jourDeuxiemeIntensite, niveauDuProfil, palierPossible, phaseDe, placer, retourDeCoupure, semainesChamboulees, type BilanSemaine, type Famille, type HistoIntensite,
  cibleSortieLongue, dureeLongueVisee, type SeanceConstruite, type TypePhase,
  construireCourse, construireOuverture, construireSv1Dediee, specifiqueCols, testProcheCourse, delaiApresCourse, dureeDeCourse, epreuveDe, facteursVitesse, type CourseReference, niveauxCourses, procheCourse,
} from '../../../metrics/programme'
import { fusionnerSemainesPassees, heuresAu, programmeAu, programmeDe } from '../reglagesEntrainement'
import type { ProfilSportif } from '../reglages/ProfilSportif'
import { chargeDe, chargerContexte, domaineDe, lundiDe } from '../seances/donnees'
import type { ReglagesEntrainement, ReglagesProgramme, Seance, SeancePrevue } from '../types'
import { chargePrevue, chargesSemaine, joursDe } from './donnees'
import { chargesHebdo } from '../analyse/donnees'
import { hausseCharge } from '../../../metrics/planif'
import { ratioPic } from '../../../metrics/charge'
import { joursPanneVelo } from './imprevus'
import { lireSemaineChargee, passerSemaineChargee } from './semaineChargee'
import { chargeDeDepart } from './depart'

/** Semaines d'une course B (elles remettent à zéro le compteur des semaines chargées). */
const semaineB = (prog: Pick<ReglagesProgramme, 'competitions' | 'phases'>) => {
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  return (lundi: string) => prog.competitions.some((c) => c.date >= lundi && c.date <= decalerJour(lundi, 6) && niveaux.get(c.date) === 'B')
}

/** Familles de séances d'intensité (hors Z2 et test). */
const INTENSITES: Famille[] = ['vo2-courts', 'vo2-longs', 'seuil-plus', 'seuil', 'seuil-variable', 'sweet-spot', 'tempo', 'relances', 'sprints']
export const estIntensite = (p: SeancePrevue) => !!p.velo && (INTENSITES as string[]).includes(p.velo.famille)

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
}

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
    if (s.decouplage === undefined || s.rpe === undefined || s.sansCeinture) return []
    if (s.decouplage < 5 && s.rpe <= 3) return [1]
    if (s.decouplage > 5 || s.rpe > 3) return [-1]
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
  return { w, palier, nFaites: longues.length }
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
  if (!cible || phase === 'reprise' || phase === 'affutage' || phase === 'recuperation') return { cible, visee: undefined }
  const recentes = (await db.prevues.where('date').between(decalerJour(lundi, -21), lundi, true, false).toArray())
    .filter((p) => p.velo?.famille === 'z2-long' && p.statut === 'faite').map((p) => p.dureeMin)
  return { cible, visee: dureeLongueVisee(cible, prog.minLongMin, recentes.length ? Math.max(...recentes) : undefined) }
}

/** Bilan de la semaine précédente (si elle a été générée). */
async function bilanPrecedent(lundi: string, reel = false): Promise<BilanSemaine | undefined> {
  return bilanDe(decalerJour(lundi, -7), reel)
}

/** Part du budget kJ réalisée, semaine par semaine, en remontant depuis la semaine d'avant `lundi` (6 au plus). */
export async function partsRealisees(lundi: string) {
  const parts: (number | undefined)[] = []
  for (let i = 1; i <= 6; i++) {
    const l = decalerJour(lundi, -7 * i)
    const [meta, b] = [await lireMeta(l), await bilanDe(l)]
    parts.push(meta && b && meta.budget ? b.kjRealises / meta.budget : undefined)
  }
  return parts
}

async function bilanDe(precedent: string, reel = false): Promise<BilanSemaine | undefined> {
  const meta = await lireMeta(precedent)
  if (!meta) return undefined
  const fin = decalerJour(precedent, 6)
  const prevues = (await db.prevues.where('date').between(precedent, fin, true, true).toArray()).filter((p) => p.origine === 'auto' && p.statut !== 'abandonnee')
  const seances = await db.seances.where('date').between(precedent, fin, true, true).toArray()
  const decisions = await db.decisions.where('date').between(precedent, fin, true, true).toArray()
  // Semaine pas encore finie (13/11/2026) : comptée comme si elle se passait à 100 %, sans jour rouge ni orange ; la
  // semaine d'après se recalcule avec le vrai bilan une fois celle-ci finie
  if (!reel && fin >= aujourdhui()) {
    const kjPrevus = prevues.reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
    return { budgetRef: meta.budgetRef, kjPrevus, kjRealises: kjPrevus, rouges: 0, oranges: 0, allegee: meta.allegee, chargee: !!(await lireSemaineChargee(precedent)), provisoire: true }
  }
  return {
    budgetRef: meta.budgetRef,
    kjPrevus: prevues.reduce((a, p) => a + (p.kjPrevu ?? 0), 0),
    // Sortie dehors sans capteur de puissance : on compte les kJ prévus de la séance qu'elle a remplie
    kjRealises: seances.filter((s) => s.sport === 'velo').reduce((a, s) => a + (s.kj ?? prevues.find((p) => p.id === s.prevueId)?.kjPrevu ?? 0), 0),
    rouges: decisions.filter((d) => d.couleur === 'rouge').length,
    oranges: decisions.filter((d) => d.couleur === 'orange').length,
    allegee: meta.allegee,
    chargee: !!(await lireSemaineChargee(precedent)),
  }
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
export async function genererSemaineVelo(lundi: string) {
  const avant = await db.prevues.where('date').aboveOrEqual(lundi).toArray()
  try {
    return await genererSemaineVeloBrute(lundi)
  } catch (e) {
    const ids = new Set(avant.map((p) => p.id))
    for (const p of await db.prevues.where('date').aboveOrEqual(lundi).toArray()) if (!ids.has(p.id)) await supprimer(db.prevues, p.id)
    for (const p of avant) await enregistrer(db.prevues, p)
    signalerErreur(e, `Semaine du ${lundi} non recalculée (semaine d'avant gardée)`)
    throw e
  }
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
  const prog = programmeAu(fusion, lundi)
  const discipline = prog.discipline ?? 'route'
  // Profil sportif (questionnaire) : niveau et heures par semaine règlent le moteur
  const ps = (await db.reglages.get('profil-sportif'))?.valeur as Partial<ProfilSportif> | undefined
  const niveau = niveauDuProfil(ps)
  const heuresSemaine = heuresAu(prog, ps?.heuresSemaine, lundi)
  const heures = heuresDe(heuresSemaine)

  // Anciennes séances à remplacer : séances auto encore à faire, plan importé et propositions de course (anciennes versions)
  for (const p of await db.prevues.where('date').aboveOrEqual(aPartirDe).toArray()) {
    if (p.statut !== 'prevue') continue
    // Une séance changée de jour à la main reste où elle est
    const ancienne = (p.origine === 'auto' && p.date <= semaine[6] && !p.deplacee) || (p.sport === 'velo' && p.id.startsWith('plan-')) || (p.origine === 'propose' && p.sport === 'course')
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

  // Ce qui est déjà fait (ou prévu à la main) cette semaine
  const veloSemaine = prevues.filter((p) => p.sport === 'velo' && dansSemaine(p.date))
  const intensiteFaite = veloSemaine.some((p) => estIntensite(p) || p.velo?.famille === 'test') ||
    seances.some((s) => s.sport === 'velo' && dansSemaine(s.date) && domaineDe(s, c.bornes) === 'haute')
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

  // Course B ou C : elle est la séance dure de la semaine ; en B, ou si elle dure plus de 2 h, aussi la sortie longue
  const courseRemplaceLong = !!courseSecondaire && (courseSecondaire.niveau === 'B' || dureeDe(courseSecondaire.date) > 120)
  const placement = placer(semaine, roles, occupations, indispos, aPartirDe, {
    competitions, delaiApresCourse: delaiCourse, dateTest, intensite: !intensiteFaite && (!courseSecondaire || dateTest !== undefined), long: !longFaite && !courseRemplaceLong, nZ2,
  })
  // Pas de sortie longue la veille ou l'avant-veille d'une course : elle devient une Z2
  if (placement.long && procheCourse(placement.long, competitions, 0)) {
    placement.z2 = [...placement.z2, placement.long].sort()
    placement.long = undefined
  }

  // Phase, semaine allégée
  const { phase, semaine: nSemaine } = phaseDe(lundi, prog.phases)
  // Seule une course B allège la semaine (la A a son affûtage, la C laisse la semaine normale)
  const course = courseB
  // Affûtage et récupération : volume fixé en part du budget de référence (pas de semaine allégée en plus)
  const coefPhase = coefficientPhase(lundi, prog.phases, prog.competitions)
  const allegee = coefPhase === undefined && (estSemaineAllegee(lundi, prog.phases, semaineB(prog)) || !!course)
  const raisonAllegee = course ? `semaine de ta course B (${course.nom}) : allégée d’un tiers, mêmes watts` : 'semaine allégée (1 sur 4)'
  const recuperation = phase.type === 'recuperation'
  const { w: z2W } = await z2Actuel()
  const maxDuJour = (d: string) => (roles[semaine.indexOf(d)] === 'velo-long' ? prog.maxLongMin : prog.maxSemaineMin)
  // Reprise progressive : durées des séances Z2 plafonnées les premières semaines (phase de reprise, ou retour après 3 semaines très légères)
  const parts = await partsRealisees(lundi)
  const coupure = retourDeCoupure(semainesChamboulees(parts), semainesChamboulees(parts.slice(1)))
  // Charge habituelle (4 meilleures semaines d'affilée sur 12) : d'où tu repars, et la reprise part de tes durées
  const depart = await chargeDeDepart(lundi, prog.phases)
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
    } else if (discipline === 'xco' && phase.type === 'specifique' && nSemaine === 1 && !allegee
      && [4, 3, 2].some((t) => construireSimulationXco(r.cpW, z2W, t).dureeMin <= maxDuJour(placement.intensite!) + 5)) {
      // Simulation de course XCO : autant de tours que ton créneau le permet (audit du 14/11/2026)
      intensite = [4, 3, 2].map((t) => construireSimulationXco(r.cpW, z2W, t)).find((x) => x.dureeMin <= maxDuJour(placement.intensite!) + 5)!
      intensite.velo.pourquoi = 'Proche de ta course · simulation de course XCO (7-10 jours avant)'
    } else {
      let choix = choisirFormat(lundi, prog.phases, histo, discipline, 0, prog.typeCourse)
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
  let longueCourse = discipline === 'route' && placement.long && !allegee
    ? typeCourse === 'en-ligne'
      ? phase.type === 'specifique' && nSemaine % 2 === 0 ? 'simulation-ligne' : undefined
      : phase.type === 'specifique' && nSemaine < 2 ? 'cyclo-montees' : undefined
    : undefined
  // Marathon VTT : la sortie longue en côtes compte comme une séance dure (48 h avant et après sans autre intensité)
  // Semaine de test CP : sortie longue normale (pas deux jours durs collés)
  let cotes = discipline === 'xcm' && phase.type !== 'reprise' && !allegee && !dateTest
  // Sortie longue dure (côtes, simulation, montées) : 48 h sans autre séance dure. L'intensité est déplacée sur une autre
  // endurance ; un test ou une course à côté, ou pas de jour pour déplacer : sortie longue normale (audit du 14/11/2026)
  if ((cotes || longueCourse) && placement.long) {
    const long = placement.long
    const colle = (d?: string) => !!d && Math.abs(ecartJours(d, long)) < 2 && d !== long
    if (placement.intensite && colle(placement.intensite) && placement.intensite !== dateTest) {
      const loin = placement.z2.find((d) => Math.abs(ecartJours(d, long)) >= 2 && !procheCourse(d, competitions, delaiCourse))
      if (loin) {
        placement.z2 = [...placement.z2.filter((d) => d !== loin), placement.intensite].sort()
        placement.intensite = loin
      }
    }
    const durAcote = colle(placement.intensite) || colle(dateTest) || coursesSemaine.some((x) => colle(x.date))
      || occupations.some((o) => o.dure && colle(o.date))
    if (durAcote) { cotes = false; longueCourse = undefined }
  }

  // 2e intensité vélo (forme Chauvin) : 4 jours de vélo ou plus, sauf débutant, hors reprise et semaine allégée, et
  // seulement si la semaine n'a pas déjà de séance dure de course (2 séances dures au total par semaine)
  const joursVelo = roles.filter((x) => x.startsWith('velo')).length
  let intensite2: { date: string; s: SeanceConstruite } | undefined
  const courseDure = [...prevues.filter((p) => p.sport === 'course' && p.intensite === 'haute' && dansSemaine(p.date)).map((p) => p.date),
    ...seances.filter((x) => x.sport === 'course' && dansSemaine(x.date) && domaineDe(x, c.bornes) === 'haute').map((x) => x.date)]
  if (intensite && placement.intensite && placement.intensite !== dateTest && deuxIntensitesPossibles(niveau, joursVelo)
    && phase.type !== 'reprise' && phase.type !== 'base' && !allegee && !courseDure.length && !longueCourse && !coursesSemaine.length) {
    const dures = [placement.intensite, ...occupations.filter((o) => o.dure).map((o) => o.date), ...(cotes && placement.long ? [placement.long] : [])]
    const jour2 = jourDeuxiemeIntensite(placement.z2.filter((d) => !procheCourse(d, competitions, delaiCourse)), dures, placement.z2.filter((d) => roles[semaine.indexOf(d)] === 'velo-dur'))
    if (jour2) {
      // L'autre dominante de la phase : la première séance compte comme déjà faite
      const premier = intensite.velo
      const histo2: HistoIntensite[] = [...histo, { date: decalerJour(lundi, -1), famille: premier.famille as Famille, formatId: premier.formatId ?? '', palier: premier.palier ?? 0 }]
      const choix2 = choisirFormat(lundi, prog.phases, histo2, discipline, 1, prog.typeCourse)
      const etat2 = etatProgression(histo, datesTests(r.tests))[choix2.famille]
      const palier2 = palierPossible(choix2.format, etat2.palier, maxDuJour(jour2))
      const s2 = construireIntervalles(choix2.format, tenirDansCreneau(choix2.format, palier2, maxDuJour(jour2)), r.cpW, etat2.bonus, r.wPrimeKj)
      s2.velo.pourquoi = `2e séance intensive de la semaine (${joursVelo} jours de vélo, pas de séance dure de course ; au moins 48 h après l'autre) · palier ${palier2 + 1}/4`
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
  const { nominal, plafond } = plafondEtNominal({ semaineType: roles, kjIntensite, cap, z2W, longueVisee: longue.visee, heuresMax: heuresSemaine ? heures[1] : undefined, minutesAutres })
  const prec = await bilanPrecedent(lundi)
  const b = coefPhase !== undefined
    ? budgetDePhase(prec, nominal, coefPhase, NOMS_PHASES[phase.type])
    : await avecGardeFou(avecCoupure(avecPlancher(budgetSemaine(prec, !prec && prog.budgetDepart ? prog.budgetDepart : nominal, plafond, allegee, raisonAllegee, hausseSous(depart, prec, hausseBudget(niveau)), !prec && prog.budgetDepart ? 'Budget de départ : tes kJ des 4 semaines d’avant' : undefined), depart, prec, plafond, allegee), coupure), lundi)

  // Répartition du reste du budget en Z2 : 60 % pour la sortie longue
  const kjFaits = seances.filter((s) => s.sport === 'velo' && dansSemaine(s.date)).reduce((a, s) => a + (s.kj ?? 0), 0)
  const kjAutresPrevus = veloSemaine.filter((p) => p.statut === 'prevue').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  // La course dans le plan (pas encore faite) : ses kJ estimés comptent dans la semaine
  const coursesAPrevoir = coursesSemaine.filter((x) => x.date >= aPartirDe && !courseFaite(x.date)).map((x) => [x.date, construireCourse(x.nom, x.niveau, dureeDe(x.date), r.cpW)] as [string, SeanceConstruite])
  // Veille d'une course B : petit rappel d'intensité (facultatif) à la place de la Z2 prévue ce jour-là
  const veilleB = courseB && placement.z2.includes(decalerJour(courseB.date, -1)) ? decalerJour(courseB.date, -1) : undefined
  const ouverture = veilleB ? construireOuverture(z2W, r.cpW) : undefined
  if (veilleB) placement.z2 = placement.z2.filter((d) => d !== veilleB)
  const kjCourses = coursesAPrevoir.reduce((a, [, x]) => a + x.kj, 0) + (ouverture?.kj ?? 0)
  const reste = Math.max(0, b.budget - kjFaits - kjAutresPrevus - kjIntensite - kjCourses)
  const partLong = placement.long ? (placement.z2.length ? 0.6 : 1) : 0
  const borner = (min: number, max: number, v: number) => Math.min(max, Math.max(min, arrondi5(v)))
  const nLongs = (await db.prevues.toArray()).filter((p) => p.velo?.famille === 'z2-long' && p.statut === 'faite' && p.date < lundi).length

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
  const palierSv1 = { ...BLOCS_SV1[nPalier], repli: BLOCS_SV1.slice(0, nPalier).reverse(), fc: fcSv1 }
  const sprints = sprintsDeLaPhase(phase.type, discipline, nLongs)
  const intensifs = [placement.intensite, intensite2?.date].filter((d): d is string => !!d)
  const lendemains = new Set(intensifs.map((d) => decalerJour(d, 1)))
  const terrain = discipline !== 'route' ? placement.z2[0] : undefined
  // Cycle 1er seuil : une séance dédiée au 1er seuil par semaine, sur un jour d'endurance, à 48 h au moins du rappel VO2
  // si possible (relu le 13/11/2026), sinon pas le lendemain d'une intensité
  const loinDesIntensifs = (d: string) => intensifs.every((i) => Math.abs(ecartJours(d, i)) >= 2)
  const jourSv1 = phase.type === 'base' && !allegee && !sansBlocs
    ? [...placement.z2].reverse().find((d) => d !== terrain && loinDesIntensifs(d)) ?? [...placement.z2].reverse().find((d) => d !== terrain && !lendemains.has(d)) ?? placement.z2.find((d) => d !== terrain)
    : undefined
  const jourSprints = placement.z2.find((d) => d !== terrain && d !== jourSv1 && !lendemains.has(d)) ?? placement.z2.find((d) => d !== terrain && d !== jourSv1)
  const rappel = niveau === 'confirme' || niveau === 'expert'

  // Cycle 1er seuil : la séance dédiée peut dépasser ton créneau de semaine (jusqu'à 50 min de plus, 2 h 05 au plus)
  // pour que la progression aille jusqu'à 5 × 20′ ou 3 × 30′ (choix d'entraîneur, validé par Titouan le 10/11/2026)
  // Séance dédiée au 1er seuil : dans ton créneau, 10 min de plus au plus (13/11/2026) ; les blocs plus longs se font
  // dans la sortie longue
  let seanceSv1 = jourSv1 ? construireSv1Dediee(nPalier, maxDuJour(jourSv1) + 10, sv1.w, z2W, fcSv1) : undefined
  // Tranche d'heures (audit du 14/11/2026) : tests, séances dures et 1er seuil d'abord, puis la sortie longue et les
  // endurances se partagent ce qui reste (30 min au moins par endurance, 1 h au moins pour la sortie longue)
  // Semaine trop courte pour tout (ex. semaine de test avec moins de 4 h) : pas de séance dédiée au 1er seuil cette fois
  const fixesSansSv1 = aCreer.filter(([, x]) => x.velo.famille !== 'course').reduce((t, [, x]) => t + x.dureeMin, 0)
  if (seanceSv1 && heuresSemaine && fixesSansSv1 + seanceSv1.dureeMin + 30 * placement.z2.filter((d) => d !== jourSv1).length + (placement.long ? 60 : 0) > heures[1] * 60) seanceSv1 = undefined
  const nZ2Restants = placement.z2.filter((d) => !(d === jourSv1 && seanceSv1)).length
  const minutesFixes = fixesSansSv1 + (seanceSv1?.dureeMin ?? 0)
  let minutesDispo = heuresSemaine ? heures[1] * 60 - minutesFixes : Infinity
  let extraSv1 = 0
  if (placement.long) {
    const kjLong = reste * partLong
    // Cycle 1er seuil : blocs dans la sortie longue en plus de la séance dédiée, même à 4 jours (13/11/2026 : 2 séances au 1er seuil par semaine)
    let blocs = !sansBlocs && !cotes && !longueCourse ? { w: sv1.w, ...palierSv1 } : undefined
    // Les blocs au 1er seuil coûtent plus de kJ par minute : ce surplus est pris sur les Z2 de semaine, pas sur la
    // durée de la sortie longue (sinon plus le palier monte, plus la sortie raccourcit et les blocs ne rentrent plus)
    // Semaine allégée, affûtage, récupération : la sortie longue peut descendre sous son minimum habituel
    // Près de la course, sortie longue plafonnée en XCO (2 h 30) et en short track (2 h) ; au moins 3 h en cyclosportive
    // Affûtage : dernière vraie sortie longue à ~55 % de la durée visée, semaine de course 90 min au plus
    // (relecture du 9/11/2026 : volume en baisse, intensité gardée, Bosquet 2007 ; durées = choix d'entraîneur)
    const semaineCourse = prog.competitions.some((x) => x.date >= lundi && x.date <= semaine[6])
    const affutage = phase.type === 'affutage' && longue.cible ? (semaineCourse ? Math.min(90, longue.cible) : arrondi5(longue.cible * 0.55)) : undefined
    const capLong = Math.max(Math.min(60, cap.long), Math.min(affutage ?? Infinity, minutesDispo - 30 * nZ2Restants, phase.type === 'specifique' && discipline === 'xco' ? Math.min(cap.long, 150) : phase.type === 'specifique' && discipline === 'xcc' ? Math.min(cap.long, 120) : cap.long))
    // Simulation de course plus longue que ta sortie longue possible : sortie longue normale (audit du 14/11/2026)
    if (longueCourse === 'simulation-ligne' && construireSimulationLigne(r.cpW, z2W, capLong).dureeMin > capLong + 5) {
      longueCourse = undefined
      blocs = !sansBlocs && !cotes ? { w: sv1.w, ...palierSv1 } : undefined
    }
    const minLong = Math.min(capLong, Math.max(longueCourse === 'cyclo-montees' ? 180 : prog.minLongMin, longue.visee ?? 0))
    const min = affutage
      ? borner(Math.min(affutage, capLong), capLong, minutesPourKj(kjLong, z2W))
      : borner(minLong * (coefPhase ?? (allegee ? 0.7 : 1)), capLong, minutesPourKj(kjLong, z2W))
    if (longue.visee && longue.cible && longue.cible > prog.maxLongMin && !allegee)
      phrases.push(`Ta course demande une sortie longue d'environ ${heuresMin(longue.cible)} ; ton maximum est ${heuresMin(prog.maxLongMin)} : allonge-le dans Réglages (Ma semaine type) si tu peux.`)
    if (longueCourse === 'cyclo-montees' && capLong < 180) phrases.push('Ta sortie longue maximale est sous 3 h : la sortie avec montées en fin de sortie sera plus courte que conseillé pour une cyclosportive.')
    // Marathon VTT (hors reprise et semaine allégée) : sortie longue en côtes
    const courseProche = prog.competitions.some((x) => x.date >= lundi && x.date <= decalerJour(lundi, 20))
    aCreer.push([placement.long, longueCourse === 'simulation-ligne'
      ? construireSimulationLigne(r.cpW, z2W, capLong)
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
    const sl = aCreer[aCreer.length - 1][1]
    minutesDispo -= sl.dureeMin
    // Ce que la sortie longue prend au-delà de sa part (blocs au 1er seuil, allongement) est pris sur les Z2 de semaine
    extraSv1 = Math.max(0, sl.kj - kjLong)
  }
  placement.z2.forEach((d) => {
    // Séance 1er seuil allongée au-delà de ton créneau : les autres endurances peuvent descendre à 30 min pour compenser
    const minZ2 = seanceSv1 && seanceSv1.dureeMin > maxDuJour(jourSv1!) ? 30 : 45
    const maxZ2 = Math.max(30, Math.min(maxDuJour(d), cap.z2, nZ2Restants ? Math.floor(minutesDispo / nZ2Restants / 5) * 5 : Infinity))
    const min = borner(Math.min(minZ2, cap.z2, maxZ2), maxZ2, minutesPourKj((reste * (1 - partLong) - extraSv1) / placement.z2.length, z2W))
    // VTT : la première Z2 de la semaine se fait sur le terrain (technique), jamais la sortie longue
    if (d === jourSv1 && seanceSv1) aCreer.push([d, seanceSv1])
    else if (d === terrain && discipline !== 'route') aCreer.push([d, construireTerrain(discipline, min, z2W)])
    else if (d === jourSprints) aCreer.push([d, construireZ2(min, z2W, sprints, { longue: false, espacementSec: sprints.espacementSec })])
    else aCreer.push([d, construireZ2(min, z2W, undefined, lendemains.has(d) && rappel && !sansBlocs ? { sv1: { w: sv1.w, reps: 2, min: 10, fc: fcSv1 } } : {})])
  })

  // Genoux sensibles : pédaler souple, la charge sur le genou baisse quand la cadence monte (Kutzner 2012 ; résultats mitigés)
  const genoux = /genou/i.test(ps?.pointsSensibles ?? '')
  // Veille d'une course courte et très dure (XCO, XCC, course en ligne) : rappel de l'échauffement de course (Bailey 2009)
  const veilleCourse = (d: string) => prog.competitions.some((x) => x.date === decalerJour(d, 1) && ['xco', 'xcc', 'en-ligne'].includes(x.epreuve ?? epreuveDe(discipline, typeCourse)))
  for (const [date, s] of aCreer) {
    if (veilleCourse(date)) s.detail = `${s.detail}\nDemain, ta course : échauffement de 15' progressif, 5-6' à 90-100 % de ta CP, puis au moins 10' faciles avant le départ.`
    s.velo.allegee = s.velo.allegee || allegee
    await enregistrer(db.prevues, {
      id: `auto-${date}-velo`, date, sport: 'velo', titre: s.titre, detail: genoux && s.detail ? `${s.detail}\n${NOTE_GENOUX}` : s.detail, dureeMin: s.dureeMin, kjPrevu: s.kj,
      statut: 'prevue', origine: 'auto', velo: s.velo, ...champsVelo(s),
    } satisfies SeancePrevue)
  }

  // Muscu reliée à l'Entraînement (13/11/2026) : un jour sans vélo, jamais la veille d'une séance clé
  const force = (await db.reglages.get('force'))?.valeur as ReglagesForce | undefined
  if (force?.actif) {
    // Le programme avance avec les semaines vraiment faites ; un arrêt se rattrape (charges et reprise)
    // Semaines à venir construites à l'avance : les séances prévues d'ici là comptent comme faites (comme le vélo à 100 %)
    const faitesAvant = (await db.prevues.where('date').below(lundi).toArray()).filter((p) => p.muscu && (p.statut === 'faite' || (p.statut === 'prevue' && p.date >= jour))).sort((a, b) => a.date.localeCompare(b.date))
    const semainesFaites = new Set(faitesAvant.map((p) => lundiDe(p.date))).size
    const derniere = faitesAvant.at(-1)
    const semainesSans = derniere ? Math.max(0, Math.round(ecartJours(lundiDe(derniere.date), lundi) / 7) - 1) : 0
    const plan = planForce({ semainesFaites, semainesSans, repriseEnCours: !!derniere?.muscu?.longue && semainesSans === 0, phase: phase.type, allegee, seancesVoulues: force.seances })
    const faitesForce = (await db.prevues.where('date').between(lundi, semaine[6], true, true).toArray()).filter((p) => p.sport === 'renfo' && p.muscu && p.statut === 'faite').length
    const cles = [placement.intensite, intensite2?.date, placement.long, dateTest, ...competitions].filter((d): d is string => !!d)
    const jours = joursMuscu({
      roles, dates: semaine, n: plan.seances - faitesForce, cles, durs: [placement.intensite, intensite2?.date].filter((d): d is string => !!d && d !== dateTest),
      courses: prog.competitions.map((x) => x.date), indispos: [...indispos], velo: aCreer.map(([d]) => d),
    }).filter((j) => j.date >= aPartirDe)
    for (const j of jours) {
      const sf: SeanceForce = { periode: plan.periode, semaine: plan.semaine, series: plan.series, reps: plan.reps, lieu: force.lieu, legere: plan.legere, soir: j.soir, ...(plan.facteur ? { facteur: plan.facteur } : {}), ...(plan.longue ? { longue: true } : {}) }
      await enregistrer(db.prevues, {
        id: `auto-${j.date}-muscu`, date: j.date, sport: 'renfo', titre: `Muscu · ${NOMS_PERIODES[plan.periode]}`,
        detail: `${plan.series} × ${plan.reps} répétitions${plan.legere ? ' légères' : ' lourdes'} · ${EXOS[force.lieu].length} exercices + prévention${plan.facteur ? ` · reprise : charges à ${Math.round(plan.facteur * 100)} %` : ''}${j.soir ? ' · le soir, 3 h après le vélo au moins' : ''}`,
        dureeMin: dureeForce(sf), intensite: 'moyenne', priorite: 'normale', statut: 'prevue', origine: 'auto', muscu: sf,
      } satisfies SeancePrevue)
    }
  }

  const meta: MetaSemaine = {
    budgetRef: b.budgetRef, budget: b.budget, raison: b.raison, allegee, phase: NOMS_PHASES[phase.type],
    semaineDansPhase: nSemaine + 1, z2W, genereeLe: new Date().toISOString(), ...(prec?.provisoire ? { bilanProvisoire: true } : {}),
  }
  await enregistrer(db.reglages, { id: cleSemaine(lundi), valeur: meta })
  // Semaine chargée déjà déclarée : on garde le minimum, même après un recalcul
  if (await lireSemaineChargee(lundi)) await passerSemaineChargee(lundi)

  const total = kjFaits + kjAutresPrevus + aCreer.reduce((a, [, s]) => a + s.kj, 0)
  phrases.unshift(
    ...aCreer.sort((x, y) => x[0].localeCompare(y[0])).map(([d, s]) => `${nomJour(d)} : ${s.titre} (${s.dureeMin} min, ${s.kj} kJ)`),
    `Total vélo prévu : ${total} kJ pour un budget de ${b.budget} kJ.`,
  )
  if (total < b.budget * 0.9) phrases.push('Budget pas atteignable avec tes créneaux et jours libres : on garde ce qui rentre.')
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
 * Alertes de cumul vélo + course de la semaine :
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
  if (nDurs > 3) alertes.push(`${nDurs} jours durs cette semaine (vélo + course) : 2 à 3 maximum (règle « stress » du système kJ).`)

  // Deux séances le même jour (hors natation) : la séance faite remplace sa séance prévue
  for (const d of semaine) {
    const faites = seances.filter((s) => s.date === d && s.sport !== 'natation')
    const reste = prevues.filter((p) => p.date === d && p.sport !== 'natation' && p.statut === 'prevue' && !faites.some((s) => s.prevueId === p.id))
    if (faites.length + reste.length >= 2) alertes.push(`Deux séances le ${nomJour(d)} : tu préfères une seule séance par jour.`)
  }

  // Course : hausse de charge > 30 % par rapport aux 4 semaines précédentes (Nielsen 2014, coureurs en reprise)
  const chargeCourse = (du: string, au: string) => seances.filter((s) => s.sport === 'course' && s.date >= du && s.date <= au).reduce((a, s) => a + chargeDe(s, c), 0)
  const quatre = [1, 2, 3, 4].map((n) => chargeCourse(decalerJour(lundi, -7 * n), decalerJour(lundi, -7 * n + 6)))
  const faitesSemaine = seances.filter((s) => s.sport === 'course' && s.date >= lundi)
  const resteCourse = prevues.filter((p) => p.sport === 'course' && p.statut === 'prevue' && p.date >= lundi && !faitesSemaine.some((s) => s.prevueId === p.id))
  const prevueCourse = chargeCourse(lundi, fin) + resteCourse.reduce((a, p) => a + chargePrevue(p, c.chargeRef), 0)
  // Pas d'alerte juste après une reprise (moins de 3 semaines de course sur les 4) : la comparaison n'a pas de sens
  const hausse = hausseCharge(prevueCourse, quatre)
  if (hausse !== undefined && hausse > 30)
    alertes.push(`Course : charge prévue +${Math.round(hausse)} % par rapport à tes dernières semaines. Au-delà de +30 %, le risque de blessure augmente (Nielsen 2014).`)

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

  // Course : une sortie pas plus de 10 % plus longue que la plus longue des 30 derniers jours (Frandsen 2025)
  const avant = seances.filter((s) => s.sport === 'course' && s.date >= decalerJour(lundi, -30) && s.date < lundi)
  const plusLongue = Math.max(0, ...avant.map((s) => s.dureeSec / 60))
  if (plusLongue > 0)
    for (const p of resteCourse.filter((p) => p.dureeMin > plusLongue * 1.1))
      alertes.push(`Course du ${nomJour(p.date)} : ${p.dureeMin} min, plus de 10 % au-dessus de ta plus longue sortie du mois (${Math.round(plusLongue)} min). Raccourcis-la à ${Math.floor(plusLongue * 1.1)} min (Frandsen 2025).`)

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
  const depart = await chargeDeDepart(lundi, prog.phases)
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
  for (const [i, x] of semaines.slice(0, 3).entries()) {
    const prevu = (await chargesSemaine(x.lundi)).kjPrevus
    const m = await lireMeta(x.lundi)
    if (m || (i === 0 && prevu > 0)) x.budget = Math.round(prevu)
    // Semaine déjà construite allégée : elle ne « bute » pas sur le plafond (13/11/2026)
    if (m?.allegee) x.bloquee = false
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
    // Hausse voulue sur la période bloquée : +7,5 % par semaine normale, sur un cycle de 4 semaines au plus (13/11/2026)
    const nBloquees = semaines.slice(i, k > 0 ? k : undefined).filter((x) => x.bloquee).length
    // Une seule semaine qui bute (13/11/2026) : pas d'alerte, la charge repart la semaine d'après
    if (nBloquees < 2) {
      if (k < 0) break
      i = k - 1
      continue
    }
    const besoin = Math.round(p * (Math.pow(1.075, Math.min(4, Math.max(1, nBloquees))) - 1))
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
export async function actualiserSemaineEnCours() {
  const lundi = lundiDe(aujourdhui())
  if ((await lireMeta(lundi))?.bilanProvisoire) await genererSemaineVelo(lundi).catch(() => {})
}

export const recalculerApresTest = () => recalculerSemainesAVenir()

/** Recalcule la semaine en cours et les 2 suivantes déjà générées (après un test, ou un changement de semaine type / durées). */
export async function recalculerSemainesAVenir() {
  const lundi = lundiDe(aujourdhui())
  for (const l of [lundi, decalerJour(lundi, 7), decalerJour(lundi, 14)]) {
    if (await lireMeta(l)) await genererSemaineVelo(l).catch(() => {}) // erreur déjà journalisée, semaine d'avant gardée
  }
}

/**
 * Bilan du dimanche, en 3 lignes : ce qui a été fait, ce qui change la semaine suivante, et pourquoi.
 * Le budget et la séance d'intensité annoncés sont ceux que la génération de la semaine suivante utilisera.
 */
export async function bilanDimanche(lundi: string) {
  const fin = decalerJour(lundi, 6)
  const suivant = decalerJour(lundi, 7)
  const r = await lireReglages()
  const prog = r.programme
  const prevues = (await db.prevues.where('date').between(lundi, fin, true, true).toArray()).filter((p) => p.statut !== 'abandonnee')
  const seances = await db.seances.where('date').between(lundi, fin, true, true).toArray()
  const decisions = await db.decisions.where('date').between(lundi, fin, true, true).toArray()
  if (!prevues.length && !seances.length) return undefined

  // 1. Ce qui a été fait
  const faites = prevues.filter((p) => p.statut === 'faite').length
  const kjVelo = seances.filter((s) => s.sport === 'velo').reduce((a, s) => a + (s.kj ?? prevues.find((p) => p.id === s.prevueId)?.kjPrevu ?? 0), 0)
  const kjPrevus = prevues.filter((p) => p.sport === 'velo').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  const minCourse = Math.round(seances.filter((s) => s.sport === 'course').reduce((a, s) => a + s.dureeSec, 0) / 60)
  const heures = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  const fait = [
    `${faites}/${prevues.length} séances prévues faites`,
    kjPrevus ? `vélo ${Math.round(kjVelo)} / ${kjPrevus} kJ (${Math.round((kjVelo / kjPrevus) * 100)} %)` : kjVelo ? `vélo ${Math.round(kjVelo)} kJ` : undefined,
    minCourse ? `course ${heures(minCourse)}` : undefined,
  ].filter(Boolean).join(' · ')

  // 2. Ce qui change la semaine suivante
  const { phase, semaine: nSemaine } = phaseDe(suivant, prog.phases)
  const finSuivante = decalerJour(suivant, 6)
  const course = prog.competitions.find((c) => c.date >= suivant && c.date <= finSuivante)
  const test = prog.testsCp.find((d) => d >= suivant && d <= finSuivante)
  const coefSuivant = coefficientPhase(suivant, prog.phases, prog.competitions)
  const allegee = coefSuivant === undefined && (estSemaineAllegee(suivant, prog.phases, semaineB(prog)) || !!course)
  const { w: z2W } = await z2Actuel()
  const progS = programmeAu(prog, suivant)
  const depart = await chargeDeDepart(suivant, prog.phases)
  const cap = plafondsReprise(phase.type === 'reprise' ? nSemaine : undefined, progS.maxSemaineMin, progS.maxLongMin, depart?.facteur)
  const histo = await histoIntensite()
  let intensite: string
  let kjIntensite: number
  if (test) {
    const t = construireTest(r.cpW, prog.testsCourts?.includes(test))
    intensite = `${t.titre} (${nomJour(test)})`
    kjIntensite = t.kj
  } else {
    const choix = choisirFormat(suivant, prog.phases, histo, prog.discipline, 0, prog.typeCourse)
    const etat = etatProgression(histo, datesTests(r.tests))[choix.famille]
    const palier = palierPossible(choix.format, allegee ? Math.max(0, etat.palier - 1) : etat.palier, prog.maxSemaineMin)
    const s = construireIntervalles(choix.format, palier, r.cpW, etat.bonus, r.wPrimeKj)
    intensite = `${s.titre} (palier ${palier + 1}/4)`
    kjIntensite = s.kj
  }
  const longue = await longueDeLaSemaine(suivant, prog, phase.type)
  const meta = await lireMeta(lundi)
  const ps = (await db.reglages.get('profil-sportif'))?.valeur as Partial<ProfilSportif> | undefined
  const { nominal, plafond } = plafondEtNominal({ semaineType: progS.semaineType, kjIntensite, cap, z2W, longueVisee: longue.visee, heuresMax: (() => { const h = heuresAu(prog, ps?.heuresSemaine, suivant); return h ? heuresDe(h)[1] : undefined })() })
  // Bilan du dimanche : la vraie semaine, même pas tout à fait finie
  const precSuivant = await bilanPrecedent(suivant, true)
  const b = coefSuivant !== undefined
    ? budgetDePhase(precSuivant, nominal, coefSuivant, NOMS_PHASES[phase.type])
    : await avecGardeFou(avecPlancher(budgetSemaine(precSuivant, nominal, plafond, allegee, course ? `semaine de ta course (${course.nom})` : 'semaine allégée (1 sur 4)', hausseSous(depart, precSuivant, hausseBudget(niveauDuProfil(ps)))), depart, precSuivant, plafond, allegee), suivant)
  const ecart = meta ? b.budget - meta.budget : undefined
  const change = [
    `budget vélo ${b.budget} kJ${ecart !== undefined ? ` (${ecart >= 0 ? '+' : ''}${ecart})` : ''}`,
    `intensité : ${intensite}`,
    `${NOMS_PHASES[phase.type]}, semaine ${nSemaine + 1}${allegee ? ' (allégée)' : ''}`,
    longue.visee ? `sortie longue d'au moins ${Math.min(longue.visee, cap.long)} min (vers ${Math.min(longue.cible!, cap.long)} min)` : `sortie longue jusqu'à ${cap.long} min`,
  ].join(' · ')

  // 3. Pourquoi
  const rouges = decisions.filter((d) => d.couleur === 'rouge').length
  const oranges = decisions.filter((d) => d.couleur === 'orange').length
  const tenues = histo.filter((h) => h.date >= lundi && h.date <= fin && h.resultat)
  const pourquoi = [
    b.raison,
    ...(decisions.length ? [`feu : ${decisions.length - rouges - oranges} vert(s), ${oranges} orange(s), ${rouges} rouge(s)`] : []),
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
  const derive = faciles.filter((s) => !s.sansCeinture && (s.decouplage ?? 0) > 5).length
  const dures = faciles.filter((s) => s.reserve === 'non').length
  const r: string[] = []
  if (derive >= 2) r.push(`❤️ ${derive} sorties faciles avec une FC qui dérive (> 5 %) : fatigue, chaleur ou hydratation ? À croiser avec ta VFC`)
  if (dures >= 2) r.push(`😮‍💨 ${dures} sorties faciles ressenties comme dures : garde-les vraiment faciles`)
  return r
}

/**
 * Garde-fou course → vélo pour la semaine qui commence `lundi` : course prévue comparée aux 4 semaines
 * précédentes, et pic de charge totale sur les 7 derniers jours. Il faut 35 jours d'historique.
 * Seul le budget de la semaine baisse (pas la base) : la semaine d'après repart normalement.
 */
/** Sous ta charge habituelle, le budget remonte de 10 % par semaine validée (au lieu de 7,5 %). */
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
  // Audit « vraie vie » du 13/11/2026 : en cours de saison, le plancher ne fait pas remonter de plus de 10 % d'un coup
  // (sinon +15 à +22 % après une semaine ratée) ; il s'applique en entier seulement au départ
  const ref = Math.round(Math.min(plafond, depart.plancher, prec ? prec.budgetRef * 1.1 : Infinity))
  if (ref <= b.budgetRef) return b
  const coupure = depart.coupure ? `${depart.coupure} semaine${depart.coupure > 1 ? 's' : ''} de coupure` : 'pas de coupure'
  return {
    ...b, budgetRef: ref, budget: Math.round(allegee ? ref * 0.65 : ref),
    raison: `${Math.round(depart.facteur * 100)} % de ta charge habituelle (${depart.habituelle.toLocaleString('fr-FR')} kJ, ${coupure})${allegee ? ' · semaine allégée : −35 %' : ''}`,
  }
}

/** Retour après des semaines chamboulées : budget −10 % (la référence aussi, pour repartir plus bas). */
function avecCoupure<B extends { budgetRef: number; budget: number; raison: string }>(b: B, c: ReturnType<typeof retourDeCoupure>): B {
  if (!c.raison) return b
  return { ...b, budgetRef: Math.round(b.budgetRef * c.facteur), budget: Math.round(b.budget * c.facteur), raison: `${b.raison} · ${c.raison}` }
}

async function avecGardeFou<B extends { budget: number; raison: string }>(b: B, lundi: string): Promise<B> {
  const c = await chargerContexte()
  const seances = await db.seances.toArray()
  const premier = seances.map((s) => s.date).sort()[0]
  if (!premier || premier > decalerJour(lundi, -35)) return b
  const coursePrevue = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray())
    // Seule la course intense compte (un footing facile ne retire rien au vélo, 12/11/2026)
    .filter((p) => p.sport === 'course' && p.statut !== 'abandonnee' && p.intensite !== 'basse')
    .reduce((a, p) => a + chargePrevue(p, c.chargeRef), 0)
  const charge7 = chargesHebdo(seances, c, lundi, 1, 'entrainement')[0]
  const g = gardeFouCourse({
    hausseCoursePct: hausseCharge(coursePrevue, chargesHebdo(seances, c, lundi, 4, 'course-entrainement')),
    ratioPic: ratioPic(charge7, chargesHebdo(seances, c, decalerJour(lundi, -7), 4, 'entrainement')),
  })
  return g ? { ...b, budget: Math.round(b.budget * (1 - g.pct)), raison: `${b.raison} · ${g.raison}` } : b
}
