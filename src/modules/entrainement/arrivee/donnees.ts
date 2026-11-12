import { db } from '../../../core/db'
import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { zonesDepuisCp } from '../../../core/zones'
import { ageAu, type Profil } from '../../../core/profil'
import type { Competition, Discipline, Phase, Role } from '../../../metrics/programme'
import { calculerSaison, datesCoursesA, lireHistorique, phasesAvecCoursesA } from '../../../metrics/saison'
import { dureeDeCourse, epreuveDe, niveauDuProfil, niveauxCourses, phaseDe } from '../../../metrics/programme'
import type { ProfilSportif } from '../reglages/ProfilSportif'
import { DEFAUT_ENTRAINEMENT } from '../reglagesEntrainement'
import type { ReglagesEntrainement, ZoneVelo } from '../types'
import { chargeDeDepart, type HistoriqueKj } from '../plan/depart'

/** Réponses du questionnaire d'arrivée d'un nouveau compte (élève, frère…). */
export interface ReponsesArrivee {
  naissance: string
  sexe: 'homme' | 'femme'
  tailleCm?: number
  poidsKg?: number
  /** CP, ou FTP Zwift prise telle quelle (× 1,0 : la règle « 75 % de la meilleure minute » n'est pas validée) */
  cpW?: number
  fcMax?: number
  discipline: Discipline
  anciennete?: string
  heuresRecentes?: string
  intervalles?: boolean
  arretSemaines: number
  heuresSemaine?: string
  pointsSensibles?: string
  muscu?: string
  /** Suivi de la nutrition (besoins du jour, repas du soir), en option comme la muscu */
  nutrition: boolean
  /** Nutrition à l'effort (glucides par heure sur les sorties longues et les courses) ; absent = oui */
  nutritionEffort?: boolean
  semaineType: Role[]
  maxSemaineMin: number
  minLongMin: number
  maxLongMin: number
  /** Pas de course prévue : la saison vise une « forme générale » dans 20 semaines (aucune course enregistrée) */
  sansCourse?: boolean
  /** Course principale : distance, dénivelé et durée donnée comme les autres courses */
  course: { nom: string; date: string; distanceKm?: number; deniveleM?: number; dureeMin?: number; cols?: Competition['cols'] }
  /** Autres courses (facultatif) : B importante, C pour s'entraîner */
  autresCourses?: Competition[]
  /** Route : course en ligne (FFC…) ou cyclosportive / longue distance */
  typeCourse?: 'en-ligne' | 'cyclo'
  /** Durée prévue de la course (min) : route et marathon VTT */
  dureeCourseMin?: number
}

export const SEMAINE_TYPE_DEPART: Role[] = ['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-long', 'libre']

/**
 * Semaine type selon le nombre de jours de vélo (semaines types de Mathias Chauvin) : 1 jour dur (mardi), la sortie
 * longue le week-end, le reste en Z2. À partir de 4 jours, le moteur place lui-même la 2e séance intensive sur une Z2
 * (la plus éloignée du mardi : vendredi ou samedi). Modifiable en touchant les jours.
 */
export function semaineDepuisJours(n: number): Role[] {
  const t: Role[] = ['libre', 'velo-dur', 'libre', 'libre', 'libre', 'libre', 'libre']
  if (n <= 3) { t[3] = 'velo-z2'; t[6] = 'velo-long'; return t }
  if (n === 4) { t[3] = 'velo-z2'; t[5] = 'velo-z2'; t[6] = 'velo-long'; return t }
  t[2] = 'velo-z2'; t[3] = 'velo-z2'; t[5] = 'velo-z2'; t[6] = 'velo-long'
  if (n >= 6) t[0] = 'velo-z2'
  return t
}

/** FC max provisoire (Tanaka 2001 : 208 − 0,7 × âge, ±10 bpm) en attendant la plus haute vue dans tes sorties. */
export const fcMaxTanaka = (age: number) => Math.round(208 - 0.7 * age)
/** CP provisoire sans test ni FTP : 2,5 W/kg, volontairement prudent (choix d'entraîneur) ; le test de la 1re semaine la remplace. */
export const cpProvisoire = (kg?: number) => Math.round(((kg ?? 70) * 2.5) / 5) * 5

