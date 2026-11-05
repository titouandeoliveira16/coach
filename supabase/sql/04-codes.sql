-- Inscription avec un code (comptes des élèves, de ton frère…)
-- À coller dans Supabase → SQL Editor → New query → Run (une seule fois),
-- APRÈS avoir déployé la fonction « inscription ».
-- Seule la fonction serveur touche ces tables : l'appli passe toujours par elle.

-- Les comptes qui peuvent créer des codes (toi). Ton compte s'ajoute avec la ligne
-- « insert … » plus bas, en remplaçant l'email : rien de personnel n'est écrit dans le dépôt.
create table if not exists public.coachs (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.coachs enable row level security;
revoke all on public.coachs from anon, authenticated;
grant select, insert, update, delete on public.coachs to service_role;

create table if not exists public.codes_invitation (
  code         text primary key,
  cree_par     uuid not null references auth.users on delete cascade,
  cree_le      timestamptz not null default now(),
  pour         text,
  utilise_par  uuid references auth.users on delete set null,
  utilise_le   timestamptz
);
alter table public.codes_invitation enable row level security;
revoke all on public.codes_invitation from anon, authenticated;
grant select, insert, update, delete on public.codes_invitation to service_role;

-- À exécuter avec TON email à la place de ton@email.fr (une seule fois) :
-- insert into public.coachs (user_id) select id from auth.users where email = 'ton@email.fr';
