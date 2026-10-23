-- Rappels (notifications de l'appli)
-- À coller dans Supabase → SQL Editor → New query → Run (une seule fois),
-- APRÈS avoir déployé la fonction « rappels ».

-- Clés VAPID (créées par la fonction elle-même) : seule la fonction serveur y accède
create table if not exists public.push_config (
  id           int primary key default 1,
  cle_publique text not null,
  cle_privee   text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
grant select, insert, update, delete on public.push_config to service_role;

-- Un abonnement par appareil
create table if not exists public.push_abonnements (
  endpoint        text primary key,
  user_id         uuid not null references auth.users on delete cascade,
  abonnement      jsonb not null,
  fuseau          text not null default 'Europe/Paris',
  heure           text not null default '08:30',
  pesee_jours     int[] not null default '{2}',
  pesee_dates     text[] not null default '{}',
  dernier_matin   text,
  derniere_pesee  text,
  cree_le         timestamptz not null default now()
);
alter table public.push_abonnements enable row level security;
revoke all on public.push_abonnements from anon, authenticated;
grant select, insert, update, delete on public.push_abonnements to service_role;

-- La fonction lit « donnees » pour ne pas rappeler ce qui est déjà fait
grant select on public.donnees to service_role;

-- Toutes les 15 minutes, la fonction envoie les rappels dus
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'coach-rappels',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://vjjuopkiwfyqjolxmnho.supabase.co/functions/v1/rappels/envoyer',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
