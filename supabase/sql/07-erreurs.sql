-- 07 (11/11/2026) : erreurs de l'appli, tous comptes confondus, pour que le coach soit prévenu et puisse corriger.
-- Chaque appareil n'écrit que les siennes ; seul un compte « coach » (table coachs) peut les lire.
-- Contenu limité : message technique, écran, version. Aucune donnée de santé ni d'argent. Rejouable.
create table if not exists public.erreurs (
  id        bigserial primary key,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  le        timestamptz not null default now(),
  version   text check (char_length(version) <= 20),
  page      text check (char_length(page) <= 80),
  message   text not null check (char_length(message) <= 500),
  pile      text check (char_length(pile) <= 2000),
  vue       boolean not null default false,
  notifiee  boolean not null default false
);
create index if not exists erreurs_le on public.erreurs (le desc);
alter table public.erreurs enable row level security;

-- Le compte connecté est-il un coach ? (lit coachs sans l'ouvrir aux comptes)
create or replace function public.est_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coachs where user_id = (select auth.uid()))
$$;
revoke all on function public.est_coach() from public;
grant execute on function public.est_coach() to authenticated;

drop policy if exists "signaler mes erreurs" on public.erreurs;
create policy "signaler mes erreurs" on public.erreurs for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "le coach lit les erreurs" on public.erreurs;
create policy "le coach lit les erreurs" on public.erreurs for select to authenticated using (public.est_coach());
drop policy if exists "le coach marque les erreurs vues" on public.erreurs;
create policy "le coach marque les erreurs vues" on public.erreurs for update to authenticated
  using (public.est_coach()) with check (public.est_coach());

revoke all on public.erreurs from anon;
grant insert, select, update on public.erreurs to authenticated;
grant usage on sequence public.erreurs_id_seq to authenticated;
grant select, update on public.erreurs to service_role;
grant select on public.coachs to service_role;
