/**
 * Signal du jour 🟢🟠🔴 : règles de décision, paramétrables, chacune avec sa raison.
 *
 * Inspiré de l'entraînement guidé par la VFC (Kiviniemi 2007, Vesterinen 2016, Javaloyes 2019)
 * et du suivi multi-indicateurs recommandé (Bourdon et al., 2017 ; guide AIS) :
 *  - 🟢 aucun indicateur hors zone → séance prévue maintenue ;
 *  - 🟠 un seul indicateur hors zone → séance intense remplacée par de l'endurance basse ;
 *  - 🔴 deux indicateurs ou plus, ou malade / douleur → repos ou récupération active.
 */
import { decaler, type AnalyseVfc } from './vfc'

export type Couleur = 'vert' | 'orange' | 'rouge'
export type Recommandation = 'maintenir' | 'alleger' | 'remplacer' | 'repos'

export interface Seuils {
  /** FC de repos 7 j au-dessus de la base de plus de… (bpm) */
  fcReposEcart: number
  /** TSB en dessous de… */
  tsbMin: number
  /** Moyenne du ressenti du matin (1-5) en dessous de… */
  ressentiMin: number
  /** Note de sommeil (1-5) inférieure ou égale à… */
  sommeilMax: number
  /** Charge 7 j / moyenne des 4 semaines précédentes au-dessus de… */
  picMax: number
  /** CV 7 j au-dessus de… fois le CV habituel */
  cvFacteur: number
  /** Nuit courte : moins de… heures (Craven 2022 : ≤ 6 h dégrade la performance) */
  nuitMinH: number
  /** Dette : moyenne 7 j sous… heures (Walsh 2021 : < 7 h = sommeil court) */
  moyenne7MinH: number
  /** Dette personnelle : moyenne 7 j sous ta moyenne 30 j de plus de… heures */
  ecartPersoH: number
}

export const SEUILS_DEFAUT: Seuils = {
  fcReposEcart: 5, tsbMin: -20, ressentiMin: 2.5, sommeilMax: 2, picMax: 1.3, cvFacteur: 1.5, nuitMinH: 6, moyenne7MinH: 7, ecartPersoH: 0.75,
}

/** Durée de sommeil : nuit, moyenne 7 jours (au moins 3 nuits) et moyenne des 30 jours d'avant (au moins 10 nuits). */
export function analyserSommeil(nuits: { date: string; h?: number }[], date: string) {
  const entre = (du: string, au: string) => nuits.filter((n) => n.h !== undefined && n.date >= du && n.date <= au).map((n) => n.h!)
  const moy = (x: number[], min: number) => (x.length >= min ? x.reduce((a, b) => a + b, 0) / x.length : undefined)
  return {
    nuit: nuits.find((n) => n.date === date)?.h,
    moyenne7: moy(entre(decaler(date, -6), date), 3),
    moyenne30: moy(entre(decaler(date, -36), decaler(date, -7)), 10),
  }
}

