import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'
import { construireZ2 } from '../../../metrics/programme'
import type { SeancePrevue } from '../types'

// Séances déjà envoyées à Zwift / la montre (16/11/2026) : changées → renvoyées ; changées de jour ou supprimées → retirées
const appels: { route: string; corps: Record<string, unknown> }[] = []
vi.mock('./intervals', () => ({
  appeler: async (route: string, corps: Record<string, unknown>) => { appels.push({ route, corps }); return { id: 'ev1' } },
}))

beforeEach(async () => {
  appels.length = 0
  const { db } = await import('../../../core/db')
  await db.prevues.clear()
  await db.reglages.clear()
})

const seance = (date: string, min: number): SeancePrevue => {
  const s = construireZ2(min, 180)
  return { id: `auto-${date}-velo`, date, sport: 'velo', titre: s.titre, dureeMin: s.dureeMin, kjPrevu: s.kj, statut: 'prevue', origine: 'auto', velo: s.velo, intensite: 'basse', priorite: 'normale' }
}

it('séance raccourcie après l’envoi : renvoyée ; séance déplacée : l’ancienne est retirée', async () => {
  const { db } = await import('../../../core/db')
  const { enregistrer, supprimer } = await import('../../../core/stockage')
  const { envoyerSeance, mettreAJourEnvois } = await import('./envoi')
  const p = seance('2099-01-05', 120)
  await enregistrer(db.prevues, p)
  await envoyerSeance(p, p.velo!.etapes!, 'zwift')
  await mettreAJourEnvois()
  expect(appels.filter((a) => a.route === 'planifier')).toHaveLength(1) // rien n'a changé
  // Recalcul : 120 → 95 min
  await enregistrer(db.prevues, seance('2099-01-05', 95))
  await mettreAJourEnvois()
  const maj = appels.filter((a) => a.route === 'planifier')
  expect(maj).toHaveLength(2)
  expect(maj[1].corps).toMatchObject({ id: 'ev1', dureeSec: 95 * 60 })
  // Recalcul : la séance part sur un autre jour (l'ancienne disparaît)
  await supprimer(db.prevues, p.id)
  await mettreAJourEnvois()
  expect(appels.at(-1)).toMatchObject({ route: 'retirer', corps: { id: 'ev1' } })
})
