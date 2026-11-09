import { describe, expect, it } from 'vitest'
import { bilanControle, controlerSeance, controleTenu } from './controle'
import { construireIntervalles, construireZ2, deplier, formatDe } from './programme'

/** Fichier simulé : la séance prévue jouée telle quelle, avec un départ décalé et un facteur sur les efforts. */
function simuler(etapes: Parameters<typeof deplier>[0], decalage: number, facteurEffort = 1) {
  const w: number[] = Array.from({ length: decalage }, () => 100)
  for (const e of deplier(etapes)) for (let t = 0; t < e.dureeSec; t++) w.push(e.wMin ? (e.w ?? 0) * facteurEffort : e.w ?? 500)
  return w
}

it('30/15 : séries tenues, même avec un départ décalé de 2 min', () => {
  const s = construireIntervalles(formatDe('30-15')!, 0, 235, 0)
  const c = controlerSeance({ etapes: s.velo.etapes!, famille: 'vo2-courts', w1Hz: simuler(s.velo.etapes!, 120), cpW: 235 })!
  expect(c.lignes.map((l) => l.libelle)).toEqual(['Série 1 · efforts', 'Série 2 · efforts'])
  expect(c.lignes.every((l) => l.verdict === 'ok')).toBe(true)
  expect(controleTenu(c)).toBe(true)
})

it('seuil fait trop fort : au-dessus et pas tenu ; trop faible : en dessous', () => {
  const s = construireIntervalles(formatDe('seuil-8-10')!, 0, 235, 0)
  const fort = controlerSeance({ etapes: s.velo.etapes!, famille: 'seuil', w1Hz: simuler(s.velo.etapes!, 0, 1.08), cpW: 235 })!
  expect(fort.lignes.every((l) => l.verdict === 'haut' && !l.tenu)).toBe(true)
  expect(bilanControle(fort, 'seuil')).toMatch(/au-dessus de ton seuil/)
  const faible = controlerSeance({ etapes: s.velo.etapes!, famille: 'seuil', w1Hz: simuler(s.velo.etapes!, 0, 0.9), cpW: 235 })!
  expect(faible.lignes.every((l) => l.verdict === 'bas')).toBe(true)
})

it('over-unders : passages sous et au-dessus contrôlés séparément', () => {
  const s = construireIntervalles(formatDe('over-under')!, 0, 235, 0)
  const c = controlerSeance({ etapes: s.velo.etapes!, famille: 'seuil-variable', w1Hz: simuler(s.velo.etapes!, 30), cpW: 235 })!
  expect(c.lignes.map((l) => l.libelle)).toEqual(['Bloc 1 · sous la cp', 'Bloc 1 · au-dessus', 'Bloc 2 · sous la cp', 'Bloc 2 · au-dessus'])
})

it('Z2 avec sprints : la Z2 est contrôlée, les sprints ignorés ; ressenti en hausse signalé', () => {
  const z = construireZ2(90, 150, { n: 6, sec: 10 })
  const c = controlerSeance({ etapes: z.velo.etapes!, famille: 'z2-long', w1Hz: simuler(z.velo.etapes!, 0), cpW: 235 })!
  expect(c.lignes.map((l) => l.libelle)).toEqual(['Z2', 'Z2 entre les sprints', 'Z2'])
  expect(c.lignes.every((l) => l.verdict === 'ok')).toBe(true)
  expect(c.auDessusSeuil1).toBeLessThan(60)
  expect(controleTenu(c)).toBe(true)
  const s = construireIntervalles(formatDe('seuil-8-10')!, 0, 235, 0)
  const k = controlerSeance({ etapes: s.velo.etapes!, famille: 'seuil', w1Hz: simuler(s.velo.etapes!, 0), cpW: 235 })!
  expect(bilanControle(k, 'seuil')).toMatch(/dans la plage/)
})

it('avec les tours de Zwift : moyennes et FC prises tour par tour', () => {
  const s = construireIntervalles(formatDe('seuil-8-10')!, 0, 235, 0)
  const plat = deplier(s.velo.etapes!)
  // Un tour libre avant la séance, puis un tour par étape ; le 2e bloc fait trop fort
  let bloc = 0
  const tours = [{ dureeSec: 300, w: 120 }, ...plat.map((e) => {
    const effort = !!e.wMin
    if (effort) bloc++
    return { dureeSec: e.dureeSec, w: effort && bloc === 2 ? 260 : e.w ?? 0, fc: effort ? 175 + bloc : 130 }
  })]
  const c = controlerSeance({ etapes: s.velo.etapes!, famille: 'seuil', w1Hz: [], cpW: 235, tours })!
  expect(c.parTours).toBe(true)
  expect(c.lignes.map((l) => l.verdict)).toEqual(['ok', 'haut', 'ok'])
  expect(c.lignes[2].fc).toBe(178)
})


