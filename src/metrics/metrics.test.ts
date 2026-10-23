import { describe, expect, it } from 'vitest'
import { contrainte, modeleForme, monotonie, ratioPic, srpe, trimpBanister, trimpDepuisMoyenne } from './charge'
import { allureSecKm, pctVma, rtss, vitesseKmh } from './course'
import { decouplage, domaineDepuisFc, domaines, tempsParZone, type BornesZones } from './fc'
import { kjDepuisEchantillons, kjDepuisMoyenne, meilleurePuissance, puissanceNormalisee, tss } from './puissance'
import { analyserVfc, decaler } from './vfc'
import { adapterSeance, analyserSommeil, calculerSignal } from './signal'
import { hausseCharge, replanifier, trimpPrevu, type SeancePlan } from './planif'

const secondes = (n: number) => Array.from({ length: n + 1 }, (_, i) => i)
const BORNES: BornesZones = [143, 163, 184, 194]

describe('charge', () => {
  it('sRPE = RPE × minutes', () => {
    expect(srpe(7.5, 60)).toBe(450)
  })

  it('TRIMP : 60 min à 50 % de la réserve de FC ≈ 50,1', () => {
    // FC repos 50, FC max 200 → 125 bpm = 50 % ; 60 × 0,5 × 0,64 × e^0,96 = 50,14
    const t = secondes(3600)
    const fc = t.map(() => 125)
    expect(trimpBanister(t, fc, 50, 200)).toBeCloseTo(50.14, 1)
    expect(trimpDepuisMoyenne(125, 60, 50, 200)).toBeCloseTo(50.14, 1)
  })

  it('TRIMP ignore les pauses de plus de 30 s', () => {
    expect(trimpBanister([0, 1, 100], [125, 125, 125], 50, 200)).toBeCloseTo(50.14 / 3600, 4)
  })

  it('CTL/ATL : charge constante → convergence ; premier jour = charge / 42 et / 7', () => {
    const jours = Array.from({ length: 400 }, (_, i) => ({ date: String(i), charge: 100 }))
    const f = modeleForme(jours)
    expect(f[0].ctl).toBeCloseTo(100 / 42, 5)
    expect(f[0].atl).toBeCloseTo(100 / 7, 5)
    expect(f[0].tsb).toBe(0)
    expect(f[399].ctl).toBeCloseTo(100, 0)
    expect(f[399].tsb).toBeCloseTo(0, 0)
  })

  it('TSB = CTL − ATL de la veille', () => {
    const f = modeleForme([{ date: 'a', charge: 70 }, { date: 'b', charge: 0 }])
    expect(f[1].tsb).toBeCloseTo(f[0].ctl - f[0].atl, 10)
  })

  it('monotonie et contrainte de Foster', () => {
    const semaine = [100, 0, 100, 0, 100, 0, 100]
    // moyenne 57,14 ; écart-type 49,49 → 1,155 ; contrainte = 400 × 1,155
    expect(monotonie(semaine)).toBeCloseTo(1.155, 3)
    expect(contrainte(semaine)).toBeCloseTo(461.9, 1)
    expect(monotonie([50, 50, 50, 50, 50, 50, 50])).toBeUndefined()
  })

  it('ratio de pic de charge', () => {
    expect(ratioPic(650, [500, 500, 500, 500])).toBeCloseTo(1.3, 5)
    expect(ratioPic(100, [])).toBeUndefined()
  })
})

describe('puissance', () => {
  it('kJ = Σ W × s / 1000 : 1 h à 200 W = 720 kJ', () => {
    const t = secondes(3600)
    expect(kjDepuisEchantillons(t, t.map(() => 200))).toBeCloseTo(720, 5)
    expect(kjDepuisMoyenne(200, 3600)).toBe(720)
  })

  it('NP : puissance constante = cette puissance', () => {
    expect(puissanceNormalisee(new Array(600).fill(250))).toBeCloseTo(250, 5)
  })

  it('NP > moyenne pour un effort irrégulier', () => {
    // 5 min à 300 W puis 5 min à 100 W : moyenne 200 W, NP plus haute
    const w = [...new Array(300).fill(300), ...new Array(300).fill(100)]
    expect(puissanceNormalisee(w)!).toBeGreaterThan(230)
  })

  it('TSS : 1 h au seuil = 100 ; 1 h à 75 % = 56,25', () => {
    expect(tss(3600, 280, 280)).toBeCloseTo(100, 5)
    expect(tss(3600, 210, 280)).toBeCloseTo(56.25, 5)
  })
})

