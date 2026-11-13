import { describe, expect, it } from 'vitest'
import { calculerSaison, chargeHabituelle, datesCoursesA, dureesPhases, lireHistorique, migrerBase, phasesAvecCoursesA } from './saison'
import { estSemaineAllegee, coefficientPhase, phaseDe } from './programme'
import { decalerJour } from '../core/dates'

describe('saison calculée depuis la course', () => {
  it('durées selon les semaines disponibles', () => {
    const vide = { reprise: 0, base: 0, entretien: 0, 'seuil-tirage': 0, 'seuil-maintien': 0, 'fin-prepa': 0, specifique: 0, affutage: 0 }
    // Prépa hivernale Methodic (relecture du 10/11/2026) : VO2 3, spécifique 3, affûtage 2 ; 2e seuil tirée puis poussée ;
    // cycle 1er seuil autant que le 2e seuil (13/11/2026), 4-10 chacun, jusqu'à 12 au 1er seuil avant de l'entretien ; reprise 0 si tu roulais déjà, 2 sinon
    expect(dureesPhases(12, false, true)).toEqual({ ...vide, 'seuil-tirage': 2, 'seuil-maintien': 2, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(20, false, true)).toEqual({ ...vide, base: 6, 'seuil-tirage': 3, 'seuil-maintien': 3, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(24, false, true)).toEqual({ ...vide, base: 8, 'seuil-tirage': 4, 'seuil-maintien': 4, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(28, false, true)).toEqual({ ...vide, base: 10, 'seuil-tirage': 4, 'seuil-maintien': 6, 'fin-prepa': 3, specifique: 3, affutage: 2 })
    expect(dureesPhases(40, false, true)).toMatchObject({ reprise: 0, base: 12, entretien: 10 })
    expect(dureesPhases(30, false, true)).toMatchObject({ reprise: 0, base: 12, 'seuil-tirage': 4, 'seuil-maintien': 6, entretien: 0 })
    expect(dureesPhases(28)).toMatchObject({ reprise: 2, base: 9, 'seuil-tirage': 4, 'seuil-maintien': 5 })
    expect(dureesPhases(6)).toMatchObject({ reprise: 0, 'fin-prepa': 1, specifique: 3, affutage: 2 })
    expect(dureesPhases(20, true).reprise).toBe(4)
    expect(dureesPhases(2)).toMatchObject({ affutage: 2, specifique: 0 })
  })
  it('reprise : seulement après un vrai arrêt, moins les semaines déjà roulées (13/11/2026)', () => {
    // 2,5 semaines d'arrêt (→ 1 semaine de reprise), puis 3 semaines roulées : plus de reprise
    const s = calculerSaison({ debut: '2026-11-09', course: '2027-04-25', entraine: true, arretSemaines: 3, repriseFaite: 3 })
    expect(s.phases.map((p) => p.type).slice(0, 3)).toEqual(['base', 'seuil-tirage', 'seuil-maintien'])
    // Arrêt de 2 mois sans avoir repris : 4 semaines
    expect(calculerSaison({ debut: '2026-11-09', course: '2027-04-25', arretSemaines: 8 }).phases[1].debut).toBe('2026-12-07')
    // Charge habituelle : semaines d'arrêt (< 20 %) et semaines déjà roulées depuis (≥ 40 %)
    const h = chargeHabituelle([...Array(4).fill({ kj: 4000 }), ...Array(3).fill({ kj: 300 }), ...Array(3).fill({ kj: 1800 })])!
    expect(h).toMatchObject({ habituelle: 4000, arret: 3, repriseFaite: 3, coupure: 6 })
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
  it('semaine allégée : au plus 3 semaines chargées d’affilée, jamais en affûtage', () => {
    const s = calculerSaison({ debut: '2026-11-09', course: '2027-02-14' })
    expect(estSemaineAllegee('2026-11-30', s.phases)).toBe(true) // 4e semaine de la saison
    expect(estSemaineAllegee('2026-12-28', s.phases)).toBe(true) // 8e : au plus 3 semaines chargées d'affilée, quelle que soit la phase
    expect(estSemaineAllegee('2026-12-21', s.phases)).toBe(false)
    // Course B : sa semaine remet le compteur à zéro
    expect(estSemaineAllegee('2026-12-28', s.phases, (l) => l === '2026-12-14')).toBe(false)
    const spe = s.phases.find((p) => p.type === 'specifique')!.debut
    expect(estSemaineAllegee(spe, s.phases)).toBe(false)
    expect(coefficientPhase('2027-02-01', s.phases, [{ date: '2027-02-14' }])).toBe(0.65)
    expect(coefficientPhase('2027-02-08', s.phases, [{ date: '2027-02-14' }])).toBe(0.45)
    expect(coefficientPhase('2027-02-15', s.phases, [{ date: '2027-02-14' }])).toBe(0.6)
  })
})

describe('séances des phases calculées (forme Chauvin)', () => {
  it('2e seuil tirée puis poussée avec rappel 30/15, cycle VO2max', async () => {
    const { choisirFormat } = await import('./programme')
    const ph = [{ debut: '2026-11-02', type: 'seuil-tirage' as const }, { debut: '2026-11-30', type: 'seuil-maintien' as const }, { debut: '2027-01-25', type: 'fin-prepa' as const }]
    expect(choisirFormat('2026-11-09', ph, []).format.id).toBe('tirage-seuil')
    expect(choisirFormat('2026-11-09', ph, [], 'xco').format.id).toBe('inoue')
    expect(choisirFormat('2026-11-30', ph, []).format.id).toBe('seuil-maintien')
    expect(choisirFormat('2026-12-14', ph, []).format.id).toBe('30-15') // 3e semaine : rappel
    // Cycle VO2max : 40/20, puis 3′, puis 4 × 4′ ; la 2e séance entretient le seuil
    expect(choisirFormat('2027-01-25', ph, []).format.id).toBe('40-20')
    expect(choisirFormat('2027-02-01', ph, []).format.id).toBe('3min')
    expect(choisirFormat('2027-02-08', ph, []).format.id).toBe('4min')
    expect(choisirFormat('2027-01-25', ph, [], 'route', 1).format.id).toBe('seuil-maintien')
    expect(choisirFormat('2027-01-25', ph, [], 'xco').format.id).toBe('sit-series')
  })
})

describe('sortie longue au 1er seuil, sprints de la semaine', () => {
  it('blocs au 1er seuil : au plus 60 % de la sortie, en haut de la Z2, le plus haut palier qui rentre', async () => {
    const { construireZ2, signalSv1, sprintsDeLaPhase, BLOCS_SV1 } = await import('./programme')
    const s = construireZ2(120, 150, undefined, { longue: true, sv1: { w: 180, reps: 6, min: 20 } })
    expect(s.velo.famille).toBe('z2-long')
    expect(s.velo.blocsSv1! * 20).toBeLessThanOrEqual(72)
    // Palier 6 (2 × 40) demandé : 2 × 30 dans 2 h, 2 × 25 dans 1 h 30
    const haut = { w: 180, ...BLOCS_SV1[6], repli: BLOCS_SV1.slice(0, 6).reverse() }
    expect(construireZ2(120, 150, undefined, { longue: true, sv1: haut }).titre).toMatch(/2 × 30'/)
    expect(construireZ2(90, 150, undefined, { longue: true, sv1: haut }).titre).toMatch(/2 × 25'/)
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
    const f = (...fc: number[]) => fc.map((x) => ({ fc: x }))
    expect(signalSv1(f(140, 142, 143), 4)).toBe(1)
    expect(signalSv1(f(140, 150), 4)).toBe(-1)
    // Découplage : watts en baisse à FC égale (la séance « pourrie » : 295, 290, 285 W, FC en hausse)
    expect(signalSv1([{ fc: 150, w: 295 }, { fc: 152, w: 290 }, { fc: 155, w: 280 }], 5)).toBe(-1)
    expect(signalSv1([{ fc: 150, w: 200 }, { fc: 152, w: 200 }], 6)).toBe(1)
    expect(signalSv1(f(140, 141), 7)).toBe(-1)
    const { plageFcSv1, signalFcSv1 } = await import('./programme')
    // FC max 190 : 78 % = 148, puis 82 % = 156 ; plafonnée à la FC du 1er seuil + 3
    expect(plageFcSv1({ fcMax: 190, nFaites: 0 })).toEqual([144, 148])
    expect(plageFcSv1({ fcMax: 190, nFaites: 9 })).toEqual([152, 156])
    expect(plageFcSv1({ fcMax: 190, nFaites: 9, fcSeuil1: 150 })).toEqual([149, 153])
    expect(plageFcSv1({ fcMax: 190, nFaites: 9, debutant: true })[1]).toBe(148)
    expect(signalFcSv1([150, 158], [152, 156])).toBe(0)
    expect(signalFcSv1([158, 160], [152, 156])).toBe(-1)
    expect(signalFcSv1([145, 147], [152, 156])).toBe(1)
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

describe('sortie longue qui s’allonge vers la course', () => {
  it('cible selon la course, +10 min par semaine, jamais sous le minimum ni au-dessus de la cible', async () => {
    const { cibleSortieLongue, dureeLongueVisee } = await import('./programme')
    expect(cibleSortieLongue('route', 'en-ligne', 150)).toBe(150)
    expect(cibleSortieLongue('route', 'en-ligne', 300)).toBe(240)
    expect(cibleSortieLongue('route', 'cyclo', 360)).toBe(270)
    expect(cibleSortieLongue('route', 'cyclo')).toBe(225) // 5 h par défaut
    expect(cibleSortieLongue('xcm', undefined, 200)).toBe(180)
    expect(cibleSortieLongue('xco')).toBe(150)
    expect(cibleSortieLongue('enduro')).toBeUndefined()
    expect(dureeLongueVisee(180, 90)).toBe(90)
    expect(dureeLongueVisee(180, 90, 110)).toBe(120)
    expect(dureeLongueVisee(180, 90, 175)).toBe(180)
    expect(dureeLongueVisee(120, 150, 100)).toBe(150)
  })
})

describe('migration vers la base', () => {
  it('une reprise de 8 semaines devient 2 semaines de reprise puis une base', () => {
    const avant = [{ debut: '2026-11-09', type: 'reprise' as const }, { debut: '2027-01-04', type: 'entretien' as const }]
    expect(migrerBase(avant).map((p) => [p.debut, p.type])).toEqual([['2026-11-09', 'reprise'], ['2026-11-23', 'base'], ['2027-01-04', 'entretien']])
    const courte = [{ debut: '2026-11-09', type: 'reprise' as const }, { debut: '2026-11-23', type: 'seuil-tirage' as const }]
    expect(migrerBase(courte)).toBe(courte)
  })
})

describe('plusieurs courses A', () => {
  const s = calculerSaison({ debut: '2026-11-09', course: '2027-04-04' })
  const types = (p: { debut: string; type: string }[], apres: string) => p.filter((x) => x.debut > apres).map((x) => `${x.debut} ${x.type}`)
  it('4 semaines d’écart : récupération, spécifique court, affûtage d’1 semaine', () => {
    const p = phasesAvecCoursesA(s.phases, ['2027-04-04', '2027-05-02'])
    expect(p.find((x) => x.debut === '2027-04-05')?.type).toBe('recuperation')
    expect(p.filter((x) => x.type === 'affutage').map((x) => x.debut)).toContain('2027-04-26')
    expect(p.at(-1)).toEqual({ debut: '2027-05-10', type: 'entretien' })
  })
  it('9 semaines d’écart : bloc pour progresser, spécifique 2, affûtage 2', () => {
    const p = phasesAvecCoursesA(s.phases, ['2027-04-04', '2027-06-06'])
    expect(types(p, '2027-04-04').map((x) => x.split(' ')[1])).toEqual(['recuperation', 'seuil-tirage', 'specifique', 'affutage', 'recuperation', 'entretien'])
  })
  it('6 semaines d’écart : récup 1, spécifique 3, affûtage 2', () => {
    const p = phasesAvecCoursesA(s.phases, ['2027-04-25', '2027-06-05'])
    expect(types(p, '2027-04-25')).toEqual(['2027-04-26 recuperation', '2027-05-03 specifique', '2027-05-24 affutage', '2027-06-07 recuperation', '2027-06-14 entretien'])
  })
  it('une seule A : la saison ne change pas avant elle', () => {
    expect(phasesAvecCoursesA(s.phases, ['2027-04-04'])).toEqual(s.phases)
  })
  it('A retenues : 3 semaines d’écart au moins, 4 au plus', () => {
    expect(datesCoursesA([{ date: '2027-04-04', niveau: 'A' }, { date: '2027-04-18', niveau: 'A' }, { date: '2027-05-02', niveau: 'A' }, { date: '2027-03-01', niveau: 'B' }]))
      .toEqual(['2027-04-04', '2027-05-02'])
  })
})

describe('tes 4 semaines d’avant', () => {
  it('3 semaines sur 4 avec 2 sorties et 60 % du budget : entraîné, budget de départ = médiane', () => {
    expect(lireHistorique([{ sorties: 4, kj: 2000 }, { sorties: 3, kj: 1800 }, { sorties: 4, kj: 2200 }, { sorties: 1, kj: 400 }], 2000))
      .toEqual({ entraine: true, budgetDepart: Math.round((1900 * 0.9) / 10) * 10 })
    expect(lireHistorique([{ sorties: 1, kj: 600 }, { sorties: 2, kj: 800 }, { sorties: 0, kj: 0 }, { sorties: 3, kj: 1500 }], 2000).entraine).toBe(false)
  })
})

describe('robustesse (audit du 11/11/2026)', () => {
  it('aucune phase : entretien, sans erreur', () => {
    expect(phaseDe('2026-11-09', []).phase.type).toBe('entretien')
    expect(coefficientPhase('2026-11-09', [], [])).toBeUndefined()
  })
  it('1re phase qui ne commence pas un lundi : les semaines allégées tombent quand même', () => {
    const phases = [{ debut: '2026-10-28', type: 'base' as const }]
    const allegees = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => estSemaineAllegee(decalerJour('2026-10-26', 7 * i), phases))
    expect(allegees.filter(Boolean).length).toBe(2)
  })
})
