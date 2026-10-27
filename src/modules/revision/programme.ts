import { decalerJour, depuisJour, ecartJours } from '../../core/dates'
import type { Epreuve, Notion, Rappel, Theme } from './types'

/**
 * Planification des révisions (fonctions pures, testées).
 * Tout part des J0 réels : rien n'est figé, tout se recalcule chaque jour.
 */

// ---------- Les 41 notions, dans l'ordre d'apprentissage (alternance écrit 1 / écrit 2) ----------

export const NOTIONS_DEPART: [string, Epreuve, Theme][] = [
  ['Sport scolaire', 'E1', 'T1'], ['Savoir', 'E1', 'T1'], ['Textes officiels', 'E2', 'Théorie'], ['Finalités', 'E1', 'T1'],
  ["Théories de l'apprentissage", 'E2', 'Théorie'], ['Leçon', 'E1', 'T1'], ['Pratique pédagogique', 'E1', 'T1'], ['PACE', 'E2', 'Blocs'],
  ['Évaluation', 'E1', 'T1'], ["Motifs d'agir", 'E2', 'Théorie'], ['Diversité des élèves', 'E1', 'T1'], ['Plaisir', 'E2', 'Blocs'],
  ['Citoyenneté', 'E1', 'T1'], ['Activité et expérience', 'E2', 'Théorie'], ['Pôles de sens', 'E2', 'Blocs'], ['Adolescence', 'E2', 'Théorie'],
  ['Formation des enseignants', 'E1', 'T1'], ['Émotion', 'E2', 'Théorie'], ['Projet collectif', 'E2', 'Blocs'], ['Estime de soi', 'E2', 'Théorie'],
  ['Corps', 'E1', 'T2'], ['Bien-être', 'E2', 'Théorie'], ['Mise en projet individuelle', 'E2', 'Blocs'], ['Effort (É2)', 'E2', 'Théorie'],
  ['Geste', 'E1', 'T2'], ['Performance', 'E2', 'Théorie'], ['Formes de groupement', 'E2', 'Blocs'], ['Processus de régulation', 'E2', 'Théorie'],
  ['Effort (É1)', 'E1', 'T2'], ['Ressources', 'E2', 'Théorie'], ['Aménagement du milieu', 'E2', 'Blocs'], ['Sensations', 'E2', 'Théorie'],
  ['Santé', 'E1', 'T2'], ['Techniques corporelles', 'E2', 'Théorie'], ['Évaluation / capitalisation', 'E2', 'Blocs'], ['Sciences', 'E1', 'T2'],
  ['Acteurs', 'E1', 'T3'], ['Débat et controverse', 'E1', 'T3'], ['Tutorat', 'E2', 'Blocs'], ['Débats par période', 'E1', 'T3'],
  ['Transformation du système éducatif', 'E1', 'T3'],
]

export const NOMS_THEMES: Record<Theme, string> = {
  T1: 'T1 · Transmettre et adapter', T2: 'T2 · Le geste et l’effort', T3: 'T3 · Débats et controverses', Théorie: 'Théorie', Blocs: 'Blocs',
}

// ---------- Rappels (méthode des J, en feuille blanche) ----------

export const INTERVALLES = [1, 4, 10, 21, 45, 90]
/** Durée prévue d'un rappel (min) selon l'intervalle */
export const DUREES: Record<number, number> = { 1: 30, 4: 25, 10: 25, 21: 20, 45: 20, 90: 15 }
export const dureeRappel = (r: Pick<Rappel, 'intervalle' | 'cible'>) => (r.cible ? 20 : (DUREES[r.intervalle] ?? 20))

/** Rappels J+1 … J+90 d'une notion à partir d'un jour (ceux qui tombent après la veille du concours sont ignorés). */
export function serieDeRappels(notionId: string, depart: string, p: Parametres, id: (i: number) => string): Rappel[] {
  return INTERVALLES.map((n, i) => ({ id: id(i), notionId, intervalle: n, prevu: decalerJour(depart, n) }))
    .filter((r) => r.prevu <= p.veille)
}

// ---------- Paramètres ----------

export type Periode = 'cours' | 'vacances' | 'sujets' | 'sujets-vacances' | 'derniere' | 'repos' | 'veille' | 'concours'

/** Capacité de rappels (minutes) par jour de la semaine, dimanche d'abord (comme Date.getDay()). */
export type Capacites = [number, number, number, number, number, number, number]

