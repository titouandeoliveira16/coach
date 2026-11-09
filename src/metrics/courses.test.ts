import { describe, expect, it } from 'vitest'
import { delaiApresCourse, dureeDeCourse, estimerDureeCourse, niveauxCourses, procheCourse, construireOuverture, construireCourse } from './programme'

const phases = [{ debut: '2026-11-09', type: 'reprise' as const }, { debut: '2026-12-07', type: 'seuil-tirage' as const }]

describe('courses A / B / C', () => {
  it('sans niveau : la plus lointaine est la A, les autres des B', () => {
    const n = niveauxCourses([{ date: '2027-05-16', nom: 'A' }, { date: '2027-03-28', nom: 'x' }], phases)
    expect(n.get('2027-05-16')).toBe('A')
    expect(n.get('2027-03-28')).toBe('B')
  })
  it('une B devient C : en reprise, à moins de 10 jours de la A, ou à moins de 3 semaines d’une autre B', () => {
    const n = niveauxCourses([
      { date: '2027-05-16', nom: 'A', niveau: 'A' }, { date: '2026-11-22', nom: 'reprise', niveau: 'B' },
      { date: '2027-05-09', nom: 'proche A', niveau: 'B' }, { date: '2027-03-28', nom: 'B1', niveau: 'B' }, { date: '2027-04-11', nom: 'B2', niveau: 'B' },
      { date: '2027-04-25', nom: 'B3', niveau: 'B' },
    ], phases)
    expect(n.get('2026-11-22')).toBe('C')
    expect(n.get('2027-05-09')).toBe('C')
    expect(n.get('2027-03-28')).toBe('B')
    expect(n.get('2027-04-11')).toBe('C')
    expect(n.get('2027-04-25')).toBe('B')
  })
  it('pas de séance dure les 2 jours avant, ni avant J+3 (course courte) ou J+4 (longue)', () => {
    expect(delaiApresCourse(90)).toBe(3)
    expect(delaiApresCourse(300)).toBe(4)
    const c = ['2027-03-28']
    expect(procheCourse('2027-03-26', c, 3)).toBe(true)
    expect(procheCourse('2027-03-25', c, 3)).toBe(false)
    expect(procheCourse('2027-03-30', c, 3)).toBe(true)
    expect(procheCourse('2027-03-31', c, 3)).toBe(false)
    expect(procheCourse('2027-03-31', c, 4)).toBe(true)
    expect(procheCourse('2027-04-01', c, 4)).toBe(false)
  })
  it('veille de course B : 45 min, moins de 5 min au-dessus de la CP', () => {
    const s = construireOuverture(170, 260)
    const fin = s.velo.etapes!.reduce((a, e) => Math.max(a, e.debutSec + e.dureeSec), 0)
    expect(fin).toBe(45 * 60)
    expect(s.velo.etapes!.filter((e) => e.w === undefined || e.w > 260).reduce((a, e) => a + e.dureeSec, 0)).toBeLessThan(300)
  })
  it('la course compte ses kJ (≈ 75 % de la CP)', () => {
    expect(construireCourse('x', 'C', 120, 260).kj).toBe(1404)
  })
})

describe('durée estimée d’une course', () => {
  it('ordres de grandeur pour un amateur (3,5 W/kg, 70 kg)', () => {
    const a = { cpW: 245, poidsKg: 70 }
    const h = (m: number) => m / 60
    expect(h(estimerDureeCourse('cyclo', 170, 4500, a))).toBeGreaterThan(7.5)
    expect(h(estimerDureeCourse('cyclo', 170, 4500, a))).toBeLessThan(11)
    expect(h(estimerDureeCourse('en-ligne', 100, 1000, a))).toBeGreaterThan(2.5)
    expect(h(estimerDureeCourse('en-ligne', 100, 1000, a))).toBeLessThan(4)
    expect(h(estimerDureeCourse('xco', 25, 800, a))).toBeGreaterThan(1.2)
    expect(h(estimerDureeCourse('xco', 25, 800, a))).toBeLessThan(2.2)
  })
  it('la durée donnée passe en premier ; un coureur plus fort met moins de temps en cyclo', () => {
    expect(dureeDeCourse({ date: '2027-03-28', nom: 'x', epreuve: 'cyclo', distanceKm: 100, dureeMin: 200 }, { discipline: 'route' })).toBe(200)
    expect(estimerDureeCourse('cyclo', 150, 2000, { cpW: 320, poidsKg: 70 })).toBeLessThan(estimerDureeCourse('cyclo', 150, 2000, { cpW: 200, poidsKg: 70 }))
  })
})
