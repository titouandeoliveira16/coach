import { describe, expect, it } from 'vitest'
import { plagesForme, positionPct } from './plages'

describe('plagesForme', () => {
  const vfc = { nBase: 40, ln7: Math.log(62), zoneBasse: Math.log(55), zoneHaute: Math.log(70), fcRepos7: 48, fcReposBase: 47 }
  it('reprend les bornes des règles du feu', () => {
    const [rec, pouls, som] = plagesForme(vfc, { moyenne7: 6.33, moyenne30: 7.5 })
    expect(Math.round(rec.bas!)).toBe(55)
    expect(Math.round(rec.haut!)).toBe(70)
    expect(Math.round(rec.valeur!)).toBe(62)
    expect([pouls.bas, pouls.haut]).toEqual([42, 52])
    expect(som.bas).toBe(7)
    expect(som.haut).toBeCloseTo(8.25)
    expect(som.valeur! < som.bas!).toBe(true)
  })
  it('la valeur reste dans l’échelle, même très loin', () => {
    const [, , som] = plagesForme(vfc, { moyenne7: 4 })
    expect(positionPct(som, som.valeur!)).toBeGreaterThanOrEqual(0)
    expect(som.min).toBeLessThan(4)
  })
  it('sans base : pas de normale', () => {
    const [rec, pouls] = plagesForme({ nBase: 3 }, {})
    expect(rec.bas).toBeUndefined()
    expect(pouls.valeur).toBeUndefined()
  })
})