export interface Creneau {
  debut: string
  fin: string
  type: 'notion' | 'fixation' | 'rappels' | 'stage' | 'internat' | 'memoire' | 'sujet' | 'express' | 'correction' | 'relecture' | 'synthese' | 'libre'
  libelle?: string
  optionnel?: boolean
}

export interface Parametres {
  /** Écrit 1 (l'écrit 2 a lieu le lendemain) */
  concours: string
  veille: string
  vacances: { nom: string; debut: string; fin: string }[]
  /** Début de la phase « sujets » */
  debutSujets: string
  /** Début de la dernière ligne droite */
  derniereLigne: string
  repos: string[]
  /** Changement de lieu de stage : après-midis et soirées redéfinis à partir de ce jour */
  changementStage: string
  /** Après-midis et soirées à partir du changement de stage, par jour de la semaine (vide = comme avant) */
  apresMidiNouveauStage: Partial<Record<number, Creneau[]>>
  /** Lundis sans stage (l'après-midi devient rappels) */
  lundisSansStage: string[]
  /** Envoi du document de mémoire au tuteur */
  memoireEnvoi: string
  memoireEnvoye?: boolean
  capacites: Record<'vacances' | 'cours' | 'sujets' | 'sujets-vacances', Capacites>
}

export const PARAMETRES_DEFAUT: Parametres = {
  concours: '2027-03-02',
  veille: '2027-03-01',
  vacances: [
    { nom: 'Toussaint', debut: '2026-10-17', fin: '2026-11-01' },
    { nom: 'Noël', debut: '2026-12-19', fin: '2027-01-03' },
  ],
  debutSujets: '2026-12-22',
  derniereLigne: '2027-02-22',
  repos: ['2026-12-25', '2027-01-01', '2027-02-28'],
  changementStage: '2027-01-22',
  apresMidiNouveauStage: {},
  lundisSansStage: [],
  memoireEnvoi: '2026-10-30',
  capacites: {
    vacances: [150, 120, 120, 45, 120, 90, 150],
    cours: [150, 60, 120, 150, 120, 40, 90],
    sujets: [120, 60, 90, 60, 90, 40, 60],
    'sujets-vacances': [120, 90, 90, 90, 90, 90, 60],
  },
}

const jourSemaine = (jour: string) => depuisJour(jour).getDay()
export const enVacances = (jour: string, p: Parametres) => p.vacances.some((v) => jour >= v.debut && jour <= v.fin)

export function periodeDu(jour: string, p: Parametres): Periode {
  const ecrit2 = decalerJour(p.concours, 1)
  if (jour === p.concours || jour === ecrit2) return 'concours'
  if (jour === p.veille) return 'veille'
  if (p.repos.includes(jour)) return 'repos'
  if (jour >= p.derniereLigne && jour < p.veille) return 'derniere'
  if (jour >= p.debutSujets) return enVacances(jour, p) ? 'sujets-vacances' : 'sujets'
  return enVacances(jour, p) ? 'vacances' : 'cours'
}

export const NOMS_PERIODES: Record<Periode, string> = {
  cours: 'Cours', vacances: 'Vacances', sujets: 'Sujets', 'sujets-vacances': 'Sujets (vacances)',
  derniere: 'Dernière ligne droite', repos: 'Repos', veille: 'Veille du concours', concours: 'Concours',
}

/** Minutes de rappels possibles ce jour-là. */
export function capacite(jour: string, p: Parametres): number {
  const per = periodeDu(jour, p)
  const js = jourSemaine(jour)
  if (per === 'concours' || per === 'repos') return 0
  if (per === 'veille') return 60
  if (per === 'derniere') return js === 4 || js === 5 ? 240 : js === 6 ? 120 : js === 0 ? 0 : p.capacites.sujets[js]
  // Lundi sans stage : l'après-midi passe en rappels
  if (per === 'cours' && js === 1 && p.lundisSansStage.includes(jour)) return 150
  return p.capacites[per][js]
}

// ---------- Journées types ----------

/** Jour où l'on commence une nouvelle notion : lun, mar, jeu, sam en cours ; du lundi au samedi en vacances. */
export function estJourNotion(jour: string, p: Parametres): boolean {
  const per = periodeDu(jour, p)
  const js = jourSemaine(jour)
  if (per === 'vacances' || per === 'sujets-vacances') return js !== 0
  if (per === 'cours' || per === 'sujets') return [1, 2, 4, 6].includes(js)
  return false
}

