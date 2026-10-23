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
