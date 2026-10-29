/**
 * Besoins du jour (estimation, ±10-15 %) : énergie et macronutriments selon les séances.
 *  - Métabolisme de base : Mifflin-St Jeor (Frankenfield 2005 : la plus juste des équations comparées).
 *  - Vie quotidienne hors sport : métabolisme × 1,4 (digestion, posture, petits mouvements, la marche du quotidien
 *    et les activités occasionnelles comme un five ; FAO/OMS/UNU 2004 : sédentaire 1,40-1,69).
 *    Pas de comptage de pas : le maintien mesuré (repas + poids) corrige ensuite le coefficient.
 *  - Séances : vélo 1 kcal par kJ de travail (rendement brut ~24 %) ; course ~1 kcal × kg × km ;
 *    sinon par équivalent métabolique (MET, Compendium d'Ainsworth), hors repos. Jamais les calories de la montre.
 *  - Glucides brûlés en séance : part glucidique de la dépense selon l'intensité, zone par zone, pondérée par
 *    l'énergie dépensée dans chaque zone (Z1-Z2 50 %, Z3 70 %, Z4-Z5 90 % ; Romijn 1993, van Loon 2001).
 *    Glucides du jour = 3 g/kg + 1,5 × glucides brûlés (le facteur couvre la recharge du glycogène),
 *    entre 3 et 12 g/kg : on retombe dans les fourchettes du consensus ACSM / AND / DC (Thomas 2016).
 *    Protéines 1,6 g/kg (Morton 2018), lipides le reste, jamais sous 20 % de l'énergie.
 *  - Objectif « perte de gras légère » : déficit continu, −500 kcal moins 0,6 kcal par kcal de glucides brûlée
 *    en séance, jamais moins de −100 (manger selon le travail fait, Impey 2018 ; pente : choix d'entraîneur), visée ~0,5 % du poids
 *    par semaine (Garthe 2011), protéines 1,8 g/kg, et jamais sous 30 kcal par kg de masse maigre une fois
 *    le sport déduit (disponibilité énergétique, consensus CIO sur le RED-S 2023).
 */
export type Objectif = 'maintien' | 'perte'

/** Masse maigre estimée faute de mesure de masse grasse (~15 % de gras). */
export const PART_MASSE_MAIGRE = 0.85
/** Disponibilité énergétique minimale (kcal par kg de masse maigre et par jour). */
export const DISPONIBILITE_MIN = 30
export type Intensite = 'basse' | 'moyenne' | 'haute'

export interface ActiviteJour {
  sport: 'velo' | 'course' | 'natation' | 'renfo' | 'autre'
  dureeMin: number
  intensite: Intensite
  /** Vélo : travail (kJ) mesuré ou prévu */
  kj?: number
  /** Course : distance (km) */
  distanceKm?: number
  /** Part glucidique de la dépense (0,5 à 0,9), d'après le temps dans chaque zone ; sinon selon `intensite` */
  partGlucides?: number
}

/** Part glucidique de la dépense par zone (Z1 à Z5) et coût relatif d'une minute dans chaque zone. */
const GLUCIDES_ZONE = [0.5, 0.5, 0.7, 0.9, 0.9]
const COUT_ZONE = [0.55, 0.7, 0.85, 1, 1.15]
/** Séance prévue (sans zones) : échauffement et récupération compris. */
const GLUCIDES_PREVUE: Record<Intensite, number> = { basse: 0.5, moyenne: 0.7, haute: 0.8 }

/** Part glucidique d'une séance d'après son temps dans chaque zone de FC (pondéré par l'énergie de chaque zone). */
export function partGlucides(tempsZones: number[]) {
  const poids = tempsZones.map((t, i) => t * COUT_ZONE[i])
  const total = poids.reduce((a, b) => a + b, 0)
  return total ? poids.reduce((a, p, i) => a + p * GLUCIDES_ZONE[i], 0) / total : undefined
}

/** kcal de glucides brûlées par une séance. */
export const kcalGlucidesSeance = (a: ActiviteJour, kg: number) => kcalActivite(a, kg) * (a.partGlucides ?? GLUCIDES_PREVUE[a.intensite])

/** MET nets (au-dessus du repos) quand on n'a ni kJ ni distance. */
const MET_NETS: Record<ActiviteJour['sport'], Record<Intensite, number>> = {
  velo: { basse: 6, moyenne: 8, haute: 10 },
  course: { basse: 8.8, moyenne: 10.5, haute: 12 },
  natation: { basse: 5, moyenne: 7, haute: 9 },
  renfo: { basse: 3, moyenne: 4, haute: 5 },
  autre: { basse: 2.5, moyenne: 4, haute: 6 },
}

export const metabolismeBase = (kg: number, cm: number, age: number) => 10 * kg + 6.25 * cm - 5 * age + 5

