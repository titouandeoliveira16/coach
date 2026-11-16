-- 10 (16/11/2026) : retire les droits inutiles des rôles du navigateur (audit sécurité du Budget).
-- TRUNCATE vide une table entière sans passer par les règles par compte (RLS) ; REFERENCES et TRIGGER ne servent pas.
-- L'API ne permet pas de les utiliser aujourd'hui : c'est par précaution. Rejouable sans risque.
revoke truncate, references, trigger on public.donnees from anon, authenticated;
revoke truncate, references, trigger on public.erreurs from anon, authenticated;
