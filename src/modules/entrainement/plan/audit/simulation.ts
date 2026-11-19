import { vi } from 'vitest'
import { db } from '../../../../core/db'
import { decalerJour } from '../../../../core/dates'
import { deplier, heuresDe, phaseDe, verifierSemaineType, type Discipline, type Role } from '../../../../metrics/programme'
import { enregistrerArrivee, type ReponsesArrivee } from '../../arrivee/donnees'
import { heuresAu, programmeAu } from '../../reglagesEntrainement'
import type { ReglagesEntrainement, SemaineTypeFuture } from '../../types'
import { adapterDuJour } from '../adaptation'
import { declarerPanneVelo } from '../imprevus'
import { chargesSemaine } from '../donnees'
import { genererSemaineEtSuite, genererSemaineVelo, lireMeta, saison, seancesClesSautees } from '../programme'

/**
 * Audit complet du moteur (14/11/2026) : des centaines de profils tirés au hasard (reproductibles par leur graine),
 * une saison entière chacun, semaine par semaine, avec une « vraie vie » plus ou moins chahutée, et ~20 règles
 * vérifiées chaque semaine. Lancé à part : `npm run audit` (trop long pour chaque mise en ligne).
 */
export const INTENSES = ['vo2-courts', 'vo2-longs', 'seuil-plus', 'seuil', 'seuil-variable', 'sweet-spot', 'tempo', 'sprints', 'relances']
export const hasard = (graine: number) => {
  let g = (graine * 7919 + 12345) % 2147483647 || 1
  return () => { g = (g * 16807) % 2147483647; return g / 2147483647 }
}

const HEURES = ['Moins de 4 h', '4 à 6 h', '6 à 8 h', '8 à 10 h', '10 à 12 h', 'Plus de 12 h']
const ANCIENNETES = ['Moins d’un an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans']
const RECENTES = ['Moins de 3 h', '3 à 6 h', '6 à 10 h', 'Plus de 10 h']
// Enduro et descente ne sont plus proposés (5/11/2026) : l'audit ne simule que les disciplines proposées (19/11/2026)
const DISCIPLINES: Discipline[] = ['route', 'route', 'route', 'xco', 'xcc', 'xcm']
const MUSCU = ['Pas pour l’instant', '1 séance par semaine', '2 séances par semaine']
const DEBUT = '2026-11-09'

export interface Scenario {
  graine: number
  nom: string
  r: ReponsesArrivee
  futures?: SemaineTypeFuture[]
  /** Probabilités de la vie : séance ratée, semaine malade, semaine à 2 jours rouges, séance raccourcie, intensité ratée */
  vie: { rate: number; malade: number; rouges: number; courte: number; echec: number; muscuSautee: number }
  pannes: string[]
  sauts: string[]
}

const choisir = <T,>(a: () => number, l: T[]) => l[Math.floor(a() * l.length)]

/** Une semaine type valide de n jours de vélo, tirée au hasard. */
function semaineAuHasard(a: () => number, n: number): Role[] {
  for (let essai = 0; essai < 50; essai++) {
    const t: Role[] = Array(7).fill('libre')
    const jours = [0, 1, 2, 3, 4, 5, 6].sort(() => a() - 0.5).slice(0, n)
    const long = jours.includes(6) ? 6 : jours.includes(5) ? 5 : jours[0]
    t[long] = 'velo-long'
    const autres = jours.filter((j) => j !== long)
    const nDurs = n >= 4 && a() < 0.4 ? 2 : 1
    autres.forEach((j, i) => { t[j] = i < nDurs ? 'velo-dur' : 'velo-z2' })
    if (a() < 0.3) { const l = t.indexOf('libre'); if (l >= 0) t[l] = 'renfo' }
    if (a() < 0.1) { const l = t.indexOf('libre'); if (l >= 0) t[l] = 'course' }
    if (verifierSemaineType(t).ok) return t
  }
  return ['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-z2', 'velo-long']
}

