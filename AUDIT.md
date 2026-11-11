# Audit complet de Coach (11/11/2026, version 11.1.0)

Panel de 8 experts indépendants (un sous-agent chacun, en parallèle, lecture seule). Chaque problème renvoie à du code
lu ; les points critiques ont été revérifiés à la main. Aucune donnée personnelle n'est reprise dans ce rapport.

## 1. Compréhension du projet

1. PWA en français pour iPhone (React 19, Vite 8, TypeScript, Tailwind v4), thème sombre, publiée sur GitHub Pages.
2. « Local d'abord » : base Dexie/IndexedDB sur le téléphone, synchro avec Supabase (table `donnees`, RLS par
   utilisateur) ; 4 fonctions serveur Deno (rappels Web Push, Intervals.icu, agenda iCal, inscription par code).
3. Cœur : coach vélo (feu du jour par VFC, budget kJ hebdo à +7,5 %, saison calculée depuis les courses, séances
   envoyées à Zwift/Intervals, import .FIT) ; modules Révision CAPEPS et Budget ; Muscu et Catalogue masqués.
4. Utilisée par l'auteur, son frère et des élèves (comptes invités par code, questionnaire d'arrivée).
5. ~22 000 lignes, 41 fichiers de tests (235 tests) ; métier pur dans `src/metrics`.

**Vérifications lancées** : `npx vitest run` 235/235 ✔ · `npx tsc -b` ✔ · `npm run build` ✔ (paquet principal
1,65 Mo, 420 Ko gzip, avertissement > 500 Ko) · `npm run lint` : 0 erreur, ~22 avertissements (`react(purity)`,
`only-export-components`, `set-state-in-effect`). Le QA a relancé la suite à d'autres dates (changement d'heure,
2027-2029) et fuseaux : toujours verte.

## 2. Le panel

### 2.1 Chef de produit : 6,5/10
Moteur vélo riche et sourcé, mais le passage au « vélo seul » n'a pas été nettoyé dans l'interface, les aides et les
parcours annexes, ce qui contredit l'objectif d'une appli simple.

