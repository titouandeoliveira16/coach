import { describe, expect, it } from 'vitest'
import {
  NOTIONS_DEPART, PARAMETRES_DEFAUT as p, capacite, creneauxDu, estJourNotion, periodeDu, placerRappels, projection, serieDeRappels,
} from './programme'
import type { Notion, Rappel } from './types'

it('41 notions : 18 pour l’écrit 1, 23 pour l’écrit 2', () => {
  expect(NOTIONS_DEPART).toHaveLength(41)
  expect(NOTIONS_DEPART.filter(([, e]) => e === 'E1')).toHaveLength(18)
})

describe('périodes et capacités', () => {
  it('reconnaît les périodes', () => {
    expect(periodeDu('2026-10-28', p)).toBe('vacances')
    expect(periodeDu('2026-11-02', p)).toBe('cours')
    expect(periodeDu('2026-12-23', p)).toBe('sujets-vacances')
    expect(periodeDu('2027-01-11', p)).toBe('sujets')
    expect(periodeDu('2026-12-25', p)).toBe('repos')
    expect(periodeDu('2027-02-24', p)).toBe('derniere')
    expect(periodeDu('2027-03-01', p)).toBe('veille')
    expect(periodeDu('2027-03-03', p)).toBe('concours')
  })
  it('capacités du prompt', () => {
    expect(capacite('2026-10-28', p)).toBe(45) // mercredi des vacances (mémoire)
    expect(capacite('2026-11-04', p)).toBe(150) // mercredi en cours
    expect(capacite('2026-11-06', p)).toBe(40) // vendredi en cours
    expect(capacite('2027-02-25', p)).toBe(240) // jeudi de la dernière semaine
    expect(capacite('2027-03-01', p)).toBe(60)
    expect(capacite('2027-03-02', p)).toBe(0)
    expect(capacite('2026-11-02', { ...p, lundisSansStage: ['2026-11-02'] })).toBe(150)
  })
  it('jours de notion : lun, mar, jeu, sam en cours ; lun → sam en vacances', () => {
    expect(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((j) => estJourNotion(j, p)))
      .toEqual([true, true, false, true, false, true, false])
    expect(estJourNotion('2026-10-30', p)).toBe(true)
  })
  it('journées types : mercredi des vacances = mémoire ; mercredi en cours = rappels puis stage', () => {
    expect(creneauxDu('2026-10-28', p, true).map((x) => x.type)).toEqual(['notion', 'rappels', 'memoire', 'fixation'])
    expect(creneauxDu('2026-11-04', p, true).map((x) => x.type)).toEqual(['rappels', 'stage', 'internat'])
    expect(creneauxDu('2027-01-11', p, false).map((x) => x.type)).toEqual(['sujet', 'correction', 'stage', 'rappels'])
  })
})

describe('rappels', () => {
  it('série J+1 … J+90, sans ce qui dépasse le 1er mars', () => {
    expect(serieDeRappels('n', '2026-10-27', p, String).map((r) => r.prevu)).toEqual(['2026-10-28', '2026-10-31', '2026-11-06', '2026-11-17', '2026-12-11', '2027-01-25'])
    expect(serieDeRappels('n', '2027-01-20', p, String).map((r) => r.intervalle)).toEqual([1, 4, 10, 21])
  })
  it('placement : J+1 d’abord, le reste glisse au lendemain', () => {
    const r = (id: string, intervalle: number, prevu: string): Rappel => ({ id, notionId: id, intervalle, prevu })
    // Mercredi des vacances : 45 min
    const plan = placerRappels([r('a', 4, '2026-10-28'), r('b', 1, '2026-10-28'), r('c', 10, '2026-10-27')], '2026-10-28', p, 2)
    expect(plan.get('2026-10-28')!.map((x) => x.id)).toEqual(['b'])
    expect(plan.get('2026-10-29')!.map((x) => x.id)).toEqual(['a', 'c'])
  })
})

it('projection : la notion en cours d’abord, puis les suivantes aux jours de notion', () => {
  const notions: Notion[] = NOTIONS_DEPART.slice(0, 3).map(([nom, epreuve, theme], i) => ({ id: String(i), nom, epreuve, theme, ordre: i, statut: i === 0 ? 'en-cours' : 'a-faire' }))
  const { parJour, fin } = projection(notions, '2026-10-31', p, false) // samedi des vacances
  expect([...parJour.keys()]).toEqual(['2026-10-31', '2026-11-02', '2026-11-03'])
  expect(fin).toBe('2026-11-03')
})