/** Un profil et sa vie, entièrement déterminés par la graine. */
export function scenarioDe(graine: number): Scenario {
  const a = hasard(graine)
  const discipline = choisir(a, DISCIPLINES)
  const nJours = choisir(a, [3, 3, 4, 4, 4, 5, 5, 6])
  const heures = choisir(a, nJours <= 3 ? HEURES.slice(0, 3) : nJours === 4 ? HEURES.slice(1, 4) : HEURES.slice(2))
  const semaines = Math.floor(6 + a() * 34)
  const course = decalerJour(DEBUT, semaines * 7 + 6)
  const maxLong = choisir(a, [90, 120, 150, 180, 240, 300])
  const r: ReponsesArrivee = {
    naissance: `${1965 + Math.floor(a() * 45)}-0${1 + Math.floor(a() * 9)}-15`, sexe: a() < 0.75 ? 'homme' : 'femme', tailleCm: 160 + Math.floor(a() * 35), poidsKg: 52 + Math.floor(a() * 40),
    cpW: 150 + Math.floor(a() * 200), discipline, anciennete: choisir(a, ANCIENNETES), heuresRecentes: choisir(a, RECENTES), intervalles: a() < 0.6,
    arretSemaines: choisir(a, [0, 0, 0, 2, 4]), heuresSemaine: heures, nutrition: a() < 0.3, muscu: choisir(a, MUSCU), muscuLieu: a() < 0.7 ? 'salle' : 'maison',
    semaineType: semaineAuHasard(a, nJours), maxSemaineMin: choisir(a, [45, 60, 75, 90, 120]), minLongMin: Math.min(maxLong, choisir(a, [60, 90, 120])), maxLongMin: maxLong,
    ...(discipline === 'route' ? { typeCourse: a() < 0.5 ? 'cyclo' as const : 'en-ligne' as const } : {}),
    course: { nom: 'A', date: course, ...(a() < 0.6 ? { distanceKm: 40 + Math.floor(a() * 160), deniveleM: Math.floor(a() * 3500) } : {}) },
  }
  // Autres courses : une 2e A (6-12 semaines après), une B, une C
  const autres: NonNullable<ReponsesArrivee['autresCourses']> = []
  if (a() < 0.2) autres.push({ date: decalerJour(course, 7 * (6 + Math.floor(a() * 7))), nom: 'A2', niveau: 'A' })
  if (a() < 0.35 && semaines > 8) autres.push({ date: decalerJour(DEBUT, 7 * (3 + Math.floor(a() * (semaines - 6))) + 6), nom: 'B', niveau: 'B' })
  if (a() < 0.25 && semaines > 6) autres.push({ date: decalerJour(DEBUT, 7 * (2 + Math.floor(a() * (semaines - 4))) + 5), nom: 'C', niveau: 'C' })
  if (autres.length) r.autresCourses = autres
  // Semaine type qui change en cours de saison
  const futures: SemaineTypeFuture[] = []
  if (a() < 0.3) {
    const n = Math.max(3, Math.min(6, nJours + choisir(a, [-1, 1, 1])))
    futures.push({ debut: decalerJour(DEBUT, 7 * (2 + Math.floor(a() * Math.max(1, semaines - 4)))), semaineType: semaineAuHasard(a, n), maxSemaineMin: choisir(a, [60, 75, 90]), maxLongMin: choisir(a, [120, 180, 240]), ...(a() < 0.5 ? { heuresSemaine: choisir(a, HEURES.slice(n <= 3 ? 1 : 2, n <= 3 ? 3 : 5)) } : {}) })
  }
  // Vie : parfaite, normale ou chaotique
  const type = a()
  const vie = type < 0.15 ? { rate: 0, malade: 0, rouges: 0, courte: 0, echec: 0, muscuSautee: 0 }
    : type < 0.8 ? { rate: 0.12, malade: 0.05, rouges: 0.2, courte: 0.15, echec: 0.3, muscuSautee: 0.2 }
    : { rate: 0.3, malade: 0.15, rouges: 0.4, courte: 0.3, echec: 0.5, muscuSautee: 0.5 }
  const pannes = vie.rate > 0 && a() < 0.4 ? [decalerJour(DEBUT, 7 * Math.floor(1 + a() * Math.max(1, semaines - 2)) + 2)] : []
  const s = Math.floor(2 + a() * Math.max(1, semaines - 6))
  const sauts = vie.rate > 0 && a() < 0.3 ? [decalerJour(DEBUT, 7 * s), decalerJour(DEBUT, 7 * (s + 1))] : []
  const nom = `#${graine} ${discipline}${r.typeCourse ? ` ${r.typeCourse}` : ''} · ${nJours} j · ${heures} · course dans ${semaines + 1} sem.${autres.length ? ` + ${autres.map((x) => x.niveau).join('')}` : ''}${futures.length ? ' · semaine type qui change' : ''} · muscu ${r.muscu![0] === 'P' ? 'non' : r.muscu![0]} · vie ${type < 0.15 ? 'parfaite' : type < 0.8 ? 'normale' : 'chaotique'}`
  return { graine, nom, r, futures, vie, pannes, sauts }
}

