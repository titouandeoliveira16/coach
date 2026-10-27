import { useLiveQuery } from 'dexie-react-hooks'
import { decalerJour } from '../../core/dates'
import { db } from '../../core/db'
import { useReglage } from '../../core/reglages'
import { enregistrer, supprimer } from '../../core/stockage'
import { NOTIONS_DEPART, PARAMETRES_DEFAUT, niveauDe, serieDeRappels, type Parametres } from './programme'
import type { Notion, Rappel, Resultat, SeanceMemoire, Sujet } from './types'

/** Toutes les données du module, tenues à jour (undefined pendant le chargement). */
export function useRevision() {
  return useLiveQuery(async () => ({
    notions: (await db.notions.toArray()).sort((a, b) => a.ordre - b.ordre),
    rappels: await db.revisions.toArray(),
    sujets: (await db.sujets.toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    memoire: await db.memoire.toArray(),
  }))
}
export type DonneesRevision = NonNullable<ReturnType<typeof useRevision>>

/** Paramètres (dates, capacités, créneaux) : réglage synchronisé « revision ». */
export const useParametres = () => useReglage<Parametres>('revision', PARAMETRES_DEFAUT)

/** Premier lancement : les 41 notions, « Sport scolaire » en cours. */
export async function installerNotions() {
  if (await db.notions.count()) return
  for (const [i, [nom, epreuve, theme]] of NOTIONS_DEPART.entries())
    await enregistrer(db.notions, { id: `n${String(i + 1).padStart(2, '0')}`, nom, epreuve, theme, ordre: i + 1, statut: i === 0 ? 'en-cours' : 'a-faire' })
}

const lireParametres = async (): Promise<Parametres> =>
  ({ ...PARAMETRES_DEFAUT, ...((await db.reglages.get('revision'))?.valeur as Partial<Parametres> | undefined) })

const nouvelleSerie = async (notionId: string, depart: string) => {
  const p = await lireParametres()
  for (const r of serieDeRappels(notionId, depart, p, (i) => `${notionId}|${depart}|${i}`)) await enregistrer(db.revisions, r)
}

/** Notion finie : J0 = ce jour, 6 rappels créés, la suivante passe « en cours ». */
export async function finirNotion(n: Notion, jour: string) {
  await enregistrer(db.notions, { ...n, statut: 'finie', j0: jour, niveau: n.niveau ?? 2 })
  await nouvelleSerie(n.id, jour)
  const toutes = await db.notions.toArray()
  if (toutes.some((x) => x.statut === 'en-cours' && x.id !== n.id)) return
  const suivante = toutes.filter((x) => x.statut === 'a-faire').sort((a, b) => a.ordre - b.ordre)[0]
  if (suivante) await enregistrer(db.notions, { ...suivante, statut: 'en-cours' })
}

/** Choisir la notion à apprendre maintenant (l'éventuelle notion en cours repasse « à faire »). */
export async function commencerNotion(n: Notion) {
  for (const x of await db.notions.toArray()) if (x.statut === 'en-cours' && x.id !== n.id) await enregistrer(db.notions, { ...x, statut: 'a-faire' })
  await enregistrer(db.notions, { ...n, statut: 'en-cours' })
}

/** Annule « finie » (erreur de toucher) : rappels non faits supprimés, la notion redevient « en cours ». */
export async function annulerFinie(n: Notion) {
  for (const r of await db.revisions.where('notionId').equals(n.id).toArray()) if (!r.fait) await supprimer(db.revisions, r.id)
  for (const x of await db.notions.toArray()) if (x.statut === 'en-cours') await enregistrer(db.notions, { ...x, statut: 'a-faire' })
  const { j0: _j0, ...reste } = n
  await enregistrer(db.notions, { ...reste, statut: 'en-cours' })
}

export const modifierNotion = (n: Notion) => enregistrer(db.notions, n)

/**
 * Résultat d'un rappel :
 * su → la série continue · hésitant → un rappel de plus le lendemain · raté → la notion repart de zéro (J+1, J+4… à partir d'aujourd'hui).
 */
export async function noterRappel(r: Rappel, resultat: Resultat, jour: string) {
  await enregistrer(db.revisions, { ...r, fait: jour, resultat })
  const n = await db.notions.get(r.notionId)
  if (n) await enregistrer(db.notions, { ...n, niveau: niveauDe(resultat) })
  if (resultat === 'hesitant')
    await enregistrer(db.revisions, { id: `${r.notionId}|${jour}|hesitant`, notionId: r.notionId, intervalle: 1, prevu: decalerJour(jour, 1), cible: 'hesitant' })
  if (resultat === 'rate') {
    for (const x of await db.revisions.where('notionId').equals(r.notionId).toArray())
      if (!x.fait && !x.annule && x.id !== r.id) await enregistrer(db.revisions, { ...x, annule: true })
    await nouvelleSerie(r.notionId, jour)
  }
}

/** Revenir sur un rappel noté (erreur de toucher) : il redevient à faire. Les rappels créés par ce résultat restent. */
export async function annulerRappel(r: Rappel) {
  const { fait: _f, resultat: _r, ...reste } = r
  await enregistrer(db.revisions, reste)
}

/** Sujet : enregistré, et chaque notion faible reçoit un rappel ciblé le lendemain. */
export async function enregistrerSujet(s: Sujet) {
  await enregistrer(db.sujets, s)
  for (const id of s.notionsFaibles)
    await enregistrer(db.revisions, { id: `${s.id}|${id}`, notionId: id, intervalle: 1, prevu: decalerJour(s.date, 1), cible: 'sujet' })
}
export const supprimerSujet = (id: string) => supprimer(db.sujets, id)

export const enregistrerMemoire = (m: SeanceMemoire) => enregistrer(db.memoire, m)
