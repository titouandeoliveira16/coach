# Serveur (Supabase)

## Déjà en place
- `sql/01-donnees.sql` : table de synchronisation (exécuté à l'étape 3 bis).

## Connexion Intervals.icu (à faire une fois)

Intervals.icu fournit une API gratuite par clé personnelle. Les activités arrivées dans Intervals **via Strava**
ne sont pas transmises par son API (règles de Strava) : relie Garmin Connect et Zwift **directement** à Intervals.

1. **Intervals.icu → Settings → Connections** : relier Garmin Connect (et Zwift).
2. **Intervals.icu → Settings → Developer Settings** : générer une **API Key** (et noter l'**Athlete ID**, ex. `i123456`).
3. **Supabase → SQL Editor** : exécuter `sql/02-intervals-et-suppression.sql`.
4. **Supabase → Edge Functions → Deploy a new function → Via Editor** : nom **`intervals`**, coller
   `functions/intervals/index.ts`, Deploy. Aucun secret à ajouter.
5. **Dans l'appli** : Réglages → Intervals.icu → coller la clé (et l'ID athlète) → Relier → Importer mes 3 derniers mois.

La fonction vérifie elle-même l'utilisateur connecté : la vérification JWT de Supabase peut rester activée.

## Rappels par notification (à faire une fois)

1. **Supabase → Edge Functions → Deploy a new function → Via Editor** : nom **`rappels`**, coller
   `functions/rappels/index.ts`, Deploy. Puis, dans les réglages de la fonction, **désactiver « Verify JWT »**
   (la fonction vérifie elle-même l'utilisateur, et l'envoi programmé l'appelle sans compte).
2. **Supabase → SQL Editor** : exécuter `sql/03-rappels.sql` (tables + envoi toutes les 15 min).
   Si `pg_cron` ou `pg_net` est refusé : Database → Extensions → activer **pg_cron** et **pg_net**, puis relancer le script.
3. **Dans l'appli, sur l'iPhone (ouverte depuis l'écran d'accueil)** : Réglages → Rappels → Activer → Autoriser.

## Audit du 11/11/2026 (à faire une fois, dans cet ordre)

1. **SQL Editor** : exécuter `sql/05-synchro-seq.sql` (numéro d'arrivée de chaque donnée : un 2e appareil ne saute plus
   de lignes). L'appli marche avant et après (elle repasse sur l'ancien curseur tant que la colonne n'existe pas).
2. **SQL Editor** : exécuter `sql/06-rappels-secret.sql` (secret partagé avec la tâche planifiée, rappels envoyés une
   seule fois par jour et par type).
3. **Edge Functions → rappels → Code** : coller `functions/rappels/index.ts`, Deploy. (Après l'étape 2, sinon les
   rappels s'arrêtent : la fonction refuse tout appel sans le secret.)
4. **Edge Functions → inscription → Code** : coller `functions/inscription/index.ts`, Deploy (route « supprimer mon
   compte »).

État des fonctions : `intervals`, `rappels`, `agenda` et `inscription` ont « Verify JWT » désactivé ; chacune vérifie
elle-même le compte connecté (et `rappels/envoyer` le secret de la tâche planifiée).

## Déploiement automatique des fonctions (depuis le 11/11/2026)

Les 4 fonctions se redéploient seules à chaque modification de `supabase/functions/` envoyée sur GitHub
(`.github/workflows/supabase.yml`). À faire une seule fois :
1. **Supabase → Account (en haut à droite) → Access Tokens → Generate new token** (nom : « GitHub coach »). Copie-le.
2. **GitHub → dépôt coach → Settings → Secrets and variables → Actions → New repository secret** :
   nom `SUPABASE_ACCESS_TOKEN`, valeur = le jeton copié. Ne le colle nulle part ailleurs (ni dans une conversation).
3. **GitHub → Actions → Fonctions Supabase → Run workflow** pour un premier déploiement de test.
Les scripts SQL restent à exécuter à la main dans le SQL Editor.
