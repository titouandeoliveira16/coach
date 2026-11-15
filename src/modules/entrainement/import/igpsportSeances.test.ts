import { describe, expect, it } from 'vitest'
import { construireIntervalles, construireZ2, formatDe } from '../../../metrics/programme'
import { dureeIgpsport, versIgpsport } from './igpsportSeances'

describe('séance Cycle → iGPSPORT (16/11/2026)', () => {
  it('une Z2 : échauffement, corps en watts, retour au calme ; durée totale juste', () => {
    const s = construireZ2(60, 180)
    const st = versIgpsport(s.velo.etapes!)
    expect(st[0].intensityClass).toBe('WarmUp')
    expect(st.at(-1)!.intensityClass).toBe('CoolDown')
    expect(st.some((p) => p.intensityTarget?.unit === 'PowerCustom')).toBe(true)
    expect(dureeIgpsport(st)).toBe(60 * 60)
  })
  it('des intervalles : une répétition, les mêmes durées que la séance', () => {
    const f = formatDe('seuil-4x8') ?? formatDe('4x8')
    const s = f ? construireIntervalles(f, 0, 250, 0) : construireZ2(90, 180, { n: 4, sec: 10 })
    const st = versIgpsport(s.velo.etapes!)
    const total = s.velo.etapes!.reduce((t, e) => t + (e.repetition ? e.repetition.fois * e.repetition.etapes.reduce((a, x) => a + x.dureeSec, 0) - e.repetition.etapes.slice(e.repetition.derniere ?? e.repetition.etapes.length).reduce((a, x) => a + x.dureeSec, 0) : e.dureeSec), 0)
    expect(dureeIgpsport(st)).toBe(total)
    expect(st.some((p) => p.type === 'Repetition')).toBe(true)
  })
})
