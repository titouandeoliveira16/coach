# Coach — appli personnelle de Titouan

PWA en français (iPhone d'abord, thème sombre) : un accueil, puis des modules. **Entraînement** est construit
(vélo + course, système kJ, CP, feu du jour par VFC) ; **Budget** est construit (saisie manuelle, plafonds, patrimoine) ;
**Révision CAPEPS** est construit (41 notions, rappels J+1…J+90 en feuille blanche, sujets ; concours le 2/03/2027) ;
**Muscu** est construit (développé couché 5/3/1 adapté, pas encore relié à l'Entraînement ni à la nutrition).
En ligne : https://titouandeoliveira16.github.io/coach/ (GitHub Pages, déployé à chaque push sur `main`).

## Façon de travailler avec Titouan
- Toujours répondre **en français**, simplement, en le tutoyant ; pas de jargon technique sans l'expliquer.
- **Ne rien changer sans son accord** quand il s'agit d'un choix (règle d'entraînement, écran, fonctionnement) :
  proposer d'abord, coder ensuite. Quand il dit « go » / « fais-le », enchaîner jusqu'au déploiement.
- Les règles d'entraînement doivent être **appuyées sur la littérature scientifique** (sous-agent
  `relecteur-scientifique`) et expliquées dans les « ? » de l'appli (`src/modules/entrainement/aides.ts`).
- Il veut une appli **simple** : peu d'écrans, peu de chiffres, autonome (pas de service d'IA en ligne).
- Les points mis de côté sont dans **`docs/a-revoir.md`** : le tenir à jour et le lui rappeler au bon moment
  (ex. après le 5 km du 13/12/2026 : 4 vélos et 2 courses par semaine).
- Ne jamais lui demander de coller un mot de passe, une clé ou un jeton dans la conversation.
- **Le dépôt GitHub est public : aucune donnée personnelle dans le code, les tests ou les docs** (montants, soldes,
  poids, taille, date de naissance, FC, records, employeur, proches). Ses valeurs vivent dans ses données synchronisées ;
  pour les lui faire entrer, préparer un fichier privé (scratchpad, envoyé avec SendUserFile) à importer via
  Accueil → ⚙️ → « Importer mes données » (`src/app/importDonnees.ts`) ou Budget → Réglages → « Importer des mouvements ».

## Commandes
- `npm run dev` · `npm test` (Vitest) · `npx tsc -b` · `npm run lint` (oxlint) · `npm run build`
- Publier une version : skill **`publier`** (version, vérifications, commit, push, déploiement, contrôle).
- Contrôle visuel : sous-agent **`testeur-mobile`**.
- Un hook bloque `git push` si les types ou les tests échouent.

## Repères dans le code
- `src/app/` : coquille (accueil, barre du bas propre à chaque module, registre `modules.ts`). Réglages communs
  (compte, notifications, version) : Accueil → ⚙️ (`ReglagesGeneraux.tsx`) ; chaque module n'affiche que les siens.
- `src/core/` : base locale Dexie (IndexedDB), écritures via `stockage.ts` (horodatage + suppressions),
  synchro « local d'abord » avec Supabase (`synchro.ts`), notifications (`notifications.ts`), composants `ui/`.
- `src/metrics/` : formules pures et testées (charge, VFC, signal du jour, programme vélo, planification).
- `src/modules/entrainement/` : écrans Aujourd'hui · Semaine · Saison · Progrès, programme vélo
  (`plan/programme.ts`), imprévus (panne, report d'intensité), import Intervals.icu / .FIT.
- `src/modules/budget/` : écrans Mois · Liste · Patrimoine · Analyses, saisie rapide (`Saisie.tsx`), calculs purs et
  testés (`calculs.ts`, montants en centimes), plafonds par mois (`plafonds`, repris les mois suivants), relevés d'investissement.
- `src/modules/revision/` : écrans Aujourd'hui · Notions · Semaine · Sujets ; planification pure et testée
  (`programme.ts` : périodes, capacités de rappels, journées types, placement, projection) ; paramètres dans `reglages|revision`.
- `src/modules/muscu/` : écrans Séance · Progrès ; règles pures et testées (`programme.ts`) ; tout l'état dans le réglage `muscu`.
- Séances : activités enchaînées regroupées (`seances/enchainements.ts`), watts par bloc vs cible (`plan/blocs.ts`),
  contrôle FC et question « en réserve » selon le type de séance (`plan/controleFc.ts`, repères d'entraîneur).
- Journal des repas du soir (Entraînement) : table `repas`, carte `forme/CarteRepas.tsx`, suivi dans Progrès.
- Nommage en français dans le code (`seance`, `prevue`, `enregistrer`…) : garder ce style.
- Nouveau module : un dossier dans `src/modules/`, déclaré dans `src/app/modules.ts`.

## Serveur (Supabase, projet `vjjuopkiwfyqjolxmnho`)
- Fonctions : `supabase/functions/intervals` (clé Intervals chiffrée) et `rappels` (notifications Web Push,
  appelée toutes les 15 min par pg_cron ; envoie aussi le rappel de saisie du Budget, réglé dans `reglages|budget`). « Verify JWT » désactivé sur les deux.
- SQL : `supabase/sql/01…03` (déjà exécutés). Toute nouvelle table doit recevoir ses droits explicitement
  (le projet n'expose pas les nouvelles tables).
- Modifier une fonction ou le SQL ne passe pas par GitHub : déployer via le serveur MCP `supabase` s'il est
  disponible, sinon donner à Titouan les étapes exactes dans le tableau de bord.
