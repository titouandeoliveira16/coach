-- 09 (16/11/2026) : sorties du compteur iGPSPORT envoyées automatiquement dans Intervals.icu (fonction « igpsport »).
-- Rejouable sans risque.

-- 1. Compte iGPSPORT relié (mot de passe chiffré par la fonction ; lisible seulement par le serveur)
create table if not exists public.igpsport_comptes (
  user_id           uuid primary key references auth.users on delete cascade,
  identifiant       text not null,
  mdp_chiffre       text not null,
  relie_le          timestamptz not null default now(),
  derniere_synchro  timestamptz,
  importees         int not null default 0,
  reste             int not null default 0,
  erreur            text
);
-- Séances envoyées sur le compteur : un emplacement par jour de la semaine (identifiants iGPSPORT)
alter table public.igpsport_comptes add column if not exists seances_ids jsonb not null default '{}'::jsonb;
alter table public.igpsport_comptes enable row level security;
revoke all on public.igpsport_comptes from anon, authenticated;
grant select, insert, update, delete on public.igpsport_comptes to service_role;

-- 2. Sorties déjà envoyées (jamais deux fois la même)
create table if not exists public.igpsport_faits (
  user_id       uuid not null references auth.users on delete cascade,
  ride_id       bigint not null,
  intervals_id  text,
  le            timestamptz not null default now(),
  primary key (user_id, ride_id)
);
alter table public.igpsport_faits enable row level security;
revoke all on public.igpsport_faits from anon, authenticated;
grant select, insert, update, delete on public.igpsport_faits to service_role;

-- 3. Toutes les 15 minutes (décalé de 7 min par rapport aux rappels), avec le secret partagé de sql/06
select cron.unschedule('coach-igpsport') where exists (select 1 from cron.job where jobname = 'coach-igpsport');
select cron.schedule(
  'coach-igpsport',
  '7,22,37,52 * * * *',
  $$ select net.http_post(
       url := 'https://vjjuopkiwfyqjolxmnho.supabase.co/functions/v1/igpsport/cron',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-coach-cron', (select valeur from public.secret_cron where id = 1)),
       body := '{}'::jsonb,
       timeout_milliseconds := 120000
     ) $$
);
