import { describe, expect, it } from 'vitest'
import { jourAAjouter, pistesDeblocage, type Role } from '../../../metrics/programme'
import { accepterConseil, annulerConseil, appliquerChangement, trancheAuDessus } from './pistes'
import type { ReglagesProgramme } from '../types'

const semaine: Role[] = ['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-z2', 'velo-long']
const prog = { semaineType: semaine, maxSemaineMin: 75, maxLongMin: 180, semainesTypesFutures: [] } as unknown as ReglagesProgramme

describe('conseil de Saison appliqué en un geste (13/11/2026)', () => {
  it('pistes de la plus rentable à la moins rentable, jour proposé loin des séances dures', () => {
    const p = pistesDeblocage({ semaineType: semaine, cap: { z2: 75, long: 180 }, z2W: 180 })
    expect(p.map((x) => x.levier).sort()).toEqual(['jour', 'longue', 'semaine'])
    expect(p[0].gain).toBeGreaterThanOrEqual(p[p.length - 1].gain)
    // Lundi (après la longue, avant le jour dur) et mercredi (après le dur) sont collés : vendredi (entre deux Z2) d'abord
    expect(jourAAjouter(semaine)).toBe(4)
    // Plus de 5 h de sortie longue : pas proposé
    expect(pistesDeblocage({ semaineType: semaine, cap: { z2: 75, long: 300 }, z2W: 180 }).some((x) => x.levier === 'longue')).toBe(false)
  })
  it('appliqué à partir du lundi du blocage, et aux semaines types d’après', () => {
    const avecFuture = { ...prog, semainesTypesFutures: [{ debut: '2027-02-01', semaineType: semaine, maxLongMin: 200 }] } as ReglagesProgramme
    const r = appliquerChangement(avecFuture, '6 à 8 h', '2027-01-04', { levier: 'jour', jour: 4 })
    expect(r.semainesTypesFutures!.map((f) => f.debut)).toEqual(['2027-01-04', '2027-02-01'])
    expect(r.semainesTypesFutures!.every((f) => f.semaineType[4] === 'velo-z2')).toBe(true)
    expect(r.semaineType[4]).toBe('libre')
    const l = appliquerChangement(avecFuture, '6 à 8 h', '2027-01-04', { levier: 'longue', minutes: 210 })
    expect(l.semainesTypesFutures!.map((f) => f.maxLongMin)).toEqual([210, 210])
    const h = appliquerChangement(prog, '6 à 8 h', '2027-01-04', { levier: 'heures' })
    expect(h.semainesTypesFutures![0].heuresSemaine).toBe('8 à 10 h')
    expect(trancheAuDessus('Plus de 12 h')).toBeUndefined()
  })
})

describe('choix acceptés annulables un par un (13/11/2026)', () => {
  it('accepter deux choix, annuler le premier : le second reste, tout annuler : retour aux semaines types d’avant', () => {
    const p1 = accepterConseil(prog, '6 à 8 h', '2027-01-04', { levier: 'jour', jour: 4 }, 'jeudi')
    const p2 = accepterConseil(p1, '6 à 8 h', '2027-02-01', { levier: 'longue', minutes: 210 }, 'longue')
    expect(p2.conseils!.liste).toHaveLength(2)
    const p3 = annulerConseil(p2, '6 à 8 h', p2.conseils!.liste[0].id)
    expect(p3.semainesTypesFutures!.map((f) => f.debut)).toEqual(['2027-02-01'])
    expect(p3.semainesTypesFutures![0].semaineType[4]).toBe('libre')
    expect(p3.semainesTypesFutures![0].maxLongMin).toBe(210)
    const p4 = annulerConseil(p3, '6 à 8 h', p3.conseils!.liste[0].id)
    expect(p4.semainesTypesFutures).toEqual([])
    expect(p4.conseils).toBeUndefined()
  })
})
