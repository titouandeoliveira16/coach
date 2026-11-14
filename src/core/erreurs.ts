import { supabase } from './supabase'

/**
 * Erreurs de l'appli (11/11/2026) : envoyées sur le serveur (table « erreurs », sql/07) pour que le coach soit prévenu
 * par notification, quel que soit le compte. Contenu limité au message technique, à l'écran et à la version : jamais
 * de données saisies. Au plus 10 par lancement, une seule fois chacune.
 */
const dejaSignalees = new Set<string>()
let compte = 0

export function signalerErreur(e: unknown, contexte?: string) {
  try {
    const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : `Erreur sans message (${typeof e})`)
    // Coupures réseau : normales hors ligne, pas des bugs
    if (/fetch|network|réseau|Load failed/i.test(err.message) && !navigator.onLine) return
    const message = `${contexte ? `${contexte} : ` : ''}${err.message}`.slice(0, 500)
    if (dejaSignalees.has(message) || compte >= 10) return
    dejaSignalees.add(message)
    compte++
    console.error(message, err)
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      return supabase.from('erreurs').insert({
        message,
        pile: err.stack?.slice(0, 2000) ?? null,
        page: location.hash.replace(/^#/, '').split('?')[0].slice(0, 80) || '/',
        version: __VERSION__.slice(0, 20),
      })
    }).catch(() => {})
  } catch {
    /* le signalement ne doit jamais casser l'appli */
  }
}

/** À appeler une fois au démarrage : erreurs non attrapées. */
export function surveillerErreurs() {
  window.addEventListener('error', (ev) => signalerErreur(ev.error ?? ev.message, 'Erreur'))
  window.addEventListener('unhandledrejection', (ev) => signalerErreur(ev.reason, 'Promesse'))
}

export interface ErreurServeur { id: number; user_id: string; le: string; version: string | null; page: string | null; message: string; vue: boolean }

/** Coach : dernières erreurs (tous comptes). Refusé par le serveur pour les autres comptes. */
export async function dernieresErreurs() {
  const { data, error } = await supabase.from('erreurs').select('id, user_id, le, version, page, message, vue').order('le', { ascending: false }).limit(40)
  if (error) throw error
  return data as ErreurServeur[]
}

export async function marquerErreursVues() {
  await supabase.from('erreurs').update({ vue: true }).eq('vue', false)
}
