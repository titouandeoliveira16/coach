-- 06 (audit du 11/11/2026) : la route /rappels/envoyer n'accepte plus que la tâche planifiée.
-- Rejouable sans risque. À exécuter AVANT de redéployer la fonction « rappels ».

-- 1. Secret partagé entre pg_cron et la fonction (lisible seulement par le serveur)
create table if not exists public.secret_cron (
  id     int primary key default 1 check (id = 1),
  valeur text not null
);
alter table public.secret_cron enable row level security;
revoke all on public.secret_cron from anon, authenticated;
grant select on public.secret_cron to service_role;
insert into public.secret_cron (id, valeur)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- 2. Rappels déjà envoyés aujourd'hui, par type (un seul envoi par jour même si la fonction est appelée deux fois)
alter table public.push_abonnements add column if not exists envoyes jsonb not null default '{}'::jsonb;

-- 3. La tâche planifiée envoie le secret dans l'en-tête « x-coach-cron »
select cron.unschedule('coach-rappels') where exists (select 1 from cron.job where jobname = 'coach-rappels');
select cron.schedule(
  'coach-rappels',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://vjjuopkiwfyqjolxmnho.supabase.co/functions/v1/rappels/envoyer',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-coach-cron', (select valeur from public.secret_cron where id = 1)),
       body := '{}'::jsonb
     ) $$
);
