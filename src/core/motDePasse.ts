import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

/**
 * Mot de passe oublié (12/11/2026) : Supabase envoie un e-mail avec un lien. Ce lien rouvre l'appli avec, dans
 * l'adresse, de quoi ouvrir la session (#access_token=…&type=recovery) ; l'appli choisit alors un nouveau mot de passe.
 * Le lien peut s'ouvrir dans Safari (autre mémoire que l'appli de l'écran d'accueil) : on y change le mot de passe,
 * puis on se reconnecte dans l'appli avec le nouveau.
 */
let enRecuperation = false
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

export function useRecuperation() {
  return useSyncExternalStore((f) => (abonnes.add(f), () => abonnes.delete(f)), () => enRecuperation)
}

/** À appeler avant le routeur : lit le retour du lien de l'e-mail et nettoie l'adresse. */
export function lireRetourRecuperation() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash.includes('type=recovery') && !hash.includes('error_description')) return
  const p = new URLSearchParams(hash)
  history.replaceState(null, '', `${window.location.pathname}#/`)
  const access = p.get('access_token'), refresh = p.get('refresh_token')
  if (!access || !refresh) {
    alert(`Le lien n'est plus valable (${p.get('error_description') ?? 'expiré'}). Redemande un e-mail depuis l'écran de connexion.`)
    return
  }
  enRecuperation = true
  prevenir()
  supabase.auth.setSession({ access_token: access, refresh_token: refresh }).catch(() => {
    enRecuperation = false
    prevenir()
  })
}

export async function envoyerLienMotDePasse(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}` })
  if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Trop de demandes : attends quelques minutes avant de redemander un e-mail.' : error.message)
}

/**
 * Avec le code à 6 chiffres de l'e-mail (pas de lien : marche même si la boîte mail a « vérifié » le lien avant toi,
 * et sans passer par Safari). Ouvre la session puis enregistre le nouveau mot de passe.
 */
export async function changerAvecCode(email: string, code: string, motDePasse: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\D/g, ''), type: 'recovery' })
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'Code faux ou expiré : redemande un e-mail et prends le code du plus récent.' : error.message)
  await changerMotDePasse(motDePasse)
}

export async function changerMotDePasse(motDePasse: string) {
  const { error } = await supabase.auth.updateUser({ password: motDePasse })
  if (error) throw new Error(/same|different/i.test(error.message) ? 'Choisis un mot de passe différent de l’ancien.' : error.message)
  enRecuperation = false
  prevenir()
}
