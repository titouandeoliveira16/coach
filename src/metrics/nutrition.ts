/**
 * Besoins du jour (estimation, ±10-15 %) : énergie et macronutriments selon les séances.
 *  - Métabolisme de base : Mifflin-St Jeor (Frankenfield 2005 : la plus juste des équations comparées).
 *  - Vie quotidienne hors sport : métabolisme × 1,3 (digestion, posture, petits mouvements), plus la marche,
 *    pas par pas : 0,5 kcal par kg et par km (coût net de la marche, équation de marche de l'ACSM),
 *    foulée = 0,415 × taille. Pas de course retirés (déjà comptés dans la séance). On retrouve les niveaux
 *    FAO/OMS/UNU 2004 : ~1,35 à 4 000 pas, ~1,45 à 10 000, ~1,55 à 15 000.
 *  - Séances : vélo 1 kcal par kJ de travail (rendement brut ~24 %) ; course ~1 kcal × kg × km ;
 *    sinon par équivalent métabolique (MET, Compendium d'Ainsworth), hors repos. Jamais les calories de la montre.
 *  - Glucides selon la charge du jour (consensus ACSM / AND / DC, Thomas 2016 : 3-5 à 8-12 g/kg),
 *    protéines 1,6 g/kg (Morton 2018), lipides le reste, jamais sous 20 % de l'énergie.
 *  - Objectif « perte de gras légère » : déficit selon le jour (−500 repos ou facile, −300 modéré,
 *    −100 intensité ou sortie longue : manger selon le travail prévu, Impey 2018), visée ~0,5 % du poids
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
}

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

/** Glucides (g/kg) selon la durée totale et l'intensité du jour (tranches d'entraîneur dans les fourchettes de Thomas 2016). */
export function glucidesParKg(minutes: number, intense: boolean) {
  if (minutes >= 240) return 10
  if (minutes >= 90) return intense ? 8 : 7
  if (minutes >= 45) return intense ? 7 : 6
  if (minutes > 0) return intense ? 6 : 5
  return 4
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
  /** Coefficient de la vie quotidienne (métabolisme × 1,3 + marche), pour information */
  facteur: number
  /** Calories de la marche (pas hors course) */
  marche: number
  /** kcal retirées pour étaler un excès récent */
  reduction: number
  quotidien: number
  seances: number
  glucides: number
  glucidesParKg: number
  proteines: number
  lipides: number
}

/** Vie quotidienne sans la marche : métabolisme × 1,3. */
export const FACTEUR_SANS_MARCHE = 1.3
/** Coût net de la marche : 0,5 kcal par kg et par km (ACSM). */
const KCAL_KG_KM_MARCHE = 0.5

/** Calories de la marche de la journée (pas hors course). */
export function kcalMarche(pas: number, kg: number, cm: number) {
  const foulee = 0.415 * (cm / 100)
  return KCAL_KG_KM_MARCHE * kg * ((pas * foulee) / 1000)
}

export function besoinsDuJour(o: {
  kg: number; cm: number; age: number; activites: ActiviteJour[]; objectif?: Objectif; pas?: number
  /** Écart entre ton maintien mesuré (repas + poids) et la formule, en kcal/j */
  correction?: number
  /** Excès d'un jour récent étalé sur ce jour (kcal en moins) */
  reduction?: number
}): Besoins {
  const base = metabolismeBase(o.kg, o.cm, o.age)
  const marche = o.pas ? kcalMarche(o.pas, o.kg, o.cm) : 0
  const quotidien = base * FACTEUR_SANS_MARCHE + marche + (o.correction ?? 0)
  const facteur = Math.round((quotidien / base) * 100) / 100
  const seances = o.activites.reduce((s, a) => s + kcalActivite(a, o.kg), 0)
  const minutes = o.activites.reduce((s, a) => s + a.dureeMin, 0)
  const intense = o.activites.some((a) => a.intensite === 'haute')
  const maintien = quotidien + seances
  const journee = intense || minutes >= 90 ? 'dure' : minutes >= 45 || o.activites.some((a) => a.intensite === 'moyenne') ? 'moderee' : 'facile'
  const perte = o.objectif === 'perte'
  const deficitVise = perte ? { facile: 500, moderee: 300, dure: 100 }[journee] : 0
  const plancherKcal = DISPONIBILITE_MIN * o.kg * PART_MASSE_MAIGRE + seances
  // Le plancher de disponibilité énergétique protège aussi de l'étalement d'un excès
  const energie = Math.max(maintien - deficitVise - (o.reduction ?? 0), perte || o.reduction ? plancherKcal : 0)
  const reduction = Math.max(0, Math.min(o.reduction ?? 0, maintien - deficitVise - energie))

  const proteinesParKg = perte ? 1.8 : 1.6
  const proteines = proteinesParKg * o.kg
  let gkg = glucidesParKg(minutes, intense)
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
    plancher: perte && plancherKcal > maintien - deficitVise, reduction: r(reduction), base: r(base), facteur, marche: r(marche), quotidien: r(quotidien), seances: r(seances),
    glucides: r(glucides), glucidesParKg: gkg, proteines: r(proteines), proteinesParKg, lipides: r(lipides),
  }
}

/**
 * Évolution du poids (kg par semaine) : pente des pesées des 28 derniers jours (moindres carrés).
 * Il faut au moins 3 pesées étalées sur 14 jours.
 */
export function tendancePoids(pesees: { date: string; poidsKg: number }[], jour: string) {
  const jours = (d: string) => (Date.parse(d) - Date.parse(jour)) / 86_400_000
  const p = pesees.filter((x) => jours(x.date) <= 0 && jours(x.date) > -28)
  if (p.length < 3) return undefined
  const x = p.map((v) => jours(v.date))
  if (Math.max(...x) - Math.min(...x) < 14) return undefined
  const mx = x.reduce((a, b) => a + b, 0) / x.length
  const my = p.reduce((a, v) => a + v.poidsKg, 0) / p.length
  const sxy = x.reduce((a, xi, i) => a + (xi - mx) * (p[i].poidsKg - my), 0)
  const sxx = x.reduce((a, xi) => a + (xi - mx) ** 2, 0)
  return sxx ? (sxy / sxx) * 7 : undefined
}

/** Étalement d'un excès : au plus 250 kcal en moins par jour facile, sur les 7 jours qui suivent. */
export const ETALEMENT_MAX_JOUR = 250

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
export function maintienMesure(o: { kcalMoyen: number; formuleMoyenne: number; tendanceKgSemaine: number }) {
  const mesure = o.kcalMoyen - (o.tendanceKgSemaine * 7700) / 7
  const ecart = Math.max(-500, Math.min(500, Math.round((mesure - o.formuleMoyenne) / 50) * 50))
  return { mesure: Math.round(mesure / 10) * 10, ecart }
}
