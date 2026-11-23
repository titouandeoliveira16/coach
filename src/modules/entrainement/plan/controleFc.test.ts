import { describe, expect, it } from 'vitest'
import type { Seance } from '../types'
import { controleFc, deriveSeance } from './controleFc'

const s = (extra: Partial<Seance>): Seance => ({ id: 'x', date: '2026-10-27', sport: 'velo', dureeSec: 3600, source: 'intervals', fcMoy: 140, ...extra })

it('facile : dérive < 5 % stable, 5-10 % attention, > 10 % trop dur ; sans FC → ressenti', () => {
  expect(controleFc(s({ decouplage: 3 }), 'facile', 204)?.couleur).toBe('vert')
  expect(controleFc(s({ decouplage: 7 }), 'facile', 204)?.couleur).toBe('orange')
  expect(controleFc(s({ decouplage: 12 }), 'facile', 204)?.couleur).toBe('rouge')
  expect(controleFc(s({ fcMoy: undefined }), 'facile', 204)?.couleur).toBe('gris')
})

it('seuil : plateau ≤ 5 % ; au-dessus de la CP seulement si > 8 % ET fin de bloc ≥ 95 % FC max', () => {
  const b = (deriveFc: number[], fcFin: number[]) => s({ blocs: { cibleW: 225, dureeSec: 600, w: [225, 225], deriveFc, fcFin } })
  expect(controleFc(b([2, 4], [170, 172]), 'plateau', 204)?.couleur).toBe('vert')
  expect(controleFc(b([3, 10], [175, 185]), 'plateau', 204)?.couleur).toBe('orange')
  expect(controleFc(b([3, 10], [180, 196]), 'plateau', 204)?.couleur).toBe('rouge')
})

it('VO2 longs : minutes à 90 % de la FC max', () => {
  expect(controleFc(s({ tempsFc90: 600 }), 'vo2', 204)?.couleur).toBe('vert')
  expect(controleFc(s({ tempsFc90: 300 }), 'vo2', 204)?.couleur).toBe('orange')
  expect(controleFc(s({ tempsFc90: 120 }), 'vo2', 204)?.couleur).toBe('rouge')
  expect(controleFc(s({}), 'sans', 204)).toBeUndefined()
})

describe('dérive retenue (23/11/2026)', () => {
  it('avec des blocs au 1er seuil : premier bloc contre dernier, pas la Z2 d’après', () => {
    const lignes = [
      { libelle: 'Z2', w: 144, fc: 127 }, { libelle: '1er seuil 1', w: 169, fc: 139 },
      { libelle: '1er seuil 2', w: 167, fc: 142 }, { libelle: 'Z2', w: 136, fc: 135 },
    ]
    const d = deriveSeance({ controle: { lignes } as never, decouplage: 6.1 })
    expect(d?.entreBlocs).toBe(true)
    expect(d!.valeur).toBeLessThan(5)
    expect(d!.valeur).toBeGreaterThan(2.5)
  })
  it('endurance seule : le découplage de la partie Z2', () => {
    expect(deriveSeance({ decouplage: 3.2 })).toEqual({ valeur: 3.2, entreBlocs: false })
  })
})
