-- Intervals.icu + suppression des données
-- À coller dans Supabase → SQL Editor → New query → Run (une seule fois).

-- Clé API Intervals.icu (chiffrée par la fonction serveur). Aucune règle d'accès :
-- l'appli ne peut ni la lire ni l'écrire, seule la fonction serveur y accède.
create table if not exists public.intervals_cles (
  user_id      uuid primary key references auth.users on delete cascade,
  athlete_id   text not null,
  cle_chiffre  text not null,
  maj_le       timestamptz not null default now()
);
alter table public.intervals_cles enable row level security;
revoke all on public.intervals_cles from anon, authenticated;
-- Le projet n'expose pas automatiquement les nouvelles tables : droit explicite pour la fonction serveur
grant select, insert, update, delete on public.intervals_cles to service_role;

-- Bouton « Supprimer toutes mes données » (Réglages)
drop policy if exists "supprimer mes donnees" on public.donnees;
create policy "supprimer mes donnees" on public.donnees for delete
  using ((select auth.uid()) = user_id);
grant delete on public.donnees to authenticated;
