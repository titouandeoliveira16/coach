import { expect, it } from 'vitest'
import { estMineur, objectifPermis } from './profil'

it('moins de 18 ans : pas de perte de gras, le maintien à la place (audit du 14/11/2026)', () => {
  expect(objectifPermis({ naissance: '2010-06-01', objectif: 'perte' }, '2026-11-14')).toBe('maintien')
  expect(objectifPermis({ naissance: '2008-11-14', objectif: 'perte' }, '2026-11-14')).toBe('perte')
  expect(estMineur({ naissance: '2008-11-15' }, '2026-11-14')).toBe(true)
  expect(objectifPermis({ objectif: 'perte' }, '2026-11-14')).toBe('perte')
})