describe('course', () => {
  it('vitesse, allure, % VMA', () => {
    expect(vitesseKmh(10, 2700)).toBeCloseTo(13.333, 3)
    expect(allureSecKm(10, 2700)).toBe(270)
    expect(pctVma(13.875, 18.5)).toBeCloseTo(75, 5)
  })

  it('rTSS : 1 h au seuil = 100', () => {
    expect(rtss(3600, 18.5 * 0.87, 18.5)).toBeCloseTo(100, 5)
    expect(rtss(1800, 18.5 * 0.87, 18.5)).toBeCloseTo(50, 5)
  })
})

describe('fréquence cardiaque', () => {
  it('temps par zone et domaines', () => {
    const t = secondes(400)
    const fc = t.map((i) => (i <= 100 ? 130 : i <= 200 ? 150 : i <= 300 ? 170 : 190))
    const z = tempsParZone(t, fc, BORNES)
    expect(z).toEqual([100, 100, 100, 100, 0])
    expect(domaines(z)).toEqual({ basse: 200, moyenne: 100, haute: 100 })
    expect(domaineDepuisFc(140, BORNES)).toBe('basse')
    expect(domaineDepuisFc(170, BORNES)).toBe('moyenne')
    expect(domaineDepuisFc(196, BORNES)).toBe('haute')
  })

  it('découplage : même vitesse, FC 140 puis 147 → 4,76 %', () => {
    const t = secondes(3600)
    const fc = t.map((i) => (i < 1800 ? 140 : 147))
    const v = t.map(() => 8)
    expect(decouplage(t, fc, v)).toBeCloseTo(4.76, 2)
  })
})

describe('VFC', () => {
  const jours = (n: number, rmssd: (i: number) => number, fc = () => 48) =>
    Array.from({ length: n }, (_, i) => ({ date: decaler('2026-01-01', i), rmssd: rmssd(i), fcRepos: fc() }))

  it('calibration : pas de zone normale avant 14 jours', () => {
    const j = jours(10, () => 60)
    const a = analyserVfc(j, j[9].date)
    expect(a.zoneBasse).toBeUndefined()
    expect(a.ln7).toBeCloseTo(Math.log(60), 10)
  })

  it('zone normale = moyenne ± 0,5 écart-type de ln(RMSSD)', () => {
    // alternance 50 / 70 ms : ln moyen = (ln50 + ln70)/2, écart-type = (ln70 − ln50)/2
    const j = jours(20, (i) => (i % 2 ? 70 : 50))
    const a = analyserVfc(j, j[19].date)
    const m = (Math.log(50) + Math.log(70)) / 2
    const sd = (Math.log(70) - Math.log(50)) / 2
    expect(a.zoneBasse).toBeCloseTo(m - 0.5 * sd, 10)
    expect(a.zoneHaute).toBeCloseTo(m + 0.5 * sd, 10)
    expect(a.fcReposBase).toBe(48)
  })
})

