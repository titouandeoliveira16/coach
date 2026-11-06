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
  /** Nuit courte : moins de… heures (plancher absolu) */
  nuitMinH: number
  /** Nuit courte personnelle : moins que ta normale (30 nuits d'avant) de plus de… heures */
  nuitEcartPersoH: number
  /** Dette : moyenne 7 j sous… heures (plancher absolu : 6 h ou moins pendant 2 semaines dégrade la vigilance, Van Dongen 2003) */
  moyenne7MinH: number
  /** Dette personnelle : moyenne 7 j sous ta normale de plus de… heures */
  ecartPersoH: number
  /** Repère conseillé (ligne d'information, sans effet sur la couleur) */
  repereH: number
}

export const SEUILS_DEFAUT: Seuils = {
  fcReposEcart: 5, tsbMin: -20, ressentiMin: 2.5, sommeilMax: 2, picMax: 1.3, cvFacteur: 1.5, nuitMinH: 6, nuitEcartPersoH: 1.5, moyenne7MinH: 6, ecartPersoH: 0.75, repereH: 7,
}

/** Conseil affiché après une nuit courte ou une dette de sommeil. */
export const CONSEIL_SIESTE = 'Si tu peux : une sieste courte (une demi-heure) en début d’après-midi, au moins une heure avant ta séance'

/** Durée de sommeil : nuit, moyenne 7 jours (au moins 3 nuits) et ta normale = moyenne des 30 jours d'avant (au moins 14 nuits, comme la VFC). */
export function analyserSommeil(nuits: { date: string; h?: number }[], date: string) {
  const entre = (du: string, au: string) => nuits.filter((n) => n.h !== undefined && n.date >= du && n.date <= au).map((n) => n.h!)
  const moy = (x: number[], min: number) => (x.length >= min ? x.reduce((a, b) => a + b, 0) / x.length : undefined)
  return {
    nuit: nuits.find((n) => n.date === date)?.h,
    moyenne7: moy(entre(decaler(date, -6), date), 3),
    moyenne30: moy(entre(decaler(date, -36), decaler(date, -7)), 14),
  }
}

/** Nuit courte et dette de sommeil, comparées à ta normale (planchers absolus de 6 h). */
export function etatSommeil(h: { nuit?: number; moyenne7?: number; moyenne30?: number } | undefined, s: Seuils = SEUILS_DEFAUT) {
  const nuitCourte = h?.nuit !== undefined && (h.nuit < s.nuitMinH || (h.moyenne30 !== undefined && h.nuit < h.moyenne30 - s.nuitEcartPersoH))
  const dette = h?.moyenne7 !== undefined && (h.moyenne7 < s.moyenne7MinH || (h.moyenne30 !== undefined && h.moyenne7 < h.moyenne30 - s.ecartPersoH))
  const sousRepere = h?.moyenne7 !== undefined && h.moyenne7 < s.repereH
  return { nuitCourte, dette, sousRepere }
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
  /** Nuit marquée « sans montre » : VFC, FC de repos et sommeil de la nuit ignorés */
  sansMontre?: boolean
}

export interface Alerte {
  code: 'vfc' | 'fc-repos' | 'ressenti' | 'tsb' | 'pic' | 'malade' | 'cv' | 'saturation'
  texte: string
  /** false = information seulement (ne compte pas dans le nombre d'indicateurs) */
  compte: boolean
}

/** Une ligne d'explication sous le feu, en mots simples. */
export interface Detail {
  icone: string
  texte: string
  etat: 'ok' | 'alerte' | 'info'
  /** Indicateur (case de la carte « Ta forme ») et sa valeur en un ou deux mots */
  cle?: 'recuperation' | 'pouls' | 'sommeil' | 'ressenti' | 'charge'
  court?: string
}

export interface Signal {
  couleur: Couleur
  recommandation: Recommandation
  alertes: Alerte[]
  /** Vrai tant que la base VFC n'est pas constituée (14 jours) */
  calibrationVfc: boolean
  /** Phrase de synthèse */
  raison: string
  /** Une ligne par indicateur, sans chiffres */
  details: Detail[]
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
  // Sommeil comparé à TA normale (Walsh 2021 : approche individuelle), avec un plancher absolu de 6 h ; le repère de 7 h
  // n'est qu'une information (relecture du 6/11/2026)
  const h = e.sommeilH
  const etat = etatSommeil(h, s)
  if (etat.nuitCourte) textes.push(h!.nuit! < s.nuitMinH ? `nuit courte (${enHeures(h!.nuit!)}, moins de ${s.nuitMinH} h)` : `nuit courte (${enHeures(h!.nuit!)} contre ${enHeures(h!.moyenne30!)} d'habitude)`)
  if (etat.dette) textes.push(h!.moyenne7! < s.moyenne7MinH ? `dette de sommeil (${enHeures(h!.moyenne7!)} en moyenne sur 7 j, moins de ${s.moyenne7MinH} h)` : `dette de sommeil (${enHeures(h!.moyenne7!)} sur 7 j contre ${enHeures(h!.moyenne30!)} d'habitude)`)
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

