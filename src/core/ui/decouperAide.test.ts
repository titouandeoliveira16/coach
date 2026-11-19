import { describe, expect, it } from 'vitest'
import { AIDES } from '../../modules/entrainement/aides'
import { decouperAide } from './decouperAide'

describe('aides courtes', () => {
  it('une aide courte reste entière', () => {
    expect(decouperAide('Une phrase. Une autre.')).toEqual({ court: 'Une phrase. Une autre.' })
  })
  it('une aide longue : 2 phrases d’abord, la suite derrière « Pour aller plus loin »', () => {
    const t = `${'Mot '.repeat(30)}fin. ${'Mot '.repeat(30)}fin. ${'Détail '.repeat(30)}fin.`
    const d = decouperAide(t)
    expect(d.court.endsWith('fin.')).toBe(true)
    expect(d.suite).toMatch(/^Détail/)
  })
  it('aucune aide de l’appli ne montre plus de 100 mots d’abord', () => {
    for (const v of Object.values(AIDES)) expect(decouperAide(v).court.split(/\s+/).length).toBeLessThanOrEqual(100)
  })
})
