/**
 * Contrôle d'une séance faite contre la séance prévue : moyenne de chaque bloc comparée à sa plage
 * (on juge la moyenne d'un bloc, pas la puissance seconde par seconde : Liedl 1999, Bossi 2020).
 * La séance faite est d'abord recalée dans le temps sur la séance prévue (décalage de départ).
 */
import { deplier, type Etape, type Famille } from './programme'

export type Verdict = 'ok' | 'bas' | 'haut'
export interface LigneControle {
  libelle: string
  w: number
  wMin: number
  wMax: number
  verdict: Verdict
  /** Au-dessus de la plage sans conséquence (VO2, sprints) : compté comme tenu */
  tenu: boolean
  /** FC moyenne du bloc */
  fc?: number
  /** Ressenti du bloc (0-10), saisi après coup */
  rpe?: number
}
export interface Controle {
  lignes: LigneControle[]
  /** Z2 : secondes passées au-dessus du 1er seuil (puissance lissée sur 30 s) */
  auDessusSeuil1?: number
  /** Moyennes prises sur les tours de l'activité (sinon : fichier recalé sur la séance prévue) */
  parTours?: boolean
  /** Secondes d'arrêt (pause, roue libre prolongée) exclues des moyennes */
  arretSec?: number
}

/** Arrêt : au moins 10 s de suite sous 10 W (pause pour parler, roue libre prolongée). Exclu des moyennes des blocs. */
export const ARRET_MIN_SEC = 10
export function secondesArret(w: number[]): boolean[] {
  const arret = w.map(() => false)
  let debut = -1
  for (let i = 0; i <= w.length; i++) {
    if (i < w.length && w[i] < 10) {
      if (debut < 0) debut = i
    } else {
      if (debut >= 0 && i - debut >= ARRET_MIN_SEC) for (let j = debut; j < i; j++) arret[j] = true
      debut = -1
    }
  }
  return arret
}

/** Familles où dépasser la plage change le domaine (on passerait au-dessus du seuil). */
const PLAFONNEES = new Set<string>(['seuil', 'sweet-spot', 'tempo', 'z2', 'z2-long'])
/** Au-delà de 5 min cumulées au-dessus du 1er seuil, une Z2 n'est plus une Z2 (choix d'entraîneur). */
export const MAX_AU_DESSUS_SEUIL1 = 300

const moyenne = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0)

/** Décalage (s) entre le début de la séance prévue et le fichier : celui qui fait le mieux coïncider les deux profils. */
export function aligner(plan: number[], reel: number[]) {
  return alignerAvecScore(plan, reel).off
}

/**
 * Même chose, avec la qualité de la coïncidence (corrélation, −1 à 1) pour comparer deux lectures du fichier.
 * `ignore` : secondes du fichier laissées de côté (arrêts).
 */
export function alignerAvecScore(plan: number[], reel: number[], ignore?: boolean[]) {
  const mp = moyenne(plan)
  const utiles = ignore ? reel.filter((_, j) => !ignore[j]) : reel
  const mr = moyenne(utiles)
  const ep = Math.sqrt(moyenne(plan.map((x) => (x - mp) ** 2))) || 1
  const er = Math.sqrt(moyenne(utiles.map((x) => (x - mr) ** 2))) || 1
  let meilleur = 0
  let score = -Infinity
  for (let off = -60; off <= Math.min(900, reel.length - plan.length / 2); off++) {
    let s = 0
    let n = 0
    for (let i = 0; i < plan.length; i += 2) {
      const j = i + off
      if (j < 0 || j >= reel.length || ignore?.[j]) continue
      s += (plan[i] - mp) * (reel[j] - mr)
      n++
    }
    if (n > plan.length / 4 && s / n > score) {
      score = s / n
      meilleur = off
    }
  }
  return { off: meilleur, score: score / (ep * er) }
}

/** Un tour (lap) de l'activité, tel qu'Intervals le donne : Zwift en crée un par étape de la séance. */
export interface Tour {
  dureeSec: number
  w: number
  fc?: number
}