/** Bornes de FC provisoires en % de la FC max (choix d'entraîneur), recalées ensuite sur tes sorties (« Caler les bpm »). */
function zonesFc(fcMax: number): { fcMin?: number; fcMax?: number }[] {
  const b = [0, 0.7, 0.8, 0.87, 0.93, 1].map((x) => Math.round(fcMax * x))
  return [0, 1, 2, 3, 4].map((i) => ({ fcMin: b[i], fcMax: b[i + 1] }))
}

/** Tout ce que le questionnaire enregistre (pur : testé). */
export function preparerArrivee(r: ReponsesArrivee, jour: string, testsFaits: ReglagesEntrainement['tests'] = [], historique?: { entraine: boolean; budgetDepart?: number; coupure?: number }) {
  const age = ageAu(r.naissance, jour)
  const fcMax = r.fcMax ?? fcMaxTanaka(age)
  const cpW = r.cpW ?? cpProvisoire(r.poidsKg)
  const ps: ProfilSportif = {
    sports: [r.discipline === 'route' ? 'Vélo route' : 'VTT', ...(r.muscu && !/^Pas/.test(r.muscu) ? ['Musculation'] : [])],
    materiel: ['Capteur de puissance'],
    anciennete: r.anciennete, heuresRecentes: r.heuresRecentes, intervalles: r.intervalles,
    heuresSemaine: r.heuresSemaine, pointsSensibles: r.pointsSensibles || undefined, muscu: r.muscu, nutrition: r.nutrition, nutritionEffort: r.nutritionEffort !== false,
  }
  const principale: Competition = {
    date: r.course.date, nom: r.course.nom.trim() || 'Course principale', niveau: 'A', epreuve: epreuveDe(r.discipline, r.typeCourse),
    ...(r.course.distanceKm ? { distanceKm: r.course.distanceKm } : {}), ...(r.course.deniveleM ? { deniveleM: r.course.deniveleM } : {}), ...(r.course.dureeMin ? { dureeMin: r.course.dureeMin } : {}),
    ...(r.course.cols?.length ? { cols: r.course.cols } : {}),
  }
  const dureePrincipale = r.course.distanceKm || r.course.dureeMin
    ? dureeDeCourse(principale, { discipline: r.discipline, typeCourse: r.typeCourse, cpW: r.cpW, poidsKg: r.poidsKg })
    : r.dureeCourseMin
  const jourLong = r.semaineType.indexOf('velo-long')
  const jourDur = r.semaineType.indexOf('velo-dur')
  // Deux courses A ou plus : la préparation vise la 1re, puis récupération et bloc jusqu'à la suivante
  const premiereA = datesCoursesA([...(r.sansCourse ? [] : [principale]), ...(r.autresCourses ?? [])])[0] ?? r.course.date
  const saison = calculerSaison({
    debut: jour, course: premiereA, arretSemaines: Math.max(r.arretSemaines, historique?.coupure ?? 0), debutant: niveauDuProfil(ps) === 'debutant', entraine: historique?.entraine,
    jourLong: jourLong >= 0 ? jourLong : 6, jourDur: jourDur >= 0 ? jourDur : 1, aujourdhui: jour,
  })
  // CP déjà testée ces 4 dernières semaines (compte déjà utilisé) : pas de nouveau test dans les 2 premières semaines
  if (testsFaits.some((t) => t.type === 'cp' && t.date <= jour && ecartJours(t.date, jour) <= 28)) {
    const garder = (d: string) => d >= decalerJour(jour, 14)
    saison.testsCp = saison.testsCp.filter(garder)
    saison.testsCourts = saison.testsCourts.filter(garder)
  }
  const profil: Profil = { naissance: r.naissance, sexe: r.sexe, tailleCm: r.tailleCm, poidsKg: r.poidsKg, fcMax, objectif: 'maintien' }
  const entrainement: ReglagesEntrainement = {
    ...DEFAUT_ENTRAINEMENT,
    vmaKmh: undefined,
    cpW,
    zonesVelo: zonesDepuisCp(cpW, zonesFc(fcMax)) as ZoneVelo[],
    tests: [],
    programme: {
      semaineType: r.semaineType, maxSemaineMin: r.maxSemaineMin, minLongMin: r.minLongMin, maxLongMin: r.maxLongMin,
      // Autres courses A : après la 1re, récupération puis bloc adapté à l'écart jusqu'à la suivante
      phases: phasesAvecCoursesA(saison.phases, datesCoursesA([...(r.sansCourse ? [] : [principale]), ...(r.autresCourses ?? [])])), testsCp: saison.testsCp, testsCourts: saison.testsCourts,
      competitions: [...(r.sansCourse ? [] : [principale]), ...(r.autresCourses ?? []).filter((x) => r.sansCourse || x.date !== r.course.date)], discipline: r.discipline, modele: 'chauvin', ...(r.discipline === 'route' ? { typeCourse: r.typeCourse ?? 'cyclo' } : {}),
      // Durée de la course principale : donnée, ou estimée par sa distance et son dénivelé (règle la sortie longue visée)
      ...(dureePrincipale ? { dureeCourseMin: dureePrincipale } : {}),
      // Tu roulais déjà : le budget de la 1re semaine part de tes kJ réels, pas de la semaine type
      ...(historique?.budgetDepart ? { budgetDepart: historique.budgetDepart } : {}),
      saisonV2: true, saisonV3: true, saisonV4: true,
    },
  }
  return { profil, entrainement, profilSportif: ps, saison, cpConnue: r.cpW !== undefined, fcConnue: r.fcMax !== undefined }
}