/** Dépense d'une séance (kcal). */
export function kcalActivite(a: ActiviteJour, kg: number) {
  if (a.sport === 'velo' && a.kj) return a.kj
  if (a.sport === 'course' && a.distanceKm) return kg * a.distanceKm
  // 1 MET ≈ 1 kcal par kg et par heure
  return MET_NETS[a.sport][a.intensite] * kg * (a.dureeMin / 60)
}

/** Glucides (g/kg) : 3 g/kg + 1,5 × les glucides brûlés en séance, entre 3 et 12 g/kg. */
export function glucidesParKg(kcalGlucides: number, kg: number) {
  return Math.min(12, Math.max(3, 3 + (1.5 * kcalGlucides) / 4 / kg))
}

export interface Besoins {
  kcal: number
  /** Besoin pour garder son poids (avant déficit) */
  maintien: number
  deficit: number
  /** Type de journée pour le déficit */
  journee: 'facile' | 'moderee' | 'dure'
  /** Le plancher de disponibilité énergétique a limité le déficit */
  plancher: boolean
  proteinesParKg: number
  base: number
  /** kcal retirées pour étaler un excès récent */
  reduction: number
  /** kcal de glucides brûlées en séance */
  kcalGlucides: number
  quotidien: number
  seances: number
  glucides: number
  glucidesParKg: number
  proteines: number
  lipides: number
}

/** Déficit de base en perte de gras (kcal), et ses bornes une fois ajusté par le bilan du dimanche */
export const DEFICIT_BASE = 500
export const DEFICIT_MIN = 200
export const DEFICIT_MAX = 600

/** Vie quotidienne (marche comprise) : métabolisme × 1,4. */
export const FACTEUR_QUOTIDIEN = 1.4

export function besoinsDuJour(o: {
  kg: number; cm: number; age: number; activites: ActiviteJour[]; objectif?: Objectif
  /** Écart entre ton maintien mesuré (repas + poids) et la formule, en kcal/j */
  correction?: number
  /** Excès d'un jour récent étalé sur ce jour (kcal en moins) */
  reduction?: number
  /** Déficit de base en perte de gras (500 par défaut, ajusté par le bilan du dimanche, 200 à 600) */
  deficitBase?: number
}): Besoins {
  const base = metabolismeBase(o.kg, o.cm, o.age)
  const quotidien = base * FACTEUR_QUOTIDIEN + (o.correction ?? 0)
  const seances = o.activites.reduce((s, a) => s + kcalActivite(a, o.kg), 0)
  const kcalGlucides = o.activites.reduce((s, a) => s + kcalGlucidesSeance(a, o.kg), 0)
  const maintien = quotidien + seances
  const journee = kcalGlucides < 150 ? 'facile' : kcalGlucides < 500 ? 'moderee' : 'dure'
  const perte = o.objectif === 'perte'
  const deficitBase = o.deficitBase ?? DEFICIT_BASE
  // Les jours de grosse séance restent bien alimentés : le déficit y descend à 100 kcal, quel que soit le réglage
  const deficitVise = perte ? Math.min(deficitBase, Math.max(100, deficitBase - 0.6 * kcalGlucides)) : 0
  const plancherKcal = DISPONIBILITE_MIN * o.kg * PART_MASSE_MAIGRE + seances
  // Le plancher de disponibilité énergétique protège aussi de l'étalement d'un excès
  const energie = Math.max(maintien - deficitVise - (o.reduction ?? 0), perte || o.reduction ? plancherKcal : 0)
  const reduction = Math.max(0, Math.min(o.reduction ?? 0, maintien - deficitVise - energie))

  const proteinesParKg = perte ? 1.8 : 1.6
  const proteines = proteinesParKg * o.kg
  let gkg = Math.round(glucidesParKg(kcalGlucides, o.kg) * 10) / 10
  // Lipides au moins 20 % : si l'énergie ne suffit pas, on baisse les glucides (jamais sous 3 g/kg)
  const lipidesMin = (0.2 * energie) / 9
  const glucidesMax = (energie - proteines * 4 - lipidesMin * 9) / 4 / o.kg
  if (gkg > glucidesMax) gkg = Math.max(3, Math.floor(glucidesMax * 2) / 2)
  const glucides = gkg * o.kg
  const lipides = Math.max((energie - glucides * 4 - proteines * 4) / 9, lipidesMin)
  const kcal = glucides * 4 + proteines * 4 + lipides * 9
  const r = (n: number) => Math.round(n)
  return {
    kcal: Math.round(kcal / 50) * 50, maintien: Math.round(maintien / 50) * 50, deficit: r(Math.max(0, maintien - energie)), journee,
    plancher: perte && plancherKcal > maintien - deficitVise, reduction: r(reduction), base: r(base), quotidien: r(quotidien), seances: r(seances),
    glucides: r(glucides), glucidesParKg: gkg, kcalGlucides: r(kcalGlucides), proteines: r(proteines), proteinesParKg, lipides: r(lipides),
  }
}

