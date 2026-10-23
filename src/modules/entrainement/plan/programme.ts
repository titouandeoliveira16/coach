import { db } from '../../../core/db'
import { aujourdhui, decalerJour, NOMS_JOURS, depuisJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import {
  budgetSemaine, formatDe, projeterSaison, choisirFormat, construireIntervalles, construireTest, construireZ2, estSemaineAllegee, etatProgression,
  minutesPourKj, NOMS_PHASES, palierPossible, phaseDe, placer, SPRINTS, type BilanSemaine, type Famille, type HistoIntensite,
  type SeanceConstruite,
} from '../../../metrics/programme'
import { programmeDe } from '../reglagesEntrainement'
import { chargeDe, chargerContexte, domaineDe, lundiDe } from '../seances/donnees'
import type { ReglagesEntrainement, SeancePrevue } from '../types'
import { chargePrevue, joursDe } from './donnees'
import { joursPanneVelo } from './imprevus'

/** Familles de séances d'intensité (hors Z2 et test). */
const INTENSITES: Famille[] = ['vo2-courts', 'vo2-longs', 'seuil', 'seuil-variable', 'sweet-spot', 'tempo']
export const estIntensite = (p: SeancePrevue) => !!p.velo && (INTENSITES as string[]).includes(p.velo.famille)

/** CP par défaut tant qu'aucun test n'est saisi (CP provisoire de la prépa). */
const CP_DEFAUT = 260

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
}

const cleSemaine = (lundi: string) => `semaine-${lundi}`
export const lireMeta = async (lundi: string) => (await db.reglages.get(cleSemaine(lundi)))?.valeur as MetaSemaine | undefined

async function lireReglages() {
  const r = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined
  return { cpW: r?.cpW ?? CP_DEFAUT, zones: r?.zonesVelo, tests: r?.tests ?? [], programme: programmeDe(r?.programme) }
}

/** Dates des tests CP réalisés (résultats saisis). */
const datesTests = (tests: { date: string; type: string }[]) => tests.filter((t) => t.type === 'cp').map((t) => t.date)

const actives = (p: SeancePrevue) => p.statut === 'prevue' || p.statut === 'faite' || p.statut === 'reportee'
const arrondi5 = (n: number) => Math.round(n / 5) * 5

/** Séances d'intensité générées (passées et prévues) : alternance des formats et progression. */
async function histoIntensite(): Promise<HistoIntensite[]> {
  const autos = (await db.prevues.toArray()).filter((p) => p.origine === 'auto' && estIntensite(p) && actives(p))
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
  const z2Ids = new Set((await db.prevues.toArray()).filter((p) => p.velo?.famille === 'z2' || p.velo?.famille === 'z2-long').map((p) => p.id))
  const seances = (await db.seances.where('date').above(dernierTest).toArray()).filter((s) => s.prevueId && z2Ids.has(s.prevueId))
  let ajustement = 0
  for (const s of seances) {
    if (s.decouplage === undefined || s.rpe === undefined) continue
    if (s.decouplage < 5 && s.rpe <= 3) ajustement += 5
    else if (s.decouplage > 5 || s.rpe > 3) ajustement -= 5
  }
  const z2 = r.zones?.[1]
  const min = z2?.wMin ?? 0
  const max = z2?.wMax ?? Infinity
  return { w: Math.min(max, Math.max(min, depart + ajustement)), depart, ajustement }
}

/** Bilan de la semaine précédente (si elle a été générée). */
async function bilanPrecedent(lundi: string): Promise<BilanSemaine | undefined> {
  const precedent = decalerJour(lundi, -7)
  const meta = await lireMeta(precedent)
  if (!meta) return undefined
  const fin = decalerJour(precedent, 6)
  const prevues = (await db.prevues.where('date').between(precedent, fin, true, true).toArray()).filter((p) => p.origine === 'auto' && p.statut !== 'abandonnee')
  const seances = await db.seances.where('date').between(precedent, fin, true, true).toArray()
  const decisions = await db.decisions.where('date').between(precedent, fin, true, true).toArray()
  return {
    budgetRef: meta.budgetRef,
    kjPrevus: prevues.reduce((a, p) => a + (p.kjPrevu ?? 0), 0),
    // Sortie dehors sans capteur de puissance : on compte les kJ prévus de la séance qu'elle a remplie
    kjRealises: seances.filter((s) => s.sport === 'velo').reduce((a, s) => a + (s.kj ?? prevues.find((p) => p.id === s.prevueId)?.kjPrevu ?? 0), 0),
    rouges: decisions.filter((d) => d.couleur === 'rouge').length,
    oranges: decisions.filter((d) => d.couleur === 'orange').length,
    allegee: meta.allegee,
  }
}