/** "7 h 05" */
export function enHeures(h: number) {
  const min = Math.round(h * 60)
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export interface EntreeSignal {
  vfc: AnalyseVfc
  /** Moyenne des 5 notes de ressenti du matin */
  ressenti?: number
  sommeil?: number
  /** Durée de sommeil (h) : nuit, moyenne 7 jours, moyenne habituelle (30 jours) */
  sommeilH?: { nuit?: number; moyenne7?: number; moyenne30?: number }
  /** Absent tant que l'historique de charge est trop court */
  tsb?: number
  ratioPic?: number
  /** ATL / CTL (bloc chargé si > 1,1) */
  atlSurCtl?: number
  maladeOuDouleur?: boolean
}

export interface Alerte {
  code: 'vfc' | 'fc-repos' | 'ressenti' | 'tsb' | 'pic' | 'malade' | 'cv' | 'saturation'
  texte: string
  /** false = information seulement (ne compte pas dans le nombre d'indicateurs) */
  compte: boolean
}

export interface Signal {
  couleur: Couleur
  recommandation: Recommandation
  alertes: Alerte[]
  /** Vrai tant que la base VFC n'est pas constituée (14 jours) */
  calibrationVfc: boolean
  /** Phrase de synthèse */
  raison: string
}

const f1 = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

export function calculerSignal(e: EntreeSignal, s: Seuils = SEUILS_DEFAUT): Signal {
  const alertes: Alerte[] = []
  const { vfc } = e
  const calibrationVfc = vfc.zoneBasse === undefined

  if (e.maladeOuDouleur) alertes.push({ code: 'malade', texte: 'Tu as signalé être malade ou avoir une douleur', compte: true })

  if (vfc.ln7 !== undefined && vfc.zoneBasse !== undefined && vfc.ln7 < vfc.zoneBasse)
    alertes.push({ code: 'vfc', texte: `VFC 7 j sous ta zone normale (ln ${f1(vfc.ln7)} < ${f1(vfc.zoneBasse)})`, compte: true })

  if (vfc.fcRepos7 !== undefined && vfc.fcReposBase !== undefined && vfc.fcRepos7 > vfc.fcReposBase + s.fcReposEcart)
    alertes.push({ code: 'fc-repos', texte: `FC de repos 7 j élevée (${Math.round(vfc.fcRepos7)} bpm, base ${Math.round(vfc.fcReposBase)})`, compte: true })

  // Ressenti et sommeil : une seule alerte, quelle que soit la cause (note, nuit courte, dette)
  const textes: string[] = []
  const h = e.sommeilH
  if (h?.nuit !== undefined && h.nuit < s.nuitMinH) textes.push(`nuit courte (${enHeures(h.nuit)}, moins de ${s.nuitMinH} h)`)
  if (h?.moyenne7 !== undefined && h.moyenne7 < s.moyenne7MinH) textes.push(`dette de sommeil (${enHeures(h.moyenne7)} en moyenne sur 7 j, moins de ${s.moyenne7MinH} h)`)
  else if (h?.moyenne7 !== undefined && h.moyenne30 !== undefined && h.moyenne7 < h.moyenne30 - s.ecartPersoH)
    textes.push(`dette de sommeil (${enHeures(h.moyenne7)} sur 7 j contre ${enHeures(h.moyenne30)} d'habitude)`)
  if (e.sommeil !== undefined && e.sommeil <= s.sommeilMax) textes.push('sommeil mauvais cette nuit')
  if (e.ressenti !== undefined && e.ressenti < s.ressentiMin) textes.push(`ressenti bas ce matin (${f1(e.ressenti)}/5)`)
  if (textes.length) alertes.push({ code: 'ressenti', texte: textes.join(', ').replace(/^./, (c) => c.toUpperCase()), compte: true })

  if (e.tsb !== undefined && e.tsb < s.tsbMin)
    alertes.push({ code: 'tsb', texte: `Fraîcheur (TSB) basse : ${Math.round(e.tsb)}`, compte: true })

  if (e.ratioPic !== undefined && e.ratioPic > s.picMax)
    alertes.push({ code: 'pic', texte: `Pic de charge : 7 derniers jours à ${Math.round(e.ratioPic * 100)} % de ta moyenne`, compte: true })

  if (vfc.cv7 !== undefined && vfc.cvBase !== undefined && vfc.cv7 > vfc.cvBase * s.cvFacteur)
    alertes.push({ code: 'cv', texte: `VFC instable cette semaine (CV ${f1(vfc.cv7)} % contre ${f1(vfc.cvBase)} % d'habitude)`, compte: false })

  const n = alertes.filter((a) => a.compte).length
  let couleur: Couleur = e.maladeOuDouleur || n >= 2 ? 'rouge' : n === 1 ? 'orange' : 'vert'

  // VFC très haute + FC de repos basse pendant un bloc chargé : possible saturation parasympathique
  const saturation =
    vfc.ln7 !== undefined && vfc.zoneHaute !== undefined && vfc.ln7 > vfc.zoneHaute &&
    vfc.fcRepos7 !== undefined && vfc.fcReposBase !== undefined && vfc.fcRepos7 < vfc.fcReposBase &&
    (e.atlSurCtl ?? 0) > 1.1
  if (saturation && couleur === 'vert') {
    couleur = 'orange'
    alertes.push({ code: 'saturation', texte: 'VFC très haute et FC de repos basse en plein bloc chargé : possible saturation, fie-toi à tes sensations', compte: false })
  }

  const recommandation: Recommandation =
    couleur === 'rouge' ? 'repos' : couleur === 'orange' ? (saturation ? 'alleger' : 'remplacer') : 'maintenir'

  const raison =
    alertes.length === 0
      ? calibrationVfc
        ? 'Aucun signal d’alerte (VFC encore en calibration).'
        : 'Tous tes indicateurs sont dans ta zone normale.'
      : alertes.map((a) => a.texte).join(' · ')

  return { couleur, recommandation, alertes, calibrationVfc, raison }
}

/** Ce qu'il faut faire de la séance prévue selon le signal. */
export function adapterSeance(
  prevue: { intensite: 'basse' | 'moyenne' | 'haute'; dureeMin: number } | undefined,
  signal: Signal,
  /** Puissance Z2 (vélo) : précise la séance de remplacement */
  z2W?: number,
): string {
  const watts = z2W ? ` à ${z2W} W` : ''
  if (!prevue) return signal.couleur === 'rouge' ? 'Repos ou récupération active (20-30 min très facile).' : 'Pas de séance prévue.'
  const intense = prevue.intensite !== 'basse'
  switch (signal.recommandation) {
    case 'maintenir':
      return 'Séance prévue maintenue.'
    case 'alleger':
      return `Séance maintenue mais allégée : environ ${Math.round(prevue.dureeMin * 0.75)} min, arrête-toi si les sensations ne suivent pas.`
    case 'remplacer':
      return intense
        ? `Remplace par de l'endurance basse (Z1-Z2) : ${Math.round(prevue.dureeMin * 0.75)} à ${prevue.dureeMin} min${watts}.`
        : 'Séance facile maintenue, reste bien en zone basse.'
    case 'repos':
      return 'Repos ou récupération active (20-30 min très facile). La séance clé est à reporter.'
  }
}
