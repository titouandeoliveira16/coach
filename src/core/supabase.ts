import { createClient } from '@supabase/supabase-js'

/**
 * Connexion au serveur Supabase (comptes + sauvegarde en ligne).
 * La clé « publishable » est publique par nature : la sécurité repose
 * sur les règles RLS du serveur (chacun n'accède qu'à ses propres lignes).
 */
const URL_SUPABASE = 'https://vjjuopkiwfyqjolxmnho.supabase.co'
const CLE_PUBLIQUE = 'sb_publishable_zzV0_gZT3t34Fzd22Un4VQ_g2ppfM-c'

export const supabase = createClient(URL_SUPABASE, CLE_PUBLIQUE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Connexion par code à 6 chiffres, pas par lien : rien à lire dans l'adresse
    detectSessionInUrl: false,
  },
})
