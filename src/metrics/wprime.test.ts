import { describe, expect, it } from 'vitest'
import { construireIntervalles, FORMATS, plafondWPrime, type Format } from './programme'

const cp = 250
describe("garde-fou W'", () => {
  it('sans W′ fiable : watts inchangés', () => {
    for (const f of FORMATS) expect(construireIntervalles(f, 0, cp, 0).velo.wPrimeKj).toBeUndefined()
  })
  it('ne vide jamais plus de 80 % du W′ par répétition, jamais sous la CP', () => {
    for (const f of FORMATS.filter((x) => !x.aFond)) {
      for (const w of [6, 12, 20]) {
        const s = construireIntervalles(f, f.paliers.length - 1, cp, 0.05, w)
        const sans = construireIntervalles(f, f.paliers.length - 1, cp, 0.05)
        expect(s.velo.cibleW!).toBeLessThanOrEqual(sans.velo.cibleW!)
        expect(s.velo.cibleW!).toBeGreaterThanOrEqual(Math.min(sans.velo.cibleW!, cp))
      }
    }
  })
  it('exemple : 4 min à 120 % de CP avec un petit W′ (8 kJ) → ramené', () => {
    const f = { ...FORMATS.find((x) => !x.aFond && !x.continu)!, pct: 120, travailSec: 240, paliers: [{ series: 1, reps: 4 }, { series: 1, reps: 4 }, { series: 1, reps: 4 }, { series: 1, reps: 4 }] } as Format
    // (300 − 250) × 240 = 12 kJ > 6,4 kJ → 250 + 6400 / 240 ≈ 276 → 275 W
    expect(plafondWPrime(f, 0, cp, 300, 125, 8)).toBe(275)
    expect(plafondWPrime(f, 0, cp, 300, 125, 20)).toBe(300)
  })
})
