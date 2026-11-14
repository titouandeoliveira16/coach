// Fonction serveur Supabase « inscription » (Deno).
// Les inscriptions libres sont fermées dans Supabase : un compte ne se crée qu'avec un code donné par le coach.
//
// Routes (POST) :
//   /inscription/creer        { code, email, motDePasse } → crée le compte si le code est valable et pas encore utilisé
//   /inscription/nouveau-code { pour? }                    → (coach connecté) crée un code à usage unique
//   /inscription/mes-codes                                 → (coach connecté) liste des codes, leur état et qui les a utilisés
//   /inscription/supprimer-code { code }                   → (coach connecté) retire un code de la liste
//   /inscription/supprimer-compte                          → (connecté) supprime le compte et TOUTES ses données (RGPD,
//                                                            art. 17) : données, clé Intervals, rappels effacés en cascade
//
// Aucun secret à ajouter : la fonction utilise la clé « service role » du projet.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Sans lettres ni chiffres qu'on confond (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function nouveauCode() {
  const o = crypto.getRandomValues(new Uint8Array(6))
  const c = [...o].map((x) => ALPHABET[x % ALPHABET.length]).join('')
  return `${c.slice(0, 3)}-${c.slice(3)}`
}
const normaliser = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{3})(.{3})$/, '$1-$2')

async function coachConnecte(req: Request) {
  const jeton = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
  if (!data.user) return undefined
  const { data: c } = await admin.from('coachs').select('user_id').eq('user_id', data.user.id).maybeSingle()
  return c ? data.user.id : undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()
  const corps = await req.json().catch(() => ({}))
  try {
    if (route === 'creer') {
      // Trop d'essais ratés depuis cette adresse (10 par heure) : on freine (audit du 14/11/2026, sql/08)
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue'
      const { count } = await admin.from('tentatives_inscription').select('id', { count: 'exact', head: true }).eq('ip', ip).gt('le', new Date(Date.now() - 3600_000).toISOString())
      if ((count ?? 0) >= 10) return json({ erreur: 'Trop d’essais : réessaie dans une heure.' }, 429)
      const rate = async (erreur: string) => {
        await admin.from('tentatives_inscription').insert({ ip })
        return json({ erreur }, 400)
      }
      const code = normaliser(String(corps.code ?? ''))
      const email = String(corps.email ?? '').trim().toLowerCase()
      const motDePasse = String(corps.motDePasse ?? '')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || motDePasse.length < 8) return json({ erreur: 'Email incorrect, ou mot de passe trop court (8 caractères min.).' }, 400)
      // Consentement explicite pour les données de santé (RGPD, art. 9) et âge (art. 8 : moins de 15 ans, accord d'un parent)
      if (corps.consentement !== true) return json({ erreur: 'Coche la case sur tes données de santé pour créer ton compte.' }, 400)
      const { data: ligne } = await admin.from('codes_invitation').select('code, utilise_par, cree_le').eq('code', code).maybeSingle()
      if (!ligne) return rate('Code inconnu : vérifie-le avec la personne qui te l’a donné.')
      if (ligne.utilise_par) return rate('Ce code a déjà servi : demande-en un nouveau.')
      // Un code vaut 30 jours (un code oublié dans une conversation ne reste pas valable des mois)
      if (Date.now() - Date.parse(ligne.cree_le) > 30 * 86_400_000) return rate('Ce code a expiré (30 jours) : demande-en un nouveau.')
      const { data: cree, error } = await admin.auth.admin.createUser({
        email, password: motDePasse, email_confirm: true,
        user_metadata: { consentement_sante_le: new Date().toISOString(), mentions_version: 1 },
      })
      if (error || !cree.user) {
        const deja = /already|registered|exists/i.test(error?.message ?? '')
        if (!deja) console.error('inscription : création refusée', error?.message)
        return json({ erreur: deja ? 'Un compte existe déjà avec cet email : utilise « Me connecter ».' : 'Compte non créé : réessaie, ou choisis un autre mot de passe.' }, 400)
      }
      // Le code ne sert qu'une fois (si deux personnes l'utilisent en même temps, la 2e est retirée)
      const { data: pris } = await admin.from('codes_invitation')
        .update({ utilise_par: cree.user.id, utilise_le: new Date().toISOString() })
        .eq('code', code).is('utilise_par', null).select('code')
      if (!pris?.length) {
        await admin.auth.admin.deleteUser(cree.user.id)
        return json({ erreur: 'Ce code a déjà servi : demande-en un nouveau.' }, 400)
      }
      return json({ ok: true })
    }

    // Supprimer son compte : ouvert à tous les comptes (avant, réservé au coach par erreur, 12/11/2026)
    if (route === 'supprimer-compte') {
      const jeton = req.headers.get('authorization')?.replace(/^Bearer /, '')
      const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
      if (!data.user) return json({ erreur: 'Connecte-toi d’abord.' }, 401)
      // Les tables liées au compte (donnees, intervals_cles, push_abonnements, coachs…) sont effacées en cascade
      const { error } = await admin.auth.admin.deleteUser(data.user.id)
      if (error) throw error
      return json({ ok: true })
    }
    const coach = await coachConnecte(req)
    if (!coach) return json({ erreur: 'Réservé au coach.' }, 403)
    if (route === 'nouveau-code') {
      for (let essai = 0; essai < 5; essai++) {
        const code = nouveauCode()
        const { error } = await admin.from('codes_invitation').insert({ code, cree_par: coach, pour: corps.pour ? String(corps.pour).slice(0, 40) : null })
        if (!error) return json({ code })
      }
      return json({ erreur: 'Code non créé, réessaie.' }, 500)
    }
    if (route === 'mes-codes') {
      const { data } = await admin.from('codes_invitation').select('code, pour, cree_le, utilise_le, utilise_par').eq('cree_par', coach).order('cree_le', { ascending: false }).limit(50)
      // Qui a utilisé chaque code (l'email du compte créé) : savoir qui a accès à l'appli
      const codes = await Promise.all((data ?? []).map(async ({ utilise_par, ...c }) => {
        if (!utilise_par) return { ...c, email: null }
        const { data: u } = await admin.auth.admin.getUserById(utilise_par)
        return { ...c, email: u.user?.email ?? '(compte supprimé)' }
      }))
      return json({ codes })
    }
    if (route === 'supprimer-code') {
      // Retire le code de la liste (le compte déjà créé avec ce code reste actif)
      const { error } = await admin.from('codes_invitation').delete().eq('code', normaliser(String(corps.code ?? ''))).eq('cree_par', coach)
      if (error) throw error
      return json({ ok: true })
    }
        return json({ erreur: 'Route inconnue.' }, 404)
  } catch (e) {
    // Détail dans les journaux du serveur, message simple pour l'appli (audit du 14/11/2026)
    console.error('inscription', route, (e as Error).message)
    return json({ erreur: 'Une erreur est survenue sur le serveur : réessaie dans un moment.' }, 500)
  }
})