/**
 * Position des tours qui correspondent à la séance prévue (mêmes durées, à 3 s près, pour au moins 80 % des étapes).
 * Un tour allongé par un arrêt compte aussi (sa durée moins l'arrêt). Undefined si les tours ne suivent pas la séance.
 * `arretDans(debut, duree)` : secondes d'arrêt dans ce morceau du fichier (les tours se suivent depuis le début).
 */
export function trouverTours(plat: { dureeSec: number }[], tours: Tour[], arretDans?: (debut: number, duree: number) => number) {
  const n = plat.length
  const debuts = tours.map((_, i) => tours.slice(0, i).reduce((a, t) => a + t.dureeSec, 0))
  for (let k = 0; k + n <= tours.length + 1 && k <= 3; k++) {
    let bons = 0
    for (let i = 0; i < n; i++) {
      const t = tours[k + i]
      if (!t) continue
      const ecart = t.dureeSec - plat[i].dureeSec
      if (Math.abs(ecart) <= 3 || (ecart > 3 && arretDans && Math.abs(ecart - arretDans(debuts[k + i], t.dureeSec)) <= 3)) bons++
    }
    if (bons >= 0.8 * n) return k
  }
  return undefined
}

export function controlerSeance(o: {
  etapes: Etape[]
  famille: Famille | 'z2' | 'z2-long' | 'test' | 'vtt-terrain' | 'vtt-speciales'
  w1Hz: number[]
  fc1Hz?: number[]
  cpW: number
  /** Tours de l'activité : utilisés en priorité (moyennes exactes de chaque étape) */
  tours?: Tour[]
}): Controle | undefined {
  const { etapes, famille, w1Hz, fc1Hz, cpW } = o
  if (famille === 'test' || (!w1Hz.length && !o.tours?.length)) return undefined
  const plat = deplier(etapes).filter((e) => e.dureeSec > 0)
  // Arrêts (pause, roue libre prolongée) : jamais comptés à 0 W dans un bloc
  const arretBrut = secondesArret(w1Hz)
  const arretDans = (debut: number, duree: number) => arretBrut.slice(debut, debut + duree).filter(Boolean).length
  const k = o.tours?.length ? trouverTours(plat, o.tours, w1Hz.length ? arretDans : undefined) : undefined
  const debutsTours = (o.tours ?? []).map((_, i) => o.tours!.slice(0, i).reduce((a, t) => a + t.dureeSec, 0))
  const fin = plat.length ? plat[plat.length - 1].debutSec + plat[plat.length - 1].dureeSec : 0
  let off = 0
  // Fichier utilisé : tel quel (arrêts exclus des moyennes), ou sans ses arrêts si le minuteur de la séance s'était mis en pause
  let W = w1Hz
  let FC = fc1Hz
  let arret = arretBrut
  if (k === undefined) {
    if (!w1Hz.length) return undefined
    // Sans tours : on recale le fichier sur la séance prévue (décalage de départ)
    const plan = Array.from({ length: fin }, () => 0)
    for (const e of plat) for (let t = e.debutSec; t < e.debutSec + e.dureeSec; t++) plan[t] = e.w ?? cpW * 2
    // Deux lectures : le minuteur a continué pendant l'arrêt (arrêt ignoré), ou il s'est mis en pause (arrêt retiré)
    const brut = alignerAvecScore(plan, w1Hz, arretBrut)
    off = brut.off
    if (arretBrut.some(Boolean)) {
      const garde = w1Hz.map((_, i) => i).filter((i) => !arretBrut[i])
      const sans = garde.map((i) => w1Hz[i])
      const a = alignerAvecScore(plan, sans)
      if (a.score > brut.score) {
        W = sans
        FC = fc1Hz?.length ? garde.map((i) => fc1Hz[i] ?? 0) : fc1Hz
        arret = sans.map(() => false)
        off = a.off
      }
    }
  }
  const fenetre = (debut: number, duree: number, v: number[]) => v.slice(Math.max(0, debut + off), Math.max(0, debut + off + duree))
  let arretSec = 0
  /** Moyennes (watts, FC) d'une étape à plat, arrêts exclus : sur le fichier aux bornes de son tour, sinon sa fenêtre recalée. */
  const mesure = (i: number) => {
    const t = k !== undefined ? o.tours![k + i] : undefined
    if (t && !w1Hz.length) return { w: t.w, fc: t.fc, duree: t.dureeSec }
    const [debut, duree] = t ? [debutsTours[k! + i], t.dureeSec] : [plat[i].debutSec + off, plat[i].dureeSec]
    const depart = Math.max(0, debut)
    const garder = (_: number, j: number) => !arret[depart + j]
    const wTout = W.slice(depart, Math.max(0, debut + duree))
    const w = wTout.filter(garder)
    arretSec += wTout.length - w.length
    // Tour sans arrêt : la moyenne du tour (calculée par Intervals sur le fichier complet)
    if (t && w.length === wTout.length) return { w: t.w, fc: t.fc, duree: t.dureeSec }
    const f = FC?.length ? FC.slice(depart, Math.max(0, debut + duree)).filter(garder).filter((x) => x > 0) : []
    return { w: moyenne(w), fc: f.length ? moyenne(f) : t?.fc, duree: w.length }
  }
  /** Moyenne pondérée par la durée de plusieurs étapes. */
  const groupe = (idx: number[]) => {
    const m = idx.map(mesure).filter((x) => x.duree > 0)
    const d = m.reduce((a, x) => a + x.duree, 0)
    const avecFc = m.filter((x) => x.fc)
    const dFc = avecFc.reduce((a, x) => a + x.duree, 0)
    return d ? { w: m.reduce((a, x) => a + x.w * x.duree, 0) / d, fc: dFc ? Math.round(avecFc.reduce((a, x) => a + x.fc! * x.duree, 0) / dFc) : undefined } : undefined
  }
  const plafonnee = PLAFONNEES.has(famille)
  const ligne = (libelle: string, w: number, wMin: number, wMax: number, fc?: number, plafond = plafonnee): LigneControle => {
    const verdict: Verdict = w < wMin ? 'bas' : w > wMax ? 'haut' : 'ok'
    return { libelle, w: Math.round(w), wMin, wMax, verdict, tenu: verdict === 'ok' || (verdict === 'haut' && !plafond), ...(fc ? { fc } : {}) }
  }

  const lignes: LigneControle[] = []
  let idx = 0
  let serie = 0
  let bloc = 0
  for (const e of etapes) {
    if (e.dureeSec <= 0) continue
    if (e.repetition) {
      const sous = e.repetition.etapes
      const { fois, derniere = sous.length } = e.repetition
      const parSous = sous.map(() => [] as number[])
      for (let i = 0; i < fois; i++) {
        for (let j = 0; j < sous.length; j++) {
          if (i === fois - 1 && j >= derniere) break
          parSous[j].push(idx++)
        }
      }
      // Sprints de la sortie longue : à fond, pas de plage à contrôler (la Z2 entre les sprints est contrôlée)
      if (famille === 'z2-long') {
        const j = sous.findIndex((x) => x.libelle === 'Z2')
        const g = j >= 0 ? groupe(parSous[j]) : undefined
        if (g && sous[j].wMin && sous[j].wMax) lignes.push(ligne(sous.some((x) => x.libelle === 'Montée') ? 'Z2 entre les montées' : 'Z2 entre les sprints', g.w, sous[j].wMin!, sous[j].wMax!, g.fc))
        // Sortie longue en côtes : les montées sont contrôlées ensemble (85-95 % de la CP, sans dépasser)
        const m = sous.findIndex((x) => x.libelle === 'Montée')
        const gm = m >= 0 ? groupe(parSous[m]) : undefined
        if (gm && sous[m].wMin && sous[m].wMax) lignes.push(ligne('Montées', gm.w, sous[m].wMin!, sous[m].wMax!, gm.fc))
        continue
      }
      serie++
      const nom = famille === 'seuil-variable' ? `Bloc ${serie}` : `Série ${serie}`
      const efforts = sous.filter((y) => y.wMin)
      sous.forEach((x, j) => {
        if (!x.wMin || !x.wMax) return
        const g = groupe(parSous[j])
        if (g) lignes.push(ligne(`${nom}${efforts.length > 1 ? ` · ${x.libelle.toLowerCase()}` : ' · efforts'}`, g.w, x.wMin, x.wMax, g.fc))
      })
    } else {
      const i = idx++
      if (!e.wMin || !e.wMax || e.dureeSec < 60) continue
      const g = groupe([i])
      if (!g) continue
      bloc++
      lignes.push(ligne(/^Z2/.test(e.libelle) ? 'Z2' : `Bloc ${bloc}`, g.w, e.wMin, e.wMax, g.fc))
    }
  }
  if (!lignes.length) return undefined

  // Z2 : temps au-dessus du 1er seuil sur les parties Z2 (puissance lissée sur 30 s ; seulement avec le fichier)
  let auDessusSeuil1: number | undefined
  if ((famille === 'z2' || famille === 'z2-long') && w1Hz.length) {
    if (k !== undefined) off = (o.tours!.slice(0, k).reduce((a, t) => a + t.dureeSec, 0))
    const z2 = plat.filter((e) => e.libelle.startsWith('Z2'))
    const limite = Math.max(0.7 * cpW, ...z2.map((e) => e.wMax ?? 0))
    auDessusSeuil1 = 0
    for (const e of z2) {
      const w = fenetre(e.debutSec, e.dureeSec, W)
      for (let i = 30; i <= w.length; i++) if (moyenne(w.slice(i - 30, i)) > limite) auDessusSeuil1++
    }
  }
  if (W !== w1Hz) arretSec = w1Hz.length - W.length
  return {
    lignes, ...(auDessusSeuil1 !== undefined ? { auDessusSeuil1 } : {}), ...(k !== undefined ? { parTours: true } : {}),
    ...(arretSec >= ARRET_MIN_SEC ? { arretSec } : {}),
  }
}

