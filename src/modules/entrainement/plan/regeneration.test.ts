// Garde-fou de l'audit du 18/11/2026 : le recalcul de la semaine ne doit jamais écraser une séance déplacée à la main ou
// faite un autre jour (données inventées).
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { genererSemaineVelo } from './programme'
import { changerDeJour } from './donnees'

const LUNDI = '2026-10-26'
const JOURS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']

async function repartir() {
  await db.prevues.clear()
  await db.reglages.where('id').startsWith('meta').delete().catch(() => {})
  await genererSemaineVelo(LUNDI)
  return (await db.prevues.toArray()).filter((p) => p.origine === 'auto').sort((a, b) => a.date.localeCompare(b.date))
}

describe('recalcul de la semaine', () => {
  afterEach(() => { vi.useRealTimers() })

  it("garde chaque séance déplacée à la main à son nouveau jour", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T18:00:00'))
    const ecrasees: string[] = []
    for (let i = 0; i < 3; i++) for (const vers of JOURS) {
      const avant = await repartir()
      const p = avant[i]
      if (!p || p.date === vers) continue
      await changerDeJour(p, vers)
      const voulu = new Map((await db.prevues.toArray()).filter((x) => x.deplacee).map((x) => [x.id, x.date]))
      await genererSemaineVelo(LUNDI)
      for (const [id, date] of voulu) if ((await db.prevues.get(id))?.date !== date) ecrasees.push(`${p.id} → ${vers}`)
    }
    expect(ecrasees).toEqual([])
  })

  it("garde une séance faite un autre jour que prévu", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T18:00:00'))
    const avant = await repartir()
    const p = avant.find((x) => x.date > JOURS[0])!
    const veille = JOURS[JOURS.indexOf(p.date) - 1]
    // Faite la veille : la séance prévue suit la date réelle (comme à l'import), puis la semaine se recalcule le lendemain
    await enregistrer(db.prevues, { ...p, date: veille, statut: 'faite' })
    vi.setSystemTime(new Date(`${p.date}T07:00:00`))
    await genererSemaineVelo(LUNDI)
    const apres = await db.prevues.get(p.id)
    expect(apres?.statut).toBe('faite')
    expect(apres?.date).toBe(veille)
  })
})
