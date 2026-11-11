import { describe, expect, it } from 'vitest'
import { plafondEtNominal, type Role } from './programme'

/** Formule unique du plafond de kJ (audit du 11/11/2026) : la même pour la semaine, la Saison et le dimanche. */
const semaine = (velos: Role[]): Role[] => [...velos, ...Array<Role>(7 - velos.length).fill('libre')]
const base = { kjIntensite: 600, cap: { z2: 75, long: 150 }, z2W: 170 }

describe('plafondEtNominal', () => {
  it('plus de jours de vélo = plafond plus haut, nominal identique', () => {
    const trois = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-long']) })
    const quatre = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-z2', 'velo-long']) })
    const cinq = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-z2', 'velo-z2', 'velo-long']) })
    expect(trois.plafond).toBeLessThan(quatre.plafond)
    expect(quatre.plafond).toBeLessThan(cinq.plafond)
    expect(trois.nominal).toBe(cinq.nominal)
  })
  it('un 2e jour « dur » compte comme une endurance dans le plafond', () => {
    const z2 = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-long']) })
    const dur = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-dur', 'velo-long']) })
    expect(dur.plafond).toBe(z2.plafond)
  })
  it('limité par le haut de la tranche d’heures, jamais sous le nominal', () => {
    const libre = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-z2', 'velo-z2', 'velo-long']) })
    const borne = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-z2', 'velo-z2', 'velo-long']), heuresMax: 4 })
    expect(borne.plafond).toBeLessThan(libre.plafond)
    expect(borne.plafond).toBeGreaterThanOrEqual(borne.nominal)
  })
  it('la sortie longue visée fait monter le nominal, dans la limite du créneau', () => {
    const court = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-long']) })
    const long = plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-long']), longueVisee: 240 })
    expect(long.nominal).toBeGreaterThan(court.nominal)
    expect(long.nominal).toBe(plafondEtNominal({ ...base, semaineType: semaine(['velo-dur', 'velo-z2', 'velo-long']), longueVisee: 150 }).nominal)
  })
})