/**
 * Évolution du poids (kg par semaine) : pente des pesées des `fenetre` derniers jours (28 par défaut, moindres carrés).
 * Il faut au moins `minPesees` pesées étalées sur `etalement` jours (3 pesées sur 14 jours par défaut).
 */
export function tendancePoids(pesees: { date: string; poidsKg: number }[], jour: string, fenetre = 28, etalement = 14, minPesees = 3) {
  const jours = (d: string) => (Date.parse(d) - Date.parse(jour)) / 86_400_000
  const p = pesees.filter((x) => jours(x.date) <= 0 && jours(x.date) > -fenetre)
  if (p.length < minPesees) return undefined
  const x = p.map((v) => jours(v.date))
  if (Math.max(...x) - Math.min(...x) < etalement) return undefined
  const mx = x.reduce((a, b) => a + b, 0) / x.length
  const my = p.reduce((a, v) => a + v.poidsKg, 0) / p.length
  const sxy = x.reduce((a, xi, i) => a + (xi - mx) * (p[i].poidsKg - my), 0)
  const sxx = x.reduce((a, xi) => a + (xi - mx) ** 2, 0)
  return sxx ? (sxy / sxx) * 7 : undefined
}

/** Étalement d'un excès : au plus 250 kcal en moins par jour facile, sur les 7 jours qui suivent. */
export const ETALEMENT_MAX_JOUR = 250
/** Excès qui compte (kcal au-dessus du besoin) : proposition d'étalement */
export const SEUIL_EXCES = 500

/**
 * Réduction de chaque jour pour étaler des excès : on prend jusqu'à 250 kcal par jour facile
 * (jamais un jour de séance modérée ou dure), dans l'ordre, sur les 7 jours suivant l'excès.
 */
export function reductionsEtalement(excès: { date: string; kcal: number }[], jours: { date: string; facile: boolean }[]) {
  const r = new Map<string, number>()
  for (const e of [...excès].sort((a, b) => a.date.localeCompare(b.date))) {
    let reste = e.kcal
    const fin = new Date(Date.parse(e.date) + 7 * 86_400_000).toISOString().slice(0, 10)
    for (const j of jours) {
      if (reste <= 0) break
      if (j.date <= e.date || j.date > fin || !j.facile) continue
      const pris = Math.min(ETALEMENT_MAX_JOUR - (r.get(j.date) ?? 0), reste)
      if (pris <= 0) continue
      r.set(j.date, (r.get(j.date) ?? 0) + pris)
      reste -= pris
    }
  }
  return r
}

/**
 * Maintien mesuré : ce que tu as mangé en moyenne, corrigé de ce qu'a fait ton poids
 * (1 kg ≈ 7 700 kcal). Renvoie aussi l'écart avec la formule, arrondi à 50 kcal et limité à ±500.
 */
export function maintienMesure(o: { kcalMoyen: number; formuleMoyenne: number; tendanceKgSemaine: number; borne?: number }) {
  const mesure = o.kcalMoyen - (o.tendanceKgSemaine * 7700) / 7
  const borne = o.borne ?? 500
  const ecart = Math.max(-borne, Math.min(borne, Math.round((mesure - o.formuleMoyenne) / 50) * 50))
  return { mesure: Math.round(mesure / 10) * 10, ecart }
}

// ——— Bilan du dimanche (relecture du 29/10 : Garthe 2011, Mountjoy 2023 ; pas et seuils = choix d'entraîneur) ———

export type Faim = 'ok' | 'un-peu' | 'souvent'
export type Energie = 'bien' | 'moyen' | 'mauvais'
export interface BilanNutrition {
  /** Dimanche du bilan */
  date: string
  faim: Faim
  energie: Energie
  /** Tour de taille (cm, moyenne de 2 mesures), facultatif */
  tailleCm?: number
}

/** Écart de tour de taille qui compte (erreur de mesure ~1-2 cm, Barrios 2016) */
export const SEUIL_TAILLE_CM = 1.5
/** Pause au maintien quand les signaux d'alerte s'allument (jours) */
export const DUREE_PAUSE = 7
/** Délai minimal entre deux ajustements du déficit (jours) */
export const DELAI_AJUSTEMENT = 14

export type Proposition =
  | { type: 'garder'; raison: string }
  | { type: 'ajuster'; delta: number; raison: string }
  | { type: 'pause'; raison: string; medecin: boolean }