/**
 * Réponses déjà connues d'un compte qui a déjà servi (Titouan, passé au questionnaire en 11/2026) : profil, CP, FC max,
 * profil sportif et programme. Undefined pour un compte neuf. Les jours de course de l'ancienne semaine type deviennent libres.
 */
export async function reponsesExistantes() {
  const [p, e, ps] = await Promise.all(['profil', 'entrainement', 'profil-sportif'].map((id) => db.reglages.get(id)))
  const profil = p?.valeur as Profil | undefined
  const ent = e?.valeur as ReglagesEntrainement | undefined
  const sportif = ps?.valeur as ProfilSportif | undefined
  if (!profil && !ent && !sportif) return undefined
  const prog = ent?.programme
  const reponses: Partial<ReponsesArrivee> = {
    ...(profil?.naissance ? { naissance: profil.naissance } : {}),
    ...(profil?.sexe ? { sexe: profil.sexe } : {}),
    ...(prog?.discipline ? { discipline: prog.discipline } : {}),
    ...(sportif ? {
      anciennete: sportif.anciennete, heuresRecentes: sportif.heuresRecentes, intervalles: sportif.intervalles, heuresSemaine: sportif.heuresSemaine,
      pointsSensibles: sportif.pointsSensibles, muscu: sportif.muscu, nutrition: sportif.nutrition !== false, nutritionEffort: sportif.nutritionEffort !== false,
    } : {}),
    ...(prog ? {
      semaineType: prog.semaineType.map((x) => (x === 'course' ? 'libre' : x)),
      maxSemaineMin: prog.maxSemaineMin, minLongMin: prog.minLongMin, maxLongMin: prog.maxLongMin,
      ...(prog.typeCourse ? { typeCourse: prog.typeCourse } : {}),
      ...(prog.dureeCourseMin ? { dureeCourseMin: prog.dureeCourseMin } : {}),
      // Course principale encore à venir : préremplie (distance, dénivelé, durée)
      ...((() => {
        const a = prog.competitions.find((x) => x.niveau === 'A' && x.date > aujourdhui())
        return a ? { course: { nom: a.nom, date: a.date, ...(a.distanceKm ? { distanceKm: a.distanceKm } : {}), ...(a.deniveleM ? { deniveleM: a.deniveleM } : {}), ...(a.dureeMin ? { dureeMin: a.dureeMin } : {}), ...(a.cols ? { cols: a.cols } : {}) } } : {}
      })()),
      // Courses B et C déjà notées : gardées
      ...(prog.competitions.some((x) => x.niveau === 'B' || x.niveau === 'C') ? { autresCourses: prog.competitions.filter((x) => x.niveau === 'B' || x.niveau === 'C') } : {}),
    } : {}),
  }
  const texte = (v?: number) => (v ? String(v) : '')
  return {
    reponses: Object.fromEntries(Object.entries(reponses).filter(([, v]) => v !== undefined)) as Partial<ReponsesArrivee>,
    textes: { taille: texte(profil?.tailleCm), poids: texte(profil?.poidsKg), cp: texte(ent?.cpW), fc: texte(profil?.fcMax) },
  }
}

