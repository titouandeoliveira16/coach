// 25/11/2026 (demande de Titouan) : un changement de réglage s'applique à partir de la semaine suivante ; la semaine en
// cours, même recalculée (séance déplacée, jour rouge, import), garde les réglages avec lesquels elle a été construite.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { PROGRAMME_DEFAUT } from '../reglagesEntrainement'
import { genererSemaineVelo, recalculerApresReglage } from './programme'

const LUNDI = '2026-10-26'
const SUIVANT = '2026-11-02'
const velo = async (de: string, a: string) => (await db.prevues.where('date').between(de, a, true, true).toArray())
  .filter((p) => p.origine === 'auto' && p.sport === 'velo').map((p) => `${p.date} ${p.type}`).sort()

describe('réglages figés pour la semaine en cours', () => {
  afterEach(() => { vi.useRealTimers() })

  it('changer ses jours ne touche pas la semaine en cours, seulement la suivante', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T07:00:00'))
    const avant = (await db.reglages.get('entrainement'))?.valeur as Record<string, unknown> | undefined
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...avant, programme: { ...PROGRAMME_DEFAUT } } })
    await genererSemaineVelo(LUNDI)
    await genererSemaineVelo(SUIVANT)
    const cetteAvant = await velo('2026-10-27', '2026-11-01')
    const suivanteAvant = await velo(SUIVANT, '2026-11-08')
    // Nouveaux jours : tout décalé d'un jour
    const t = PROGRAMME_DEFAUT.semaineType
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...avant, programme: { ...PROGRAMME_DEFAUT, semaineType: [t[6], ...t.slice(0, 6)] } } })
    await recalculerApresReglage()
    // Puis un recalcul de la semaine en cours le lendemain (comme après une séance déplacée)
    vi.setSystemTime(new Date('2026-10-27T07:00:00'))
    await genererSemaineVelo(LUNDI)
    expect(await velo('2026-10-27', '2026-11-01')).toEqual(cetteAvant)
    expect(await velo(SUIVANT, '2026-11-08')).not.toEqual(suivanteAvant)
  })
})
