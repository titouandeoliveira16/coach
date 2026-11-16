import { db } from '../../../core/db'
import { depuisJour } from '../../../core/dates'
import type { Etape } from '../../../metrics/programme'
import type { SeancePrevue } from '../types'
import { dureeIgpsport, versIgpsport } from './igpsportSeances'
import { enregistrer } from '../../../core/stockage'
import { CLE_PUBLIQUE, URL_SUPABASE, supabase } from '../../../core/supabase'
import { importerIntervals, reimporterHistorique } from './intervals'

/**
 * Compteur iGPSPORT (16/11/2026) : la fonction serveur « igpsport » récupère tes sorties et les envoie dans ton
 * Intervals.icu, toutes les 15 minutes ; Cycle les importe ensuite comme les autres.
 */
export interface EtatIgpsport { relie: boolean; identifiant?: string; derniereSynchro?: string; importees?: number; reste?: number; erreur?: string | null }

async function appeler<T>(route: string, corps?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Connecte-toi d’abord à ton compte (Accueil → ⚙️).')
  const r = await fetch(`${URL_SUPABASE}/functions/v1/igpsport/${route}`, {
    ...(typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(90_000) } : {}),
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps ?? {}),
  }).catch(() => { throw new Error('Pas de connexion internet.') })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction « igpsport » n’est pas encore installée sur le serveur.')
  if (!r.ok) throw new Error(json.erreur ?? `Erreur ${r.status}`)
  return json as T
}

/** Une seule fois par appareil (comptes reliés avant la 14.4) : on demande au serveur si le compteur est relié. */
export async function verifierRelie() {
  if ((await lireEnvoi()).relie === undefined) await etatIgpsport().catch(() => {})
  if ((await lireEnvoi()).relie) await completerWattsIgpsport().catch(() => {})
}

/**
 * Une seule fois (16/11/2026) : séances vélo sans watts dont la même sortie existe sur le compteur iGPSPORT (Intervals
 * avait gardé la version de la montre) : on lit le .fit du compteur et on complète la séance (watts, kJ, et le reste
 * s'il manque). Rien n'est touché si le fichier du compteur n'a pas de watts non plus.
 */
export async function completerWattsIgpsport() {
  if ((await db.reglages.get('igpsport-watts'))?.valeur) return 0
  const { faits } = await appeler<{ faits: { rideId: number; intervalsId: string | null }[] }>('faits')
  const { chargerContexte, fusionner } = await import('../seances/donnees')
  const { importerFit } = await import('./fit')
  const c = await chargerContexte()
  const seances = await db.seances.toArray()
  let n = 0
  for (const f of faits) {
    if (!f.intervalsId || !f.intervalsId.startsWith('i')) continue
    const s = seances.find((x) => x.sport === 'velo' && !x.kj && (x.idExterne === f.intervalsId || x.autresIds?.includes(f.intervalsId!)))
    if (!s) continue
    try {
      const { fit } = await appeler<{ fit: string }>('fit', { rideId: f.rideId })
      const octets = Uint8Array.from(atob(fit), (ch) => ch.charCodeAt(0))
      const lue = await importerFit(new File([octets], `igpsport_${f.rideId}.fit`), c)
      if (!lue.kj) continue
      await enregistrer(db.seances, fusionner({ ...lue, id: s.id, idExterne: s.idExterne, autresIds: s.autresIds, prevueId: s.prevueId, titre: s.titre, date: s.date, rpe: s.rpe }, s))
      n++
    } catch { /* sortie suivante */ }
  }
  await enregistrer(db.reglages, { id: 'igpsport-watts', valeur: { le: new Date().toISOString(), completees: n } })
  return n
}

export async function etatIgpsport() {
  const e = await appeler<EtatIgpsport>('etat')
  if (e.relie !== (await lireEnvoi()).relie) await ecrireEnvoi({ relie: e.relie })
  return e
}
export const delierIgpsport = async () => { await appeler('delier'); await ecrireEnvoi({ relie: false }) }

