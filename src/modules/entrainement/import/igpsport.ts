import { db } from '../../../core/db'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
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

export const etatIgpsport = () => appeler<EtatIgpsport>('etat')
export const delierIgpsport = async () => { await appeler('delier'); await ecrireEnvoi({ actif: false, signatures: {} }) }

/** Une fois l'historique iGPSPORT entièrement envoyé : réimport des 90 derniers jours et des kJ sur 6 mois. */
async function apresEnvoi(r: { envoyees?: number; reste?: number }) {
  if (r.envoyees) await importerIntervals().catch(() => {})
  const fait = (await db.reglages.get('igpsport-historique'))?.valeur
  if (!fait && r.reste === 0) {
    await reimporterHistorique().catch(() => {})
    await enregistrer(db.reglages, { id: 'igpsport-historique', valeur: { le: new Date().toISOString() } })
  }
}

/** Envoi des séances sur le compteur : actif (par défaut une fois relié) et ce qui a déjà été envoyé, par jour. */
export interface EnvoiIgpsport { actif?: boolean; signatures?: Record<string, string>; dernier?: string; erreur?: string }
const lireEnvoi = async () => ((await db.reglages.get('igpsport-envoi'))?.valeur as EnvoiIgpsport | undefined) ?? {}
export const ecrireEnvoi = async (e: EnvoiIgpsport) => enregistrer(db.reglages, { id: 'igpsport-envoi', valeur: { ...(await lireEnvoi()), ...e } })

const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] as const
const NOMS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/**
 * Séances vélo des 7 prochains jours envoyées sur le compteur iGPSPORT (16/11/2026) : seulement celles qui ont changé
 * depuis le dernier envoi (recalcul, feu orange, changement de jour). Un emplacement par jour de la semaine.
 */
export async function envoyerSeancesIgpsport(forcer = false) {
  const envoi = await lireEnvoi()
  if (!envoi.actif) return
  const jour = aujourdhui()
  const prevues = (await db.prevues.where('date').between(jour, decalerJour(jour, 6), true, true).toArray())
    .filter((p) => p.sport === 'velo' && p.statut === 'prevue' && p.velo?.etapes?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const signatures = { ...(forcer ? {} : envoi.signatures) }
  const seances: { jour: string; titre: string; description: string; structure: ReturnType<typeof versIgpsport>; totalTime: number; signature: string }[] = []
  for (const p of prevues) {
    const d = depuisJour(p.date)
    const cle = JOURS[d.getDay()]
    if (seances.some((x) => x.jour === cle)) continue // une seule séance par jour (la première)
    const titre = `${NOMS[d.getDay()]} ${p.date.slice(8, 10)}/${p.date.slice(5, 7)} · ${p.titre}`.slice(0, 64)
    const structure = versIgpsport(p.velo!.etapes!)
    const signature = JSON.stringify([titre, p.velo!.etapes])
    if (signatures[cle] === signature) continue
    seances.push({ jour: cle, titre, description: (p.detail ?? '').slice(0, 500), structure, totalTime: dureeIgpsport(structure), signature })
  }
  if (!seances.length) return
  try {
    await appeler('seances', { seances: seances.map(({ signature: _s, ...x }) => x) })
    for (const x of seances) signatures[x.jour] = x.signature
    await ecrireEnvoi({ signatures, dernier: new Date().toISOString(), erreur: undefined })
  } catch (e) {
    await ecrireEnvoi({ erreur: (e as Error).message })
  }
}

export async function relierIgpsport(identifiant: string, motDePasse: string) {
  const r = await appeler<{ envoyees: number; reste: number; erreur?: string }>('relier', { identifiant, motDePasse })
  await ecrireEnvoi({ actif: true, signatures: {} })
  await envoyerSeancesIgpsport().catch(() => {})
  await apresEnvoi(r)
  return r
}

export async function synchroIgpsport() {
  const r = await appeler<{ envoyees: number; reste: number; erreur?: string }>('synchro')
  await apresEnvoi(r)
  return r
}
