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
  it('séries répétées en blocs « Nx » (dernière répétition sans récup) et sprints de la sortie longue envoyés un par un', () => {
    const v = texteIntervals(construireIntervalles(formatDe('30-15')!, 0, 235, 0).velo.etapes!)
    expect(v).toContain('9x\n- Effort 30s 280w 90-105rpm\n- Récup 15s 120w\n\n- Effort 30s 280w 90-105rpm')
    const z = construireZ2(62.9999999, 160, { n: 6, sec: 10 })
    expect(z.dureeMin).toBe(63)
    const t = texteIntervals(z.velo.etapes!)
    expect(t).toContain('3x\n- Sprint à fond 10s freeride 100-120rpm\n- Très facile 2m 135w\n- Endurance 7m50s 160w')
    expect(t.match(/freeride/g)).toHaveLength(2) // 3 dans le bloc « 3x », puis le dernier
    expect(t).not.toMatch(/\d+\.\d/)
  })
})
