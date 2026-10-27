import { describe, expect, it } from 'vitest'
import { retourDeCoupure, semainesChamboulees } from '../../../metrics/programme'
import type { SeancePrevue } from '../types'
import { choisirSemaineMinimale } from './semaineChargee'

const p = (id: string, date: string, c: Partial<SeancePrevue>): SeancePrevue => ({
  id, date, sport: 'velo', titre: id, intensite: 'basse', dureeMin: 60, priorite: 'normale', statut: 'prevue', origine: 'auto', ...c,
})

describe('semaine chargée', () => {
  const semaine = [
    p('v-seuil', '2026-11-03', { intensite: 'haute' }),
    p('v-z2', '2026-11-04', { dureeMin: 75 }),
    p('v-long', '2026-11-07', { dureeMin: 110, longue: true }),
    p('c-vma', '2026-11-02', { sport: 'course', intensite: 'haute' }),
    p('c-foot1', '2026-11-05', { sport: 'course', dureeMin: 45 }),
    p('c-foot2', '2026-11-08', { sport: 'course', dureeMin: 40 }),
    p('renfo', '2026-11-06', { sport: 'renfo', dureeMin: 30 }),
  ]

  it('garde la séance clé et une facile raccourcie par sport, enlève le reste, ne touche pas au renfo', () => {
    const c = choisirSemaineMinimale(semaine, [])
    expect(c.enlever.sort()).toEqual(['c-foot2', 'v-z2'])
    expect(c.raccourcir).toEqual(expect.arrayContaining([{ id: 'v-long', dureeMin: 60 }, { id: 'c-foot1', dureeMin: 30 }]))
  })

  it('ce qui est déjà fait cette semaine compte', () => {
    const c = choisirSemaineMinimale(semaine, [{ sport: 'velo', dure: true }, { sport: 'course', dure: false }])
    expect(c.enlever.sort()).toEqual(['c-foot1', 'c-foot2', 'v-seuil', 'v-z2'])
  })

  it('retour après des semaines très légères', () => {
    expect(semainesChamboulees([0.3, 0.2, 0.95, 0.1])).toBe(2)
    expect(semainesChamboulees([undefined, 0.2])).toBe(0)
    expect(retourDeCoupure(1, 0).facteur).toBe(1)
    expect(retourDeCoupure(2, 1).facteur).toBe(0.9)
    expect(retourDeCoupure(3, 2)).toMatchObject({ facteur: 1, semaineReprise: 0 })
    expect(retourDeCoupure(0, 4)).toMatchObject({ semaineReprise: 1 })
    expect(retourDeCoupure(0, 2).raison).toBeUndefined()
  })
})