/**
 * Tes 4 semaines complètes avant celle-ci : sorties vélo et kJ, lus dans tes séances importées. Avec ta charge habituelle
 * (12/11/2026, 4 meilleures semaines d'affilée sur 12) : budget de départ au moins à la part qui va avec ta coupure,
 * et la coupure vue dans tes séances règle la reprise.
 */
export async function historiqueRecent(jour: string, cpW: number, semaineType: Role[], phases: Phase[] = []): Promise<{ entraine: boolean; budgetDepart?: number; coupure?: number }> {
  const lundi = decalerJour(jour, -((new Date(`${jour}T12:00:00`).getDay() + 6) % 7))
  const debut = decalerJour(lundi, -28)
  const seances = (await db.seances.where('date').between(debut, decalerJour(lundi, -1), true, true).toArray()).filter((s) => s.sport === 'velo')
  const semaines = [0, 1, 2, 3].map((i) => {
    const l = decalerJour(debut, 7 * i)
    const sem = seances.filter((s) => s.date >= l && s.date <= decalerJour(l, 6))
    return { sorties: sem.length, kj: sem.reduce((a, s) => a + (s.kj ?? 0), 0) }
  })
  // Semaine type estimée : Z2 à 62 % de la CP, 1 h par jour d'endurance, 1 h 40 de sortie longue, 45 min d'intensité
  const nZ2 = semaineType.filter((x) => x === 'velo-z2').length
  const nominal = (0.62 * cpW * 60 * (60 * nZ2 + 100) + 0.8 * cpW * 60 * 45) / 1000
  const h = lireHistorique(semaines, nominal)
  const dep = await chargeDeDepart(lundi, phases)
  if (!dep) return h
  const budgetDepart = Math.max(h.budgetDepart ?? 0, dep.plancher)
  return { entraine: h.entraine, budgetDepart, coupure: dep.coupure }
}

/** Réglage « arrivee » : le questionnaire est fait (sinon il s'affiche à l'ouverture d'un compte créé avec un code). */
export interface EtatArrivee { fait?: string; montre?: 'reliee' | 'plus-tard' }

export async function enregistrerArrivee(r: ReponsesArrivee) {
  const jour = aujourdhui()
  const lire = async <T,>(id: string) => (await db.reglages.get(id))?.valeur as T | undefined
  const [profilAvant, entAvant, psAvant] = [await lire<Profil>('profil'), await lire<ReglagesEntrainement>('entrainement'), await lire<ProfilSportif>('profil-sportif')]
  const p = preparerArrivee(r, jour, entAvant?.tests, await historiqueRecent(jour, r.cpW ?? entAvant?.cpW ?? cpProvisoire(r.poidsKg), r.semaineType))
  // Compte déjà utilisé : les données acquises restent (tests CP, bornes de FC calées, W', réglages divers, objectif
  // nutrition…) ; seuls le programme (saison calculée) et les réponses du questionnaire changent
  await enregistrer(db.reglages, { id: 'profil', valeur: { ...profilAvant, ...p.profil, objectif: profilAvant?.objectif ?? p.profil.objectif } })
  await enregistrer(db.reglages, {
    id: 'entrainement',
    valeur: entAvant
      ? { ...entAvant, cpW: p.entrainement.cpW, zonesVelo: entAvant.zonesVelo?.length ? zonesDepuisCp(p.entrainement.cpW!, entAvant.zonesVelo) as ZoneVelo[] : p.entrainement.zonesVelo, programme: p.entrainement.programme }
      : p.entrainement,
  })
  await enregistrer(db.reglages, { id: 'profil-sportif', valeur: { ...psAvant, ...p.profilSportif, materiel: psAvant?.materiel?.length ? psAvant.materiel : p.profilSportif.materiel } })
  await enregistrer(db.reglages, { id: 'arrivee', valeur: { fait: jour } satisfies EtatArrivee })
  // La semaine en cours (et la suivante si on est déjà en fin de semaine) est construite tout de suite
  const { genererSemaineVelo } = await import('../plan/programme')
  const { lundiDe } = await import('../seances/donnees')
  await genererSemaineVelo(lundiDe(jour)).catch(() => {})
  if (new Date(`${jour}T12:00:00`).getDay() === 0) await genererSemaineVelo(decalerJour(lundiDe(jour), 7)).catch(() => {})
  return p
}

