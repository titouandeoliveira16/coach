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
  /** FC moyenne des 30 dernières secondes du bloc */
  fc?: number
  /** Ressenti du bloc (0-10), saisi après coup */
  rpe?: number
}
export interface Controle {
  lignes: LigneControle[]
  /** Z2 : secondes passées au-dessus du 1er seuil (puissance lissée sur 30 s) */
  auDessusSeuil1?: number
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

export function controlerSeance(o: {
  etapes: Etape[]
  famille: Famille | 'z2' | 'z2-long' | 'test'
  w1Hz: number[]
  fc1Hz?: number[]
  cpW: number
}): Controle | undefined {
  const { etapes, famille, w1Hz, fc1Hz, cpW } = o
  if (famille === 'test' || !w1Hz.length) return undefined
  const plat = deplier(etapes)
  const fin = plat.length ? plat[plat.length - 1].debutSec + plat[plat.length - 1].dureeSec : 0
  const plan = Array.from({ length: fin }, () => 0)
  for (const e of plat) for (let t = e.debutSec; t < e.debutSec + e.dureeSec; t++) plan[t] = e.w ?? cpW * 2
  const off = aligner(plan, w1Hz)
  const fenetre = (debut: number, duree: number, v: number[]) => v.slice(Math.max(0, debut + off), Math.max(0, debut + off + duree))
  const fcFin = (debut: number, duree: number) => {
    if (!fc1Hz?.length) return undefined
    const f = fenetre(debut + duree - 30, 30, fc1Hz).filter((x) => x > 0)
    return f.length ? Math.round(moyenne(f)) : undefined
  }
  const plafonnee = PLAFONNEES.has(famille)
  const ligne = (libelle: string, w: number, wMin: number, wMax: number, fc?: number, plafond = plafonnee): LigneControle => {
    const verdict: Verdict = w < wMin ? 'bas' : w > wMax ? 'haut' : 'ok'
    return { libelle, w: Math.round(w), wMin, wMax, verdict, tenu: verdict === 'ok' || (verdict === 'haut' && !plafond), ...(fc ? { fc } : {}) }
  }

  const lignes: LigneControle[] = []
  let serie = 0
  let bloc = 0
  for (const e of etapes) {
    if (e.repetition) {
      const sous = e.repetition.etapes
      // Sprints de la sortie longue : à fond, pas de plage à contrôler
      if (sous.every((x) => !x.wMin || x.libelle === 'Z2') && famille === 'z2-long') continue
      // Fenêtres de chaque sous-étape d'effort
      let h = e.debutSec
      const parSous = sous.map(() => [] as number[])
      const { fois, derniere = sous.length } = e.repetition
      for (let i = 0; i < fois; i++) {
        for (let j = 0; j < sous.length; j++) {
          if (i === fois - 1 && j >= derniere) break
          if (sous[j].wMin) parSous[j].push(...fenetre(h, sous[j].dureeSec, w1Hz))
          h += sous[j].dureeSec
        }
      }
      serie++
      const nom = famille === 'seuil-variable' ? `Bloc ${serie}` : `Série ${serie}`
      sous.forEach((x, j) => {
        if (!x.wMin || !x.wMax || !parSous[j].length) return
        const suffixe = sous.filter((y) => y.wMin).length > 1 ? ` · ${x.libelle.toLowerCase()}` : ' · efforts'
        lignes.push(ligne(`${nom}${suffixe}`, moyenne(parSous[j]), x.wMin, x.wMax, fcFin(e.debutSec, e.dureeSec)))
      })
    } else if (e.wMin && e.wMax && e.dureeSec >= 60) {
      const w = fenetre(e.debutSec, e.dureeSec, w1Hz)
      if (!w.length) continue
      bloc++
      const nom = /^Z2/.test(e.libelle) ? 'Z2' : `Bloc ${bloc}`
      lignes.push(ligne(nom, moyenne(w), e.wMin, e.wMax, fcFin(e.debutSec, e.dureeSec)))
    }
  }
  if (!lignes.length) return undefined

  // Z2 : temps au-dessus du 1er seuil sur les parties Z2 (puissance lissée sur 30 s)
  let auDessusSeuil1: number | undefined
  if (famille === 'z2' || famille === 'z2-long') {
    const z2 = plat.filter((e) => e.libelle.startsWith('Z2') || e.libelle === 'Z2')
    const limite = Math.max(0.7 * cpW, ...z2.map((e) => e.wMax ?? 0))
    auDessusSeuil1 = 0
    for (const e of z2) {
      const w = fenetre(e.debutSec, e.dureeSec, w1Hz)
      for (let i = 30; i <= w.length; i++) if (moyenne(w.slice(i - 30, i)) > limite) auDessusSeuil1++
    }
  }
  return { lignes, ...(auDessusSeuil1 !== undefined ? { auDessusSeuil1 } : {}) }
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
