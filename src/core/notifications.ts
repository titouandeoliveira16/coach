import { CLE_PUBLIQUE, URL_SUPABASE, supabase } from './supabase'

/**
 * Rappels par notification (Web Push), envoyés par la fonction serveur « rappels ».
 * Sur iPhone : seulement dans l'appli installée sur l'écran d'accueil (iOS 16.4 ou plus).
 */

/** Rappels de Titouan : chaque matin à 8 h 30, pesée le mardi, et samedi 24/10 exceptionnellement. */
export const RAPPELS = { heure: '08:30', peseeJours: [2], peseeDates: ['2026-10-24'] }

export const notificationsPossibles = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function appeler<T>(route: string, corps?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Connecte-toi d’abord à ton compte (en haut de Réglages).')
  const r = await fetch(`${URL_SUPABASE}/functions/v1/rappels/${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps ?? {}),
  }).catch(() => {
    throw new Error('Pas de connexion internet (ou fonction « rappels » pas encore installée sur Supabase).')
  })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction « rappels » n’est pas encore installée sur Supabase.')
  if (!r.ok) throw new Error(json.erreur ?? json.message ?? `Erreur ${r.status}`)
  return json as T
}

const versOctets = (b64url: string) => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** Abonnement de cet appareil (s'il existe). */
export async function abonnementActuel() {
  if (!notificationsPossibles()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Demande l'autorisation, abonne cet appareil et l'enregistre sur le serveur (à appeler depuis un bouton). */
export async function activerRappels() {
  if (!notificationsPossibles()) throw new Error("Notifications indisponibles ici. Sur iPhone : ouvre l'appli depuis l'écran d'accueil (iOS 16.4 ou plus).")
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications refusées. Réglages de l’iPhone → Notifications → Coach → Autoriser.')
  const { cle } = await appeler<{ cle: string }>('cle')
  const reg = await navigator.serviceWorker.ready
  const abonnement = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(cle) }))
  await appeler('abonner', { abonnement: abonnement.toJSON(), fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone, ...RAPPELS })
}

export async function desactiverRappels() {
  const abonnement = await abonnementActuel()
  if (!abonnement) return
  await appeler('desabonner', { endpoint: abonnement.endpoint }).catch(() => {})
  await abonnement.unsubscribe()
}

export const testerRappels = () => appeler<{ envoyes: number }>('tester')
