import { expect, it } from 'vitest'
import { montee, monteeAFond, puissanceTenable, tempsLimite, vitesseMontee } from './col'

it('montée : ordres de grandeur réalistes', () => {
  // 70 kg + 8 kg, 250 W sur 8 % : environ 13-14 km/h
  const v = vitesseMontee(250, 78, 0.08) * 3.6
  expect(v).toBeGreaterThan(12.5)
  expect(v).toBeLessThan(15)
  // 10 km à 7 % (700 m) à 200 W : un peu moins d'une heure
  const m = montee(10, 700, 78, 200)
  expect(m.tempsSec / 60).toBeGreaterThan(45)
  expect(m.tempsSec / 60).toBeLessThan(60)
})

it('temps limite et puissance tenable (modèle CP)', () => {
  expect(tempsLimite(300, 250, 18)).toBe(360)
  expect(tempsLimite(240, 250, 18)).toBeUndefined()
  expect(puissanceTenable(600, 250, 18)).toBe(280)
  expect(puissanceTenable(3600, 250, 18)).toBeLessThan(250)
  expect(puissanceTenable(3600, 250, 18)).toBeGreaterThan(220)
})

it('montée à fond : cohérente avec la puissance tenable sur sa propre durée', () => {
  const r = monteeAFond(10, 700, 78, 250, 18)
  expect(Math.abs(r.puissanceW - puissanceTenable(r.tempsSec, 250, 18))).toBeLessThan(2)
})