/** Une fois l'historique iGPSPORT entièrement envoyé : réimport des 90 derniers jours et des kJ sur 6 mois. */
async function apresEnvoi(r: { envoyees?: number; reste?: number }) {
  if (r.envoyees) await importerIntervals().catch(() => {})
  const fait = (await db.reglages.get('igpsport-historique'))?.valeur
  if (!fait && r.reste === 0) {
    await reimporterHistorique().catch(() => {})
    await enregistrer(db.reglages, { id: 'igpsport-historique', valeur: { le: new Date().toISOString() } })
  }
}

/** Compteur relié (pour montrer le bouton d'envoi) et séances déjà envoyées (id → date). */
export interface EnvoiIgpsport { relie?: boolean; envois?: Record<string, string>; signatures?: Record<string, string> }
const lireEnvoi = async () => ((await db.reglages.get('igpsport-envoi'))?.valeur as EnvoiIgpsport | undefined) ?? {}
const ecrireEnvoi = async (e: EnvoiIgpsport) => enregistrer(db.reglages, { id: 'igpsport-envoi', valeur: { ...(await lireEnvoi()), ...e } })

const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] as const
const NOMS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/**
 * « Envoyer à mon compteur » (16/11/2026, à la demande seulement) : la séance part dans les entraînements de l'appli
 * iGPSPORT, nommée par son jour (« Mar 17/11 · … ») ; un emplacement par jour de la semaine, réécrit d'une semaine à
 * l'autre pour ne pas remplir ta liste.
 */
export async function envoyerSeanceIgpsport(p: SeancePrevue, etapes: Etape[]) {
  const d = depuisJour(p.date)
  const titre = `${NOMS[d.getDay()]} ${p.date.slice(8, 10)}/${p.date.slice(5, 7)} · ${p.titre}`.slice(0, 64)
  const structure = versIgpsport(etapes)
  if (!structure.length) throw new Error('Séance sans étapes : rien à envoyer.')
  const r = await appeler<{ envoyees: number }>('seances', {
    seances: [{ jour: JOURS[d.getDay()], titre, description: (p.detail ?? '').slice(0, 500), structure, totalTime: dureeIgpsport(structure) }],
  })
  if (!r.envoyees) throw new Error('iGPSPORT n’a pas accepté la séance.')
  const avant = await lireEnvoi()
  await ecrireEnvoi({ envois: { ...avant.envois, [p.id]: new Date().toISOString() }, signatures: { ...avant.signatures, [p.id]: JSON.stringify([titre, etapes]) } })
}

/** Séances déjà envoyées au compteur puis recalculées : la nouvelle version remplace l'ancienne (16/11/2026). */
export async function mettreAJourEnvoisIgpsport() {
  const e = await lireEnvoi()
  if (!e.relie || !e.envois) return
  const jour = new Date().toLocaleDateString('sv-SE')
  for (const prevueId of Object.keys(e.envois)) {
    const p = await db.prevues.get(prevueId)
    const etapes = p?.velo?.etapes
    if (!p || !etapes?.length || p.statut !== 'prevue' || p.date < jour) continue
    const d = depuisJour(p.date)
    const titre = `${NOMS[d.getDay()]} ${p.date.slice(8, 10)}/${p.date.slice(5, 7)} · ${p.titre}`.slice(0, 64)
    if (e.signatures?.[prevueId] === JSON.stringify([titre, etapes])) continue
    await envoyerSeanceIgpsport(p, etapes).catch(() => {})
  }
}

export async function relierIgpsport(identifiant: string, motDePasse: string) {
  const r = await appeler<{ envoyees: number; reste: number; erreur?: string }>('relier', { identifiant, motDePasse })
  await ecrireEnvoi({ relie: true })
  await apresEnvoi(r)
  return r
}

export async function synchroIgpsport() {
  const r = await appeler<{ envoyees: number; reste: number; erreur?: string }>('synchro')
  await apresEnvoi(r)
  return r
}