const c = (debut: string, fin: string, type: Creneau['type'], libelle?: string, optionnel?: boolean): Creneau =>
  ({ debut, fin, type, ...(libelle ? { libelle } : {}), ...(optionnel ? { optionnel } : {}) })

/** Après-midi et soirée types selon la période et le jour. `fixation` = créneau de feuille blanche (ou de correction). */
function apresMidi(jour: string, p: Parametres, matin: Creneau['type'] | undefined): Creneau[] {
  const per = periodeDu(jour, p)
  const js = jourSemaine(jour)
  const vacances = per === 'vacances' || per === 'sujets-vacances'
  let l: Creneau[]
  if (vacances) {
    l = js === 3 && per === 'vacances' ? [c('13:30', '14:15', 'rappels'), c('14:30', '17:45', 'memoire'), c('18:00', '18:30', 'fixation')]
      : js === 3 ? [c('13:30', '14:15', 'rappels'), c('14:30', '17:45', 'memoire', 'Mémoire (option)', true)]
      : js === 5 ? [c('13:45', '14:30', 'fixation'), c('14:45', '16:15', 'rappels')]
      : js === 6 ? [c('14:00', '14:45', 'fixation'), c('15:15', '16:45', 'rappels')]
      : js === 0 ? [c('14:00', '16:00', 'relecture', 'Relecture légère', true)]
      : [c('13:45', '14:30', 'fixation'), c('14:45', '16:45', 'rappels'), c('17:00', '18:00', 'libre', 'Marge')]
  } else {
    const nouveau = jour >= p.changementStage ? p.apresMidiNouveauStage[js] : undefined
    l = nouveau ?? (
      js === 1 ? [c('13:30', '14:00', 'fixation'), c('14:00', '17:00', 'stage', 'Stage (si présent)'), c('17:30', '18:30', 'rappels', undefined, true)]
      : js === 2 ? [c('13:00', '13:45', 'fixation'), c('14:00', '16:00', 'stage'), c('16:30', '18:30', 'rappels')]
      : js === 3 ? [c('13:30', '17:30', 'stage'), c('19:00', '22:00', 'internat', 'Stage à l’internat (pas de révision)')]
      : js === 4 ? [c('13:30', '14:30', 'fixation'), c('14:45', '16:45', 'rappels'), c('19:00', '22:00', 'internat', 'Stage à l’internat (pas de révision)')]
      : js === 5 ? [c('17:00', '17:40', 'rappels', 'Rappel court')]
      : js === 6 ? [c('14:00', '14:45', 'fixation'), c('15:15', '16:45', 'rappels')]
      : [c('14:00', '16:00', 'relecture', 'Relecture légère', true)]
    )
    if (js === 1 && p.lundisSansStage.includes(jour)) l = l.map((x) => (x.type === 'stage' ? c(x.debut, x.fin, 'rappels', 'Rappels (pas de stage)') : x))
  }
  // Créneau de fixation : feuille blanche après une notion, correction après un sujet, sinon rien
  return l.flatMap((x, i) => {
    if (x.type !== 'fixation') return [x]
    if (matin === 'notion') return [x]
    if (matin === 'sujet') {
      // 1 h, sans déborder sur le créneau suivant
      const fin = [decalerHeure(x.debut, 60), l[i + 1]?.debut ?? '23:59'].sort()[0]
      return [c(x.debut, fin, 'correction', 'Correction + fiche d’erreurs')]
    }
    return []
  })
}

