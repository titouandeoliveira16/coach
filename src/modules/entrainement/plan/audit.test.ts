import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { deplier } from '../../../metrics/programme'
import { enregistrerArrivee, semaineDepuisJours, type ReponsesArrivee } from '../arrivee/donnees'
import { genererSemaineVelo } from './programme'

/**
 * Audit du moteur : une saison entière, semaine par semaine, pour plusieurs profils. Invariants vérifiés :
 * une séance vélo par jour, jamais deux jours durs d'affilée, durées et kJ positifs, déroulé sans trou,
 * watts plausibles (40 % à 250 % de la CP, sprints à fond exceptés).
 */
const base: ReponsesArrivee = {
  naissance: '1998-03-03', sexe: 'homme', tailleCm: 178, poidsKg: 70, cpW: 260, discipline: 'route', anciennete: '3 à 5 ans',
  heuresRecentes: '6 à 10 h', intervalles: true, arretSemaines: 0, heuresSemaine: '8 à 10 h', nutrition: true,
  semaineType: semaineDepuisJours(5), maxSemaineMin: 75, minLongMin: 120, maxLongMin: 240, course: { nom: 'Objectif', date: '2027-05-16' },
}
const profils: [string, Partial<ReponsesArrivee>][] = [
  ['route en ligne 5 j', { typeCourse: 'en-ligne' }],
  ['route cyclo 4 j', { typeCourse: 'cyclo', semaineType: semaineDepuisJours(4) }],
  ['XCO 4 j', { discipline: 'xco', semaineType: semaineDepuisJours(4) }],
  ['XCC 3 j', { discipline: 'xcc', semaineType: semaineDepuisJours(3) }],
  ['marathon VTT 5 j', { discipline: 'xcm' }],
  ['débutant 3 j après arrêt', { anciennete: 'Moins d’un an', heuresRecentes: 'Moins de 3 h', intervalles: false, arretSemaines: 4, semaineType: semaineDepuisJours(3), heuresSemaine: 'Moins de 4 h' }],
  ['route 4 j, 2 jours durs choisis (mardi, vendredi)', { semaineType: ['libre', 'velo-dur', 'velo-z2', 'renfo', 'velo-dur', 'libre', 'velo-long'] }],
  ['expert 6 j, course proche', { anciennete: 'Plus de 5 ans', heuresRecentes: 'Plus de 10 h', heuresSemaine: 'Plus de 12 h', semaineType: semaineDepuisJours(6), course: { nom: 'Proche', date: '2027-01-10' } }],
]

describe('audit du moteur sur une saison entière', () => {
  for (const [nom, p] of profils)
    it(nom, async () => {
      await db.delete(); await db.open()
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-09T07:00:00'))
      const r = { ...base, ...p }
      await enregistrerArrivee(r)
      const problemes: string[] = []
      for (let l = '2026-11-09'; l <= decalerJour(r.course.date, 14); l = decalerJour(l, 7)) {
        vi.setSystemTime(new Date(`${l}T06:00:00`))
        await genererSemaineVelo(l)
        const semaine = (await db.prevues.where('date').between(l, decalerJour(l, 6), true, true).toArray()).filter((x) => x.sport === 'velo' && x.statut === 'prevue')
        const parJour = new Map<string, number>()
        for (const s of semaine) parJour.set(s.date, (parJour.get(s.date) ?? 0) + 1)
        for (const [d, n] of parJour) if (n > 1) problemes.push(`${l} : ${n} séances vélo le ${d}`)
        const dures = semaine.filter((s) => s.intensite === 'haute').map((s) => s.date).sort()
        for (let i = 1; i < dures.length; i++) if (decalerJour(dures[i - 1], 1) === dures[i]) problemes.push(`${l} : jours durs d'affilée ${dures[i - 1]} et ${dures[i]}`)
        for (const s of semaine) {
          if (!(s.dureeMin > 0) || !(s.kjPrevu! > 0) || Number.isNaN(s.kjPrevu)) problemes.push(`${l} : ${s.titre} durée ${s.dureeMin} kJ ${s.kjPrevu}`)
          const et = s.velo?.etapes
          if (!et) continue
          const plat = deplier(et)
          const total = plat.reduce((a, e) => a + e.dureeSec, 0)
          if (Math.abs(total - s.dureeMin * 60) > 120) problemes.push(`${l} : ${s.titre} déroulé ${Math.round(total / 60)} min pour ${s.dureeMin} min`)
          for (const e of plat) {
            if (e.dureeSec <= 0) problemes.push(`${l} : ${s.titre} étape « ${e.libelle} » de durée ${e.dureeSec}`)
            if (e.w !== undefined && (Number.isNaN(e.w) || e.w < 0.4 * 260 * 0.8 || e.w > 2.5 * 260)) problemes.push(`${l} : ${s.titre} « ${e.libelle} » à ${e.w} W`)
          }
        }
      }
      vi.useRealTimers()
      expect(problemes).toEqual([])
    }, 60_000)

  it('les 2 jours durs choisis portent les 2 intensités (hors reprise)', async () => {
    await db.delete(); await db.open()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-09T07:00:00'))
    await enregistrerArrivee({ ...base, semaineType: ['libre', 'velo-dur', 'velo-z2', 'renfo', 'velo-dur', 'libre', 'velo-long'] })
    const jours: number[][] = []
    for (let l = '2026-11-09'; l <= '2027-03-01'; l = decalerJour(l, 7)) {
      vi.setSystemTime(new Date(`${l}T06:00:00`))
      await genererSemaineVelo(l)
      const semaine = (await db.prevues.where('date').between(l, decalerJour(l, 6), true, true).toArray()).filter((x) => x.sport === 'velo')
      jours.push(semaine.filter((x) => x.intensite === 'haute' && x.velo?.famille !== 'test').map((x) => new Date(`${x.date}T12:00:00`).getDay()).sort())
      // 4 jours de vélo chaque semaine, le vendredi compris
      expect(semaine.length).toBe(4)
    }
    vi.useRealTimers()
    expect(jours.some((j) => j.join() === '2,5')).toBe(true)
    expect(jours.every((j) => j.every((d) => d === 2 || d === 5))).toBe(true)
  }, 60_000)
})
