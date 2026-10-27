import { db } from '../../../core/db'
import { enregistrer, supprimer } from '../../../core/stockage'
import type { Seance } from '../types'
import { chargerContexte, completerMetriques } from './donnees'

/** Écart maximal entre deux activités pour les regrouper (ex. échauffement, test, retour au calme). */
export const ECART_MAX_MIN = 30

const debutMs = (s: Seance) => new Date(s.debut!).getTime()
const finMs = (s: Seance) => debutMs(s) + s.dureeSec * 1000

/** Deux activités du même sport, le même jour, la seconde commençant moins de 30 min après la fin de la première. */
export function sontEnchainees(a: Seance, b: Seance) {
  if (a.id === b.id || a.sport !== b.sport || a.date !== b.date || !a.debut || !b.debut) return false
  const [p, q] = debutMs(a) <= debutMs(b) ? [a, b] : [b, a]
  const ecart = debutMs(q) - finMs(p)
  // Léger chevauchement toléré (durée en mouvement < durée réelle) ; un vrai chevauchement = doublon, géré ailleurs
  return ecart > -120_000 && ecart <= ECART_MAX_MIN * 60_000
}

const somme = (x?: number, y?: number) => (x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0))

/** Une seule séance à partir de deux activités enchaînées : durées, distances, charges additionnées. */
export function fusionnerEnchainement(a: Seance, b: Seance): Seance {
  const [p, q] = debutMs(a) <= debutMs(b) ? [a, b] : [b, a]
  const dureeSec = p.dureeSec + q.dureeSec
  const kj = somme(p.kj, q.kj)
  const fcMoy = p.fcMoy && q.fcMoy ? Math.round((p.fcMoy * p.dureeSec + q.fcMoy * q.dureeSec) / dureeSec) : (p.fcMoy ?? q.fcMoy)
  const meilleurs = p.meilleurs || q.meilleurs
    ? Object.fromEntries([...new Set([...Object.keys(p.meilleurs ?? {}), ...Object.keys(q.meilleurs ?? {})])]
      .map((k) => [k, Math.max(p.meilleurs?.[k] ?? 0, q.meilleurs?.[k] ?? 0)]))
    : undefined
  return {
    ...p,
    titre: p.prevueId ? p.titre : (q.prevueId ? q.titre : p.titre),
    type: p.type ?? q.type,
    dureeSec,
    distanceKm: somme(p.distanceKm, q.distanceKm),
    deniveleM: somme(p.deniveleM, q.deniveleM),
    fcMoy,
    fcMax: Math.max(p.fcMax ?? 0, q.fcMax ?? 0) || undefined,
    kj,
    pas: somme(p.pas, q.pas),
    puissanceMoyW: kj ? Math.round((kj * 1000) / dureeSec) : undefined,
    puissanceNormW: undefined,
    tempsZones: p.tempsZones && q.tempsZones ? p.tempsZones.map((t, i) => t + (q.tempsZones![i] ?? 0)) : (p.tempsZones ?? q.tempsZones),
    trimp: somme(p.trimp, q.trimp),
    trimpFlux: !!p.trimpFlux && !!q.trimpFlux,
    decouplage: undefined,
    meilleurs,
    blocs: p.blocs ?? q.blocs,
    tempsFc90: somme(p.tempsFc90, q.tempsFc90),
    reserve: p.reserve ?? q.reserve,
    rpe: p.rpe ?? q.rpe,
    sensations: p.sensations ?? q.sensations,
    notes: [p.notes, q.notes].filter(Boolean).join(' · ') || undefined,
    prevueId: p.prevueId ?? q.prevueId,
    parties: (p.parties ?? 1) + (q.parties ?? 1),
    autresIds: [...new Set([...(p.autresIds ?? []), ...(q.autresIds ?? []), ...(q.idExterne ? [q.idExterne] : [])])].filter((id) => id !== p.idExterne),
  }
}

/** Regroupe les activités enchaînées déjà enregistrées. Renvoie le nombre de regroupements. */
export async function regrouperEnchainements() {
  const c = await chargerContexte()
  let n = 0
  for (;;) {
    const toutes = (await db.seances.toArray()).filter((s) => s.debut).sort((x, y) => x.debut!.localeCompare(y.debut!))
    let paire: [Seance, Seance] | undefined
    for (let i = 0; i < toutes.length && !paire; i++)
      for (let j = i + 1; j < toutes.length && toutes[j].date === toutes[i].date; j++)
        if (sontEnchainees(toutes[i], toutes[j])) { paire = [toutes[i], toutes[j]]; break }
    if (!paire) return n
    const [a, b] = paire
    const fusion = completerMetriques(fusionnerEnchainement(a, b), c)
    const retiree = fusion.id === a.id ? b : a
    await enregistrer(db.seances, fusion)
    await supprimer(db.seances, retiree.id)
    // La séance prévue rattachée à l'activité retirée (si différente) redevient à faire
    if (retiree.prevueId && retiree.prevueId !== fusion.prevueId) {
      const p = await db.prevues.get(retiree.prevueId)
      if (p?.statut === 'faite') await enregistrer(db.prevues, { ...p, statut: 'prevue' })
    }
    n++
  }
}
