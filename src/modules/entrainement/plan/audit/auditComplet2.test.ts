import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { scenarioDe, simuler } from './simulation'

// Audit complet, tranche 2 sur 5 (100 saisons) : seulement avec `npm run audit`
const TRANCHE = 2
describe.skipIf(!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.AUDIT_COMPLET)(`audit complet ${TRANCHE}/5`, () => {
  // AUDIT_DECALAGE : autres profils (ex. 500 → graines 501 à 1000)
  const d0 = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.AUDIT_DECALAGE ?? 0)
  for (let g = d0 + (TRANCHE - 1) * 100 + 1; g <= d0 + TRANCHE * 100; g++) {
    const sc = scenarioDe(g)
    it(sc.nom, async () => {
      const problemes = await simuler(sc)
      if (problemes.length) console.log(`AUDIT ${sc.nom}\n  ${problemes.join('\n  ')}`)
      expect(problemes).toEqual([])
    }, 120_000)
  }
})
