import { describe, expect, it } from 'vitest'
import {
  choisirFormat, construireIntervalles, construireLongueCotes, construireSpeciales, construireTerrain, cotesDe, deplier, formatDe, formatsPour,
  type HistoIntensite, type Phase,
} from './programme'
import { controlerSeance } from './controle'

const PHASES: Phase[] = [
  { debut: '2026-10-26', type: 'reprise' },
  { debut: '2026-12-14', type: 'vo2' },
  { debut: '2027-02-01', type: 'seuil' },
]
const h = (date: string, famille: HistoIntensite['famille'], formatId: string): HistoIntensite => ({ date, famille, formatId, palier: 0 })

describe('moteur VTT : choix des séances selon la discipline', () => {
  it('route inchangée : les formats VTT ne sortent jamais', () => {
    expect(formatsPour('vo2-longs').map((f) => f.id)).not.toContain('inoue')
    expect(formatsPour('vo2-longs', 'xco').map((f) => f.id)).toEqual(['5min', 'inoue'])
  })

  it('reprise : pas de sprints ni de relances, même en XCO', () => {
    expect(choisirFormat('2026-11-02', PHASES, [], 'xco').famille).toBe('sweet-spot')
    expect(choisirFormat('2026-11-09', PHASES, [h('2026-11-03', 'sweet-spot', 'sweet-spot')], 'dh').famille).toBe('vo2-courts')
  })

  it('XCO, phase VO2 : VO2 courts → VO2 longs → sprints de 30" en séries', () => {
    const histo: HistoIntensite[] = [h('2026-11-10', 'vo2-courts', '30-15')]
    const a = choisirFormat('2026-12-14', PHASES, histo, 'xco')
    expect(a.famille).toBe('vo2-longs')
    histo.push(h('2026-12-15', a.famille, a.format.id))
    const b = choisirFormat('2026-12-21', PHASES, histo, 'xco')
    expect(b.famille).toBe('sprints')
    expect(b.format.id).toBe('sit-series')
  })

  it('XCO, phase seuil : 1 séance sur 3 en relances', () => {
    const histo = [h('2027-01-19', 'seuil', 'seuil-8-10'), h('2027-02-02', 'seuil', 'seuil-8-10')]
    const c = choisirFormat('2027-02-15', PHASES, histo, 'xco')
    expect(c.famille).toBe('relances')
    expect(c.format.id).toBe('relances-xco')
    expect(choisirFormat('2027-02-15', PHASES, histo, 'xcc').format.id).toBe('relances-xcc')
  })

  it('descente : sprints courts en phase VO2', () => {
    const c = choisirFormat('2026-12-14', PHASES, [h('2026-11-10', 'vo2-courts', '30-15')], 'dh')
    expect([c.famille, c.format.id]).toEqual(['sprints', 'sprints-courts'])
  })
})

describe('moteur VTT : construction des séances', () => {
  it('sprints à fond : pas de cible en watts (allure libre), pas de bonus', () => {
    const s = construireIntervalles(formatDe('sit-series')!, 0, 250, 0.05)
    expect(s.velo.cibleW).toBeUndefined()
    const sprints = deplier(s.velo.etapes!).filter((e) => e.libelle === 'Sprint à fond')
    expect(sprints).toHaveLength(8)
    expect(sprints.every((e) => e.w === undefined && e.cadence === '100-120')).toBe(true)
    expect(s.titre).toBe('2 × 4 sprints de 30"')
  })

  it('relances XCO : fond contrôlé, relance sans plage', () => {
    const s = construireIntervalles(formatDe('relances-xco')!, 0, 250, 0)
    expect(s.titre).toBe("2 × 8' à relances")
    const rep = s.velo.etapes!.find((e) => e.repetition)!.repetition!
    expect(rep.etapes[0]).toMatchObject({ libelle: 'Fond', w: 200 })
    expect(rep.etapes[0].wMin).toBeDefined()
    expect(rep.etapes[1]).toMatchObject({ libelle: 'Relance', w: 390 })
    expect(rep.etapes[1].wMin).toBeUndefined()
  })

  it('intervalles longs du vététiste : 4 min de récupération', () => {
    const s = construireIntervalles(formatDe('inoue')!, 0, 250, 0)
    expect(s.titre).toBe("7 × 4' intervalles longs du vététiste")
    expect(s.velo.etapes!.find((e) => e.libelle.startsWith('Récupération'))!.dureeSec).toBe(240)
  })

  it('sortie longue en côtes : montées plafonnées à 85-95 % de la CP, 6 × 15 seulement avant une course', () => {
    expect(cotesDe(0, false)).toEqual({ n: 4, min: 8 })
    expect(cotesDe(9, false)).toEqual({ n: 5, min: 12 })
    expect(cotesDe(0, true)).toEqual({ n: 6, min: 15 })
    const s = construireLongueCotes(180, 160, 250, { n: 4, min: 8 })
    expect(s.dureeMin).toBe(180)
    const plat = deplier(s.velo.etapes!)
    expect(plat.reduce((t, e) => t + e.dureeSec, 0)).toBe(180 * 60)
    expect(plat.filter((e) => e.libelle === 'Montée').map((e) => [e.wMin, e.wMax])).toEqual(Array(4).fill([215, 240]))
    // Sortie courte : moins de montées (au moins 10 min de Z2 entre)
    expect(construireLongueCotes(90, 160, 250, { n: 6, min: 15 }).velo.etapes![1].repetition!.fois).toBe(2)
  })

  it('contrôle de la sortie en côtes : montées et Z2 jugées', () => {
    const s = construireLongueCotes(120, 160, 250, { n: 4, min: 8 })
    const w1Hz = deplier(s.velo.etapes!).flatMap((e) => Array(e.dureeSec).fill(e.libelle === 'Montée' ? 250 : (e.w ?? 150)))
    const c = controlerSeance({ etapes: s.velo.etapes!, famille: 'z2-long', w1Hz, cpW: 250 })!
    expect(c.lignes.map((l) => [l.libelle, l.verdict])).toContainEqual(['Montées', 'haut'])
    expect(c.lignes.find((l) => l.libelle === 'Z2 entre les montées')!.verdict).toBe('ok')
  })

  it('VTT technique : 60 min au plus, puis Z2 ; spéciales d’enduro', () => {
    expect(construireTerrain('xco', 45, 160).titre).toBe("VTT technique 45'")
    const t = construireTerrain('enduro', 90, 160)
    expect(t.titre).toBe("VTT technique 60' + 30' Z2")
    expect(t.velo.famille).toBe('vtt-terrain')
    expect(construireSpeciales(0, 250)).toMatchObject({ titre: "4 spéciales de 3'", velo: { famille: 'vtt-speciales' } })
  })
})
