import { describe, expect, it } from 'vitest'
import {
  budgetSemaine, choisirFormat, construireIntervalles, construireZ2, dureeFormat, etatProgression, formatDe, FORMATS,
  palierPossible, phaseDe, placer, projeterSaison, type HistoIntensite, type Phase, type Role,
} from './programme'
import { decaler } from './vfc'

const PHASES: Phase[] = [
  { debut: '2026-10-26', type: 'reprise' },
  { debut: '2026-12-14', type: 'vo2' },
  { debut: '2027-02-01', type: 'seuil' },
]
const ROLES: Role[] = ['course', 'velo-dur', 'renfo', 'course', 'velo-z2', 'course', 'velo-long']
const semaine = Array.from({ length: 7 }, (_, i) => decaler('2026-10-26', i))

describe('banque de séances', () => {
  it('chaque format a 4 paliers de durée croissante', () => {
    for (const f of FORMATS) {
      const durees = [0, 1, 2, 3].map((i) => dureeFormat(f, i).travailSec)
      expect(durees).toEqual([...durees].sort((a, b) => a - b))
    }
  })

  it('30/15 au dernier palier : 3 × 13, environ 1 h, 120 % de CP', () => {
    const s = construireIntervalles(formatDe('30-15')!, 3, 260, 0)
    expect(s.titre).toBe('3 × 13 × 30/15')
    expect(s.dureeMin).toBe(60)
    expect(s.velo.cibleW).toBe(310)
    expect(s.kj).toBeGreaterThan(500)
  })

  it('tous les formats tiennent dans 75 min au 1er palier, la plupart au dernier', () => {
    for (const f of FORMATS) expect(dureeFormat(f, 0).totalSec).toBeLessThanOrEqual(75 * 60)
  })

  it('palier réduit si le créneau est trop court', () => {
    const f = formatDe('30-15')!
    expect(palierPossible(f, 3, 75)).toBe(3)
    expect(palierPossible(f, 3, 45)).toBeLessThan(3)
  })

  it('Z2 : kJ cohérents', () => {
    const s = construireZ2(60, 160)
    expect(s.kj).toBeGreaterThan(550)
    expect(s.kj).toBeLessThan(576)
  })
})

describe('choix de la séance', () => {
  const h = (date: string, famille: HistoIntensite['famille'], formatId: string): HistoIntensite => ({ date, famille, formatId, palier: 0 })

  it('reprise : sous le seuil puis VO2 courts, en alternance', () => {
    expect(choisirFormat('2026-11-02', PHASES, []).famille).toBe('sweet-spot')
    const apres1 = choisirFormat('2026-11-09', PHASES, [h('2026-11-03', 'sweet-spot', 'sweet-spot')])
    expect(apres1.format.id).toBe('30-15')
    const apres2 = choisirFormat('2026-11-16', PHASES, [h('2026-11-03', 'sweet-spot', 'sweet-spot'), h('2026-11-10', 'vo2-courts', '30-15')])
    expect(apres2.famille).toBe('tempo')
  })

  it('phase VO2 : 2 VO2 (courts puis longs) puis 1 seuil, formats tournants', () => {
    const histo: HistoIntensite[] = [h('2026-11-10', 'vo2-courts', '30-15')]
    const s1 = choisirFormat('2026-12-14', PHASES, histo)
    expect(s1.famille).toBe('vo2-longs')
    histo.push(h('2026-12-15', s1.famille, s1.format.id))
    const s2 = choisirFormat('2026-12-21', PHASES, histo)
    expect(s2.famille).toBe('vo2-courts')
    expect(s2.format.id).toBe('30-30')
    histo.push(h('2026-12-22', s2.famille, s2.format.id))
    expect(choisirFormat('2026-12-28', PHASES, histo).famille).toBe('seuil')
  })

  it('phase et semaine allégée', () => {
    expect(phaseDe('2026-11-16', PHASES)).toMatchObject({ phase: { type: 'reprise' }, semaine: 3 })
    expect(phaseDe('2027-02-08', PHASES)).toMatchObject({ phase: { type: 'seuil' }, semaine: 1 })
  })
})

