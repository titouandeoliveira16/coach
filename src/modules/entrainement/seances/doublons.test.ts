import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Seance } from '../types'
import { fusionner, richesse, sontDoublons } from './donnees'

const base: Seance = { id: 'a', date: '2026-10-20', sport: 'velo', dureeSec: 7200, debut: '2026-10-20T08:00:00Z', source: 'intervals', idExterne: 'i1' }

describe('doublons', () => {
  it('montre et compteur lancés à 6 min d’écart = même sortie', () => {
    expect(sontDoublons(base, { ...base, id: 'b', idExterne: 'i2', debut: '2026-10-20T08:06:00Z', dureeSec: 6900 })).toBe(true)
  })
  it('deux séances le même jour sans chevauchement ≠ doublon', () => {
    expect(sontDoublons(base, { ...base, id: 'b', idExterne: 'i2', debut: '2026-10-20T17:00:00Z', dureeSec: 3600 })).toBe(false)
  })
  it('sports différents ≠ doublon', () => {
    expect(sontDoublons(base, { ...base, id: 'b', idExterne: 'i2', sport: 'course' })).toBe(false)
  })
  it('un id déjà fusionné est reconnu', () => {
    expect(sontDoublons({ ...base, autresIds: ['i9'] }, { ...base, id: 'b', idExterne: 'i9', debut: undefined })).toBe(true)
  })
  it('fusion : données de la plus riche, ressenti conservé, ids gardés', () => {
    const riche: Seance = { ...base, id: 'b', idExterne: 'i2', kj: 900, tempsZones: [1, 2, 3, 4, 5] }
    const pauvre: Seance = { ...base, rpe: 3, sensations: 4 }
    expect(richesse(riche)).toBeGreaterThan(richesse(pauvre))
    const f = fusionner(riche, pauvre)
    expect(f).toMatchObject({ id: 'b', kj: 900, rpe: 3, sensations: 4, autresIds: ['i1'] })
  })
})
