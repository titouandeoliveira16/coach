/**
 * Signal du jour 🟢🟠🔴 : règles de décision, paramétrables, chacune avec sa raison.
 *
 * Inspiré de l'entraînement guidé par la VFC (Kiviniemi 2007, Vesterinen 2016, Javaloyes 2019)
 * et du suivi multi-indicateurs recommandé (Bourdon et al., 2017 ; guide AIS) :
 *  - 🟢 aucun indicateur hors zone → séance prévue maintenue ;
 *  - 🟠 un seul indicateur hors zone → séance intense remplacée par de l'endurance basse ;
 *  - 🔴 deux indicateurs ou plus, ou malade / douleur → repos ou récupération active.
 */
import type { AnalyseVfc } from './vfc'

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
}

export const SEUILS_DEFAUT: Seuils = { fcReposEcart: 5, tsbMin: -20, ressentiMin: 2.5, sommeilMax: 2, picMax: 1.3, cvFacteur: 1.5 }

export interface EntreeSignal {
  vfc: AnalyseVfc
  /** Moyenne des 5 notes de ressenti du matin */
  ressenti?: number
  sommeil?: number
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

  const ressentiBas = e.ressenti !== undefined && e.ressenti < s.ressentiMin
  const sommeilBas = e.sommeil !== undefined && e.sommeil <= s.sommeilMax
  if (ressentiBas || sommeilBas)
    alertes.push({ code: 'ressenti', texte: sommeilBas ? 'Sommeil mauvais cette nuit' : `Ressenti bas ce matin (${f1(e.ressenti!)}/5)`, compte: true })

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
