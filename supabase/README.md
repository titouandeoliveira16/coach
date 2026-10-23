# Serveur (Supabase)

## Déjà en place
- `sql/01-donnees.sql` : table de synchronisation (exécuté à l'étape 3 bis).

## Connexion Strava (à faire une fois)

### 1. Créer l'application Strava
1. Va sur https://www.strava.com/settings/api (connecté à ton compte Strava).
2. Remplis :
   - **Application Name** : Coach Titouan (le mot « Strava » est interdit dans le nom)
   - **Category** : Training
   - **Website** : https://titouandeoliveira16.github.io/coach/
   - **Authorization Callback Domain** : `vjjuopkiwfyqjolxmnho.supabase.co`
3. Valide, puis note le **Client ID** et le **Client Secret** (bouton « show »).

### 2. Créer les tables
Supabase → **SQL Editor** → New query → colle `sql/02-strava-et-suppression.sql` → **Run**.

### 3. Installer la fonction serveur
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom de la fonction : **`strava`** (exactement).
3. Remplace tout le code par le contenu de `functions/strava/index.ts`, puis **Deploy**.
4. Dans les réglages de la fonction (**Details**), **désactive « Verify JWT with legacy secret » / « Enforce JWT verification »**
   (Strava appelle `/strava/retour` sans jeton ; la fonction vérifie elle-même l'utilisateur sur les autres routes).

### 4. Ajouter les secrets
Supabase → **Edge Functions** → **Secrets** (ou Project Settings → Edge Functions) :
- `STRAVA_CLIENT_ID` = le Client ID
- `STRAVA_CLIENT_SECRET` = le Client Secret

### 5. Dans l'appli
Réglages → **Strava** → **Connecter Strava** → autorise (coche l'accès aux activités privées) → reviens dans Coach
→ **Importer mes 3 derniers mois**.

Limites : une appli Strava nouvellement créée n'accepte qu'**un seul athlète** (toi). Pour la partager, il faudra la
faire valider par Strava. Les traces GPS ne sont jamais récupérées.