describe('arrêt pendant un bloc (pause pour parler, roue libre)', () => {
  const s = construireIntervalles(formatDe('sweet-spot')!, 0, 235, 0)
  const etapes = s.velo.etapes!
  const plat = deplier(etapes)
  const bloc1 = plat.find((e) => e.libelle.startsWith('Répétition 1'))!
  // Fichier : la séance jouée à la cible, avec 60 s à 0 W au milieu du 1er bloc
  const avecArret = (minuteurEnPause: boolean) => {
    const w: number[] = []
    for (const e of plat) {
      for (let t = 0; t < e.dureeSec; t++) {
        if (e === bloc1 && t === 420) for (let p = 0; p < 60; p++) w.push(0)
        if (e === bloc1 && !minuteurEnPause && t >= 420 && t < 480) continue
        w.push(e.w ?? 0)
      }
    }
    return w
  }

  it('minuteur arrêté pendant la pause : le reste de la séance est décalé, la minute est exclue', () => {
    const c = controlerSeance({ etapes, famille: 'sweet-spot', w1Hz: avecArret(true), cpW: 235 })!
    expect(c.lignes.map((l) => l.verdict)).toEqual(['ok', 'ok'])
    expect(c.lignes[0].w).toBe(bloc1.w)
    expect(c.arretSec).toBe(60)
  })

  it('minuteur qui continue : la minute à 0 W est exclue de la moyenne du bloc', () => {
    const c = controlerSeance({ etapes, famille: 'sweet-spot', w1Hz: avecArret(false), cpW: 235 })!
    expect(c.lignes.map((l) => l.verdict)).toEqual(['ok', 'ok'])
    expect(c.lignes[0].w).toBe(bloc1.w)
  })

  it('tours allongés par l’arrêt : reconnus, moyenne du tour telle quelle (comme sur la montre)', () => {
    const w = avecArret(true)
    let h = 0
    const tours = plat.map((e) => {
      const d = e.dureeSec + (e === bloc1 ? 60 : 0)
      const t = { dureeSec: d, w: moyenne(w.slice(h, h + d)) }
      h += d
      return t
    })
    const c = controlerSeance({ etapes, famille: 'sweet-spot', w1Hz: w, cpW: 235, tours })!
    expect(c.parTours).toBe(true)
    expect(c.lignes[0].w).toBe(Math.round(tours[plat.indexOf(bloc1)].w))
    expect(c.arretSec).toBe(60)
  })

  it('circuits de la montre (un par grand morceau) : chaque bloc prend la moyenne de son circuit', () => {
    const w = avecArret(true)
    const bloc2 = plat.find((e) => e.libelle.startsWith('Répétition 2'))!
    const i1 = plat.indexOf(bloc1)
    const i2 = plat.indexOf(bloc2)
    const duree = (a: number, b: number) => plat.slice(a, b).reduce((t, e) => t + e.dureeSec, 0)
    // Échauffement en un circuit, bloc 1 (+ 60 s de pause), récup, bloc 2, retour au calme
    const tours = [
      { dureeSec: duree(0, i1), w: 150 },
      { dureeSec: bloc1.dureeSec + 60, w: 208, fc: 156 },
      { dureeSec: duree(i1 + 1, i2), w: 120 },
      { dureeSec: bloc2.dureeSec, w: 210, fc: 165 },
      { dureeSec: duree(i2 + 1, plat.length), w: 110 },
    ]
    const c = controlerSeance({ etapes, famille: 'sweet-spot', w1Hz: w, cpW: 235, tours })!
    expect(c.parTours).toBeUndefined()
    expect(c.blocsParTours).toBe(2)
    expect(c.lignes.map((l) => [l.w, l.fc])).toEqual([[208, 156], [210, 165]])
    // Sans le fichier : même résultat, par l'ordre et la durée des circuits
    expect(controlerSeance({ etapes, famille: 'sweet-spot', w1Hz: [], cpW: 235, tours })!.lignes.map((l) => l.w)).toEqual([208, 210])
  })

  it('un seul grand circuit : pas de tour pour les blocs, calcul sur le fichier', () => {
    const w = avecArret(true)
    const c = controlerSeance({ etapes, famille: 'sweet-spot', w1Hz: w, cpW: 235, tours: [{ dureeSec: w.length, w: 180 }] })!
    expect(c.blocsParTours).toBeUndefined()
    expect(c.lignes[0].w).toBe(bloc1.w)
  })
})

const moyenne = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length
