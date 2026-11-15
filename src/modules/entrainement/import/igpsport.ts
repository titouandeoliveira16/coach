import { db } from '../../../core/db'
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

export const etatIgpsport = () => appeler<EtatIgpsport>('etat')
export const delierIgpsport = () => appeler('delier')

/** Une fois l'historique iGPSPORT entièrement envoyé : réimport des 90 derniers jours et des kJ sur 6 mois. */
async function apresEnvoi(r: { envoyees?: number; reste?: number }) {
  if (r.envoyees) await importerIntervals().catch(() => {})
  const fait = (await db.reglages.get('igpsport-historique'))?.valeur
  if (!fait && r.reste === 0) {
    await reimporterHistorique().catch(() => {})
    await enregistrer(db.reglages, { id: 'igpsport-historique', valeur: { le: new Date().toISOString() } })
  }
}

export async function relierIgpsport(identifiant: string, motDePasse: string) {
  const r = await appeler<{ envoyees: number; reste: number; erreur?: string }>('relier', { identifiant, motDePasse })
  await apresEnvoi(r)
  return r
}

export async function synchroIgpsport() {
  const r = await appeler<{ envoyees: number; reste: number; erreur?: string }>('synchro')
  await apresEnvoi(r)
  return r
}
