-- 08 (14/11/2026, audit sécurité et fiabilité) : limites côté serveur. Rejouable.

-- 1. donnees : tailles bornées (un compte ne peut pas remplir la base de tous), noms de table propres
alter table public.donnees drop constraint if exists donnees_taille_valeur;
alter table public.donnees add constraint donnees_taille_valeur check (valeur is null or octet_length(valeur::text) < 200000);
alter table public.donnees drop constraint if exists donnees_taille_cle;
alter table public.donnees add constraint donnees_taille_cle check (char_length(cle) <= 200);
alter table public.donnees drop constraint if exists donnees_nom_table;
alter table public.donnees add constraint donnees_nom_table check (table_nom ~ '^[a-z_]{1,40}$');

-- Au plus 50 000 lignes par compte (aujourd'hui : quelques centaines)
create or replace function public.limiter_donnees() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.donnees where user_id = new.user_id) >= 50000 then
    raise exception 'Trop de données pour ce compte' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function public.limiter_donnees() from public, anon, authenticated;
drop trigger if exists limiter_donnees on public.donnees;
create trigger limiter_donnees before insert on public.donnees for each row execute function public.limiter_donnees();

-- Une version plus ancienne ne remplace jamais une plus récente (un vieil appareil qui renvoie une ligne périmée)
create or replace function public.garder_plus_recente() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.modifie_le < old.modifie_le then return null; end if;
  return new;
end $$;
revoke all on function public.garder_plus_recente() from public, anon, authenticated;
drop trigger if exists garder_plus_recente on public.donnees;
-- (« a_ » : passe avant le déclencheur qui date l'arrivée)
create trigger a_garder_plus_recente before update on public.donnees for each row execute function public.garder_plus_recente();

-- Lien agenda : recherche de la clé par un index (avant, chaque appel parcourait les données de tous les comptes)
create index if not exists donnees_cle_agenda on public.donnees ((valeur -> 'valeur' ->> 'cle')) where table_nom = 'reglages' and cle = 'agenda';

-- 2. erreurs : au plus 30 par compte et par jour (au-delà, ignorées sans bruit)
create or replace function public.limiter_erreurs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.erreurs where user_id = new.user_id and le > now() - interval '1 day') >= 30 then
    return null;
  end if;
  return new;
end $$;
revoke all on function public.limiter_erreurs() from public, anon, authenticated;
drop trigger if exists limiter_erreurs on public.erreurs;
create trigger limiter_erreurs before insert on public.erreurs for each row execute function public.limiter_erreurs();

-- 3. Inscription : tentatives ratées par adresse IP (lues seulement par la fonction serveur)
create table if not exists public.tentatives_inscription (
  id  bigserial primary key,
  ip  text not null,
  le  timestamptz not null default now()
);
create index if not exists tentatives_ip_le on public.tentatives_inscription (ip, le desc);
alter table public.tentatives_inscription enable row level security;
revoke all on public.tentatives_inscription from anon, authenticated;
grant select, insert, delete on public.tentatives_inscription to service_role;
grant usage on sequence public.tentatives_inscription_id_seq to service_role;

-- 4. Fonction interne de Supabase (active la RLS sur les nouvelles tables) : pas appelable depuis l'API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
