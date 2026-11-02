import { expect, it } from 'vitest'
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
  k.lignes[0].rpe = 6
  k.lignes[2].rpe = 9
  expect(bilanControle(k, 'seuil')).toMatch(/Ressenti en hausse de 3 points/)
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

