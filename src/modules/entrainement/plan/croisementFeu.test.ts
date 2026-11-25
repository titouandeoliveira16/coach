// Relecture « feu du jour » (26/11/2026) : croisements avec le recalcul de la semaine.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { PROGRAMME_DEFAUT } from '../reglagesEntrainement'
import { estIntensite, genererSemaineVelo } from './programme'
import { reporterIntensite } from './imprevus'

const AVANT = '2026-10-26'
const LUNDI = '2026-11-02'
const dures = async () => (await db.prevues.where('date').between(LUNDI, '2026-11-08', true, true).toArray())
  .filter((p) => p.origine === 'auto' && p.sport === 'velo' && p.statut !== 'abandonnee' && (estIntensite(p) || p.velo?.famille === 'test'))

describe('feu rouge puis recalcul de la semaine', () => {
  afterEach(() => { vi.useRealTimers() })

  it('l’intensité reportée reste à son nouveau jour, sans doublon', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T18:00:00'))
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { programme: { ...PROGRAMME_DEFAUT }, tests: [], cpW: 240 } })
    await genererSemaineVelo(AVANT)
    await genererSemaineVelo(LUNDI)
    const [p] = (await dures()).sort((a, b) => a.date.localeCompare(b.date))
    expect(p).toBeDefined()
    // Le matin de la séance : feu rouge, l'intensité est reportée
    vi.setSystemTime(new Date(`${p.date}T07:00:00`))
    await enregistrer(db.decisions, { date: p.date, couleur: 'rouge', force: false })
    await reporterIntensite(p)
    // Puis la semaine se recalcule (séance déplacée, import…)
    await genererSemaineVelo(LUNDI)
    const apres = await dures()
    expect(apres.filter((x) => x.date === p.date && x.statut === 'prevue').length).toBe(0)
    expect(apres.length).toBe((await dures()).length)
    expect(apres.some((x) => x.id === p.id || x.reporteeDu === p.date)).toBe(true)
  })
})
