import { expect, it } from 'vitest'
import { blocTenu, tousTenus } from './blocs'

it('bloc tenu : moyenne dans la plage, plafond au seuil ; anciennes séances à 97 % de la cible', () => {
  const seuil = { cibleW: 250, minW: 245, maxW: 260, dureeSec: 600, w: [250, 262] }
  expect(blocTenu(250, seuil)).toBe(true)
  expect(blocTenu(262, seuil)).toBe(false)
  expect(blocTenu(240, seuil)).toBe(false)
  expect(tousTenus(seuil)).toBe(false)
  const vo2 = { cibleW: 280, minW: 270, dureeSec: 300, w: [300, 272] }
  expect(tousTenus(vo2)).toBe(true)
  const ancienne = { cibleW: 250, dureeSec: 600, w: [243] }
  expect(tousTenus(ancienne)).toBe(true)
})
