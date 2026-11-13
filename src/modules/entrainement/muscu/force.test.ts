import { describe, expect, it } from 'vitest'
import type { Role } from '../../../metrics/programme'
import { apresSeance, chargeProposee, dureeForce, EXOS, joursMuscu, planForce } from './force'

const squat = EXOS.salle.find((e) => e.id === 'squat')!
const curlSol = EXOS.maison.find((e) => e.id === 'curlsol')!

describe('muscu du cycliste (13/11/2026)', () => {
  it('périodes : apprentissage 3 semaines, force lourde 10 → 6 → 5, entretien 1 fois, allégée 2 séries, repos après la course', () => {
    const p = (lundi: string, phase = 'base' as const, allegee = false) => planForce({ debut: '2026-11-16', lundi, phase, allegee, seancesVoulues: 2 })
    expect(p('2026-11-16')).toMatchObject({ periode: 'apprentissage', series: 2, reps: 12, legere: true, seances: 2 })
    expect(p('2026-12-07')).toMatchObject({ periode: 'lourd', semaine: 1, series: 3, reps: 10 })
    expect(p('2027-01-04')).toMatchObject({ periode: 'lourd', reps: 6 })
    expect(p('2027-02-01')).toMatchObject({ periode: 'lourd', reps: 5 })
    expect(p('2027-03-01')).toMatchObject({ periode: 'entretien', seances: 1 })
    expect(planForce({ debut: '2026-11-16', lundi: '2027-01-04', phase: 'base', allegee: true, seancesVoulues: 2 }).series).toBe(2)
    expect(planForce({ debut: '2026-11-16', lundi: '2027-02-08', phase: 'fin-prepa', allegee: false, seancesVoulues: 2 }).periode).toBe('entretien')
    expect(planForce({ debut: '2026-11-16', lundi: '2027-04-12', phase: 'affutage', allegee: false, seancesVoulues: 2 })).toMatchObject({ periode: 'affutage', series: 2, seances: 1 })
    expect(planForce({ debut: '2026-11-16', lundi: '2027-04-26', phase: 'recuperation', allegee: false, seancesVoulues: 2 }).seances).toBe(0)
  })
  it('jours : sans vélo, jamais la veille d’une séance clé ni dans les 4 jours avant une course, 2 jours d’écart', () => {
    const roles: Role[] = ['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-z2', 'velo-long']
    const dates = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10']
    // Lundi = veille du mardi dur : exclu ; mercredi et vendredi possibles
    expect(joursMuscu({ roles, dates, n: 1, cles: ['2027-01-05', '2027-01-10'], durs: ['2027-01-05'], courses: [] })).toEqual([{ date: '2027-01-06', soir: false }])
    expect(joursMuscu({ roles, dates, n: 2, cles: ['2027-01-05', '2027-01-10'], durs: ['2027-01-05'], courses: [] }).map((j) => j.date)).toEqual(['2027-01-06', '2027-01-08'])
    // Course le samedi : rien à partir du mardi ; plus de jour sans vélo → pas de séance (le jour dur est aussi trop près)
    expect(joursMuscu({ roles, dates, n: 1, cles: ['2027-01-05', '2027-01-09'], durs: ['2027-01-05'], courses: ['2027-01-09'] })).toEqual([])
    // Aucun jour libre : le soir de la séance dure
    const plein: Role[] = ['velo-z2', 'velo-dur', 'velo-z2', 'velo-z2', 'velo-z2', 'velo-z2', 'velo-long']
    expect(joursMuscu({ roles: plein, dates, n: 1, cles: ['2027-01-05', '2027-01-10'], durs: ['2027-01-05'], courses: [] })).toEqual([{ date: '2027-01-05', soir: true }])
  })
  it('surcharge progressive : +5 kg réussi, même charge raté, −5 % après 2 ratés, +1 répétition au poids du corps', () => {
    expect(apresSeance(squat, { charge: 60 }, { charge: 60, reps: [10, 10, 10], cible: 10, series: 3 })).toMatchObject({ charge: 65, echecs: 0 })
    const rate = apresSeance(squat, { charge: 60 }, { charge: 60, reps: [10, 9, 8], cible: 10, series: 3 })
    expect(rate).toMatchObject({ charge: 60, echecs: 1 })
    expect(apresSeance(squat, rate, { charge: 60, reps: [10, 8, 8], cible: 10, series: 3 })).toMatchObject({ charge: 55, echecs: 0 })
    expect(apresSeance(curlSol, { repsEnPlus: 2 }, { reps: [14, 14, 14], cible: 14, series: 3 }).repsEnPlus).toBe(3)
    // Apprentissage : la charge trouvée est retenue sans hausse
    expect(apresSeance(squat, undefined, { charge: 40, reps: [12, 12], cible: 12, series: 2, legere: true })).toMatchObject({ charge: 40, repsRef: 12 })
  })
  it('charge adaptée quand on passe de 10 à 6 répétitions (Epley), arrondie au pas', () => {
    expect(chargeProposee(squat, { charge: 60, repsRef: 10 }, 6)).toBe(65)
    expect(chargeProposee(squat, { charge: 60, repsRef: 10 }, 10)).toBe(60)
    expect(chargeProposee(squat, undefined, 10)).toBeUndefined()
  })
  it('environ 1 h en force lourde', () => expect(dureeForce({ periode: 'lourd', semaine: 1, series: 3, reps: 6, lieu: 'salle' })).toBeLessThanOrEqual(60))
})