describe('progression', () => {
  const r = (date: string, palier: number, resultat: 'reussie' | 'ratee'): HistoIntensite => ({ date, famille: 'vo2-courts', formatId: '30-15', palier, resultat })

  it('réussi : palier suivant ; dernier palier : +2,5 % et retour au 2e ; raté : −5 %', () => {
    expect(etatProgression([r('2026-11-03', 0, 'reussie')])['vo2-courts']).toEqual({ palier: 1, bonus: 0 })
    expect(etatProgression([r('2026-11-03', 3, 'reussie')])['vo2-courts']).toEqual({ palier: 1, bonus: 0.025 })
    expect(etatProgression([r('2026-11-03', 1, 'ratee')])['vo2-courts'].bonus).toBeCloseTo(-0.05)
    // Une autre famille n'est pas touchée
    expect(etatProgression([r('2026-11-03', 0, 'reussie')]).seuil).toEqual({ palier: 0, bonus: 0 })
  })
})

describe('budget kJ', () => {
  const prec = { budgetRef: 2000, kjPrevus: 2000, kjRealises: 1950, rouges: 0, oranges: 0, allegee: false }

  it('validé et au vert : +7,5 %', () => expect(budgetSemaine(prec, 2000, 4000, false).budgetRef).toBe(2150))
  it('pas réalisé à 90 % : stable', () => expect(budgetSemaine({ ...prec, kjRealises: 1500 }, 2000, 4000, false).budgetRef).toBe(2000))
  it('2 jours rouges : −15 %', () => expect(budgetSemaine({ ...prec, rouges: 2 }, 2000, 4000, false).budgetRef).toBe(1700))
  it('semaine allégée : −35 %, la référence est gardée', () => {
    const b = budgetSemaine(prec, 2000, 4000, true)
    expect(b.budget).toBe(Math.round(2150 * 0.65))
    expect(budgetSemaine({ ...prec, budgetRef: b.budgetRef, allegee: true }, 2000, 4000, false).budgetRef).toBe(2150)
  })
  it('plafonné par les créneaux', () => expect(budgetSemaine(prec, 2000, 2100, false).budgetRef).toBe(2100))
})

describe('placement', () => {
  it('semaine type : intensité mardi, Z2 vendredi, long dimanche', () => {
    const autres = [
      { date: semaine[0], dure: false }, { date: semaine[2], dure: false }, { date: semaine[3], dure: true }, { date: semaine[5], dure: false },
    ]
    expect(placer(semaine, ROLES, autres, new Set(), semaine[0])).toEqual({ intensite: semaine[1], long: semaine[6], z2: [semaine[4]] })
  })

  it('test 1500 m mardi, renfo jeudi, test CP vendredi : Z2 le mercredi', () => {
    const autres = [
      { date: semaine[0], dure: false }, { date: semaine[1], dure: true }, { date: semaine[3], dure: false }, { date: semaine[5], dure: false },
    ]
    expect(placer(semaine, ROLES, autres, new Set(), semaine[0], { dateTest: semaine[4] })).toEqual({ intensite: semaine[4], long: semaine[6], z2: [semaine[2]] })
  })

  it('jamais d’intensité à côté d’une séance dure : sinon elle est déplacée', () => {
    // Séances dures lundi et mercredi : mardi impossible, vendredi possible
    const autres = [{ date: semaine[0], dure: true }, { date: semaine[2], dure: true }, { date: semaine[3], dure: false }, { date: semaine[5], dure: false }]
    expect(placer(semaine, ROLES, autres, new Set(), semaine[0]).intensite).toBe(semaine[4])
  })

  it('pas d’intensité dans les 2 jours avant une compétition', () => {
    const autres = [{ date: semaine[3], dure: true }]
    const p = placer(semaine, ROLES, autres, new Set(), semaine[0], { competitions: [semaine[6]] })
    expect([semaine[3], semaine[4], semaine[5]]).not.toContain(p.intensite)
  })
})

describe('saison', () => {
  it('projette phases, semaines allégées, test et course', () => {
    const s = projeterSaison({
      lundi: '2026-10-26', jusquA: '2027-01-04', phases: PHASES, testsCp: ['2026-10-30'],
      competitions: [{ date: '2026-12-13', nom: '5 km' }], histo: [], budgetDepart: 2000, plafond: 3000,
    })
    expect(s[0]).toMatchObject({ type: 'test', intensite: 'Test CP 12-7-3', numero: 1, total: 7, phase: 'reprise' })
    expect(s[3].type).toBe('allegee')
    expect(s.find((x) => x.lundi === '2026-12-07')).toMatchObject({ type: 'competition', competition: '5 km' })
    expect(s.find((x) => x.lundi === '2026-12-14')).toMatchObject({ phase: 'vo2', numero: 1 })
    expect(s[1].budget).toBeGreaterThan(s[0].budget)
    expect(s[3].budget).toBeLessThan(s[2].budget)
  })
})
