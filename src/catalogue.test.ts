import { describe, expect, it } from 'vitest'
import catalogue from '../catalogue/seances.json'

type Etape = { type: string; duree?: number; intensite?: number[]; max?: boolean; fois?: number; etapes?: Etape[] }

const SPORTS = ['velo', 'course', 'force', 'methode']
const NIVEAUX_PREUVE = ['prouvé', 'plausible', 'mitigé', 'pratique', 'faible']

function duree(etapes: Etape[]): number {
  return etapes.reduce((t, e) => t + (e.type === 'repetition' ? e.fois! * duree(e.etapes!) : e.duree!), 0)
}

describe('catalogue de séances', () => {
  const seances = catalogue.seances as unknown as Record<string, unknown>[]

  it('identifiants uniques, sports connus, preuve renseignée', () => {
    const ids = seances.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of seances) {
      expect(SPORTS).toContain(s.sport)
      const p = s.preuve as { niveau: string; resultat: string; references: { auteurs: string; annee: number }[] }
      expect(NIVEAUX_PREUVE).toContain(p.niveau)
      expect(p.resultat.length).toBeGreaterThan(10)
      expect(p.references.length).toBeGreaterThan(0)
      for (const r of p.references) expect(r.annee).toBeGreaterThan(1950)
    }
  })

  it('déroulés cohérents : durées positives, intensités [min ≤ max], durée totale juste', () => {
    const verifier = (etapes: Etape[]) => {
      for (const e of etapes) {
        if (e.type === 'repetition') { expect(e.fois).toBeGreaterThan(0); verifier(e.etapes!) }
        else {
          expect(e.duree).toBeGreaterThan(0)
          if (!e.max) expect(e.intensite![0]).toBeLessThanOrEqual(e.intensite![1])
        }
      }
    }
    for (const s of seances.filter((x) => x.deroule)) {
      verifier(s.deroule as Etape[])
      expect(Math.round(duree(s.deroule as Etape[]) / 60)).toBe(s.dureeMin)
    }
  })
})
