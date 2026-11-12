import { describe, expect, it } from 'vitest'
import { heuresAu } from './reglagesEntrainement'
import type { ReglagesProgramme } from './types'

describe('heuresAu', () => {
  const prog = { semainesTypesFutures: [
    { debut: '2027-01-04', semaineType: [], heuresSemaine: '6 à 8 h' },
    { debut: '2027-03-08', semaineType: [] },
    { debut: '2027-04-05', semaineType: [], heuresSemaine: '8 à 10 h' },
  ] } as unknown as ReglagesProgramme
  it('garde le temps du profil avant la première date', () => expect(heuresAu(prog, '4 à 6 h', '2026-12-28')).toBe('4 à 6 h'))
  it('prend le temps choisi à partir de sa date', () => expect(heuresAu(prog, '4 à 6 h', '2027-01-04')).toBe('6 à 8 h'))
  it('une semaine sans temps choisi garde le précédent', () => expect(heuresAu(prog, '4 à 6 h', '2027-03-15')).toBe('6 à 8 h'))
  it('le plus récent l’emporte', () => expect(heuresAu(prog, '4 à 6 h', '2027-05-03')).toBe('8 à 10 h'))
})
