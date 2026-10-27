-- Étape 3 bis (déjà exécuté) : table de synchronisation de toutes les données.
create table public.donnees (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  table_nom  text not null,
  cle        text not null,
  valeur     jsonb,
  supprime   boolean not null default false,
  modifie_le timestamptz not null,
  synchro_le timestamptz not null default now(),
  primary key (user_id, table_nom, cle)
);
create index donnees_synchro on public.donnees (user_id, synchro_le);
create function public.dater_synchro() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synchro_le := now();
  return new;
end $$;
create trigger dater_synchro before insert or update on public.donnees
  for each row execute function public.dater_synchro();
alter table public.donnees enable row level security;
create policy "lire mes donnees" on public.donnees for select using ((select auth.uid()) = user_id);
create policy "ajouter mes donnees" on public.donnees for insert with check ((select auth.uid()) = user_id);
create policy "modifier mes donnees" on public.donnees for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.donnees to authenticated;
