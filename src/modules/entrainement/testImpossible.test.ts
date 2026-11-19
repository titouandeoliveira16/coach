import { describe, expect, it } from 'vitest'
import { testImpossible } from './calculs'

describe('test CP impossible (audit du 18/11/2026)', () => {
  it('refuse une CP au-dessus de la puissance de 12 min', () => {
    expect(testImpossible([{ dureeSec: 720, puissanceW: 305 }, { dureeSec: 420, puissanceW: 300 }, { dureeSec: 180, puissanceW: 300 }])).toBeDefined()
  })
  it('accepte un test cohérent', () => {
    expect(testImpossible([{ dureeSec: 720, puissanceW: 280 }, { dureeSec: 420, puissanceW: 300 }, { dureeSec: 180, puissanceW: 360 }])).toBeUndefined()
  })
})
