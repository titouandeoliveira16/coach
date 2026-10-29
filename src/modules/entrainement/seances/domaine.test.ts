import { describe, expect, it } from 'vitest'
import type { Seance } from '../types'
import { chargeDe, domaineDe } from './donnees'

const bornes: [number, number, number, number] = [130, 150, 165, 177]
const s = (c: Partial<Seance>): Seance => ({ id: 'x', date: '2026-10-27', sport: 'course', dureeSec: 2400, source: 'manuel', ...c } as Seance)

describe('intensité d’une séance', () => {
  it('un test court à fond est une séance dure, même avec peu de minutes en zone haute', () => {
    // 25 min d'échauffement en Z1-Z2, 5 min d'effort dont 2 en Z5
    expect(domaineDe(s({ tempsZones: [900, 600, 120, 180, 120] }), bornes)).toBe('haute')
    expect(domaineDe(s({ titre: 'Test 1500m', tempsZones: [1500, 600, 60, 60, 0] }), bornes)).toBe('haute')
    expect(domaineDe(s({ rpe: 8, tempsZones: [1500, 600, 60, 60, 0] }), bornes)).toBe('haute')
  })
  it('un footing reste facile ; sans ceinture, un pic de FC ne compte pas', () => {
    expect(domaineDe(s({ titre: 'Footing', tempsZones: [1500, 900, 0, 0, 0] }), bornes)).toBe('basse')
    expect(domaineDe(s({ fcMoy: 140, fcMax: 185, sansCeinture: true }), bornes)).toBe('basse')
  })
})

it('foot entre amis (« autre ») : aucune charge d’entraînement, mais son intensité sert aux calories', () => {
  const foot = s({ sport: 'autre', titre: 'Football', dureeSec: 5400, rpe: 7, tempsZones: [1200, 1800, 1200, 900, 300] })
  expect(chargeDe(foot, { chargeRef: 'trimp' })).toBe(0)
  expect(chargeDe(foot, { chargeRef: 'srpe' })).toBe(0)
  expect(domaineDe(foot, bornes)).toBe('haute')
})
