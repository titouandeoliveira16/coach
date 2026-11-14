import { createClient } from '@supabase/supabase-js'

/**
 * Connexion au serveur Supabase (comptes + sauvegarde en ligne).
 * La clé « publishable » est publique par nature : la sécurité repose
 * sur les règles RLS du serveur (chacun n'accède qu'à ses propres lignes).
 */
export const URL_SUPABASE = 'https://vjjuopkiwfyqjolxmnho.supabase.co'
export const CLE_PUBLIQUE = 'sb_publishable_zzV0_gZT3t34Fzd22Un4VQ_g2ppfM-c'

/** Appels réseau avec un délai maximum (audit du 14/11/2026) : une réponse qui ne vient jamais ne bloque plus la synchro. */
const fetchAvecDelai: typeof fetch = (entree, init) => {
  // Anciens iPhone (AbortSignal.timeout / any absents) : appel normal
  if (typeof AbortSignal.timeout !== 'function') return fetch(entree, init)
  const delai = AbortSignal.timeout(30_000)
  if (init?.signal && typeof AbortSignal.any !== 'function') return fetch(entree, init)
  const signal = init?.signal ? AbortSignal.any([init.signal, delai]) : delai
  return fetch(entree, { ...init, signal })
}

export const supabase = createClient(URL_SUPABASE, CLE_PUBLIQUE, {
  global: { fetch: fetchAvecDelai },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Connexion par mot de passe : rien à lire dans l'adresse de la page
    detectSessionInUrl: false,
  },
})
