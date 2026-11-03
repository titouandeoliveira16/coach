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
}

/** Familles où dépasser la plage change le domaine (on passerait au-dessus du seuil). */
const PLAFONNEES = new Set<string>(['seuil', 'sweet-spot', 'tempo', 'z2', 'z2-long'])
/** Au-delà de 5 min cumulées au-dessus du 1er seuil, une Z2 n'est plus une Z2 (choix d'entraîneur). */
export const MAX_AU_DESSUS_SEUIL1 = 300

const moyenne = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0)

/** Décalage (s) entre le début de la séance prévue et le fichier : celui qui fait le mieux coïncider les deux profils. */
export function aligner(plan: number[], reel: number[]) {
  const mp = moyenne(plan)
  const mr = moyenne(reel)
  let meilleur = 0
  let score = -Infinity
  for (let off = -60; off <= Math.min(900, reel.length - plan.length / 2); off++) {
    let s = 0
    let n = 0
    for (let i = 0; i < plan.length; i += 2) {
      const j = i + off
      if (j < 0 || j >= reel.length) continue
      s += (plan[i] - mp) * (reel[j] - mr)
      n++
    }
    if (n > plan.length / 4 && s / n > score) {
      score = s / n
      meilleur = off
    }
  }
  return meilleur
}

/** Un tour (lap) de l'activité, tel qu'Intervals le donne : Zwift en crée un par étape de la séance. */
export interface Tour {
  dureeSec: number
  w: number
  fc?: number
}

/**
 * Position des tours qui correspondent à la séance prévue (mêmes durées, à 3 s près, pour au moins 80 % des étapes).
 * Undefined si les tours ne suivent pas la séance (sortie libre, séance arrêtée en route).
 */
export function trouverTours(plat: { dureeSec: number }[], tours: Tour[]) {
  const n = plat.length
  for (let k = 0; k + n <= tours.length + 1 && k <= 3; k++) {
    let bons = 0
    for (let i = 0; i < n; i++) if (tours[k + i] && Math.abs(tours[k + i].dureeSec - plat[i].dureeSec) <= 3) bons++
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
  const k = o.tours?.length ? trouverTours(plat, o.tours) : undefined
  const fin = plat.length ? plat[plat.length - 1].debutSec + plat[plat.length - 1].dureeSec : 0
  let off = 0
  if (k === undefined) {
    if (!w1Hz.length) return undefined
    // Sans tours : on recale le fichier sur la séance prévue (décalage de départ)
    const plan = Array.from({ length: fin }, () => 0)
    for (const e of plat) for (let t = e.debutSec; t < e.debutSec + e.dureeSec; t++) plan[t] = e.w ?? cpW * 2
    off = aligner(plan, w1Hz)
  }
  const fenetre = (debut: number, duree: number, v: number[]) => v.slice(Math.max(0, debut + off), Math.max(0, debut + off + duree))
  /** Moyennes (watts, FC) d'une étape à plat : son tour, sinon sa fenêtre dans le fichier. */
  const mesure = (i: number) => {
    const t = k !== undefined ? o.tours![k + i] : undefined
    if (t) return { w: t.w, fc: t.fc, duree: t.dureeSec }
    const e = plat[i]
    const w = fenetre(e.debutSec, e.dureeSec, w1Hz)
    const f = fc1Hz?.length ? fenetre(e.debutSec, e.dureeSec, fc1Hz).filter((x) => x > 0) : []
    return { w: moyenne(w), fc: f.length ? moyenne(f) : undefined, duree: w.length }
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
      const w = fenetre(e.debutSec, e.dureeSec, w1Hz)
      for (let i = 30; i <= w.length; i++) if (moyenne(w.slice(i - 30, i)) > limite) auDessusSeuil1++
    }
  }
  return { lignes, ...(auDessusSeuil1 !== undefined ? { auDessusSeuil1 } : {}), ...(k !== undefined ? { parTours: true } : {}) }
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
