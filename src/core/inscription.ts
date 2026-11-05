import { db } from './db'
import { enregistrer } from './stockage'
import { CLE_PUBLIQUE, URL_SUPABASE, supabase } from './supabase'
import { seConnecter } from './synchro'

/** Réglage « compte » : un compte créé avec un code n'a que l'Entraînement à l'accueil (Budget et CAPEPS sont à Titouan). */
export interface ReglageCompte {
  invite?: boolean
}

async function appeler<T>(route: string, corps: unknown, avecSession = false): Promise<T> {
  const entetes: Record<string, string> = { apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' }
  if (avecSession) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Connecte-toi d’abord.')
    entetes.Authorization = `Bearer ${data.session.access_token}`
  }
  const r = await fetch(`${URL_SUPABASE}/functions/v1/inscription/${route}`, { method: 'POST', headers: entetes, body: JSON.stringify(corps) })
    .catch(() => { throw new Error('Pas de connexion internet.') })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction « inscription » n’est pas encore installée sur Supabase.')
  if (!r.ok) throw new Error(json.erreur ?? json.message ?? `Erreur ${r.status}`)
  return json as T
}

/** Crée le compte avec le code reçu, connecte, puis note que c'est un compte invité. */
export async function creerCompteAvecCode(code: string, email: string, motDePasse: string) {
  await appeler('creer', { code, email, motDePasse })
  await seConnecter(email, motDePasse)
  await enregistrer(db.reglages, { id: 'compte', valeur: { invite: true } satisfies ReglageCompte })
}

export interface CodeInvitation { code: string; pour: string | null; cree_le: string; utilise_le: string | null }
export const nouveauCode = (pour?: string) => appeler<{ code: string }>('nouveau-code', { pour }, true)
export const mesCodes = () => appeler<{ codes: CodeInvitation[] }>('mes-codes', {}, true)
