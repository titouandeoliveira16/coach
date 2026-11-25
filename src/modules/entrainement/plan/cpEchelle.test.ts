// 26/11/2026 (demande de Titouan, relu : dose = durée × intensité relative, Allen & Coggan, Sanders 2017) : après un test
// CP en hausse, le budget kJ suit la nouvelle puissance d'endurance et les séances gardent la même durée.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { PROGRAMME_DEFAUT } from '../reglagesEntrainement'
import { genererSemaineVelo, lireMeta } from './programme'

const LUNDI = '2026-10-26'
const SUIVANT = '2026-11-02'
const durees = async () => (await db.prevues.where('date').between(SUIVANT, '2026-11-08', true, true).toArray())
  .filter((p) => p.origine === 'auto' && p.sport === 'velo').reduce((t, p) => t + p.dureeMin, 0)

describe('CP en hausse : mêmes durées', () => {
  afterEach(() => { vi.useRealTimers() })

  it('CP +5 % : budget kJ +5 % environ, durée totale de la semaine quasi identique', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T18:00:00'))
    const base = { programme: { ...PROGRAMME_DEFAUT, z2W: undefined }, tests: [], cpW: 240 }
    await enregistrer(db.reglages, { id: 'entrainement', valeur: base })
    await genererSemaineVelo(LUNDI)
    await genererSemaineVelo(SUIVANT)
    const avant = { min: await durees(), kj: (await lireMeta(SUIVANT))!.budgetRef }
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...base, cpW: 252 } })
    await genererSemaineVelo(SUIVANT)
    const apres = { min: await durees(), kj: (await lireMeta(SUIVANT))!.budgetRef }
    expect(apres.kj / avant.kj).toBeGreaterThan(1.03)
    expect(Math.abs(apres.min - avant.min) / avant.min).toBeLessThan(0.03)
  })
})
