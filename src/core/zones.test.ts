import { expect, it } from 'vitest'
import { couleurPctCP, COULEURS_ZONES, zonesDepuisCp } from './zones'

it('zones en % de la CP (Z4 jusqu’à 100 %), FC gardées zone par zone', () => {
  const z = zonesDepuisCp(200, [{ fcMin: 100, fcMax: 140 }, { fcMin: 140, fcMax: 160 }])
  expect(z.map((x) => [x.nom, x.wMin, x.wMax])).toEqual([
    ['Z1', 0, 110], ['Z2', 112, 140], ['Z3', 142, 180], ['Z4', 182, 200], ['Z5', 202, 240], ['Z6', 242, undefined],
  ])
  expect([z[1].fcMin, z[1].fcMax, z[2].fcMin]).toEqual([140, 160, undefined])
  expect(couleurPctCP(100)).toBe(COULEURS_ZONES[3])
  expect(couleurPctCP(101)).toBe(COULEURS_ZONES[4])
})