describe('signal', () => {
  const vfcOk = { nBase: 30, ln7: 4.1, zoneBasse: 4.0, zoneHaute: 4.2, fcRepos7: 48, fcReposBase: 48 }

  it('🟢 si tout est dans la zone', () => {
    const s = calculerSignal({ vfc: vfcOk, ressenti: 4, sommeil: 4, tsb: -5 })
    expect(s.couleur).toBe('vert')
    expect(s.recommandation).toBe('maintenir')
  })

  it('🟠 si un seul indicateur hors zone, avec la raison', () => {
    const s = calculerSignal({ vfc: { ...vfcOk, ln7: 3.9 }, tsb: -5 })
    expect(s.couleur).toBe('orange')
    expect(s.alertes[0].code).toBe('vfc')
    expect(adapterSeance({ intensite: 'haute', dureeMin: 60 }, s)).toMatch(/endurance basse/)
  })

  it('sommeil : nuit courte ou dette = une seule alerte (🟠)', () => {
    const court = calculerSignal({ vfc: vfcOk, sommeilH: { nuit: 5.5, moyenne7: 6.5 }, sommeil: 1, ressenti: 2 })
    expect(court.couleur).toBe('orange')
    expect(court.alertes).toHaveLength(1)
    expect(court.raison).toMatch(/nuit courte/i)
    // Dette personnelle : 7 j à 7 h 10 contre 8 h d'habitude
    expect(calculerSignal({ vfc: vfcOk, sommeilH: { nuit: 7, moyenne7: 7.17, moyenne30: 8 } }).couleur).toBe('orange')
    expect(calculerSignal({ vfc: vfcOk, sommeilH: { nuit: 7.5, moyenne7: 7.6, moyenne30: 8 } }).couleur).toBe('vert')
    const n = analyserSommeil([{ date: '2026-10-21', h: 7 }, { date: '2026-10-22', h: 6 }, { date: '2026-10-23', h: 8 }], '2026-10-23')
    expect(n).toEqual({ nuit: 8, moyenne7: 7, moyenne30: undefined })
  })

  it('🔴 si deux indicateurs ou malade', () => {
    expect(calculerSignal({ vfc: { ...vfcOk, ln7: 3.9 }, tsb: -28 }).couleur).toBe('rouge')
    expect(calculerSignal({ vfc: vfcOk, maladeOuDouleur: true }).couleur).toBe('rouge')
  })

  it('saturation parasympathique : pas de 🟢 automatique', () => {
    const s = calculerSignal({ vfc: { ...vfcOk, ln7: 4.4, fcRepos7: 44 }, atlSurCtl: 1.3 })
    expect(s.couleur).toBe('orange')
    expect(s.alertes.some((a) => a.code === 'saturation')).toBe(true)
  })

  it('calibration signalée tant que la base VFC manque', () => {
    expect(calculerSignal({ vfc: { nBase: 3 } }).calibrationVfc).toBe(true)
  })
})

describe('planification', () => {
  const semaine = Array.from({ length: 7 }, (_, i) => decaler('2026-10-26', i)) // lundi → dimanche

  it('replace une séance intense sans la coller à une autre séance intense', () => {
    const seances: SeancePlan[] = [
      { id: 'a', date: semaine[1], intensite: 'haute', dureeMin: 60, priorite: 'cle' }, // mardi
      { id: 'b', date: semaine[3], intensite: 'haute', dureeMin: 60, priorite: 'cle' }, // jeudi
    ]
    const d = replanifier(semaine, seances, new Set([semaine[1]]), ['a'], semaine[0])
    expect(d[0].statut).toBe('deplacee')
    expect([semaine[2], semaine[4]]).not.toContain(d[0].vers) // pas mercredi ni vendredi (à côté de jeudi)
    expect(d[0].vers).not.toBe(semaine[3])
  })

  it('sortie longue replacée de préférence le week-end', () => {
    const seances: SeancePlan[] = [{ id: 'l', date: semaine[6], intensite: 'basse', dureeMin: 150, priorite: 'cle', longue: true }]
    const d = replanifier(semaine, seances, new Set([semaine[6]]), ['l'], semaine[0])
    expect(d[0].vers).toBe(semaine[5])
  })

  it('séance normale sans place → abandonnée ; clé → reportée', () => {
    const toutPris = new Set(semaine)
    const seances: SeancePlan[] = [
      { id: 'n', date: semaine[0], intensite: 'basse', dureeMin: 45, priorite: 'normale' },
      { id: 'c', date: semaine[0], intensite: 'haute', dureeMin: 45, priorite: 'cle' },
    ]
    const d = replanifier(semaine, seances, toutPris, ['n', 'c'], semaine[0])
    expect(d.find((x) => x.id === 'c')!.statut).toBe('reportee')
    expect(d.find((x) => x.id === 'n')!.statut).toBe('abandonnee')
  })

  it('charge prévue et hausse', () => {
    expect(trimpPrevu('haute', 60)).toBeGreaterThan(trimpPrevu('basse', 60))
    expect(hausseCharge(575, [500, 500, 500, 500])).toBeCloseTo(15, 5)
  })
})

describe('meilleurs efforts', () => {
  it('meilleure moyenne glissante', () => {
    const w = [...Array(100).fill(100), ...Array(180).fill(300), ...Array(100).fill(100)]
    expect(meilleurePuissance(w, 180)).toBe(300)
    expect(meilleurePuissance(w, 420)).toBeUndefined()
  })
})
