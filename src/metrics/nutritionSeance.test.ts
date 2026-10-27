import { describe, expect, it } from 'vitest'
import { conseilsSeance } from './nutritionSeance'

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
