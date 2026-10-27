import { createClient } from '@supabase/supabase-js'

/**
 * Connexion au serveur Supabase (comptes + sauvegarde en ligne).
 * La clé « publishable » est publique par nature : la sécurité repose
 * sur les règles RLS du serveur (chacun n'accède qu'à ses propres lignes).
 */
export const URL_SUPABASE = 'https://vjjuopkiwfyqjolxmnho.supabase.co'
export const CLE_PUBLIQUE = 'sb_publishable_zzV0_gZT3t34Fzd22Un4VQ_g2ppfM-c'

export const supabase = createClient(URL_SUPABASE, CLE_PUBLIQUE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Connexion par mot de passe : rien à lire dans l'adresse de la page
    detectSessionInUrl: false,
  },
})