  return { couleur, recommandation, alertes, calibrationVfc, raison, details: detailsSignal(e, alertes, calibrationVfc, s) }
}

/** Lignes d'explication du feu : chaque indicateur, ce qu'il dit, en mots simples. */
function detailsSignal(e: EntreeSignal, alertes: Alerte[], calibration: boolean, s: Seuils): Detail[] {
  const a = (code: Alerte['code']) => alertes.some((x) => x.code === code)
  const d: Detail[] = []
  type Case = [Detail['cle'], string]
  const ok = (icone: string, texte: string, c?: Case) => d.push({ icone, texte, etat: 'ok', ...(c ? { cle: c[0], court: c[1] } : {}) })
  const alerte = (icone: string, texte: string, c?: Case) => d.push({ icone, texte, etat: 'alerte', ...(c ? { cle: c[0], court: c[1] } : {}) })
  const info = (icone: string, texte: string, c?: Case) => d.push({ icone, texte, etat: 'info', ...(c ? { cle: c[0], court: c[1] } : {}) })

  if (a('malade')) alerte('🤒', 'Malade ou douleur signalée : le corps passe avant le plan')

  // Récupération (VFC)
  if (e.sansMontre) info('⌚', 'Nuit sans montre : on se fie aux nuits d’avant')
  else if (e.vfc.lnJour === undefined) info('⌚', 'Mesure de la nuit pas (encore) arrivée : on se fie aux nuits d’avant')
  if (a('vfc')) alerte('💓', 'Récupération plus basse que d’habitude sur la semaine', ['recuperation', 'Plus basse'])
  else if (calibration) info('💓', 'Récupération : l’appli apprend encore ta normale', ['recuperation', 'En calibration'])
  else if (e.vfc.ln7 !== undefined) ok('💓', 'Récupération normale', ['recuperation', 'Normale'])
  if (a('cv')) info('〰️', 'Récupération irrégulière cette semaine (pour info)')
  if (a('saturation')) info('🔋', 'Récupération très haute en plein bloc chargé : écoute tes sensations')

  // Pouls au repos
  if (a('fc-repos')) alerte('❤️', 'Pouls au repos plus haut que d’habitude', ['pouls', 'Plus haut'])
  else if (e.vfc.fcRepos7 !== undefined && e.vfc.fcReposBase !== undefined) ok('❤️', 'Pouls au repos normal', ['pouls', 'Normal'])

  // Sommeil
  const h = e.sommeilH
  const { nuitCourte, dette, sousRepere } = etatSommeil(h, s)
  if (nuitCourte) alerte('😴', dette ? 'Nuit courte, et manque de sommeil sur la semaine' : 'Nuit courte', ['sommeil', 'Nuit courte'])
  else if (dette) alerte('😴', 'Manque de sommeil accumulé sur la semaine', ['sommeil', 'En retard'])
  // Conseil (le feu ne change pas) : sieste courte en début d'après-midi (Mesas 2023, Lastella 2021)
  if (nuitCourte || dette) info('💤', CONSEIL_SIESTE)
  // Repère conseillé (sans effet sur la couleur) : on s'habitue à manquer de sommeil sans le sentir (Van Dongen 2003)
  else if (sousRepere) info('🛏️', 'Un peu moins de sept heures en moyenne : dormir plus reste un vrai levier de progrès')
  else if (e.sommeil !== undefined && e.sommeil <= s.sommeilMax) alerte('😴', 'Mauvaise nuit d’après toi', ['sommeil', 'Mauvaise nuit'])
  else if (h?.nuit !== undefined || h?.moyenne7 !== undefined) ok('😴', sousRepere ? 'Sommeil dans ta normale' : 'Sommeil suffisant', ['sommeil', sousRepere ? 'Normal' : 'Suffisant'])

  // Ressenti du matin
  if (e.ressenti === undefined) info('🙂', 'Ressenti du matin pas encore noté', ['ressenti', 'Pas noté'])
  else if (e.ressenti < s.ressentiMin) alerte('🙂', 'Ressenti en baisse ce matin', ['ressenti', 'En baisse'])
  else ok('🙂', 'Bon ressenti ce matin', ['ressenti', 'Bon'])

  // Charge d'entraînement
  if (a('pic')) alerte('🏋️', 'Hausse brutale de ta charge d’entraînement', ['charge', 'Hausse brutale'])
  if (a('tsb')) alerte('🏋️', 'Fatigue d’entraînement accumulée', ['charge', 'Fatigue'])
  if (!a('pic') && !a('tsb') && (e.tsb !== undefined || e.ratioPic !== undefined)) ok('🏋️', 'Charge d’entraînement bien dosée', ['charge', 'Bien dosée'])
  return d
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