/** Type de séance (affichage, historique) et domaine d'intensité selon la famille. */
function champsVelo(c: SeanceConstruite): Pick<SeancePrevue, 'type' | 'intensite' | 'priorite' | 'longue'> {
  const f = c.velo.famille
  if (f === 'z2') return { type: 'Endurance', intensite: 'basse', priorite: 'normale' }
  if (f === 'z2-long') return { type: 'Sortie longue', intensite: 'basse', priorite: 'cle', longue: true }
  if (f === 'test') return { type: 'Test', intensite: 'haute', priorite: 'cle' }
  return { type: f.startsWith('vo2') ? 'Fractionné / VMA' : 'Seuil', intensite: f === 'sweet-spot' || f === 'tempo' ? 'moyenne' : 'haute', priorite: 'cle' }
}

const nomJour = (d: string) => NOMS_JOURS[depuisJour(d).getDay()]

/**
 * Génère (ou regénère) les séances vélo de la semaine autour des séances déjà saisies (course Campus, renfo).
 * Les séances déjà faites sont gardées ; seules les séances auto encore à faire sont remplacées.
 */
export async function genererSemaineVelo(lundi: string) {
  const jour = aujourdhui()
  const semaine = joursDe(lundi)
  const aPartirDe = jour > lundi ? jour : lundi
  if (aPartirDe > semaine[6]) throw new Error('Cette semaine est terminée.')
  const r = await lireReglages()
  const prog = r.programme

  // Anciennes séances à remplacer : séances auto encore à faire, plan importé et propositions de course (anciennes versions)
  for (const p of await db.prevues.where('date').aboveOrEqual(aPartirDe).toArray()) {
    if (p.statut !== 'prevue') continue
    const ancienne = (p.origine === 'auto' && p.date <= semaine[6]) || (p.sport === 'velo' && p.id.startsWith('plan-')) || (p.origine === 'propose' && p.sport === 'course')
    if (ancienne) await supprimer(db.prevues, p.id)
  }

  const c = await chargerContexte()
  const prevues = (await db.prevues.where('date').between(decalerJour(lundi, -1), decalerJour(lundi, 7), true, true).toArray()).filter(actives)
  const seances = await db.seances.where('date').between(decalerJour(lundi, -1), decalerJour(lundi, 7), true, true).toArray()
  const indispos = new Set((await db.indispos.where('date').between(lundi, semaine[6], true, true).toArray()).map((i) => i.date))
  // Vélo en panne : aucun vélo ces jours-là
  for (const d of await joursPanneVelo()) indispos.add(d)
  const dansSemaine = (d: string) => d >= lundi && d <= semaine[6]

  // Jours occupés (une séance par jour) et séances dures (pour ne pas enchaîner deux jours durs)
  const occupations = [
    ...prevues.filter((p) => p.sport !== 'natation').map((p) => ({ date: p.date, dure: p.intensite === 'haute' })),
    ...seances.filter((s) => s.sport !== 'natation').map((s) => ({ date: s.date, dure: domaineDe(s, c.bornes) === 'haute' })),
  ].filter((o) => dansSemaine(o.date) || o.dure)

  // Ce qui est déjà fait (ou prévu à la main) cette semaine
  const veloSemaine = prevues.filter((p) => p.sport === 'velo' && dansSemaine(p.date))
  const intensiteFaite = veloSemaine.some((p) => estIntensite(p) || p.velo?.famille === 'test') ||
    seances.some((s) => s.sport === 'velo' && dansSemaine(s.date) && domaineDe(s, c.bornes) === 'haute')
  const longFaite = veloSemaine.some((p) => p.velo?.famille === 'z2-long' || (p.longue && p.statut === 'faite'))
  const z2Faites = veloSemaine.filter((p) => p.velo?.famille === 'z2').length
  const roles = prog.semaineType
  const nZ2 = Math.max(0, roles.filter((x) => x === 'velo-z2').length - z2Faites)
  const competitions = prog.competitions.map((x) => x.date)
  const dateTest = prog.testsCp.find((d) => dansSemaine(d) && d >= aPartirDe)

  const placement = placer(semaine, roles, occupations, indispos, aPartirDe, {
    competitions, dateTest, intensite: !intensiteFaite, long: !longFaite, nZ2,
  })

  // Phase, semaine allégée
  const { phase, semaine: nSemaine } = phaseDe(lundi, prog.phases)
  const course = prog.competitions.find((x) => dansSemaine(x.date))
  const allegee = estSemaineAllegee(nSemaine) || !!course
  const raisonAllegee = course ? `semaine de ta course (${course.nom})` : 'semaine allégée (1 sur 4)'
  const { w: z2W } = await z2Actuel()
  const maxDuJour = (d: string) => (roles[semaine.indexOf(d)] === 'velo-long' ? prog.maxLongMin : prog.maxSemaineMin)
  const phrases: string[] = []

  // Séance d'intensité
  let intensite: SeanceConstruite | undefined
  const histo = await histoIntensite()
  if (placement.intensite) {
    if (placement.intensite === dateTest) {
      intensite = construireTest(r.cpW, prog.testsCourts?.includes(dateTest))
      intensite.velo.pourquoi = 'Test prévu : il recale toutes tes cibles en watts.'
    } else {
      const choix = choisirFormat(lundi, prog.phases, histo)
      const etat = etatProgression(histo, datesTests(r.tests))[choix.famille]
      const vise = allegee ? Math.max(0, etat.palier - 1) : etat.palier
      const palier = palierPossible(choix.format, vise, maxDuJour(placement.intensite))
      intensite = construireIntervalles(choix.format, palier, r.cpW, etat.bonus)
      const bonus = etat.bonus ? ` · ${etat.bonus > 0 ? '+' : ''}${(etat.bonus * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de watts (progression)` : ''
      intensite.velo.pourquoi =
        `${NOMS_PHASES[phase.type]} · séance ${choix.dominante === 'vo2' ? 'VO2' : choix.dominante === 'seuil' ? 'seuil' : 'sous le seuil'} · palier ${palier + 1}/4${bonus}` +
        (palier < vise ? ' · palier réduit pour tenir dans ton créneau' : '') + (allegee ? ` · ${raisonAllegee}` : '')
    }
    intensite.velo.allegee = allegee
  } else if (!intensiteFaite) {
    phrases.push('Pas de jour pour l’intensité vélo sans enchaîner deux jours durs (ou sans doubler une séance) : semaine en Z2.')
  }

  // Budget kJ de la semaine
  const kjIntensite = intensite?.kj ?? 0
  const nominal = kjIntensite + construireZ2(60, z2W).kj + construireZ2(100, z2W).kj
  const plafond = kjIntensite + roles.filter((x) => x === 'velo-z2').length * construireZ2(prog.maxSemaineMin, z2W).kj + construireZ2(prog.maxLongMin, z2W).kj
  const b = budgetSemaine(await bilanPrecedent(lundi), nominal, plafond, allegee, raisonAllegee)

  // Répartition du reste du budget en Z2 : 60 % pour la sortie longue
  const kjFaits = seances.filter((s) => s.sport === 'velo' && dansSemaine(s.date)).reduce((a, s) => a + (s.kj ?? 0), 0)
  const kjAutresPrevus = veloSemaine.filter((p) => p.statut === 'prevue').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  const reste = Math.max(0, b.budget - kjFaits - kjAutresPrevus - kjIntensite)
  const partLong = placement.long ? (placement.z2.length ? 0.6 : 1) : 0
  const borner = (min: number, max: number, v: number) => Math.min(max, Math.max(min, arrondi5(v)))
  const nLongs = (await db.prevues.toArray()).filter((p) => p.velo?.famille === 'z2-long' && p.statut === 'faite' && p.date < lundi).length

  const aCreer: [string, SeanceConstruite][] = []
  if (placement.intensite && intensite) aCreer.push([placement.intensite, intensite])
  if (placement.long) {
    const min = borner(prog.minLongMin * (allegee ? 0.7 : 1), prog.maxLongMin, minutesPourKj(reste * partLong, z2W))
    aCreer.push([placement.long, construireZ2(min, z2W, SPRINTS[Math.min(nLongs, SPRINTS.length - 1)])])
  }
  for (const d of placement.z2) {
    const min = borner(45, maxDuJour(d), minutesPourKj((reste * (1 - partLong)) / placement.z2.length, z2W))
    aCreer.push([d, construireZ2(min, z2W)])
  }

  for (const [date, s] of aCreer) {
    s.velo.allegee = allegee
    await enregistrer(db.prevues, {
      id: `auto-${date}-velo`, date, sport: 'velo', titre: s.titre, detail: s.detail, dureeMin: s.dureeMin, kjPrevu: s.kj,
      statut: 'prevue', origine: 'auto', velo: s.velo, ...champsVelo(s),
    } satisfies SeancePrevue)
  }

  const meta: MetaSemaine = {
    budgetRef: b.budgetRef, budget: b.budget, raison: b.raison, allegee, phase: NOMS_PHASES[phase.type],
    semaineDansPhase: nSemaine + 1, z2W, genereeLe: new Date().toISOString(),
  }
  await enregistrer(db.reglages, { id: cleSemaine(lundi), valeur: meta })

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
  const seances = await db.seances.where('date').between(decalerJour(lundi, -28), fin, true, true).toArray()
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
  const moy4 = [1, 2, 3, 4].reduce((a, n) => a + chargeCourse(decalerJour(lundi, -7 * n), decalerJour(lundi, -7 * n + 6)), 0) / 4
  const faitesSemaine = seances.filter((s) => s.sport === 'course' && s.date >= lundi)
  const resteCourse = prevues.filter((p) => p.sport === 'course' && p.statut === 'prevue' && p.date >= lundi && !faitesSemaine.some((s) => s.prevueId === p.id))
  const prevueCourse = chargeCourse(lundi, fin) + resteCourse.reduce((a, p) => a + chargePrevue(p, c.chargeRef), 0)
  if (moy4 > 0 && prevueCourse > moy4 * 1.3)
    alertes.push(`Course : charge prévue +${Math.round((prevueCourse / moy4 - 1) * 100)} % par rapport à tes 4 dernières semaines. Au-delà de +30 %, le risque de blessure augmente en reprise (Nielsen 2014).`)

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
  const nZ2 = prog.semaineType.filter((x) => x === 'velo-z2').length
  const nominal = kjIntensite + construireZ2(60, z2W).kj + construireZ2(100, z2W).kj
  const plafond = kjIntensite + nZ2 * construireZ2(prog.maxSemaineMin, z2W).kj + construireZ2(prog.maxLongMin, z2W).kj
  const meta = await lireMeta(lundi)
  const derniere = [...prog.phases].sort((a, b) => a.debut.localeCompare(b.debut)).pop()!
  const semaines = projeterSaison({
    lundi, jusquA: decalerJour(derniere.debut, 21), phases: prog.phases, testsCp: prog.testsCp, testsCourts: prog.testsCourts, competitions: prog.competitions,
    histo: (await histoIntensite()).filter((h) => h.date < lundi), budgetDepart: meta?.budgetRef ?? nominal, plafond,
  })
  // Semaine en cours déjà générée : on montre la vraie séance et le vrai budget
  const reelle = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray())
    .find((p) => p.origine === 'auto' && (estIntensite(p) || p.velo?.famille === 'test'))
  if (semaines[0]) {
    if (reelle) semaines[0].intensite = reelle.titre
    if (meta) semaines[0].budget = meta.budget
  }
  return { semaines, phases, fin: decalerJour(derniere.debut, 27), demarrage: lundi > lundiDe(aujourdhui()) ? lundi : undefined }
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
export async function recalculerApresTest() {
  const lundi = lundiDe(aujourdhui())
  for (const l of [lundi, decalerJour(lundi, 7), decalerJour(lundi, 14)]) {
    if (await lireMeta(l)) await genererSemaineVelo(l).catch(() => {})
  }
}