/**
 * Saisons calculées avant le 10/11/2026 : recalculées une fois avec la prépa hivernale Methodic (cycle 1er seuil,
 * 2e seuil tiré puis poussé, cycle VO2max), à partir de cette semaine et de ta prochaine course A. Tes tests faits,
 * ta CP et tes réglages restent ; un test CP récent (moins de 4 semaines) évite un nouveau test les 2 premières semaines.
 */
export async function migrerSaisonV2() {
  const e = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  if (!e?.programme || e.programme.modele !== 'chauvin' || e.programme.saisonV2) return
  await recalculerSaison()
}

/**
 * Reprise selon la coupure (12/11/2026) : une saison en pleine reprise (calculée avec l'ancienne règle, 2 à 7 semaines)
 * est recalculée une fois depuis cette semaine. Courses, tests (faits et prévus) et phases passées restent.
 */
export async function migrerSaisonV3() {
  const ligne = await db.reglages.get('entrainement')
  const e = ligne?.valeur as ReglagesEntrainement | undefined
  const prog = e?.programme
  if (!e || !prog || prog.modele !== 'chauvin' || prog.saisonV3 || !prog.phases?.length) return
  const lundi = decalerJour(aujourdhui(), -((new Date(`${aujourdhui()}T12:00:00`).getDay() + 6) % 7))
  // Tests CP prévus gardés à leurs dates (demande du 12/11/2026)
  if (phaseDe(lundi, prog.phases).phase.type === 'reprise') await recalculerSaison(true)
  // Marqué fait dans tous les cas (relu : recalculerSaison a pu réécrire le programme)
  const apres = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  if (apres?.programme && !apres.programme.saisonV3) await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...apres, programme: { ...apres.programme, saisonV3: true } } })
}

/**
 * Charge habituelle sur 6 mois (12/11/2026) : tes kJ de 6 mois importés une fois d'Intervals, puis une saison en reprise
 * (ou recalculée cette semaine) est recalculée une fois de plus. Courses et tests gardés. Sans réseau : réessayé plus tard.
 */
export async function migrerSaisonV4() {
  const e = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  const prog = e?.programme
  if (!e || !prog || prog.modele !== 'chauvin' || prog.saisonV4 || !prog.phases?.length) return
  const { importerHistoriqueKj } = await import('../import/intervals')
  try {
    await importerHistoriqueKj()
  } catch {
    return // pas de réseau : réessayé à la prochaine ouverture
  }
  const lundi = decalerJour(aujourdhui(), -((new Date(`${aujourdhui()}T12:00:00`).getDay() + 6) % 7))
  const { phase } = phaseDe(lundi, prog.phases)
  if (phase.type === 'reprise' || phase.debut === lundi) await recalculerSaison(true)
  else await (await import('../plan/programme')).recalculerSemainesAVenir()
  const apres = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  if (apres?.programme && !apres.programme.saisonV4) await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...apres, programme: { ...apres.programme, saisonV3: true, saisonV4: true } } })
}

/**
 * Sorties venues de Strava absentes de l'historique (Intervals ne les transmet pas) : relu une fois par jour pendant
 * 30 jours. Dès que l'historique est nettement plus complet (montre reliée directement à Intervals), la saison en
 * reprise (ou commencée cette semaine) est recalculée. Courses et tests gardés.
 */
