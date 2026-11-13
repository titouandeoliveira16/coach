import { db } from '../../../core/db'
import { enregistrer, supprimer } from '../../../core/stockage'
import type { Seance } from '../types'
import { chargerContexte, completerMetriques, domaineDe, estRealiseDifferent } from './donnees'

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

/**
 * Deux activités qui se suivent (13/11/2026, demande de Titouan) : l'appli ne les met plus bout à bout toute seule, elle
 * te le demande (carte sur Aujourd'hui). Paires refusées gardées dans le réglage « enchainements-refuses ».
 */
export const clePaire = (a: Seance, b: Seance) => [a.id, b.id].sort().join('|')

/** Première paire d'activités enchaînées (14 derniers jours) pas encore refusée. */
export async function paireAConfirmer(depuis: string, refusees: string[] = []): Promise<[Seance, Seance] | undefined> {
  const toutes = (await db.seances.where('date').aboveOrEqual(depuis).toArray()).filter((s) => s.debut).sort((x, y) => x.debut!.localeCompare(y.debut!))
  for (let i = 0; i < toutes.length; i++)
    for (let j = i + 1; j < toutes.length && toutes[j].date === toutes[i].date; j++)
      if (sontEnchainees(toutes[i], toutes[j]) && !refusees.includes(clePaire(toutes[i], toutes[j]))) return [toutes[i], toutes[j]]
  return undefined
}

/** Met deux activités bout à bout : une seule séance ; la séance prévue est rejugée sur l'ensemble. */
export async function fusionnerPaire(a: Seance, b: Seance) {
  const c = await chargerContexte()
  const fusion = completerMetriques(fusionnerEnchainement(a, b), c)
  const retiree = fusion.id === a.id ? b : a
  // La séance prévue rattachée à l'activité retirée (si différente) redevient à faire
  if (retiree.prevueId && retiree.prevueId !== fusion.prevueId) {
    const p = await db.prevues.get(retiree.prevueId)
    if (p?.statut === 'faite') await enregistrer(db.prevues, { ...p, statut: 'prevue' })
  }
  // Une partie seule pouvait sembler « différente du prévu » (trop courte) : l'ensemble est rejugé
  const prevue = fusion.prevueId ? await db.prevues.get(fusion.prevueId) : undefined
  if (prevue?.realiseDifferent && !estRealiseDifferent(prevue, fusion, domaineDe(fusion, c.bornes))) {
    await enregistrer(db.prevues, { ...prevue, realiseDifferent: false, titreRealise: undefined })
    fusion.titre = prevue.titre
  }
  await enregistrer(db.seances, fusion)
  await supprimer(db.seances, retiree.id)
  return fusion
}

/** Regroupe toutes les activités enchaînées (sans demander). Renvoie le nombre de regroupements. */
export async function regrouperEnchainements() {
  let n = 0
  for (;;) {
    const paire = await paireAConfirmer('0000-00-00')
    if (!paire) return n
    await fusionnerPaire(...paire)
    n++
  }
}