const decalerHeure = (h: string, min: number) => {
  const t = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + min
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/**
 * Créneaux d'une journée.
 * `notionRestante` : il reste des notions à apprendre (sinon les jours de notion deviennent des jours de sujet).
 */
export function creneauxDu(jour: string, p: Parametres, notionRestante: boolean): Creneau[] {
  const per = periodeDu(jour, p)
  const js = jourSemaine(jour)
  if (per === 'concours') return [c('08:00', '13:00', 'sujet', jour === p.concours ? '✍️ Écrit 1' : '✍️ Écrit 2')]
  if (per === 'repos') return [c('09:00', '18:00', 'libre', 'Repos total')]
  if (per === 'veille') return [c('09:00', '10:00', 'relecture', 'Relecture (1 h max), puis repos'), c('10:00', '18:00', 'libre', 'Repos')]
  if (per === 'derniere') {
    const e = ecartJours(p.derniereLigne, jour)
    if (e <= 2) return [c('08:30', '13:30', 'sujet', 'Sujet chronométré'), c('14:30', '15:30', 'correction', 'Correction + fiche d’erreurs'), c('16:00', '18:00', 'rappels')]
    if (e <= 4) return [c('09:00', '12:00', 'synthese', 'Fiches de synthèse'), c('14:00', '18:00', 'rappels', 'Rappels intensifs (points faibles)')]
    return [c('09:00', '11:00', 'relecture', 'Relecture légère (2 h)')]
  }
  const vacances = per === 'vacances' || per === 'sujets-vacances'
  const phaseSujets = per === 'sujets' || per === 'sujets-vacances'
  let matin: Creneau[] = []
  if (estJourNotion(jour, p) && notionRestante) matin = [vacances || js === 6 ? c('09:00', '12:30', 'notion') : c('08:45', '12:15', 'notion')]
  else if (phaseSujets && js === 3) matin = [c('08:30', '10:00', 'express', 'Sujet express 1 (plan + intro)'), c('10:15', '11:45', 'express', 'Sujet express 2 (plan + intro)')]
  else if (phaseSujets && (estJourNotion(jour, p) || (vacances && js === 5))) matin = [c('08:30', '13:30', 'sujet', 'Sujet complet chronométré')]
  else if (js === 3 && !vacances) matin = [c('08:45', '11:15', 'rappels')]
  else if (js === 0) matin = [c('09:00', '11:30', 'rappels', 'Rappels longs')]
  return [...matin, ...apresMidi(jour, p, matin[0]?.type)]
}

// ---------- Placement des rappels ----------

/** Priorité : petits intervalles d'abord (J+1, puis J+4…), puis les plus anciens. */
const priorite = (a: Rappel, b: Rappel) => a.intervalle - b.intervalle || a.prevu.localeCompare(b.prevu)

/**
 * Répartit les rappels à faire jour par jour à partir d'aujourd'hui, dans la limite de la capacité de chaque jour.
 * Ceux qui ne rentrent pas glissent au lendemain. Renvoie jour → rappels.
 */
export function placerRappels(rappels: Rappel[], jour: string, p: Parametres, nbJours = 21): Map<string, Rappel[]> {
  const enAttente = rappels.filter((r) => !r.fait && !r.annule).sort(priorite)
  const plan = new Map<string, Rappel[]>()
  const places = new Set<string>()
  for (let i = 0; i < nbJours; i++) {
    const d = decalerJour(jour, i)
    const cap = capacite(d, p)
    let total = 0
    const duJour: Rappel[] = []
    for (const r of enAttente) {
      if (places.has(r.id) || r.prevu > d) continue
      const duree = dureeRappel(r)
      if (total + duree > cap) continue
      total += duree
      duJour.push(r)
      places.add(r.id)
    }
    plan.set(d, duJour)
  }
  return plan
}

// ---------- Avancement ----------

/**
 * Notions prévues jour par jour (à partir d'aujourd'hui) et date de fin projetée de l'apprentissage.
 * `finieAujourdhui` : une notion a déjà été finie aujourd'hui (la suivante commence au prochain jour de notion).
 */
export function projection(notions: Notion[], jour: string, p: Parametres, finieAujourdhui: boolean) {
  const restantes = notions.filter((n) => n.statut !== 'finie').sort((a, b) => (a.statut === 'en-cours' ? -1 : b.statut === 'en-cours' ? 1 : a.ordre - b.ordre))
  const parJour = new Map<string, Notion>()
  let d = finieAujourdhui ? decalerJour(jour, 1) : jour
  let fin: string | undefined
  for (const n of restantes) {
    let garde = 0
    while (!estJourNotion(d, p) && garde++ < 400) d = decalerJour(d, 1)
    if (garde >= 400) break
    parJour.set(d, n)
    fin = d
    d = decalerJour(d, 1)
  }
  return { parJour, fin }
}

/** Niveau d'après un résultat de rappel. */
export const niveauDe = (r: Rappel['resultat']): Notion['niveau'] => (r === 'su' ? 3 : r === 'hesitant' ? 2 : 1)

/** Jours restants avant l'écrit 1. */
export const joursAvant = (jour: string, p: Parametres) => ecartJours(jour, p.concours)