export async function completerHistorique() {
  const h = (await db.reglages.get('historique-kj'))?.valeur as HistoriqueKj | undefined
  const jour = aujourdhui()
  // Relu au plus une fois par heure (l'historique Garmin peut arriver dans Intervals à tout moment de la journée)
  // Ancienne version (sorties en double possibles) : relue une fois tout de suite
  const ancienne = !!h && h.version !== 2
  if (!h || (!ancienne && (!h.viaStrava || h.complet || (h.lu && Date.now() - Date.parse(h.lu) < 3_600_000) || (h.debut && ecartJours(h.debut, jour) > 30)))) return
  const { importerHistoriqueKj } = await import('../import/intervals')
  const r = await importerHistoriqueKj(true).catch(() => undefined)
  const prog = ((await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined)?.programme
  if (!r?.mieux || !prog?.phases?.length || prog.modele !== 'chauvin') return
  const lundi = decalerJour(jour, -((new Date(`${jour}T12:00:00`).getDay() + 6) % 7))
  const { phase } = phaseDe(lundi, prog.phases)
  // Simple retrait des doublons : les phases restent, seules les semaines se recalculent
  if (!ancienne && (phase.type === 'reprise' || phase.debut === lundi)) await recalculerSaison(true)
  // Dans tous les cas, ta semaine en cours (et les 2 suivantes) repart tout de suite de ta vraie charge habituelle
  else await (await import('../plan/programme')).recalculerSemainesAVenir()
}

/**
 * Saison recalculée depuis cette semaine : préparation vers la prochaine course A (à plus de 3 semaines), puis pour chaque
 * A suivante récupération, bloc et affûtage. Les phases passées restent. Appelé quand les courses changent (Réglages).
 */
export async function recalculerSaison(garderTests = false) {
  const ligne = await db.reglages.get('entrainement')
  const e = ligne?.valeur as ReglagesEntrainement | undefined
  const prog = e?.programme
  if (!e || !prog || prog.modele !== 'chauvin') return
  const jour = aujourdhui()
  // Course A : niveau noté, ou (anciennes données sans niveau) la plus lointaine
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  const a = prog.competitions.filter((c) => niveaux.get(c.date) === 'A' && c.date > decalerJour(jour, 21)).sort((x, y) => x.date.localeCompare(y.date))[0]
  if (!a) return
  const ps = (await db.reglages.get('profil-sportif'))?.valeur as ProfilSportif | undefined
  const historique = await historiqueRecent(jour, e.cpW ?? 260, prog.semaineType, prog.phases)
  const jourLong = prog.semaineType.indexOf('velo-long')
  const jourDur = prog.semaineType.indexOf('velo-dur')
  const saison = calculerSaison({
    debut: jour, course: a.date, arretSemaines: historique.coupure, debutant: niveauDuProfil(ps) === 'debutant', entraine: historique.entraine,
    jourLong: jourLong >= 0 ? jourLong : 6, jourDur: jourDur >= 0 ? jourDur : 1, aujourdhui: jour,
  })
  if ((e.tests ?? []).some((t) => t.type === 'cp' && t.date <= jour && ecartJours(t.date, jour) <= 28)) {
    const garder = (d: string) => d >= decalerJour(jour, 14)
    saison.testsCp = saison.testsCp.filter(garder)
    saison.testsCourts = saison.testsCourts.filter(garder)
  }
  // Les phases déjà passées restent (historique), la nouvelle saison commence cette semaine
  const lundi = decalerJour(jour, -((new Date(`${jour}T12:00:00`).getDay() + 6) % 7))
  const passees = prog.phases.filter((p) => p.debut < lundi)
  const phases = [...passees, ...phasesAvecCoursesA(saison.phases, datesCoursesA(prog.competitions.map((c) => ({ ...c, niveau: niveaux.get(c.date) }))))]
  await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...e, programme: { ...prog, phases, ...(garderTests ? {} : { testsCp: [...prog.testsCp.filter((d) => d < lundi), ...saison.testsCp], testsCourts: [...(prog.testsCourts ?? []).filter((d) => d < lundi), ...saison.testsCourts] }), saisonV2: true, saisonV3: true, saisonV4: true } } })
  const { recalculerSemainesAVenir } = await import('../plan/programme')
  await recalculerSemainesAVenir()
}
