import { describe, expect, it } from 'vitest'
import { construireIntervalles, construireTest, construireZ2, formatDe } from '../../../metrics/programme'
import { dureeIntervals, texteIntervals } from './envoi'

describe('envoi vers Intervals.icu', () => {
  it('durées au format Intervals', () => {
    expect(dureeIntervals(30)).toBe('30s')
    expect(dureeIntervals(600)).toBe('10m')
    expect(dureeIntervals(90)).toBe('1m30s')
    expect(dureeIntervals(6000)).toBe('1h40m')
  })
  it('une ligne par étape, watts absolus, « freeride » pour les efforts à fond, pas de chiffres dans les libellés', () => {
    const z2 = texteIntervals(construireZ2(60, 180).velo.etapes!)
    expect(z2.split('\n')).toEqual([
      '- Mise en route progressive 10m 155w',
      '- Endurance régulière 45m 180w',
      '- Retour au calme 5m 155w',
    ])
    const test = texteIntervals(construireTest(260).velo.etapes!)
    expect(test).toMatch(/12m freeride/)
    expect(test).not.toMatch(/\d+'/)
  })
  it('repère de cadence envoyé sur les efforts, pas sur la Z2', () => {
    const ss = texteIntervals(construireIntervalles(formatDe('sweet-spot')!, 0, 260, 0).velo.etapes!)
    expect(ss).toMatch(/15m 235w 85-95rpm/)
    expect(texteIntervals(construireZ2(60, 180).velo.etapes!)).not.toMatch(/rpm/)
  })
})