/** Tous les blocs tenus (et une Z2 restée sous le 1er seuil) : la séance a fait le travail prévu. */
export const controleTenu = (c: Controle) => c.lignes.every((l) => l.tenu) && (c.auDessusSeuil1 ?? 0) < MAX_AU_DESSUS_SEUIL1

/** Bilan en une phrase, avec le ressenti des blocs s'il est saisi. */
export function bilanControle(c: Controle, famille: string) {
  const n = c.lignes.length
  const ok = c.lignes.filter((l) => l.verdict === 'ok').length
  const bas = c.lignes.filter((l) => l.verdict === 'bas').length
  const haut = c.lignes.filter((l) => l.verdict === 'haut')
  const phrases: string[] = []
  if (bas === 0 && haut.length === 0) phrases.push(`${ok}/${n} dans la plage : le bon travail a été fait.`)
  else {
    phrases.push(`${ok}/${n} dans la plage.`)
    if (bas) phrases.push(`${bas} en dessous : moins de travail que prévu, l'effet visé est plus faible.`)
    const hautsPlafond = haut.filter((l) => !l.tenu).length
    if (hautsPlafond) phrases.push(famille.startsWith('z2')
      ? `${hautsPlafond} au-dessus : ta Z2 est devenue du tempo, plus de fatigue pour le même effet.`
      : `${hautsPlafond} au-dessus : tu es passé au-dessus de ton seuil, ce n'est plus le même travail (plus de fatigue).`)
    else if (haut.length) phrases.push(`${haut.length} un peu au-dessus : sans conséquence en VO2.`)
  }
  if ((c.auDessusSeuil1 ?? 0) >= MAX_AU_DESSUS_SEUIL1) phrases.push(`${Math.round(c.auDessusSeuil1! / 60)} min au-dessus du 1er seuil : ce n'était plus vraiment une Z2.`)
  const rpe = c.lignes.map((l) => l.rpe).filter((r): r is number => r !== undefined)
  if (rpe.length >= 2 && rpe[rpe.length - 1] - rpe[0] >= 2) {
    const w0 = c.lignes.find((l) => l.rpe !== undefined)!.w
    const w1 = [...c.lignes].reverse().find((l) => l.rpe !== undefined)!.w
    if (w1 <= w0 * 1.02) phrases.push(`Ressenti en hausse de ${rpe[rpe.length - 1] - rpe[0]} points à watts égaux : de la fatigue, à surveiller.`)
  }
  return phrases.join(' ')
}