**Points forts** : questionnaire d'arrivée en 5 étapes qui montre la saison calculée avant validation ; registre de
modules propre (masquage, filtre invités, réglages communs séparés, recalcul automatique).

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | Un élève sans course datée ne peut pas finir le questionnaire (date future obligatoire) et reste bloqué | `arrivee/QuestionnaireArrivee.tsx:71`, `app/App.tsx:43` | critique | moyen |
| 2 | Panne de vélo : promet de « rallonger ton footing », or la course n'est plus planifiée → message toujours faux | `plan/imprevus.ts:67-77`, `forme/CartePanne.tsx:11,77`, `ModeEmploi.tsx:67` | majeure | faible |
| 3 | Aides « ? » obsolètes (course à pied, rTSS, allure % VMA) | `entrainement/aides.ts:20,24,29-30,42-43` | majeure | faible |
| 4 | Mode d'emploi montré aux invités avec le modèle de montre de l'auteur | `entrainement/ModeEmploi.tsx:61` | majeure | faible |
| 5 | Écran Aujourd'hui chargé (jusqu'à 8 cartes ponctuelles), ~68 aides parfois > 150 mots | `ecrans/Aujourdhui.tsx:77-101`, `aides.ts` | majeure | élevé |
| 6 | Profil sportif propose Course à pied / Natation sans effet | `reglages/ProfilSportif.tsx:43` | mineure | faible |
| 7 | « Importer mes données » et mention du Budget montrées aux invités | `app/ReglagesGeneraux.tsx:28`, `SectionRappels.tsx:33` | mineure | faible |
| 8 | Invité : accueil à une seule carte (un toucher inutile) ; routes Budget/Révision ouvertes | `app/Accueil.tsx`, `app/App.tsx:50-61` | mineure | faible |
| 9 | Consignes contradictoires « pense à recalculer » alors que c'est automatique | `ProfilSportif.tsx:120`, `ModeEmploi.tsx:51` | mineure | faible |
| 10 | README obsolète (« données uniquement sur l'appareil ») ; « 41 » notions en dur | `README.md:3-5`, `Accueil.tsx` | mineure | faible |

**Priorité** : une passe « vélo seul + invité » : option « Pas de course prévue », suppression des restes course à
pied (panne, aides, sports), mode d'emploi neutre, invité envoyé directement sur Entraînement.

### 2.2 Développeur mobile : 6/10
Bonne base PWA (local d'abord, précache, safe-area, View Transitions avec repli, Web Push conforme iOS), mais un seul
paquet de 1,6 Mo, un écran Aujourd'hui en position fixe calculée à la main et une synchro qui relit toute la base.

**Points forts** : hors ligne bien pensé (écritures locales, synchro groupée, reprise au retour réseau, stockage
persistant, contrôle de mise à jour au réveil) ; détails iOS soignés (safe-area, champs date, zone de toucher du « ? »,
`prefers-reduced-motion`, notification toujours affichée).

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | `@garmin/fitsdk` (~414 Ko) et `seances.json` (251 Ko) importés statiquement : ~40 % du JS chargé pour rien au démarrage | `import/fit.ts:1`, `metrics/programme.ts:13` | majeure | faible |
| 2 | Aucun `React.lazy` ; 5 modules (dont 2 masqués) importés d'office ; 4 imports dynamiques sans effet | `app/modules.ts:2-6`, `main.tsx:16-20` | majeure | moyen |
| 3 | La synchro fait `toArray()` sur les 17 tables à chaque passage (pas d'index `_modifie`) | `core/synchro.ts:130-144` | majeure | moyen |
| 4 | Écran Aujourd'hui `fixed` positionné par mesures (`innerHeight`, +350 ms) : fragile avec le clavier iOS | `ecrans/Aujourdhui.tsx:29-47,72-74` | majeure | élevé |
| 5 | Mise à jour `autoUpdate` : rechargement possible en pleine saisie (brouillon perdu) | `vite.config.ts:19`, `main.tsx:22-34` | majeure | faible |
| 6 | Polices `woff2` absentes du précache : police système hors ligne | `vite.config.ts:40` | mineure | faible |
| 7 | Requêtes qui lisent des tables entières dans des `useLiveQuery` (pas d'index `prevueId`, `reporteeDu`) | `forme/CarteResultat.tsx:13`, `forme/CarteAujourdhui.tsx:76` | mineure | faible |
| 8 | Pas de reprise d'un abonnement push perdu (rappels qui s'arrêtent sans bruit) | `core/notifications.ts:159-172`, `public/push-sw.js` | mineure | faible |
| 9 | Geste de glisser : `getComputedStyle` sur tous les parents à chaque toucher ; pas de `role="tablist"` | `core/ui/Onglets.tsx:27-35` | mineure | faible |
| 10 | Libellés de la barre du bas proches de la zone du geste iOS ; nombreux textes en 10-11 px | `index.css:102-104`, `BarreNavigation.tsx:26` | mineure | faible |

**Priorité** : découper le paquet (import dynamique du SDK FIT, `React.lazy` par module, petit JSON des formats du
programme), ajouter `woff2` au précache.

### 2.3 Développeur back-end : 6/10
Architecture saine et documentée, mais deux pertes de données silencieuses dans la synchro et une route serveur publique
non idempotente.

**Points forts** : schéma et RLS propres (`auth.uid()`, tables sensibles fermées à `anon`/`authenticated`) ; écritures
canalisées (`enregistrer`/`supprimer` en transaction), jours en heure locale ancrés à midi, codes d'invitation
consommés de façon atomique.

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | `synchro_le := now()` (heure de début de transaction) : un envoi groupé a le même horodatage ; la réception par pages de 500 avec `gt('synchro_le')` saute les lignes au-delà de la 500e | `supabase/sql/01-donnees.sql:16`, `core/synchro.ts:92-93` | **critique** | moyen |
| 2 | Déconnexion : `synchroniser()` n'échoue jamais (hors ligne → retour silencieux), puis toutes les tables locales sont vidées → saisies non envoyées perdues | `core/synchro.ts:229-237` | **critique** | faible |
| 3 | `db.suppressions.clear()` après l'envoi réseau : une suppression faite pendant l'envoi est perdue, la ligne réapparaît | `core/synchro.ts:165` | majeure | faible |
| 4 | Réglages = un seul objet, dernier écrit gagne avec l'horloge du client : deux appareils s'écrasent | `core/synchro.ts:101`, `core/reglages.ts:15-19`, `import/intervals.ts:104-122` | majeure | élevé |
| 5 | `/rappels/envoyer` public et non idempotent pour les rappels au quart d'heure ; doubles notifications possibles | `functions/rappels/index.ts:234-320`, `sql/03-rappels.sql:38-45` | majeure | faible |
| 6 | Flux Intervals : `.catch(() => [])` avale le 429 ; séance enregistrée sans courbes et jamais redemandée | `functions/intervals/index.ts:144-151`, `import/intervals.ts:130-161` | majeure | faible |
| 7 | Rappel marqué « fait » même si l'envoi échoue ; une suppression compte comme une saisie | `functions/rappels/index.ts:226-251,315` | mineure | faible |
| 8 | Clé de chiffrement Intervals dérivée de la clé service role, logique copiée dans 2 fonctions | `functions/intervals/index.ts:37-41`, `rappels/index.ts:144-147` | mineure | faible |
| 9 | Paramètres non validés vers Intervals ; dates calculées en UTC côté serveur (décalage d'un jour la nuit) ; recherche de clé d'agenda sans index | `functions/intervals/index.ts:126-191`, `functions/agenda/index.ts:69` | mineure | faible |
| 10 | `synchro.ts` sans aucun test | `core/synchro.ts` | mineure | moyen |

**Priorité** : fiabiliser le protocole de synchro (séquence serveur, purge ciblée des suppressions, déconnexion
bloquée tant qu'il reste des envois) avec des tests sur un faux Supabase.

### 2.4 Architecte logiciel : 6/10
Formules bien isolées et registre de modules propre, mais le cœur (`plan/programme.ts`) concentre une orchestration
très longue avec effets de bord, calculs en triple et dette de migration.

**Points forts** : `src/metrics` n'importe ni Dexie ni les modules ; socle commun cohérent (`stockage.ts`,
`useReglage` transactionnel), typage sain (1 seul `any`).

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | `genererSemaineVelo` ≈ 360 lignes : lectures, suppressions, règles et écritures mêlées ; un échec laisse un état partiel | `plan/programme.ts:224-587` | majeure | élevé |
| 2 | Plafond/nominal kJ calculé 3 fois avec des règles différentes (2e jour dur, sortie longue visée, coupure, heures) → Saison, aperçu du dimanche et semaine réelle peuvent différer | `plan/programme.ts:445, 674-685, 795-796` | majeure | moyen |
| 3 | Imports dynamiques qui masquent un cycle `seances ↔ plan ↔ arrivee` | `seances/donnees.ts:229`, `arrivee/donnees.ts:206,256`, `import/intervals.ts:231` | majeure | moyen |
| 4 | Réglages lus bruts et réécrits hors transaction en plein calcul (écrasement possible) | `plan/programme.ts:233, 307-312` | majeure | faible |
| 5 | Migrations rejouées à chaque lecture, calendrier de tests par défaut injecté si `testsCourts` absent | `reglagesEntrainement.ts:30-39` | majeure | moyen |
| 6 | Restes « chauvin » et course à pied (types Campus, `vmaKmh`, `construireEquivalentCourse`…) | `types.ts:104,121-135`, `metrics/programme.ts:403` | mineure | moyen |
| 7 | Type métier `ProfilSportif` défini dans un composant ; 52 casts `valeur as …` sans accesseur typé | `reglages/ProfilSportif.tsx:18` | mineure | faible |
| 8 | Coquille couplée aux internes des modules (Accueil importe budget/revision/entrainement) | `app/Accueil.tsx:10-16`, `core/db.ts:2-4` | mineure | faible |
| 9 | UI copiée-collée (`puce` ×3, tables de couleurs locales) | `QuestionnaireArrivee.tsx:22`, `ProfilSportif.tsx:50`, `ListeCourses.tsx:14` | mineure | faible |
| 10 | `metrics/programme.ts` : 1815 lignes, ~30 responsabilités | `src/metrics/programme.ts` | mineure | moyen |

**Priorité** : « lire → calculer (pur) → écrire » pour la génération de semaine, avec une seule fonction
`plafondEtNominal` partagée, et une écriture en une transaction.

### 2.5 Testeur QA : 6,5/10
Métier pur solide et indépendant de la date ; la synchro, qui protège les données, n'a aucun test et peut en perdre ;
la génération de semaine échoue en silence.

**Points forts** : calculs purs stables (dates en texte, budget en centimes, mois courts gérés) ; écritures
centralisées sous transaction ; tests de génération à heure fixée.

| # | Problème (scénario) | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | 1er envoi > 500 lignes : le 2e appareil ne reçoit jamais la suite (horodatage identique) | `core/synchro.ts:93,114`, `sql/01-donnees.sql:16` | **critique** | moyen |
| 2 | Déconnexion dans le métro : saisies non envoyées perdues alors que le message promet le contraire | `core/synchro.ts:229-236`, `app/SectionCompte.tsx:37` | **critique** | faible |
| 3 | Séance supprimée pendant un envoi : elle réapparaît | `core/synchro.ts:142-165` | majeure | faible |
| 4 | Une seule ligne refusée par le serveur bloque toute la synchro pour toujours | `core/synchro.ts:159-161` | majeure | faible |
| 5 | `genererSemaineVelo` supprime d'abord, puis peut échouer (import dynamique hors ligne, `phaseDe`) ; 6 appelants avalent l'erreur → semaine vide sans message | `plan/programme.ts:244-248,302` | majeure | moyen |
| 6 | `phaseDe` plante avec `phases: []` (vérifié) | `metrics/programme.ts:836-838` | majeure | faible |
| 7 | `estSemaineAllegee` ne trouve jamais la semaine si la 1re phase ne commence pas un lundi (latent) | `metrics/programme.ts:853` | mineure | faible |
| 8 | `recalculerSaison` ne fait rien s'il n'y a plus de course A à > 21 jours : phases périmées gardées ; CP 260 W en dur | `arrivee/donnees.ts:236-239` | majeure | moyen |
| 9 | Import JSON sans validation : solde « 1200,50 » → `NaN` dans le Budget (vérifié) | `app/importDonnees.ts:53-68` | majeure | faible |
| 10 | Onglets : sur une sous-page, la bulle est là mais le texte n'est pas en couleur contrastée ; `touchcancel` non géré | `core/ui/Onglets.tsx:45,89` | mineure | faible |

Zones sans test : aucun composant (`.test.tsx`), `synchro.ts`, les 4 fonctions Deno.

### 2.6 Expert DevOps : 5/10
Chemin vers la production court et fiable (24 déploiements réussis), mais rien ne contrôle le serveur, aucune alerte en
cas d'erreur et pas de sauvegarde récupérable par l'utilisateur.

**Points forts** : build reproductible (`npm ci`, lockfile, Node figé), clé Supabase publique seulement ; mises à jour
PWA et migrations Dexie bien versionnées, skill `publier` ordonnée.

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | La CI ne lance ni tests ni lint (seul un hook local protège) | `.github/workflows/deploy.yml:27-28` | majeure | faible |
| 2 | Aucun export complet des données (seul un CSV Budget) | `budget/exporter.ts:10` | majeure | faible |
| 3 | Déconnexion qui efface sans vérifier la synchro (cf. back-end) | `core/synchro.ts:229-236` | majeure | faible |
| 4 | Suppressions vidées après l'envoi ; curseur sur l'horloge du téléphone | `core/synchro.ts:142-166` | majeure | moyen |
| 5 | Fonctions et SQL déployés à la main, sans version ni preuve que le code en ligne = dépôt ; README Supabase incomplet et contradictoire ; imports `npm:…@2` non figés | `supabase/README.md`, `functions/*` | majeure | moyen |
| 6 | Route `/rappels/envoyer` publique (quotas Intervals et fonctions) | `functions/rappels/index.ts:300` | majeure | faible |
| 7 | Aucune remontée d'erreurs : 17 `catch(() => {})`, pas d'ErrorBoundary (écran blanc), aucun journal serveur | `main.tsx:16-20` | majeure | moyen |
| 8 | Scripts SQL 01 non rejouables, pas de table de migrations | `supabase/sql/01-donnees.sql:2,13,19` | mineure | faible |
| 9 | Paquet de 1,65 Mo proche de la limite de précache (2 Mio) ; polices non précachées | `vite.config.ts:40-42` | mineure | faible |
| 10 | Aucun tag de version ; retour arrière = revert + push ; aucun côté serveur | `.github/workflows/deploy.yml:15-16` | mineure | faible |

**Priorité** : tests + types + lint dans le workflow avant le build ; bouton « Exporter toutes mes données ».

### 2.7 Expert sécurité / RGPD : 5,5/10
Socle bon (RLS correcte, aucun secret dans le code ni l'historique, aucun XSS), mais une route serveur ouverte, un
compte peut couper les rappels de tous, pas d'effacement possible depuis l'appli, et des données personnelles dans le
dépôt public alors que des élèves, peut-être mineurs, s'inscrivent.

**Points forts** : base et droits bien fermés, aucun jeton dans l'historique git ; cryptographie correcte (AES-GCM,
Web Push RFC 8291/8292, clé d'agenda 128 bits, codes à usage unique), aucun `innerHTML`.

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | `/rappels/envoyer` sans authentification, CORS `*` : déclenchable en boucle (notifications en rafale, quota Intervals) | `functions/rappels/index.ts:300` | majeure | faible |
| 2 | `fuseau`/`heure` non validés : un fuseau invalide fait planter toute la boucle → rappels coupés pour tous | `functions/rappels/index.ts:123-129,313` | majeure | faible |
| 3 | Adresse d'abonnement push quelconque (requêtes signées vers n'importe quel serveur) ; réattribution possible | `functions/rappels/index.ts:95,311-315` | mineure | faible |
| 4 | Droit d'effacement absent : `supprimerToutesMesDonnees` n'est appelée nulle part et n'efface ni clé Intervals, ni abonnements, ni le compte | `core/synchro.ts:263-276` | majeure | moyen |
| 5 | `docs/a-revoir.md` contient des données personnelles (santé, revenus, rythme de vie) d'une personne identifiable, dans un dépôt public et son historique | `docs/a-revoir.md` | majeure | moyen |
| 6 | Valeurs par défaut (zones, VMA) peut-être celles d'une vraie personne (non vérifiable) | `reglagesEntrainement.ts` | mineure | faible |
| 7 | Aucune information, consentement santé ni âge minimum ; nom de l'élève stocké en clair avec le code | `functions/inscription/index.ts:46-57,75` | majeure | moyen |
| 8 | Inscription sans limite de tentatives, mot de passe ≥ 6 caractères, messages d'erreur internes renvoyés | `functions/inscription/index.ts:16-84` | mineure | faible |
| 9 | Clé Intervals dérivée de la service role ; paramètres non validés | `functions/intervals/index.ts:21,37-46` | mineure | faible |
| 10 | Pas de CSP ; import JSON non validé | `index.html`, `app/importDonnees.ts:21-31` | mineure | faible |

Non vérifiable ici : région d'hébergement Supabase (UE ?), réglages réellement déployés, contrats des tiers.

### 2.8 Expert marketing : 5,5/10
Le fond est rare (règles sourcées, saison calculée à rebours, « ? » partout), mais l'emballage reste celui d'un outil
privé : promesse floue, onboarding long et technique, aucune vitrine, presque rien sur la santé et les données.

**Points forts** : la science expliquée à l'utilisateur, avec franchise sur ce qui n'est qu'un « choix
d'entraîneur » ; « moment waouh » de la saison calculée dans le questionnaire, promesse « 1 minute le matin ».

| # | Problème | Fichier:ligne | Gravité | Effort |
|---|---|---|---|---|
| 1 | Manifest et README annoncent « nutrition, apprentissage, argent » à la 1re personne ; nom « Coach » générique, icône sans lien avec le vélo | `vite.config.ts:24`, `README.md:3` | majeure | faible |
| 2 | Écran d'entrée sans explication, prénom codé en dur, aucune page publique | `app/Entree.tsx:45,58-59` | critique (si publication) | moyen |
| 3 | Questionnaire long et technique dès l'étape 1 (CP/FTP, FC max, Mifflin-St Jeor) | `QuestionnaireArrivee.tsx:99-151` | majeure | moyen |
| 4 | Dépendance à une procédure Intervals.icu en anglais ; Strava exclu | `QuestionnaireArrivee.tsx:245-268` | majeure | élevé |
| 5 | Textes propres à l'auteur visibles des invités (montre, « ton PDF », footing) | `ModeEmploi.tsx:61,67`, `aides.ts:20,24,51` | majeure | faible |
| 6 | Aucune mention santé générale alors qu'il y a poids et déficit calorique | `aides.ts:110`, `forme/CarteAujourdhui.tsx` | critique | faible |
| 7 | Rien sur les données à l'inscription ; README faux sur le stockage | `app/Entree.tsx`, `README.md:5` | majeure | faible |
| 8 | Jargon (kJ, CP, W/kg, VO2) non traduit au premier contact | `Accueil.tsx`, `ModeEmploi.tsx:72-87` | mineure | moyen |
| 9 | Différenciation écrite nulle part (français, feu VFC, science, gratuité, club/élèves) | manifest, `Entree.tsx`, README | majeure | faible |
| 10 | Invité : accueil à un module | `Accueil.tsx` | mineure | faible |

## 3. Synthèse

**Note globale : 5,9/10** (moyenne : produit 6,5 · mobile 6 · back-end 6 · architecte 6 · QA 6,5 · DevOps 5 ·
sécurité 5,5 · marketing 5,5).

Constat : un moteur métier sérieux, testé et sourcé, posé sur une synchro et un serveur pas encore au niveau des
données qu'ils portent (santé, argent, comptes d'élèves). Pour un usage perso c'est déjà utile ; pour une
publication, la fiabilité des données, la sécurité serveur et le RGPD passent avant toute nouvelle fonction.

### Problèmes critiques à corriger avant toute nouvelle fonctionnalité
1. **Perte de données à la déconnexion** (`core/synchro.ts:229-237`).
2. **Lignes jamais reçues par un 2e appareil** (`sql/01-donnees.sql:16` + `core/synchro.ts:92-93`).
3. **Suppressions perdues pendant un envoi** (`core/synchro.ts:165`) et une ligne refusée qui bloque tout (`:159-161`).
4. **Route `/rappels/envoyer` publique + fuseau non validé** qui peut couper les rappels de tous (`functions/rappels`).
5. **Données personnelles dans `docs/a-revoir.md`** (dépôt public).
6. **Questionnaire bloquant pour un élève sans course** (`QuestionnaireArrivee.tsx:71`).
7. **Semaine vidée en silence si la génération échoue** (`plan/programme.ts:244-302`, appelants en `.catch(() => {})`).

### 10 actions prioritaires (rapport impact / effort)

| # | Action | Impact | Effort | Experts |
|---|---|---|---|---|
| 1 | Déconnexion bloquée tant que la synchro n'a pas réussi et qu'il reste des envois | très fort | faible | back, QA, DevOps |
| 2 | Purger seulement les suppressions envoyées ; mettre en quarantaine une ligne refusée | fort | faible | back, QA, DevOps |
| 3 | Secret partagé sur `/rappels/envoyer`, validation fuseau/heure, `try/catch` par abonnement, endpoints push connus | fort | faible | sécu, back, DevOps |
| 4 | Sortir les notes privées de `docs/a-revoir.md` du dépôt public (fichier local ou dépôt privé) | fort | faible | sécu |
| 5 | Tests + types + lint dans le workflow GitHub avant le build | fort | faible | DevOps |
| 6 | Curseur de synchro sur une séquence serveur (`bigserial`) + tests de `synchro.ts` avec un faux Supabase | très fort | moyen | back, QA |
| 7 | Génération de semaine : calculer puis écrire en une transaction, erreur affichée ; garde-fou `phases: []` | fort | moyen | QA, archi |
| 8 | Passe « vélo seul + invité » : option « pas de course », restes course à pied, mode d'emploi neutre, invité direct sur Entraînement | fort | faible-moyen | produit, marketing |
| 9 | Export « toutes mes données » + bouton « supprimer mon compte » + mentions santé/données à l'inscription | fort | moyen | DevOps, sécu, marketing |
| 10 | Découper le paquet (SDK FIT et catalogue à la demande, `React.lazy`), polices en précache, mise à jour sans recharger en pleine saisie | moyen | faible-moyen | mobile, DevOps |

Ensuite (gros chantiers) : fonction unique `plafondEtNominal` et découpage de `genererSemaineVelo` ; fusion champ par
champ des réglages ; écran Aujourd'hui sans position fixe ; versionnage et déploiement automatique des fonctions
Supabase ; remontée d'erreurs (ErrorBoundary, journal).

## 4. Ce qui n'a pas pu être vérifié
Rendu et gestes sur un vrai iPhone ; configuration Supabase en ligne (pg_cron, Verify JWT, région, sauvegardes, offre) ;
correspondance entre les fonctions déployées et le dépôt ; limites réelles d'Intervals.icu ; volumes réels des données
de l'auteur ; couverture de tests chiffrée (outil non installé) ; justesse scientifique (rôle du relecteur).
