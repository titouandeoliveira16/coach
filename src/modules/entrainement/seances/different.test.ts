import { describe, expect, it } from 'vitest'
import { estRealiseDifferent } from './donnees'
import type { Seance } from '../types'

const s = (min: number, source: Seance['source'] = 'intervals'): Seance => ({ id: 'x', date: '2026-11-10', sport: 'velo', dureeSec: min * 60, source })
describe('réalisé différent du prévu', () => {
  it('une Z2 prévue faite en séance dure, ou une durée très différente', () => {
    expect(estRealiseDifferent({ sport: 'velo', intensite: 'basse', dureeMin: 45 }, s(50), 'haute')).toBe(true)
    expect(estRealiseDifferent({ sport: 'velo', intensite: 'basse', dureeMin: 45 }, s(48), 'basse')).toBe(false)
    expect(estRealiseDifferent({ sport: 'velo', intensite: 'haute', dureeMin: 60 }, s(25), 'haute')).toBe(true)
    expect(estRealiseDifferent({ sport: 'velo', intensite: 'basse', dureeMin: 45 }, s(40, 'manuel'), 'haute')).toBe(false)
  })
})
