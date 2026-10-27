import { describe, expect, it } from 'vitest'
import { besoinsDuJour, glucidesParKg, kcalActivite, kcalMarche, metabolismeBase, tendancePoids } from './nutrition'
import { ageAu } from '../core/profil'

describe('besoins du jour', () => {
  it('métabolisme de base (Mifflin-St Jeor) et âge', () => {
    expect(metabolismeBase(70, 175, 25)).toBeCloseTo(1673.75, 1)
    expect(ageAu('2000-03-10', '2026-03-09')).toBe(25)
    expect(ageAu('2000-03-10', '2026-03-10')).toBe(26)
  })

  it('séances : kJ au vélo, kg × km en course, sinon MET', () => {
    expect(kcalActivite({ sport: 'velo', dureeMin: 60, intensite: 'basse', kj: 600 }, 77)).toBe(600)
    expect(kcalActivite({ sport: 'course', dureeMin: 45, intensite: 'basse', distanceKm: 9 }, 77)).toBe(693)
    expect(kcalActivite({ sport: 'course', dureeMin: 60, intensite: 'basse' }, 77)).toBeCloseTo(677.6, 1)
  })

  it('glucides selon la charge, lipides jamais sous 20 %', () => {
    expect(glucidesParKg(0, false)).toBe(4)
    expect(glucidesParKg(60, false)).toBe(6)
    expect(glucidesParKg(75, true)).toBe(7)
    expect(glucidesParKg(120, true)).toBe(8)
    const repos = besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [], pas: 7000 })
    expect(repos.kcal).toBeGreaterThan(2250)
    expect(repos.kcal).toBeLessThan(2450)
    // Sans marche : métabolisme × 1,3 ; chaque pas compte (0,5 kcal/kg/km, foulée 0,415 × taille)
    expect(besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [] }).quotidien).toBe(Math.round(1673.75 * 1.3))
    expect(kcalMarche(10000, 70, 175)).toBeCloseTo(254, 0)
    expect(besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [], pas: 10000 }).facteur).toBeCloseTo(1.45, 2)
    const long = besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [{ sport: 'velo', dureeMin: 240, intensite: 'basse', kj: 2300 }] })
    expect(long.lipides * 9).toBeGreaterThanOrEqual(0.2 * long.kcal - 50)
  })
})

describe('perte de gras légère', () => {
  const p = { kg: 70, cm: 175, age: 25 }
  it('déficit selon le jour, protéines 1,8 g/kg', () => {
    const repos = besoinsDuJour({ ...p, activites: [], objectif: 'perte', pas: 7000 })
    expect(repos.journee).toBe('facile')
    expect(repos.proteinesParKg).toBe(1.8)
    expect(repos.maintien - repos.kcal).toBeGreaterThanOrEqual(400)
    const dure = besoinsDuJour({ ...p, activites: [{ sport: 'velo', dureeMin: 60, intensite: 'haute', kj: 650 }], objectif: 'perte' })
    expect(dure.journee).toBe('dure')
    expect(dure.deficit).toBe(100)
  })
  it('jamais sous 30 kcal par kg de masse maigre une fois le sport déduit', () => {
    const b = besoinsDuJour({ kg: 60, cm: 175, age: 25, activites: [], objectif: 'perte' })
    expect(b.kcal - b.seances).toBeGreaterThanOrEqual(30 * 60 * 0.85 - 50)
  })
  it('tendance du poids en kg par semaine', () => {
    const pesees = [{ date: '2026-10-01', poidsKg: 78 }, { date: '2026-10-15', poidsKg: 77.2 }, { date: '2026-10-26', poidsKg: 76.6 }]
    expect(tendancePoids(pesees, '2026-10-26')).toBeCloseTo(-0.39, 1)
    expect(tendancePoids(pesees.slice(1), '2026-10-26')).toBeUndefined()
  })
})

describe('ajustements', () => {
  it('excès étalé : 250 kcal max par jour facile, jamais un jour de séance dure', async () => {
    const { reductionsEtalement } = await import('./nutrition')
    const r = reductionsEtalement([{ date: '2026-10-27', kcal: 600 }], [
      { date: '2026-10-28', facile: true }, { date: '2026-10-29', facile: false }, { date: '2026-10-30', facile: true }, { date: '2026-10-31', facile: true },
    ])
    expect([...r.entries()]).toEqual([['2026-10-28', 250], ['2026-10-30', 250], ['2026-10-31', 100]])
  })
  it('maintien mesuré : repas moyens corrigés de la tendance du poids', async () => {
    const { maintienMesure } = await import('./nutrition')
    // 2 300 kcal mangées, −0,3 kg/sem. → 2 630 ; la formule disait 2 500 → +150 (arrondi à 50)
    expect(maintienMesure({ kcalMoyen: 2300, formuleMoyenne: 2500, tendanceKgSemaine: -0.3 })).toEqual({ mesure: 2630, ecart: 150 })
  })
  it('l’étalement ne passe jamais sous le plancher', () => {
    const b = besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [], objectif: 'perte', reduction: 250 })
    expect(b.kcal - b.seances).toBeGreaterThanOrEqual(30 * 70 * 0.85 - 50)
  })
})