/** Simule la saison et renvoie les règles cassées (vide = tout va bien). */
export async function simuler(sc: Scenario, detail = false, journal?: string[]): Promise<string[]> {
  const { r, vie } = sc
  const a = hasard(sc.graine + 999)
  await db.delete(); await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${DEBUT}T07:00:00`))
  const problemes: string[] = []
  try {
    await enregistrerArrivee(r)
  } catch (e) {
    vi.useRealTimers()
    return [`questionnaire : ${(e as Error).message}`]
  }
  if (sc.futures?.length) {
    const e0 = (await db.reglages.get('entrainement'))!.valeur as ReglagesEntrainement
    await db.reglages.put({ id: 'entrainement', valeur: { ...e0, programme: { ...e0.programme!, semainesTypesFutures: sc.futures } } } as never)
  }
  const fin = [r.course.date, ...(r.autresCourses ?? []).map((c) => c.date)].sort().pop()!
  const cp = r.cpW!
  let refPrec: number | undefined
  let prec: { budget: number; allegee: boolean; reduite: boolean } | undefined
  const derniers = new Map<string, { palier: number; resultat?: string }>()
  let nSemaine = 0
  for (let l = DEBUT; l <= decalerJour(fin, 14); l = decalerJour(l, 7)) {
    nSemaine++
    vi.setSystemTime(new Date(`${l}T06:00:00`))
    try {
      await genererSemaineVelo(l)
    } catch (e) {
      problemes.push(`${l} : la semaine ne se construit pas (${(e as Error).message})`)
      continue
    }
    const e = (await db.reglages.get('entrainement'))!.valeur as ReglagesEntrainement
    const prog = programmeAu(e.programme!, l)
    // Le profil prend le temps par semaine d'une semaine type à venir quand elle commence
    const psH = ((await db.reglages.get('profil-sportif'))?.valeur as { heuresSemaine?: string } | undefined)?.heuresSemaine
    const tranche = heuresAu(e.programme!, psH ?? r.heuresSemaine, l) ?? r.heuresSemaine
    const meta = await lireMeta(l)
    if (!meta) { problemes.push(`${l} : pas de budget`); continue }
    const { phase } = phaseDe(l, prog.phases)
    const toutes = (await db.prevues.where('date').between(l, decalerJour(l, 7), true, true).toArray()).filter((x) => x.statut === 'prevue')
    const semaine = toutes.filter((x) => x.sport === 'velo' && x.origine === 'auto' && x.date <= decalerJour(l, 6))
    const courses = e.programme!.competitions.map((c) => c.date)
    const ici = (d: string) => d >= l && d <= decalerJour(l, 6)
    const p = (t: string) => problemes.push(`${l} [${phase.type}] : ${t}`)

    // Budget
    if (!Number.isFinite(meta.budget) || meta.budget <= 0) p(`budget ${meta.budget}`)
    if (refPrec && meta.budgetRef > refPrec * 1.1 + 1) p(`budget +${Math.round((meta.budgetRef / refPrec - 1) * 100)} % (${refPrec} → ${meta.budgetRef}) · ${meta.raison}`)
    refPrec = meta.budgetRef
    // Audit des chiffres (17/11/2026) : le budget affiché est le total des séances prévues, et ce qu'il annonce est vrai
    const totalPrevu = semaine.reduce((t, x) => t + (x.kjPrevu ?? 0), 0)
    if (Math.abs(totalPrevu - meta.budget) > 3) p(`budget affiché ${meta.budget} kJ ≠ séances prévues ${Math.round(totalPrevu)} kJ`)
    const ecartVise = meta.budgetVise ? meta.budget / meta.budgetVise : 1
    const explique = /limité|dépassent|Point de départ/.test(meta.raison)
    if (!explique && (ecartVise < 0.95 || ecartVise > 1.05)) p(`prévu ${meta.budget} kJ pour un budget visé de ${meta.budgetVise} kJ, sans explication · ${meta.raison}`)
    if (prec && !prec.allegee && meta.allegee && !explique && meta.budget > prec.budget * 0.8) p(`semaine allégée pas allégée : ${prec.budget} → ${meta.budget} kJ (${Math.round((meta.budget / prec.budget - 1) * 100)} %)`)
    if (prec && !prec.allegee && !prec.reduite && !meta.allegee && /^\+/.test(meta.raison) && !explique && meta.budget > prec.budget * 1.125) p(`hausse annoncée « ${meta.raison.split(' :')[0]} », réelle +${Math.round((meta.budget / prec.budget - 1) * 100)} % (${prec.budget} → ${meta.budget})`)
    prec = { budget: meta.budget, allegee: meta.allegee, reduite: (meta.budgetVise ?? meta.budget) < meta.budgetRef * 0.9 }
    for (const s of semaine) {
      // Séances bien formées
      if (!(s.dureeMin > 0) || !(s.kjPrevu! > 0) || Number.isNaN(s.kjPrevu)) p(`${s.titre} : durée ${s.dureeMin}, kJ ${s.kjPrevu}`)
      const et = s.velo?.etapes
      if (et) {
        const plat = deplier(et)
        const total = plat.reduce((t, x) => t + x.dureeSec, 0)
        if (Math.abs(total - s.dureeMin * 60) > 120) p(`${s.titre} : déroulé de ${Math.round(total / 60)} min pour ${s.dureeMin} min`)
        // kJ annoncés = kJ des étapes (audit des chiffres du 17/11/2026), quand toutes les étapes ont leurs watts
        if (plat.every((x) => x.w !== undefined) && s.kjPrevu) {
          const kjEt = plat.reduce((t, x) => t + (x.dureeSec * x.w!) / 1000, 0)
          if (Math.abs(kjEt - s.kjPrevu) > Math.max(15, s.kjPrevu * 0.04)) p(`${s.titre} : ${s.kjPrevu} kJ annoncés, ${Math.round(kjEt)} kJ dans les étapes`)
        }
        for (const x of plat) {
          if (x.dureeSec <= 0) p(`${s.titre} : étape « ${x.libelle} » de ${x.dureeSec} s`)
          if (x.w !== undefined && (Number.isNaN(x.w) || x.w < 0.3 * cp || x.w > 2.6 * cp)) p(`${s.titre} : « ${x.libelle} » à ${x.w} W (CP ${cp})`)
        }
      }
      // Pas d'intensité en reprise ni en récupération
      if ((phase.type === 'reprise' || phase.type === 'recuperation') && INTENSES.includes(s.velo?.famille ?? '')) p(`${s.titre} en ${phase.type}`)
      // Créneaux
      if (s.velo?.famille !== 'course' && s.velo?.famille !== 'test') {
        const longue = !!s.longue || ['z2-long', 'simulation-ligne', 'cyclo-montees'].includes(s.velo?.famille ?? '') || s.date === semaine.find((x) => x.velo?.famille === 'z2-long')?.date
        const max = longue ? prog.maxLongMin : s.velo?.formatId === 'sv1-dedie' ? prog.maxSemaineMin + 10 : prog.maxSemaineMin
        if (s.dureeMin > max + 5) p(`${s.titre} : ${s.dureeMin} min pour un créneau de ${max} min`)
      }
      // Feu orange : raccourcie, mêmes watts ; 1er seuil en endurance
      const ad = adapterDuJour(s, 'orange')
      if (ad.modifiee && ad.etapes && s.velo?.etapes) {
        const av = deplier(s.velo.etapes), ap = deplier(ad.etapes)
        const duree = (x: typeof av) => x.reduce((t, y) => t + y.dureeSec, 0)
        const wMax = (x: typeof av) => Math.max(0, ...x.map((y) => y.w ?? 0))
        if (duree(ap) >= duree(av)) p(`feu orange : ${s.titre} pas raccourcie`)
        if (INTENSES.includes(s.velo.famille) && Math.abs(wMax(ap) - wMax(av)) > 5) p(`feu orange : ${s.titre} à ${wMax(ap)} W au lieu de ${wMax(av)} W`)
      }
    }
    // Heures dans la tranche (hors course)
    const heures = semaine.filter((x) => x.velo?.famille !== 'course').reduce((t, s) => t + s.dureeMin, 0) / 60
    if (heures > heuresDe(tranche)[1] + 0.25) p(`${heures.toFixed(1)} h prévues pour « ${tranche} »`)
    // Une séance par jour, pas deux jours durs d'affilée
    if (new Set(semaine.map((s) => s.date)).size < semaine.length) p('deux séances de vélo le même jour')
    const dures = semaine.filter((s) => s.intensite === 'haute').map((s) => s.date).sort()
    // (deux courses que tu as mises à la suite : ton choix)
    for (let i = 1; i < dures.length; i++) if (decalerJour(dures[i - 1], 1) === dures[i] && !(courses.includes(dures[i - 1]) && courses.includes(dures[i]))) p(`deux jours durs d'affilée (${dures[i - 1]})`)
    // Tests : jamais en affûtage, jamais dans les 4 jours avant une course
    for (const s of semaine.filter((x) => x.velo?.famille === 'test')) {
      if (phase.type === 'affutage') p('test CP en affûtage')
      if (courses.some((c) => c > s.date && c <= decalerJour(s.date, 4))) p(`test CP le ${s.date}, moins de 4 jours avant une course`)
    }
    // Courses A et B dans la semaine : la course est prévue ce jour-là, rien d'autre à vélo ce jour-là
    for (const c of courses.filter(ici)) {
      const ceJour = semaine.filter((x) => x.date === c)
      if (ceJour.length && !ceJour.every((x) => x.velo?.famille === 'course')) p(`le jour de la course (${c}) : ${ceJour.map((x) => x.titre).join(', ')}`)
    }
    // Cycle 1er seuil : séance dédiée chaque semaine chargée (4 jours de vélo ou plus, sans test ni course)
    const nVelo = prog.semaineType.filter((x) => x.startsWith('velo')).length
    if (phase.type === 'base' && !meta.allegee && nVelo >= 4 && !semaine.some((x) => x.velo?.famille === 'test' || x.velo?.famille === 'course') && !courses.some(ici)
      && semaine.length >= nVelo && semaine.some((x) => (x.velo?.blocsSv1 ?? 0) > 0) && !semaine.some((x) => x.velo?.formatId === 'sv1-dedie')) p('cycle 1er seuil sans séance dédiée au 1er seuil')
    // Paliers
    for (const s of semaine.filter((x) => INTENSES.includes(x.velo?.famille ?? '') && x.velo?.palier !== undefined)) {
      const pal = s.velo!.palier!
      if (pal < 0 || pal > 3) p(`palier ${pal} hors limites (${s.titre})`)
      const prec = derniers.get(s.velo!.famille)
      if (prec?.resultat === 'ratee' && pal > prec.palier) p(`${s.titre} au palier ${pal + 1} juste après un palier ${prec.palier + 1} raté`)
    }
    // Muscu
    const muscus = toutes.filter((x) => x.muscu && x.date <= decalerJour(l, 6))
    // Récupération : 1 séance d'entretien, 3 jours après la course au plus tôt (15/11/2026)
    const maxMuscu = ['recuperation', 'fin-prepa', 'specifique', 'affutage', 'entretien'].includes(phase.type) ? 1 : 2
    if (muscus.length > maxMuscu) p(`${muscus.length} séances de muscu`)
    for (const m of muscus) {
      const velo = toutes.find((x) => x.sport === 'velo' && x.date === m.date)
      if (velo && !(m.muscu!.soir && velo.intensite !== 'basse' && velo.velo?.famille !== 'test')) p(`muscu le ${m.date} avec ${velo.titre}`)
      if (courses.some((c) => c >= m.date && c <= decalerJour(m.date, 4))) p(`muscu le ${m.date}, moins de 4 jours avant une course`)
      if (courses.some((c) => c < m.date && decalerJour(c, 2) >= m.date)) p(`muscu le ${m.date}, moins de 3 jours après une course`)
      if (!(m.dureeMin > 0)) p(`muscu de ${m.dureeMin} min`)
    }
    // Panne
    const panne = sc.pannes.find(ici)
    if (panne) {
      vi.setSystemTime(new Date(`${panne}T06:00:00`))
      await declarerPanneVelo(panne, decalerJour(panne, 3))
      const pendant = (await db.prevues.where('date').between(panne, decalerJour(panne, 3), true, true).toArray()).filter((x) => x.sport === 'velo' && x.statut === 'prevue')
      if (pendant.length) p(`${pendant.length} séances de vélo prévues pendant la panne`)
    }
    // Intensité sautée deux semaines de suite : l'alerte
    if (sc.sauts.length && l === decalerJour(sc.sauts[1], 7)) {
      const sautees = (await db.prevues.where('date').between(sc.sauts[0], decalerJour(sc.sauts[1], 6), true, true).toArray()).filter((x) => x.origine === 'auto' && INTENSES.includes(x.velo?.famille ?? ''))
      const deuxSemaines = sc.sauts.every((s0) => sautees.some((x) => x.date >= s0 && x.date <= decalerJour(s0, 6)))
      if (deuxSemaines && sautees.every((x) => x.statut !== 'faite') && !(await seancesClesSautees(l)).includes('intensite'))
        p(`intensité sautée 2 semaines de suite sans alerte · ${(await db.prevues.where('date').between(sc.sauts[0], decalerJour(sc.sauts[1], 6), true, true).toArray()).filter((x) => x.sport === 'velo').map((x) => `${x.date.slice(5)} ${x.titre} ${x.statut} ${x.origine}`).join(' | ')}`)
    }

    if (journal) journal.push(`${l} · ${phase.type}${meta.allegee ? ' (allégée)' : ''} · budget ${meta.budget} kJ (réf. ${meta.budgetRef}, visé ${meta.budgetVise ?? meta.budget}) · ${meta.raison}\n    ${toutes.filter((x) => x.date <= decalerJour(l, 6)).sort((x, y) => x.date.localeCompare(y.date)).map((x) => `${x.date.slice(5)} ${x.titre} (${x.dureeMin}′${x.kjPrevu ? `, ${x.kjPrevu} kJ` : ''})`).join(' | ')}`)
    if (detail && problemes.some((x) => x.startsWith(l))) problemes.push(`   semaine : ${toutes.filter((x) => x.date <= decalerJour(l, 6)).sort((x, y) => x.date.localeCompare(y.date)).map((x) => `${x.date.slice(5)} ${x.sport} ${x.titre} (${x.dureeMin}′, ${x.intensite})`).join(' | ')} · roles ${prog.semaineType.join(',')} · courses ${courses.filter(ici).join(',')}`)
    // Semaines construites à l'avance (19/11/2026 : recalculées loin devant, elles se croyaient après un arrêt — « 53 jours
    // sans vélo » — et tombaient toutes en reprise sans intensité ; le graphique de la Saison disait autre chose)
    if (nSemaine === 4 && decalerJour(l, 42) <= fin) {
      const loin = decalerJour(l, 42)
      try {
        await genererSemaineEtSuite(loin)
        const vue = await saison()
        for (let w = decalerJour(l, 7); w <= loin; w = decalerJour(w, 7)) {
          const mw = await lireMeta(w)
          const pw = (t: string) => problemes.push(`${w} [construite le ${l}] : ${t}`)
          if (!mw) { pw('pas construite'); continue }
          const typeW = phaseDe(w, programmeAu(e.programme!, w).phases).phase.type
          // La semaine d'après, construite le lundi : vraie reprise possible (plus de 10 jours sans vélo à ce jour) ; plus loin, jamais
          const repriseW = /sans vélo|très légères/.test(mw.raison)
          if (repriseW && w > decalerJour(l, 7)) pw(`fausse reprise : ${mw.raison}`)
          const sw = (await db.prevues.where('date').between(w, decalerJour(w, 6), true, true).toArray()).filter((x) => x.sport === 'velo' && x.origine === 'auto' && x.statut === 'prevue')
          const avecIntensite = sw.some((x) => INTENSES.includes(x.velo?.famille ?? '') || ['test', 'course'].includes(x.velo?.famille ?? '') || x.intensite === 'haute')
          if (!['reprise', 'recuperation'].includes(typeW) && !repriseW && sw.length >= 3 && !avecIntensite) pw(`aucune intensité (${typeW}${mw.allegee ? ', allégée' : ''}) : ${sw.map((x) => x.titre).join(' | ')}`)
          // Le graphique de la Saison montre le même chiffre que la Semaine
          const barre = vue.semaines.find((x) => x.lundi === w)
          const prevu = Math.round((await chargesSemaine(w)).kjPrevus)
          if (barre && Math.abs(barre.budget - prevu) > 3) pw(`graphique ${barre.budget} kJ, Semaine ${prevu} kJ`)
        }
      } catch (err) {
        p(`construction à l'avance impossible (${(err as Error).message})`)
      }
    }

    // La semaine vécue
    const malade = a() < vie.malade
    for (const m of muscus) if (!malade && a() >= vie.muscuSautee) await db.prevues.put({ ...m, statut: 'faite' })
    const vecue = (await db.prevues.where('date').between(l, decalerJour(l, 6), true, true).toArray()).filter((x) => x.sport === 'velo' && x.origine === 'auto' && x.statut === 'prevue').sort((x, y) => x.date.localeCompare(y.date))
    const rouges = a() < vie.rouges ? 2 : 0
    // Recalcul en milieu de semaine, vendredi matin (19/11/2026 : la séance au 1er seuil du vendredi devenait une Z2 + sprints
    // quand il ne restait qu'une endurance) : ce qui était prévu après jeudi garde sa séance au 1er seuil et son intensité
    // (sauf si une séance dure manquée plus tôt prend sa place : report d'intensité)
    const jeudi = decalerJour(l, 3)
    const sv1Avant = vecue.some((x) => x.date > jeudi && x.velo?.formatId === 'sv1-dedie')
    const dur = (x: { intensite?: string; velo?: { famille?: string } }) => INTENSES.includes(x.velo?.famille ?? '') || (x.intensite === 'haute' && x.velo?.famille !== 'course' && x.velo?.famille !== 'test')
    const intenseAvant = vecue.some((x) => x.date > jeudi && dur(x))
    let recalculee = false
    for (const [i, s] of vecue.entries()) {
      if (i < rouges) await db.decisions.put({ date: s.date, couleur: 'rouge', force: true } as never)
      // (pas les semaines de panne : la séance dure y est reportée après la réparation ; ni avec une muscu cochée d'avance
      // après jeudi, artefact de la simulation qui coche la muscu de toute la semaine dès le lundi)
      if (!recalculee && s.date > jeudi && !malade && !rouges && !panne && !muscus.some((m) => m.date > jeudi)) {
        recalculee = true
        vi.setSystemTime(new Date(`${decalerJour(jeudi, 1)}T06:00:00`))
        await genererSemaineVelo(l).catch((err: Error) => p(`recalcul du jeudi impossible (${err.message})`))
        const apres = (await db.prevues.where('date').between(decalerJour(jeudi, 1), decalerJour(l, 6), true, true).toArray()).filter((x) => x.sport === 'velo' && x.origine === 'auto' && x.statut === 'prevue')
        // Vraie reprise : plus de 10 jours sans vélo à ce vendredi (la raison n'est pas toujours dans le texte du budget)
        const derniereSortie = (await db.seances.where('date').below(decalerJour(jeudi, 1)).toArray()).filter((x) => x.sport === 'velo').map((x) => x.date).sort().pop()
        const repriseVraie = !!derniereSortie && derniereSortie <= decalerJour(jeudi, -9)
        const dureManquee = (await db.prevues.where('date').between(l, jeudi, true, true).toArray()).some((x) => x.statut === 'non-faite' && dur(x))
        if (sv1Avant && !dureManquee && !repriseVraie && !apres.some((x) => x.velo?.formatId === 'sv1-dedie')) p(`recalcul du jeudi : séance au 1er seuil perdue (avant : ${vecue.filter((x) => x.date > jeudi).map((x) => `${x.date.slice(5)} ${x.titre}`).join(' | ')} ; après : ${apres.map((x) => `${x.date.slice(5)} ${x.titre}`).join(' | ')} ; fait : ${(await db.prevues.where('date').between(l, jeudi, true, true).toArray()).filter((x) => x.sport === 'velo').map((x) => `${x.date.slice(5)} ${x.titre} ${x.statut}`).join(' | ')})`)
        if (intenseAvant && !repriseVraie && !apres.some(dur)) p(`recalcul du jeudi : intensité perdue (avant : ${vecue.filter((x) => x.date > jeudi).map((x) => `${x.date.slice(5)} ${x.titre}`).join(' | ')} ; après : ${apres.map((x) => `${x.date.slice(5)} ${x.titre}`).join(' | ')} ; fait : ${(await db.prevues.where('date').between(l, jeudi, true, true).toArray()).filter((x) => x.sport === 'velo').map((x) => `${x.date.slice(5)} ${x.titre} ${x.statut}`).join(' | ')})`)
        vi.setSystemTime(new Date(`${l}T06:00:00`))
        // La semaine d'après part du budget tel que ce recalcul l'a laissé
        const mR = await lireMeta(l)
        // (le budget visé de la semaine est fixe ; le total prévu, lui, baisse quand une séance est manquée)
        if (mR) { refPrec = mR.budgetRef; prec = { budget: mR.budgetVise ?? mR.budget, allegee: mR.allegee, reduite: (mR.budgetVise ?? mR.budget) < mR.budgetRef * 0.9 } }
        // La suite de la semaine vit avec les séances recalculées
        const suite = apres.sort((x, y) => x.date.localeCompare(y.date))
        for (const t of suite) {
          const intenseT = INTENSES.includes(t.velo?.famille ?? '')
          if (a() < vie.rate) { await db.prevues.put({ ...t, statut: 'non-faite' }); continue }
          const resultatT = intenseT ? (a() < vie.echec ? 'ratee' : 'reussie') : undefined
          if (intenseT) derniers.set(t.velo!.famille, { palier: t.velo!.palier ?? 0, resultat: t.velo!.allegee ? undefined : resultatT })
          await db.prevues.put({ ...t, statut: 'faite', ...(resultatT ? { resultat: resultatT } : {}) } as never)
          await db.seances.put({ id: `s-${t.id}`, date: t.date, sport: 'velo', dureeSec: Math.round(t.dureeMin * 60), kj: Math.round(t.kjPrevu ?? 0), prevueId: t.id, source: 'manuel' } as never)
        }
        break
      }
      const intense = INTENSES.includes(s.velo?.famille ?? '')
      if (malade || a() < vie.rate || (intense && sc.sauts.includes(l))) { await db.prevues.put({ ...s, statut: 'non-faite' }); continue }
      const part = a() < vie.courte ? 0.7 : 1
      const resultat = intense ? (a() < vie.echec ? 'ratee' : 'reussie') : undefined
      if (intense) derniers.set(s.velo!.famille, { palier: s.velo!.palier ?? 0, resultat: s.velo!.allegee ? undefined : resultat })
      await db.prevues.put({ ...s, statut: 'faite', ...(resultat ? { resultat } : {}) } as never)
      await db.seances.put({ id: `s-${s.id}`, date: s.date, sport: 'velo', dureeSec: Math.round(s.dureeMin * 60 * part), kj: Math.round((s.kjPrevu ?? 0) * part), prevueId: s.id, source: 'manuel' } as never)
    }
  }
  vi.useRealTimers()
  return problemes
}
