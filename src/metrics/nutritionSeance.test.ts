import { describe, expect, it } from 'vitest'
import { conseilsSeance, palierVentre } from './nutritionSeance'

describe('nutrition autour des séances', () => {
  it('Z2 courte : eau seulement', () => {
    const c = conseilsSeance({ sport: 'velo', dureeMin: 50, intensite: 'basse' })
    expect(c.pendant).toMatch(/eau/)
    expect(c.glucides).toBeUndefined()
    expect(c.avant).toBeUndefined()
  })
  it('intensité d’1 h : un bidon de boisson d’effort, protéines après', () => {
    const c = conseilsSeance({ sport: 'velo', dureeMin: 60, intensite: 'haute' })
    expect(c.glucides).toEqual([20, 30])
    expect(c.apres).toMatch(/protéines/)
  })
  it('sortie longue de 2 h : 30-60 g/h', () => {
    expect(conseilsSeance({ sport: 'velo', dureeMin: 120, intensite: 'basse' }).glucides).toEqual([60, 120])
  })
  it('plus de 2 h 30 : 60-90 g/h glucose + fructose', () => {
    const c = conseilsSeance({ sport: 'velo', dureeMin: 180, intensite: 'basse' })
    expect(c.glucides).toEqual([180, 270])
    expect(c.pendant).toMatch(/fructose/)
  })
})

describe('glucides selon la discipline et habituer son ventre', () => {
  it('short track : eau ; XCO : 40-60 g/h ; mélange et sel au-delà d’1 h 15', () => {
    expect(conseilsSeance({ sport: 'velo', dureeMin: 30, intensite: 'haute', epreuve: 'xcc' }).glucides).toBeUndefined()
    const xco = conseilsSeance({ sport: 'velo', dureeMin: 90, intensite: 'haute', epreuve: 'xco' })
    expect(xco.glucides).toEqual([60, 90])
    expect(xco.melange).toMatch(/2 pour 1/)
    expect(conseilsSeance({ sport: 'velo', dureeMin: 300, intensite: 'basse', palierVentre: 100 }).melange).toMatch(/1 : 0,8/)
  })
  it('palier : +10 g/h par semaine, même palier à 5, −10 à 7, jusqu’à la cible', () => {
    expect(palierVentre({ semaine: 0, notes: [], dureeCourseMin: 300 })).toBe(60)
    expect(palierVentre({ semaine: 2, notes: [2, 3], dureeCourseMin: 300 })).toBe(80)
    expect(palierVentre({ semaine: 2, notes: [2, 6], dureeCourseMin: 300 })).toBe(70)
    expect(palierVentre({ semaine: 3, notes: [2, 3, 8], dureeCourseMin: 300 })).toBe(70)
    expect(palierVentre({ semaine: 6, notes: [], dureeCourseMin: 200 })).toBe(90)
    expect(palierVentre({ semaine: 6, notes: [], dureeCourseMin: 300 })).toBe(110)
  })
})
