import { describe, expect, it } from 'vitest'
import { calculerSaison, chargeHabituelle, facteurCoupure, repriseSelonCoupure } from './saison'
import { plafondsReprise, projeterSaison, type Phase } from './programme'

/** Retour après une coupure (12/11/2026) : charge habituelle, part d'où l'on repart, reprise. */
const sem = (...kj: number[]) => kj.map((x) => ({ kj: x }))

describe('chargeHabituelle', () => {
  it('prend le meilleur bloc de 4 semaines d’affilée, pas un record isolé', () => {
    const h = chargeHabituelle(sem(2000, 9000, 2000, 2000, 4000, 4200, 3800, 4000, 4000, 4100, 3900, 4000))!
    expect(h.habituelle).toBeGreaterThanOrEqual(3900)
    expect(h.habituelle).toBeLessThan(4300)
    expect(h.coupure).toBe(0)
    expect(h.facteur).toBe(0.9)
  })
  it('compte les semaines sous la moitié après le bloc : 3 semaines → 75 %', () => {
    const h = chargeHabituelle(sem(1000, 1000, 1000, 1000, 1000, 5000, 5000, 5000, 5000, 800, 600, 1200))!
    expect(h.habituelle).toBe(5000)
    expect(h.coupure).toBe(3)
    expect(h.plancher).toBe(3750)
  })
  it('l’affûtage et la récupération prévus ne comptent ni dans le bloc ni comme coupure', () => {
    const s = [...sem(5000, 5000, 5000, 5000), { kj: 3000, legere: true }, { kj: 1000, legere: true }, ...sem(4800, 4800, 4800, 4800, 4800, 4800)]
    const h = chargeHabituelle(s)!
    expect(h.habituelle).toBe(5000)
    expect(h.coupure).toBe(0)
  })
  it('sans historique : rien', () => expect(chargeHabituelle(sem(0, 0, 0, 0, 0))).toBeUndefined())
})

describe('coupure', () => {
  it('part et reprise selon le nombre de semaines', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 10].map(facteurCoupure)).toEqual([0.9, 0.9, 0.75, 0.75, 0.6, 0.6, 0.45, 0.45])
    expect([0, 1, 2, 3, 4, 6, 7].map(repriseSelonCoupure)).toEqual([0, 0, 1, 1, 2, 2, 4])
  })
  it('la reprise part de tes durées habituelles', () => {
    expect(plafondsReprise(0, 90, 180)).toEqual({ z2: 50, long: 75 })
    expect(plafondsReprise(0, 90, 180, 0.75)).toEqual({ z2: 70, long: 135 })
    expect(plafondsReprise(2, 90, 180, 0.75)).toEqual({ z2: 80, long: 155 })
    expect(plafondsReprise(0, 60, 120, 0.45)).toEqual({ z2: 50, long: 75 })
  })
  it('saison : reprise de 1 semaine après 2-3 semaines de coupure, aucune si tu roulais', () => {
    const base = { debut: '2026-11-16', course: '2027-04-25' }
    const reprise = (e: object) => calculerSaison({ ...base, ...e }).phases.filter((p) => p.type === 'reprise').length
    const semainesReprise = (e: object) => {
      const ph = calculerSaison({ ...base, ...e }).phases
      const i = ph.findIndex((p) => p.type === 'reprise')
      return i < 0 ? 0 : Math.round((Date.parse(ph[i + 1].debut) - Date.parse(ph[i].debut)) / (7 * 86_400_000))
    }
    expect(reprise({ entraine: true, arretSemaines: 0 })).toBe(0)
    expect(semainesReprise({ entraine: false, arretSemaines: 3 })).toBe(1)
    expect(semainesReprise({ entraine: false, arretSemaines: 5 })).toBe(2)
    expect(semainesReprise({ entraine: false, arretSemaines: 8 })).toBe(4)
    expect(semainesReprise({ entraine: false, arretSemaines: 0 })).toBe(2)
  })
})

describe('projection avec charge habituelle', () => {
  const PHASES: Phase[] = [{ debut: '2026-11-16', type: 'base' }]
  const o = { lundi: '2026-11-16', jusquA: '2027-02-01', phases: PHASES, testsCp: [], competitions: [], histo: [], budgetDepart: 1500, plafond: 8000 }
  it('repart au plancher puis monte plus vite sous la charge habituelle', () => {
    const avant = projeterSaison(o)
    const apres = projeterSaison({ ...o, habituelle: 5000, plancher: 3750 })
    expect(apres[1].budget).toBeGreaterThanOrEqual(3750)
    expect(apres[1].budget).toBeGreaterThan(avant[1].budget)
    const normales = apres.filter((x) => x.type === 'normale')
    expect(Math.max(...normales.map((x) => x.budget))).toBeGreaterThan(5000)
  })
})
