import { expect, it } from 'vitest'
import { couleurPctCP, couleurW, COULEURS_ZONES, zonesDepuisCp } from './zones'

it('zones en % de la CP (Z4 jusqu’à 100 %), FC gardées zone par zone', () => {
  const z = zonesDepuisCp(200, [{ fcMin: 100, fcMax: 140 }, { fcMin: 140, fcMax: 160 }])
  expect(z.map((x) => [x.nom, x.wMin, x.wMax])).toEqual([
    // Sans trou : chaque zone commence 1 W au-dessus de la précédente
    ['Z1', 0, 110], ['Z2', 111, 140], ['Z3', 141, 180], ['Z4', 181, 200], ['Z5', 201, 240], ['Z6', 241, undefined],
  ])
  expect([z[1].fcMin, z[1].fcMax, z[2].fcMin]).toEqual([140, 160, undefined])
  expect(couleurPctCP(100)).toBe(COULEURS_ZONES[3])
  expect(couleurPctCP(101)).toBe(COULEURS_ZONES[4])
})

it('couleur selon tes zones : le 1er seuil en haut de la Z2 reste bleu (19/11/2026)', () => {
  const zones = [{ wMax: 129 }, { wMax: 170 }, { wMax: 212 }, { wMax: 235 }, { wMax: 282 }, {}]
  expect(couleurW(170, 235, zones)).toBe(COULEURS_ZONES[1])
  expect(couleurW(171, 235, zones)).toBe(COULEURS_ZONES[2])
  expect(couleurW(125, 235, zones)).toBe(COULEURS_ZONES[0])
  // Sans zones : bornes en % de la CP
  expect(couleurW(170, 235)).toBe(COULEURS_ZONES[2])
})
