import { describe, expect, it } from 'vitest'
import { calculerSaison, dureesPhases } from './saison'
import { estSemaineAllegee, coefficientPhase } from './programme'

describe('saison calculée depuis la course', () => {
  it('durées selon les semaines disponibles', () => {
    expect(dureesPhases(12)).toEqual({ reprise: 2, entretien: 0, vo2: 3, seuil: 2, specifique: 3, affutage: 2 })
    expect(dureesPhases(29)).toEqual({ reprise: 8, entretien: 0, vo2: 8, seuil: 8, specifique: 3, affutage: 2 })
    expect(dureesPhases(40).entretien).toBe(11)
    expect(dureesPhases(6)).toEqual({ reprise: 0, entretien: 0, vo2: 0, seuil: 0, specifique: 4, affutage: 2 })
    expect(dureesPhases(6, true).reprise).toBe(1)
    expect(dureesPhases(2)).toMatchObject({ affutage: 2, specifique: 0 })
    expect(dureesPhases(20, true).reprise).toBe(4)
  })
  it('phases dans l’ordre, affûtage jusqu’à la course, récupération après', () => {
    // Inscription lundi 9/11/2026, course dimanche 14/02/2027 (lundi 8/02) : 14 semaines
    const s = calculerSaison({ debut: '2026-11-11', course: '2027-02-14' })
    expect(s.semaines).toBe(14)
    expect(s.phases.map((p) => p.type)).toEqual(['reprise', 'vo2', 'seuil', 'specifique', 'affutage', 'recuperation', 'entretien'])
    expect(s.phases[0].debut).toBe('2026-11-09')
    expect(s.phases.find((p) => p.type === 'affutage')!.debut).toBe('2027-02-01')
    expect(s.phases.find((p) => p.type === 'recuperation')!.debut).toBe('2027-02-15')
  })
  it('tests CP : 1re semaine, puis au moins 5 semaines d’écart, jamais en affûtage', () => {
    const s = calculerSaison({ debut: '2026-11-09', course: '2027-06-13', jourLong: 6, jourDur: 1 })
    expect(s.testsCp[0]).toBe('2026-11-15')
    const aff = s.phases.find((p) => p.type === 'affutage')!.debut
    expect(s.testsCp.every((t) => t < aff)).toBe(true)
    for (let i = 1; i < s.testsCp.length; i++) expect(Date.parse(s.testsCp[i]) - Date.parse(s.testsCp[i - 1])).toBeGreaterThanOrEqual(5 * 7 * 86_400_000 - 6 * 86_400_000)
  })
  it('semaine allégée comptée sur la saison, jamais près de la course', () => {
    const s = calculerSaison({ debut: '2026-11-09', course: '2027-02-14' })
    expect(estSemaineAllegee('2026-11-30', s.phases)).toBe(true) // 4e semaine de la saison
    expect(estSemaineAllegee('2026-12-28', s.phases)).toBe(true) // 8e
    const spe = s.phases.find((p) => p.type === 'specifique')!.debut
    expect(estSemaineAllegee(spe, s.phases)).toBe(false)
    expect(coefficientPhase('2027-02-01', s.phases, [{ date: '2027-02-14' }])).toBe(0.65)
    expect(coefficientPhase('2027-02-08', s.phases, [{ date: '2027-02-14' }])).toBe(0.45)
    expect(coefficientPhase('2027-02-15', s.phases, [{ date: '2027-02-14' }])).toBe(0.6)
  })
})
