import { describe, expect, it } from 'vitest'
import { besoinsDuJour, evolutionTaille, glucidesParKg, kcalActivite, metabolismeBase, partGlucides, propositionNutrition, tendancePoids, type BilanNutrition, type Energie, type Faim } from './nutrition'
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
    // 3 g/kg + 1,5 × glucides brûlés (Thomas 2016 : léger 3-5, ~1 h 5-7, 1-3 h 6-10, > 4 h 8-12 ; un peu bas en perte de gras)
    expect(glucidesParKg(0, 77)).toBe(3)
    expect(glucidesParKg(1200 * 0.5, 77)).toBeCloseTo(5.9, 1)
    expect(glucidesParKg(5000, 77)).toBe(12)
    // Part glucidique continue : 1 min ou 7 min en Z5, ce n'est pas la même séance
    expect(partGlucides([900, 600, 120, 120, 60])!).toBeLessThan(partGlucides([900, 600, 120, 120, 420])!)
    expect(partGlucides([0, 3600, 0, 0, 0])).toBe(0.5)
    const repos = besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [] })
    expect(repos.kcal).toBeGreaterThan(2250)
    expect(repos.kcal).toBeLessThan(2450)
    // Vie quotidienne, marche comprise : métabolisme × 1,4
    expect(repos.quotidien).toBe(Math.round(1673.75 * 1.4))
    const long = besoinsDuJour({ kg: 70, cm: 175, age: 25, activites: [{ sport: 'velo', dureeMin: 240, intensite: 'basse', kj: 2300 }] })
    expect(long.lipides * 9).toBeGreaterThanOrEqual(0.2 * long.kcal - 50)
  })
})

describe('perte de gras légère', () => {
  const p = { kg: 70, cm: 175, age: 25 }
  it('déficit continu : moins le travail glucidique est grand, plus le déficit est grand ; protéines 1,8 g/kg', () => {
    const repos = besoinsDuJour({ ...p, activites: [], objectif: 'perte' })
    expect(repos.journee).toBe('facile')
    expect(repos.proteinesParKg).toBe(1.8)
    expect(repos.maintien - repos.kcal).toBeGreaterThanOrEqual(400)
    const z2 = besoinsDuJour({ ...p, activites: [{ sport: 'velo', dureeMin: 60, intensite: 'basse', kj: 600, partGlucides: 0.5 }], objectif: 'perte' })
    expect(z2.deficit).toBe(320)
    const inter = besoinsDuJour({ ...p, activites: [{ sport: 'velo', dureeMin: 60, intensite: 'haute', kj: 700, partGlucides: 0.8 }], objectif: 'perte' })
    expect(inter.journee).toBe('dure')
    expect(inter.deficit).toBe(164)
    const long = besoinsDuJour({ ...p, activites: [{ sport: 'velo', dureeMin: 120, intensite: 'basse', kj: 1300, partGlucides: 0.5 }], objectif: 'perte' })
    expect(long.deficit).toBe(110)
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

describe('bilan du dimanche', () => {
  const b = (date: string, faim: Faim = 'ok', energie: Energie = 'bien', tailleCm?: number): BilanNutrition => ({ date, faim, energie, tailleCm })
  const base = { kg: 75, deficitBase: 500 }
  it('rythme dans la cible : on garde ; rien avant 14 jours de pesées', () => {
    expect(propositionNutrition({ ...base, tendance14: -0.35, tendance21: -0.35, bilans: [b('2026-11-15')] }).type).toBe('garder')
    expect(propositionNutrition({ ...base, tendance14: undefined, bilans: [b('2026-11-08')] }).type).toBe('garder')
  })
  it('trop vite : −100 (0,7 à 1 %/sem) ou −200 (≥ 1 %/sem) ; jamais plus d’un ajustement en 14 jours', () => {
    expect(propositionNutrition({ ...base, tendance14: -0.6, bilans: [b('2026-11-15')] })).toMatchObject({ type: 'ajuster', delta: -100 })
    expect(propositionNutrition({ ...base, tendance14: -0.8, bilans: [b('2026-11-15')] })).toMatchObject({ type: 'ajuster', delta: -200 })
    expect(propositionNutrition({ ...base, tendance14: -0.8, bilans: [b('2026-11-15')], joursDepuisAjustement: 7 }).type).toBe('garder')
  })
  it('stagnation 3 semaines sans faim ni fatigue : +100, plafonné à 600', () => {
    const bilans = [b('2026-11-15'), b('2026-11-08')]
    expect(propositionNutrition({ ...base, tendance14: -0.1, tendance21: -0.1, bilans })).toMatchObject({ type: 'ajuster', delta: 100 })
    expect(propositionNutrition({ ...base, deficitBase: 600, tendance14: -0.1, tendance21: -0.1, bilans }).type).toBe('garder')
    expect(propositionNutrition({ ...base, tendance14: -0.1, tendance21: -0.1, bilans: [b('2026-11-15', 'un-peu'), b('2026-11-08')] }).type).toBe('garder')
  })
  it('faim et fatigue : −100 ; 2 semaines de faim forte : pause au maintien, puis médecin si ça revient', () => {
    expect(propositionNutrition({ ...base, tendance14: -0.3, bilans: [b('2026-11-15', 'un-peu', 'moyen')] })).toMatchObject({ type: 'ajuster', delta: -100 })
    const faim = [b('2026-11-15', 'souvent'), b('2026-11-08', 'souvent')]
    expect(propositionNutrition({ ...base, tendance14: -0.3, bilans: faim })).toMatchObject({ type: 'pause', medecin: false })
    expect(propositionNutrition({ ...base, tendance14: -0.3, bilans: faim, pauseRecente: true })).toMatchObject({ type: 'pause', medecin: true })
  })
  it('déficit de base ajusté, mais les jours de grosse séance restent à −100', () => {
    const p = { kg: 70, cm: 175, age: 25, objectif: 'perte' as const }
    expect(besoinsDuJour({ ...p, activites: [], deficitBase: 300 }).deficit).toBe(300)
    const dure = { sport: 'velo' as const, dureeMin: 120, intensite: 'haute' as const, kj: 1500 }
    expect(besoinsDuJour({ ...p, activites: [dure], deficitBase: 600 }).deficit).toBe(100)
  })
  it('tour de taille : écart sur au moins 14 jours, significatif à partir de 1,5 cm', () => {
    expect(evolutionTaille([b('2026-11-08', 'ok', 'bien', 82)])).toBeUndefined()
    expect(evolutionTaille([b('2026-11-22', 'ok', 'bien', 80.2), b('2026-11-15', 'ok', 'bien', 81), b('2026-11-08', 'ok', 'bien', 82)]))
      .toEqual({ ecart: -1.8, significatif: true, depuis: '2026-11-08' })
  })
})
