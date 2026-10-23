import { db } from '../../../core/db'
import { enregistrer, supprimer } from '../../../core/stockage'
import { construireZ2, SPRINTS, type SeanceConstruite } from '../../../metrics/programme'
import type { SeancePrevue } from '../types'
import { z2Actuel } from './programme'

/** Semaine conservée lors de la remise à zéro (octobre 2026). */
export const LUNDI_CONSERVE = '2026-10-19'
const CLE = 'remise-a-zero'

/** Sortie longue de la semaine de reprise (75 min : on reprend progressivement). */
const SORTIE_REPRISE_MIN = 75

/** Version 0.15 : la sortie longue du 25/10 était de 2 h, trop pour une reprise. On la ramène à 1 h 15. */
export async function corrigerSortieReprise() {
  const p = await db.prevues.get('auto-2026-10-25-velo')
  if (!p || p.statut !== 'prevue' || p.dureeMin <= SORTIE_REPRISE_MIN) return
  const { w } = await z2Actuel()
  const c = construireZ2(SORTIE_REPRISE_MIN, w, SPRINTS[0])
  await enregistrer(db.prevues, { ...p, titre: c.titre, detail: c.detail, dureeMin: c.dureeMin, kjPrevu: c.kj, velo: c.velo })
}

export const remiseFaite = async () => !!(await db.reglages.get(CLE))

/**
 * Remise à zéro : garde les séances réalisées de cette semaine, les mesures du matin, les pesées et les réglages.
 * Supprime l'historique plus ancien, toutes les séances prévues, les feux passés et les budgets calculés.
 * Les suppressions passent par la synchro : elles s'appliquent au serveur et aux autres appareils.
 * Puis recrée la fin de semaine : vendredi Z2 1 h, samedi footing 45', dimanche Z2 longue 1 h 15 (reprise).
 */
export async function repartirDeZero() {
  for (const s of await db.seances.where('date').below(LUNDI_CONSERVE).toArray()) await supprimer(db.seances, s.id)
  for (const p of await db.prevues.toArray()) await supprimer(db.prevues, p.id)
  for (const d of await db.decisions.where('date').below(LUNDI_CONSERVE).toArray()) await supprimer(db.decisions, d.date)
  for (const i of await db.indispos.toArray()) await supprimer(db.indispos, i.date)
  for (const r of await db.reglages.toArray()) if (r.id.startsWith('semaine-')) await supprimer(db.reglages, r.id)
  // Les séances réalisées gardées ne sont plus rattachées à une séance prévue
  for (const s of await db.seances.toArray()) if (s.prevueId) await enregistrer(db.seances, { ...s, prevueId: undefined })

  const { w } = await z2Actuel()
  const velo = (date: string, c: SeanceConstruite, longue = false): SeancePrevue => ({
    id: `auto-${date}-velo`, date, sport: 'velo', titre: c.titre, detail: c.detail, dureeMin: c.dureeMin, kjPrevu: c.kj,
    type: longue ? 'Sortie longue' : 'Endurance', intensite: 'basse', priorite: longue ? 'cle' : 'normale', longue: longue || undefined,
    statut: 'prevue', origine: 'auto', velo: c.velo,
  })
  await enregistrer(db.prevues, velo('2026-10-23', construireZ2(60, w)))
  await enregistrer(db.prevues, {
    id: 'campus-2026-10-24', date: '2026-10-24', sport: 'course', titre: 'Footing', typeCourse: 'Endurance fondamentale', type: 'Endurance',
    intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel',
  })
  await enregistrer(db.prevues, velo('2026-10-25', construireZ2(SORTIE_REPRISE_MIN, w, SPRINTS[0]), true))
  // Séances déjà faites ces jours-là : rattachées à leur séance prévue
  for (const s of await db.seances.where('date').between('2026-10-23', '2026-10-25', true, true).toArray()) {
    const p = (await db.prevues.where('date').equals(s.date).toArray()).find((x) => x.sport === s.sport)
    if (p) {
      await enregistrer(db.seances, { ...s, prevueId: p.id })
      await enregistrer(db.prevues, { ...p, statut: 'faite' })
    }
  }
  await enregistrer(db.reglages, { id: CLE, valeur: { le: new Date().toISOString() } })
}
