# Coach — appli personnelle de Titouan

PWA en français (iPhone d'abord, thème sombre) : un accueil, puis des modules. **Entraînement** est construit
(vélo seul depuis 11/2026 : la course à pied et le plan Campus sont retirés ; système kJ, CP, feu du jour par VFC) ; **Budget** est construit (saisie manuelle, plafonds, patrimoine) ;
**Révision CAPEPS** est construit (41 notions, rappels J+1…J+90 en feuille blanche, sujets ; concours le 2/03/2027) ;
**Muscu** est construit (développé couché 5/3/1 adapté, pas encore relié à l'Entraînement ni à la nutrition ; mis de côté,
plus sur l'accueil) ;
**Catalogue** affiche le catalogue scientifique de séances (`catalogue/` : route, VTT par discipline, course (plus affichée), renfo, méthodes ;
l'Entraînement y pioche ses formats d'intensité vélo ; plus sur l'accueil : encart dépliable dans Entraînement → Réglages,
limité aux sports du profil sportif, `catalogue/ListeCatalogue.tsx`).
L'accueil n'affiche que Entraînement, Révision CAPEPS et Budget (modules `masque` dans `src/app/modules.ts`).
En ligne : https://titouandeoliveira16.github.io/coach/ (GitHub Pages, déployé à chaque push sur `main`).

## Façon de travailler avec Titouan
- Toujours répondre **en français**, simplement, en le tutoyant ; pas de jargon technique sans l'expliquer.
- **Ne rien changer sans son accord** quand il s'agit d'un choix (règle d'entraînement, écran, fonctionnement) :
  proposer d'abord, coder ensuite. Quand il dit « go » / « fais-le », enchaîner jusqu'au déploiement.
- Les règles d'entraînement doivent être **appuyées sur la littérature scientifique** (sous-agent
  `relecteur-scientifique`) et expliquées dans les « ? » de l'appli (`src/modules/entrainement/aides.ts`).
- Il veut une appli **simple** : peu d'écrans, peu de chiffres, autonome (pas de service d'IA en ligne).
- Les points mis de côté : chantiers techniques dans **`docs/a-revoir.md`** (public, sans donnée personnelle) ; son
  suivi personnel (santé, budget, saison, emploi du temps) dans son fichier privé `notes-privees-coach.md`, hors dépôt
  depuis l'audit du 11/11/2026 : le lui demander quand il faut, et lui renvoyer une version à jour (SendUserFile) au
  lieu de l'écrire dans le dépôt. Les lui rappeler au bon moment.
- Ne jamais lui demander de coller un mot de passe, une clé ou un jeton dans la conversation.
- **Le dépôt GitHub est public : aucune donnée personnelle dans le code, les tests ou les docs** (montants, soldes,
  poids, taille, date de naissance, FC, records, employeur, proches). Ses valeurs vivent dans ses données synchronisées ;
  pour les lui faire entrer, préparer un fichier privé (scratchpad, envoyé avec SendUserFile) à importer via
  Accueil → ⚙️ → « Importer mes données » (`src/app/importDonnees.ts`) ou Budget → Réglages → « Importer des mouvements ».

## Comptes
- Une seule appli pour Titouan, son frère et ses élèves : chacun son compte (données séparées par RLS), même moteur.
  Inscription seulement avec un code (`supabase/functions/inscription`, `supabase/sql/04-codes.sql`) ; un compte créé
  avec un code a le réglage `compte.invite` : accueil = Entraînement seul, questionnaire d'arrivée
  (`modules/entrainement/arrivee/`), saison calculée depuis sa course (`metrics/saison.ts`). Depuis 11/2026, le compte
  de Titouan passe aussi par le questionnaire (prérempli, ses tests CP et données gardées) : sa saison écrite à la main
  est abandonnée, `PROGRAMME_DEFAUT` n'est plus qu'un repli vélo seul.

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
  (`plan/programme.ts`, discipline visée route ou VTT : `familleVtt`, `formatsPour`), imprévus (panne, report d'intensité),
  import Intervals.icu / .FIT.
- `src/modules/budget/` : écrans Mois · Liste · Patrimoine · Analyses, saisie rapide (`Saisie.tsx`), calculs purs et
  testés (`calculs.ts`, montants en centimes), plafonds par mois (`plafonds`, repris les mois suivants), relevés d'investissement.
- `src/modules/revision/` : écrans Aujourd'hui · Notions · Semaine · Sujets ; planification pure et testée
  (`programme.ts` : périodes, capacités de rappels, journées types, placement, projection) ; paramètres dans `reglages|revision`.
- `catalogue/` : séances appuyées sur la littérature (`seances.json` généré par `generer.py`, voir son README) ;
  module `src/modules/catalogue/` pour le parcourir.
- `src/modules/muscu/` : écrans Séance · Progrès ; règles pures et testées (`programme.ts`) ; tout l'état dans le réglage `muscu`.
- Séances : activités enchaînées regroupées (`seances/enchainements.ts`), watts par bloc vs cible (`plan/blocs.ts`),
  contrôle FC et question « en réserve » selon le type de séance (`plan/controleFc.ts`, repères d'entraîneur).
- Journal des repas du soir (Entraînement) : table `repas`, carte « Nutrition du jour » `forme/CarteNutrition.tsx` (besoin / mangé / écart ; formulaire dans `forme/CarteRepas.tsx`), suivi dans Progrès.
- Nommage en français dans le code (`seance`, `prevue`, `enregistrer`…) : garder ce style.
- Nouveau module : un dossier dans `src/modules/`, déclaré dans `src/app/modules.ts`.

## Serveur (Supabase, projet `vjjuopkiwfyqjolxmnho`)
- Fonctions : `supabase/functions/intervals` (clé Intervals chiffrée) et `rappels` (notifications Web Push,
  appelée toutes les 15 min par pg_cron ; envoie aussi le rappel de saisie du Budget, réglé dans `reglages|budget`),
  `agenda` (séances prévues en iCal pour Google Agenda, clé secrète dans `reglages|agenda`). « Verify JWT » désactivé sur les trois.
- SQL : `supabase/sql/01…03` (déjà exécutés). Toute nouvelle table doit recevoir ses droits explicitement
  (le projet n'expose pas les nouvelles tables).
- Modifier une fonction ou le SQL ne passe pas par GitHub : déployer via le serveur MCP `supabase` s'il est
  disponible, sinon donner à Titouan les étapes exactes dans le tableau de bord.
