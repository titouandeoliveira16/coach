-- Étape 8 : connexion Strava + suppression des données
-- À coller dans Supabase → SQL Editor → New query → Run (une seule fois).

-- Jetons Strava (chiffrés par la fonction serveur). Aucune règle RLS :
-- l'appli ne peut NI les lire NI les écrire, seule la fonction serveur y accède.
create table public.strava_jetons (
  user_id         uuid primary key references auth.users on delete cascade,
  athlete_id      bigint,
  access_chiffre  text not null,
  refresh_chiffre text not null,
  expire_le       bigint not null,          -- secondes depuis 1970 (format Strava)
  maj_le          timestamptz not null default now()
);
alter table public.strava_jetons enable row level security;

-- Jetons d'état OAuth temporaires (anti-usurpation pendant la connexion)
create table public.strava_etats (
  etat     text primary key,
  user_id  uuid not null references auth.users on delete cascade,
  cree_le  timestamptz not null default now()
);
alter table public.strava_etats enable row level security;

revoke all on public.strava_jetons, public.strava_etats from anon, authenticated;

-- Bouton « Supprimer toutes mes données » (Réglages)
create policy "supprimer mes donnees" on public.donnees for delete
  using ((select auth.uid()) = user_id);
grant delete on public.donnees to authenticated;
