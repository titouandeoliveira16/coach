-- 05 (audit du 11/11/2026) : numéro d'arrivée strictement croissant pour la synchro.
-- Avant : le curseur était synchro_le := now() (heure de DÉBUT de transaction) ; toutes les lignes d'un même envoi
-- groupé avaient la même date, et un 2e appareil qui lisait par pages de 500 sautait celles d'après la 500e.
-- Rejouable sans risque (if not exists / or replace).
create sequence if not exists public.donnees_seq;
alter table public.donnees add column if not exists seq bigint;

-- Numérote les lignes déjà présentes, dans l'ordre d'arrivée
update public.donnees d set seq = n.num
from (select user_id, table_nom, cle, nextval('public.donnees_seq') as num
      from public.donnees where seq is null order by synchro_le, table_nom, cle) n
where d.user_id = n.user_id and d.table_nom = n.table_nom and d.cle = n.cle;

create index if not exists donnees_user_seq on public.donnees (user_id, seq);

-- Chaque écriture reçoit un nouveau numéro (et garde sa date d'arrivée)
create or replace function public.dater_synchro() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synchro_le := clock_timestamp();
  new.seq := nextval('public.donnees_seq');
  return new;
end $$;

-- Le rôle des utilisateurs doit pouvoir avancer la séquence (via le déclencheur)
grant usage on sequence public.donnees_seq to authenticated;
