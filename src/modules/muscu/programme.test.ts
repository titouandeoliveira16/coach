import { describe, expect, it } from 'vitest'
import { arrondi, decisionCycle, maxEstime, referenceDepuisMax, referenceSuivante, seanceDe } from './programme'

describe('5/3/1 au développé couché', () => {
  it('max estimé (Epley) et référence selon l’objectif, au 2,5 kg inférieur', () => {
    expect(maxEstime(85, 6)).toBe(102)
    expect(maxEstime(100, 1)).toBe(100)
    expect(referenceDepuisMax(100, 'perte')).toBe(85)
    expect(referenceDepuisMax(100, 'maintien')).toBe(90)
    expect(arrondi(63.7)).toBe(62.5)
    expect(arrondi(10)).toBe(20)
  })

  it('les 4 semaines : charges, série « + », 5×5, allègement', () => {
    const s1 = seanceDe(1, 100)
    expect(s1.principales).toEqual([{ kg: 65, reps: 5 }, { kg: 75, reps: 5 }, { kg: 85, reps: 5, plus: true }])
    expect(s1.complementaires).toHaveLength(5)
    expect(s1.complementaires[0]).toEqual({ kg: 65, reps: 5 })
    expect(s1.echauffement.map((s) => s.kg)).toEqual([20, 40, 50, 60])
    expect(seanceDe(2, 100).principales.map((s) => s.kg)).toEqual([70, 80, 90])
    expect(seanceDe(3, 100).principales.map((s) => [s.kg, s.reps])).toEqual([[75, 5], [85, 3], [95, 1]])
    const s4 = seanceDe(4, 100)
    expect(s4.principales.map((s) => s.kg)).toEqual([40, 50, 60])
    expect(s4.principales.some((s) => s.plus)).toBe(false)
    expect(s4.complementaires).toHaveLength(0)
  })

  it('progression décidée par la série à 95 %', () => {
    expect(decisionCycle(4, false).verdict).toBe('plus')
    expect(decisionCycle(2, false).verdict).toBe('stable')
    expect(decisionCycle(1, false).verdict).toBe('stable')
    expect(decisionCycle(1, true).verdict).toBe('baisse')
    expect(decisionCycle(0, false).verdict).toBe('baisse')
    expect(referenceSuivante(100, 'plus', 0.9, 0.9)).toBe(102.5)
    expect(referenceSuivante(100, 'baisse', 0.9, 0.9)).toBe(90)
    // Passage de maintien (90 %) à perte (85 %) : la référence suit
    expect(referenceSuivante(90, 'stable', 0.9, 0.85)).toBe(85)
  })
})
