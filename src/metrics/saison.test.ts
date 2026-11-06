import { describe, expect, it } from 'vitest'
import { calculerSaison, dureesPhases } from './saison'
import { estSemaineAllegee, coefficientPhase } from './programme'

describe('saison calculée depuis la course', () => {
  it('durées selon les semaines disponibles', () => {
    const vide = { reprise: 0, entretien: 0, 'seuil-tirage': 0, 'seuil-maintien': 0, 'fin-prepa': 0, specifique: 0, affutage: 0 }
    expect(dureesPhases(12)).toEqual({ ...vide, reprise: 2, 'seuil-tirage': 1, 'seuil-maintien': 1, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(20)).toEqual({ ...vide, reprise: 2, 'seuil-tirage': 4, 'seuil-maintien': 6, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(29)).toEqual({ ...vide, reprise: 8, 'seuil-tirage': 4, 'seuil-maintien': 8, entretien: 1, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(6)).toMatchObject({ reprise: 0, 'fin-prepa': 1, specifique: 3, affutage: 2 })
    expect(dureesPhases(20, true).reprise).toBe(4)
    expect(dureesPhases(2)).toMatchObject({ affutage: 2, specifique: 0 })
  })
  it('phases dans l’ordre, affûtage jusqu’à la course, récupération après', () => {
    // Inscription lundi 9/11/2026, course dimanche 14/02/2027 (lundi 8/02) : 14 semaines
    const s = calculerSaison({ debut: '2026-11-11', course: '2027-02-14' })
    expect(s.semaines).toBe(14)
    expect(s.phases.map((p) => p.type)).toEqual(['reprise', 'seuil-tirage', 'seuil-maintien', 'fin-prepa', 'specifique', 'affutage', 'recuperation', 'entretien'])
    expect(s.phases[0].debut).toBe('2026-11-09')
    expect(s.phases.find((p) => p.type === 'affutage')!.debut).toBe('2027-02-01')
    expect(s.phases.find((p) => p.type === 'recuperation')!.debut).toBe('2027-02-15')
  })
  it('tests CP : 1re semaine, puis au moins 5 semaines d’écart, jamais en affûtage', () => {
    const s = calculerSaison({ debut: '2026-11-09', course: '2027-06-13', jourLong: 6, jourDur: 1 })
    expect(s.testsCp[0]).toBe('2026-11-15')
    const aff = s.phases.find((p) => p.type === 'affutage')!.debut
    expect(s.testsCp.every((t) => t < aff)).toBe(true)
    for (let i = 1; i < s.testsCp.length; i++) expect(Date.parse(s.testsCp[i]) - Date.parse(s.testsCp[i - 1])).toBeGreaterThanOrEqual(5 * 7 * 86_400_000 - 6 * 86_400_000)
  })
  it('semaine allégée comptée sur la saison, jamais près de la course', () => {
    const s = calculerSaison({ debut: '2026-11-09', course: '2027-02-14' })
    expect(estSemaineAllegee('2026-11-30', s.phases)).toBe(true) // 4e semaine de la saison
    expect(estSemaineAllegee('2026-12-28', s.phases)).toBe(false) // 8e, mais en fin de prépa : pas d'allègement
    const spe = s.phases.find((p) => p.type === 'specifique')!.debut
    expect(estSemaineAllegee(spe, s.phases)).toBe(false)
    expect(coefficientPhase('2027-02-01', s.phases, [{ date: '2027-02-14' }])).toBe(0.65)
    expect(coefficientPhase('2027-02-08', s.phases, [{ date: '2027-02-14' }])).toBe(0.45)
    expect(coefficientPhase('2027-02-15', s.phases, [{ date: '2027-02-14' }])).toBe(0.6)
  })
})

describe('séances des phases calculées (forme Chauvin)', () => {
  it('tirer le seuil, allonger le seuil avec rappel 30/15, fin de prépa', async () => {
    const { choisirFormat } = await import('./programme')
    const ph = [{ debut: '2026-11-02', type: 'seuil-tirage' as const }, { debut: '2026-11-30', type: 'seuil-maintien' as const }, { debut: '2027-01-25', type: 'fin-prepa' as const }]
    expect(choisirFormat('2026-11-09', ph, []).format.id).toBe('tirage-seuil')
    expect(choisirFormat('2026-11-09', ph, [], 'xco').format.id).toBe('inoue')
    expect(choisirFormat('2026-11-30', ph, []).format.id).toBe('seuil-maintien')
    expect(choisirFormat('2026-12-14', ph, []).format.id).toBe('30-15') // 3e semaine : rappel
    expect(choisirFormat('2027-01-25', ph, [], 'route', 1).format.id).toBe('sweet-spot-long')
    expect(choisirFormat('2027-01-25', ph, []).famille).toMatch(/^vo2/)
    expect(choisirFormat('2027-01-25', ph, [], 'xco').format.id).toBe('sit-series')
  })
})

describe('sortie longue au 1er seuil, sprints de la semaine', () => {
  it('blocs au 1er seuil : au plus la moitié de la sortie, en haut de la Z2', async () => {
    const { construireZ2, signalSv1, sprintsDeLaPhase } = await import('./programme')
    const s = construireZ2(120, 150, undefined, { longue: true, sv1: { w: 180, reps: 6, min: 20 } })
    expect(s.velo.famille).toBe('z2-long')
    expect(s.velo.blocsSv1! * 20).toBeLessThanOrEqual(60)
    const bloc = s.velo.etapes!.find((e) => e.repetition)!.repetition!.etapes[0]
    expect(bloc.wMax).toBeLessThanOrEqual(185)
    expect(s.dureeMin).toBe(120)
    // Sprints dans une Z2 de semaine (pas la sortie longue)
    const z = construireZ2(60, 150, { n: 6, sec: 10 }, { longue: false })
    expect(z.velo.famille).toBe('z2')
    expect(z.titre).toMatch(/sprints/)
    // Z2 longue de semaine : découpée
    expect(construireZ2(90, 150).velo.etapes!.some((e) => e.repetition)).toBe(true)
    expect(construireZ2(60, 150).velo.etapes!.some((e) => e.repetition)).toBe(false)
    // Dérive
    expect(signalSv1([140, 142, 143], 4)).toBe(1)
    expect(signalSv1([140, 150], 4)).toBe(-1)
    expect(sprintsDeLaPhase('fin-prepa', 'xco', 0).sec).toBe(30)
    expect(sprintsDeLaPhase('seuil-tirage', 'route', 0).sec).toBeLessThanOrEqual(15)
  })
})

describe('séances de course', () => {
  it('simulations et montées en fin de sortie : durées et structure', async () => {
    const { construireSimulationLigne, construireCycloMontees, construireSimulationXco, choisirFormat, deplier } = await import('./programme')
    const a = construireSimulationLigne(280, 170)
    expect(a.velo.famille).toBe('simulation-ligne')
    expect(a.dureeMin).toBeGreaterThan(120)
    expect(deplier(a.velo.etapes!).filter((e) => e.libelle === 'Attaque à fond')).toHaveLength(12)
    const b = construireCycloMontees(240, 170, 280, 3, 20)
    expect(b.dureeMin).toBe(240)
    expect(deplier(b.velo.etapes!).filter((e) => e.libelle === 'Montée')).toHaveLength(3)
    const c = construireSimulationXco(280, 170)
    expect(deplier(c.velo.etapes!).filter((e) => e.libelle === 'Relance')).toHaveLength(64)
    // Pré-effort suivi d'au moins 10 min faciles (Bailey 2009)
    expect(c.velo.etapes![2].dureeSec).toBeGreaterThanOrEqual(600)
    const ph = [{ debut: '2027-04-12', type: 'specifique' as const }]
    expect(choisirFormat('2027-04-12', ph, [], 'route', 0, 'en-ligne').famille).toBe('vo2-courts')
    expect(choisirFormat('2027-04-12', ph, [], 'route', 1, 'en-ligne').famille).toBe('seuil-variable')
    expect(choisirFormat('2027-04-12', ph, [], 'route', 0, 'cyclo').format.id).toBe('seuil-12-20')
  })
})

describe('équivalent vélo d’une séance de course', () => {
  it('seuil 30 → 103 % de la CP, même structure ; VMA → 117 % ; footing → Z2 1,4 fois plus longue', async () => {
    const { construireEquivalentCourse, deplier } = await import('./programme')
    const v = construireEquivalentCourse({ intensite: 'haute', typeCourse: 'Seuil 30', minutesCle: 8, dureeMin: 46, titre: "8 × 1' seuil 30" }, 260, 160)
    expect(deplier(v.velo.etapes!).filter((e) => e.libelle === 'Effort').map((e) => e.w)).toEqual(Array(8).fill(270))
    // 3 × 8' au seuil 30 : pas 24 × 1'
    const b = construireEquivalentCourse({ intensite: 'haute', typeCourse: 'Seuil 30', minutesCle: 24, dureeMin: 60, titre: "3 × 8' seuil 30" }, 260, 160)
    expect(deplier(b.velo.etapes!).filter((e) => e.libelle === 'Effort')).toHaveLength(3)
    const vma = construireEquivalentCourse({ intensite: 'haute', typeCourse: 'Fractionné / VMA', minutesCle: 30, dureeMin: 50 }, 260, 160)
    expect(deplier(vma.velo.etapes!).filter((e) => e.libelle === 'Effort')).toHaveLength(16)
    expect(vma.velo.etapes![1].w).toBe(305)
    expect(construireEquivalentCourse({ intensite: 'basse', dureeMin: 45 }, 260, 160).dureeMin).toBe(65)
  })
})

describe('sommeil', () => {
  it('moyenne 7 j sous 7 h : dette ; 45 min sous la normale : dette ; nuit 1 h 30 sous la normale : courte', async () => {
    const { etatSommeil } = await import('./signal')
    expect(etatSommeil({ nuit: 6.6, moyenne7: 6.65, moyenne30: 6.7 }).dette).toBe(true)
    expect(etatSommeil({ moyenne7: 7.1, moyenne30: 8 }).dette).toBe(true)
    expect(etatSommeil({ moyenne7: 7.4, moyenne30: 7.5 }).dette).toBe(false)
    expect(etatSommeil({ nuit: 6.2, moyenne30: 7.8 }).nuitCourte).toBe(true)
    expect(etatSommeil({ nuit: 6 }).nuitCourte).toBe(true)
  })
})
