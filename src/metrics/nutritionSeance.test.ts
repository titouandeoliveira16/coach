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
    expect(conseilsSeance({ sport: 'velo', dureeMin: 120, intensite: 'basse' }).glucides).toEqual([45, 90])
  })
  it('plus de 2 h 30 : 60-90 g/h glucose + fructose', () => {
    const c = conseilsSeance({ sport: 'velo', dureeMin: 180, intensite: 'basse' })
    expect(c.glucides).toEqual([180, 270])
    expect(c.melange).toMatch(/fructose/)
  })
})

describe('glucides selon la discipline et habituer son ventre', () => {
  it('short track : eau ; XCO : 40-60 g/h ; mélange et sel au-delà d’1 h 15', () => {
    expect(conseilsSeance({ sport: 'velo', dureeMin: 30, intensite: 'haute', epreuve: 'xcc' }).glucides).toBeUndefined()
    const xco = conseilsSeance({ sport: 'velo', dureeMin: 90, intensite: 'haute', epreuve: 'xco' })
    expect(xco.glucides).toEqual([60, 90])
    // 60 g/h au plus : un seul sucre suffit, pas de mélange (15/11/2026)
    expect(xco.melange).toBeUndefined()
    expect(conseilsSeance({ sport: 'velo', dureeMin: 200, intensite: 'basse' }).melange).toMatch(/2 pour 1/)
    expect(conseilsSeance({ sport: 'velo', dureeMin: 300, intensite: 'basse', palierVentre: 100 }).melange).toMatch(/1 : 0,8/)
  })
  it('palier : +10 g/h par semaine, même palier à 5, −10 à 7, jusqu’à la cible', () => {
    expect(palierVentre({ semaine: 0, notes: [], dureeCourseMin: 300 })).toBe(60)
    expect(palierVentre({ semaine: 2, notes: [2, 3], dureeCourseMin: 300 })).toBe(80)
    expect(palierVentre({ semaine: 2, notes: [2, 6], dureeCourseMin: 300 })).toBe(70)
    expect(palierVentre({ semaine: 3, notes: [2, 3, 8], dureeCourseMin: 300 })).toBe(70)
    expect(palierVentre({ semaine: 6, notes: [], dureeCourseMin: 200 })).toBe(90)
    expect(palierVentre({ semaine: 6, notes: [], dureeCourseMin: 300 })).toBe(90)
  })
  it('jour de course longue : le palier toléré à l’entraînement, 60 g/h si le ventre n’a pas été entraîné', () => {
    const tolere = conseilsSeance({ sport: 'velo', dureeMin: 300, intensite: 'haute', epreuve: 'cyclo', palierTolere: 80 })
    expect(tolere.glucides).toEqual([300, 400])
    expect(tolere.pendant).toMatch(/toléré/)
    expect(conseilsSeance({ sport: 'velo', dureeMin: 240, intensite: 'haute', epreuve: 'en-ligne' }).pendant).toMatch(/60 g.*moments calmes/)
  })
  it('après : 0,3 g/kg de protéines, recharge rapide si une autre séance dure le même jour', () => {
    const c = conseilsSeance({ sport: 'velo', dureeMin: 60, intensite: 'haute', kg: 70, rechargeRapide: true })
    expect(c.apres).toMatch(/≈ 20 g de protéines/)
    expect(c.apres).toMatch(/70 g de glucides par heure pendant 4 h/)
  })
})