/**
 * Proposition après le bilan du dimanche (l'utilisateur valide toujours) :
 *  - alerte (faim « souvent » ou énergie « mauvaise » 2 semaines de suite, ou perte ≥ 1 %/sem avec faim ou fatigue) :
 *    7 jours au maintien ; si l'alerte revient après une pause récente, en parler à un médecin (CIO, REDs 2023) ;
 *  - perte ≥ 1 %/sem : déficit −200 ; 0,7 à 1 %/sem, ou faim et fatigue : −100 ;
 *  - moins de 0,25 %/sem sur 3 semaines, sans faim ni fatigue : +100 (plafond 600) ;
 *  - sinon on garde. Au plus un ajustement tous les 14 jours ; rien avant 14 jours de pesées
 *    (une perte rapide au début, c'est surtout de l'eau et du glycogène).
 */
export function propositionNutrition(o: {
  /** Pente du poids sur 14 jours et sur 21 jours (kg/sem, négatif = perte) */
  tendance14?: number
  tendance21?: number
  kg: number
  /** Bilans du plus récent au plus ancien */
  bilans: BilanNutrition[]
  deficitBase: number
  /** Jours depuis le dernier ajustement (undefined : jamais) */
  joursDepuisAjustement?: number
  /** Une pause au maintien s'est terminée il y a moins de 21 jours */
  pauseRecente?: boolean
}): Proposition {
  const [b0, b1] = o.bilans
  const pct = (t?: number) => (t === undefined ? undefined : (-t / o.kg) * 100)
  const p14 = pct(o.tendance14)
  const p21 = pct(o.tendance21)
  const deuxSemaines = (f: (b: BilanNutrition) => boolean) => !!b0 && !!b1 && f(b0) && f(b1)
  const malCetteSemaine = !!b0 && b0.faim !== 'ok' && b0.energie !== 'bien'
  const alerte = deuxSemaines((b) => b.faim === 'souvent') || deuxSemaines((b) => b.energie === 'mauvais') ||
    (p14 !== undefined && p14 >= 1 && malCetteSemaine)
  if (alerte) {
    return {
      type: 'pause', medecin: !!o.pauseRecente,
      raison: o.pauseRecente
        ? 'Les signaux d’alerte reviennent après une pause : passe au maintien et parles-en à un médecin (ou un diététicien du sport).'
        : 'Faim ou fatigue qui durent : 7 jours au maintien pour récupérer, puis on reprend.',
    }
  }
  if (p14 === undefined) return { type: 'garder', raison: 'Pas encore 14 jours de pesées : on attend avant de toucher au déficit.' }
  if (o.joursDepuisAjustement !== undefined && o.joursDepuisAjustement < DELAI_AJUSTEMENT)
    return { type: 'garder', raison: 'Déficit ajusté il y a moins de 2 semaines : on laisse le temps de voir l’effet.' }
  const borne = (d: number) => Math.max(DEFICIT_MIN, Math.min(DEFICIT_MAX, o.deficitBase + d)) - o.deficitBase
  const ajuster = (d: number, raison: string): Proposition => (borne(d) ? { type: 'ajuster', delta: borne(d), raison } : { type: 'garder', raison: `${raison} Le déficit est déjà à sa limite.` })
  if (p14 >= 1) return ajuster(-200, 'Tu perds 1 % ou plus par semaine : trop vite, tu risques de perdre du muscle et de la forme.')
  if (p14 >= 0.7 || malCetteSemaine) return ajuster(-100, p14 >= 0.7 ? 'Tu perds un peu vite (0,7 à 1 % par semaine).' : 'Faim et fatigue cette semaine : on desserre un peu.')
  const bienPartout = o.bilans.slice(0, 2).every((b) => b.faim === 'ok' && b.energie !== 'mauvais')
  if (p21 !== undefined && p21 < 0.25 && p14 < 0.25 && bienPartout)
    return ajuster(100, 'Le poids ne baisse presque plus depuis 3 semaines, sans faim ni fatigue : un peu plus de déficit.')
  return { type: 'garder', raison: 'Rythme dans la cible (0,25 à 0,7 % par semaine) : on garde.' }
}

/** Évolution du tour de taille : dernière mesure comparée à celle d'au moins 14 jours avant. Undefined si pas assez de mesures. */
export function evolutionTaille(bilans: BilanNutrition[]) {
  const m = bilans.filter((b) => b.tailleCm).sort((a, b) => b.date.localeCompare(a.date))
  const der = m[0]
  const avant = der && m.find((b) => (Date.parse(der.date) - Date.parse(b.date)) / 86_400_000 >= 14)
  if (!der || !avant) return undefined
  const ecart = der.tailleCm! - avant.tailleCm!
  return { ecart: Math.round(ecart * 10) / 10, significatif: Math.abs(ecart) >= SEUIL_TAILLE_CM, depuis: avant.date }
}

