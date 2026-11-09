# À revoir avec Titouan

Points décidés ou mis de côté, à reprendre au bon moment.

## À lui rappeler au début de la prochaine conversation (demandé le 3/11/2026)
- ~~Supabase : redéployer `rappels`~~ fait le 4/11/2026. Piste proposée : déploiement automatique des fonctions par GitHub
  (clé d'accès Supabase rangée par lui dans les secrets GitHub), s'il le souhaite.
- **Budget : comparer l'appli avec sa banque.** Lui demander l'export CSV (Budget → Réglages → Exporter) ou des captures
  (« Voir le détail » du reste à vivre, liste des mouvements), et ses captures de relevé depuis le début du suivi. Comparer
  ligne par ligne dans le scratchpad, corriger (fichier d'import si besoin), puis effacer les fichiers. Rien de tout ça dans le dépôt.
  Il a déjà envoyé les captures du 29/10 au 3/11 (opérations carte « en cours » non déduites du solde affiché, épargne le jour de la paie).
- Proposé, pas encore validé : au contrôle du solde, demander le montant des opérations carte « en cours » pour les retirer du solde.
- Question ouverte : garder le contrôle du dimanche, ou seulement le relevé du 5 ?
- Il veut remplir le Budget au bon moment, à chaque fois : vérifier que le rappel du soir est activé (Budget → Réglages).

## Conseils de Mathias Chauvin (6/11/2026, codés en v0.86.0)
- Décidé : forme de l'entraîneur (ordre reprise → 2e seuil → sweet spot + VO2 court → spécifique → affûtage), contenu
  validé par la science ; blocs au 1er seuil (fin de Z2) dans la sortie longue tout l'hiver ; 4 séances et plus = 2
  intensives, 3 séances = 1 intensive + sortie longue avec blocs ; nombre de jours d'entraînement demandé au questionnaire ;
  sprints max 1 fois par semaine ; sweet spot en fin de prépa ; semaines de 7 jours (pas de blocs de 8 jours) ; rappel
  léger le lendemain d'une intensive, repos actif la veille ; Z2 découpée seulement pour les longues séances au home trainer.
  Muscu lourde : option, plus tard.
- Codé (v0.86.0) : phases `seuil-tirage`, `seuil-maintien`, `fin-prepa` (saisons calculées, `modele: 'chauvin'` : reprise
  sans intensité) ; formats tirer le seuil, allonger le seuil (2 × 25 au lieu de 2 × 20 pour garder des paliers croissants),
  sweet spot long ; blocs au 1er seuil dans la sortie longue (SV1 70 % CP ±5 W selon la dérive, 85 % CP max ; la limite
  Z2/Z3 suit le SV1) ; sprints 1×/semaine (courts l'hiver, 30-45" en fin de prépa) ; 2 intensives dès 4 jours de vélo sauf
  débutant (la règle des 6 h est retirée), veille de la sortie longue permise ; rappel 2 × 10' au 1er seuil le lendemain
  d'une intensive (confirmé et plus) ; repos actif conseillé la veille d'une séance dure ; Z2 de 90' et plus découpée.
  À surveiller : en VTT avec 4 jours, la seule Z2 est la sortie technique → pas de sprints hors fin de prépa.
- Séances de course (8.7, 6/11/2026, relues) : catalogue « Simulation de course en ligne », « Sortie longue + montées en fin
  de sortie », « Simulation de course XCO », « Séance mixte sweet spot + 30/15 », méthode « Échauffement de course ».
  Réglage « type de course » (route : en ligne / cyclosportive, cyclosportive par défaut). Proche de la course : en ligne =
  VO2 courts + over-unders + simulation semaines 1 et 3 ; cyclo = seuil / VO2 longs / sweet spot long + montées en fin de
  sortie (aussi une semaine sur deux en fin de prépa) ; XCO = simulation semaine 2 ; longues plafonnées XCO 2 h 30, XCC 2 h ;
  marathon : la sortie en côtes compte comme dure. Rappel d'échauffement la veille (XCO, XCC, en ligne).
- **Sa saison à lui (phase VO2 prévue le 14/12) : à décider avant le 14/12** ; Étape du Tour 2027 : pas d'inscription
  pour l'instant (places manquées), objectif vélo principal à redéfinir.
- Quand il roulera dehors avec un capteur : refaire un test pour avoir des zones « dehors » (et un facteur capteur si
  besoin).

## Quand Titouan donnera le lien (frère, élèves)
- Prise en main guidée des premiers jours (« voici ta séance, fais-la, note ton ressenti »), demandée le 7/11/2026.
  Le questionnaire d'arrivée reste tel quel (il le trouve bien et indispensable à la personnalisation).

## Vacances de Noël 2026 : mesurer son besoin de sommeil
- Titouan reste sur le seuil de 7 h (moyenne 7 j) pour le feu en attendant (choix du 6/11/2026). Sa moyenne sur un an :
  ≈ 6 h 50 (Garmin estime son besoin vers 8 h 20, non validé). Proposé : 10-14 jours sans réveil, coucher fixe, moyenne
  des 7 dernières nuits = besoin estimé (protocole à faire relire, Kitamura 2016 cité de mémoire). Ensuite : son besoin
  comme repère dans le feu (et pour les élèves qui font le test) ; normale = max(30 j, 90 j) proposée, pas retenue.

## Vélo seul (9/11/2026)
- Course à pied, plan Campus et 5 km du 13/12 retirés. Titouan remplit le questionnaire d'arrivée (objectif vélo, jours) :
  sa saison est calculée comme celle des élèves ; ses tests CP et données restent.
- 1er seuil de la sortie longue : paliers 2 × 15 → 2 × 40 (30 → 80 min), 60 % de la sortie au plus, un cran par sortie
  réussie, un de moins en cas de dérive (choix d'entraîneur relus le 9/11). Avec une sortie longue de 2 h max, il plafonne
  à 2 × 30 : en parler s'il veut allonger sa sortie longue. Proposé, pas fait : blocs en fin de sortie (durabilité),
  une sortie sur 3-4 en phase spécifique, −5 W, dérive non comptée (Stevenson 2022).

## À reprendre ensuite (dans l'ordre proposé)
1. Phases spécifique et affûtage : attendre les courses vélo 2027.
2. Point après 4 semaines de données réelles (watts Z2, durées, seuils du feu). Relecture scientifique du 27/10 :
   Z2 : ±5 W maintenant après 2 sorties de suite (fait le 27/10). (Garde-fou course → vélo : sans objet depuis le retrait de la course.)
3. Nutrition « perte de gras légère » (depuis le 26/10/2026) : regarder la tendance du poids (visé ≈ −0,4 kg/sem.) et les performances ; ajuster le déficit si besoin.
   Depuis le 27/10 (v0.43.0) : glucides et déficit continus (3 g/kg + 1,5 × glucides brûlés ; déficit 500 − 0,6 × glucides
   brûlés, 100 à 500). Les jours de repos passent de 4 à 3 g/kg : vérifier la faim et les performances.

## Budget (construit le 26/10/2026 d'un bloc, à revoir ensemble)
- Faire le tour du module avec Titouan après quelques jours d'utilisation : ce qui manque, ce qui gêne, ce qui est en trop.
- Abonnements (v0.53.0, 29/10) : 4 créés par Titouan ; vérifier au 1er prélèvement que la notification et la carte « à vérifier » arrivent.
- Contrôle du solde du courant chaque dimanche (choisi plutôt que le 15) : voir après un mois si la fréquence convient.
- 3/11/2026 (v0.69.0, Titouan perdu avec le reste à vivre et les mois qui se chevauchent) : revenus réguliers attendus
  (salaire de fin de mois, job et bourse de début de mois), revenus du 25 ou après comptés pour le mois suivant, détail du
  reste à vivre, export CSV, relevés le 5 (pas avant). Comparaison avec son relevé bancaire à faire (export + relevé,
  fichiers effacés ensuite). Question ouverte : garder le contrôle du dimanche ou passer au seul relevé du 5 ?
- Pas de remise à zéro : livrets et placements remis à leurs valeurs du 1/10 (v0.38.0). Les livrets évoluent avec
  les virements, les placements avec les relevés du 5. Le 5/11 : premier relevé des placements. Premier bilan complet
  le 1/12 → vérifier qu'il est utile et lisible.

## Révision CAPEPS (construit le 26/10/2026 d'un bloc, à revoir ensemble)
- Faire le point après une semaine d'utilisation : journées types, capacités, rappels raté/hésitant.
- 22/01/2027 : nouveau stage → redéfinir les après-midis (Réglages → Nouveau stage).
- Choix faits sans validation : raté = la notion repart de zéro ; hésitant = un rappel de plus le lendemain ;
  minuteur sans notification quand l'appli est fermée ; en vacances, nouvelle notion du lundi au samedi.
- Option plus tard : notification des rappels du jour, export vers un calendrier.
- **À retravailler ensemble (demande du 27/10)** : rappels par thème, et des cartes de révision (flash cards) pour
  les citations, auteurs, dates. Revoir aussi la gestion d'une pile de rappels en retard après une coupure.

## Muscu (construit le 28/10/2026, pas encore utilisé)
- **Mis de côté le 3/11/2026** (v0.70.0) : Muscu et Catalogue retirés de l'accueil (`masque` dans `src/app/modules.ts`). Le Catalogue s'ouvre depuis Entraînement → Réglages ; la Muscu reste accessible par son adresse (#/muscu). Les remettre en enlevant `masque`.
- Développé couché en 5/3/1 adapté (référence 85 % du max en perte, 90 % en maintien ; série « + » à 1 rep en réserve ;
  5×5 complémentaire ; progression selon la série à 95 %). Relu par le relecteur scientifique.
- Plus tard (demande de Titouan) : relier les séances muscu à la nutrition et au module Entraînement
  (jour de la séance dans la semaine, charge, besoins du jour). Pas pour l'instant.
- Quand il s'y met : choisir le jour (le mercredi avec le renfo genoux ?) et vérifier la durée (~35 min).

## Plus tard
- Réglages Entraînement refaits (v0.79.0, 5/11/2026) : encarts réductibles (« Modifier › » / « Réduire ▴ », entourés d'orange
  ouverts, composant `core/ui/Repliable.tsx`), profil sportif (réglage `profil-sportif` : sports, niveau, temps, matériel,
  points sensibles, muscu ; discipline, courses et créneaux dans le programme). Retirés de l'écran : rappels, programme
  (phases, dates de tests, Z2 de départ : gérés par l'appli, plus d'écran pour les changer), charge de référence, historique
  des tests. Même style d'encart au Budget et à la Révision (v0.80.0).
- Profil sportif branché sur le moteur (v0.81.0, 5/11/2026, règles du relecteur validées par Titouan) : débutant +5 %/sem.
  (sinon +7,5 %) ; confirmé/expert ≥ 6 h : 2e intensité vélo les semaines sans course dure (2 séances dures au total) ;
  < 4 h : pas de sprints en séries ; budget plafonné au haut de la tranche d'heures moins la course ; genoux : cadence ≥ 80
  dans le détail des séances ; muscu (si 1-2 séances) : alerte le jour de l'intensité ou la veille d'une séance dure / longue,
  renfo compté au RPE × durée quand le RPE est noté ; course : alerte si une sortie dépasse de 10 % la plus longue des 30 j
  (Frandsen 2025). Défauts : intermédiaire, 4-6 h. **Reste à faire : mode sans capteur (FC / RPE, charge en sRPE, pas de
  contrôle bloc par bloc)** pour ses élèves ; débutant « palier 1 et reprise 4 semaines » pas encore codé.
- Garde-fou W' (v0.82.0, 5/11/2026, relecteur) : une répétition ne vide pas plus de 80 % du W' (sinon watts baissés, jamais
  sous la CP) ; W' utilisé seulement après un test complet 12-7-3 et pas le 1er test CP (actif à partir de son prochain test
  complet). Pmax : rien de plus (déjà dans Progrès, Titouan n'en veut pas davantage). Pas de W'bal en direct.
  Kcal vélo : 1 kcal/kJ gardé (rendement ~20 %, repos déjà compté).
- **Comptes pour élèves / frère (v0.84.0, 5/11/2026)** : une seule appli (Coach), même moteur pour tous ; inscription avec
  un code à usage unique (fonction `inscription`, SQL `04-codes.sql`, Titouan dans la table `coachs`, inscriptions libres
  fermées) ; questionnaire d'arrivée (Toi, profil, semaine, course principale → saison calculée `metrics/saison.ts`, puis
  Intervals.icu) ; accueil = Entraînement seul ; pas d'accès de Titouan aux données des élèves (pas voulu pour l'instant).
  Course à pied mise de côté (pas de programme pour les autres ; plan Campus de Titouan inchangé, à rediscuter) ;
  enduro et descente retirés des propositions. Ancienne appli `suivi-coaching` : dépôt supprimé par Titouan le 6/11/2026.
  Semaine allégée comptée sur toute la saison (pour tout le monde, validé par Titouan).
  **Plus tard** : questionnaire santé PAR-Q+ (si on ouvre à plus de monde ; accord parental pour un mineur) ;
  renfo / muscu « type force » selon la science et ses conseils d'entraîneurs ; mode sans capteur.
- VTT (3/11/2026, demande de Titouan pour ses élèves) : section VTT du catalogue (v0.66.0) puis **moteur** (v0.67.0) :
  réglage « Discipline visée » (Réglages → Avancé → Programme vélo ; route par défaut). XCO/XCC : intervalles longs d'Inoue,
  sprints de 30" en séries (à fond, allure libre), relances 1 séance de seuil sur 3 ; marathon : sortie longue en côtes
  (comptée comme dure) ; enduro : spéciales une semaine sur deux ; descente : sprints courts ; une Z2 par semaine en VTT
  technique (charge à l'effort perçu, ni FC ni watts jugés). Relu par le relecteur scientifique.
  **Gardé en tête (Titouan : « ça dépendra du temps qu'on prévoit ») :** 2 séances dures par semaine (les essais XCO en
  faisaient 2-3 ; le moteur n'en met qu'une), muscu reliée à l'Entraînement (conseillée en enduro et descente), W/kg dans Progrès.
  Littérature mince : 4 petits essais en XCO, aucun en XCC, XCM, enduro, descente. À vérifier : PMID manquants (PubMed bloqué),
  Inoue 2026 et Protzen 2026 lus seulement en notice.
- Repère pour l'avenir (infographie montrée par Titouan le 28/10, « on reste comme ça ») : répartition pyramidale par mois
  ~12 sorties Z1-Z2 (45′-2 h 30), 4 sorties longues 3-6 h avec effort en fin de sortie, 3-4 intervalles Z3 (20-60 min),
  2 intervalles Z4-Z5 (10-25 min), muscu lourde des jambes l'hiver 4-8×/mois. Pistes : effort en fin de sortie longue
  (durabilité), sortie longue dehors quand il aura un capteur, programme jambes dans Muscu (le développé couché n'aide pas le vélo).
- Envoi vers Garmin / Zwift (v0.52.0, 28/10) : boutons dans le détail d'une séance vélo → calendrier Intervals.icu
  (POST/PUT /athlete/{id}/events, champ `indoor` pour Zwift, watts absolus, « freeride » pour les efforts à fond, sans ERG).
  Testé avec succès par Titouan le 28/10 (l'envoi passe) ; reste à vérifier l'affichage sur la montre et dans Zwift. Limites : une séance
  déplacée de jour change d'identifiant (ancienne version à retirer à la main dans Intervals) ; pas d'envoi automatique.
  29/10 : Titouan est repassé sur Zwift pour le vélo ; Garmin servira peut-être pour la course. Il laisse les deux boutons.
  À l'avenir : envoi vers son compteur iGPSPORT (sorties dehors). Pas de lien direct Intervals → iGPSPORT ; pistes :
  TrainingPeaks, l'appli iGPSPORT Android/Windows, ou un fichier .FIT à charger à la main. Modèle du compteur à demander.
- Catalogue scientifique (78 séances, `catalogue/`) : depuis la v0.55.0, le programme y pioche ses 16 formats d'intensité
  (bloc `programme`) et chaque séance prévue montre sa fiche. Reste possible : choisir les séances selon la qualité à
  travailler, ajouter des formats (ex. 1 h chrono, puissance variée). Certains PMID restent à vérifier (PubMed bloqué).
- Plages de watts et repère de cadence (v0.55.0) : vérifier dans Zwift que le repère de cadence s'affiche bien (envoyé en « rpm »)
  et, après quelques séances, que le plafond au seuil / sweet spot / tempo ne juge pas trop sévèrement.
- Banques de séances repérées (28/10) : bibliothèque Intervals.icu (déjà relié à l'appli), TrainerDay (communauté, export .zwo),
  WhatsOnZwift (séances Zwift). Idée : importer des séances .zwo dans l'appli ou envoyer les nôtres vers Zwift via Intervals.
- Étape du Tour 2027 (11/07, Cluses – Les Saisies, 154 km, 4 850 m) : simple idée pour l'instant. Si elle devient
  l'objectif : phase spécifique après le CAPEPS (montées longues Z3, sorties 4-6 h, 60-90 g/h), affûtage 10-14 j.
- Zones (2/11, Titouan cherche des études avant de trancher) : proposition d'un modèle 5 zones par domaines
  (Z1 < 60 % CP · Z2 60 % → LT1 ~78 % · Z3 LT1 → CP · Z4 CP → CP + W′/120 · Z5 au-delà) + vue 3 zones de Seiler.
  L'appli reste pour l'instant en 6 zones % CP (v0.61.0). LT1 à mesurer (DFA-α1) plutôt qu'estimer.
- Prise de sang de contrôle (hémoglobine, ferritine) avant la préparation de l'Étape du Tour, et en cas de fatigue
  inhabituelle : gros volume + déficit (Lippi 2020 : hématocrite et hémoglobine plus bas avec le volume ; RED-S).
- Études lues en entier le 2/11 (envoyées par Titouan) : Galán-Rioja 2023, Neal 2013, Mateo-March 2026, Ventura 2023,
  de Oliveira 2024, Magalhães 2024 ajoutées au catalogue. Écartées : Nabofa 2025 (incohérences), bicarbonate (hors sujet).
- Durabilité (30/10, « intéressant à bosser », mis de côté) : prépa en 4 temps proposée. Base : sortie longue Z2 qui
  s'allonge + sprints, muscu lourde jambes 2×/sem (seul levier prouvé, Rønnestad 2011). Construction : blocs sweet spot
  en fin de sortie longue, intervalles après 1 h 30 de Z2, 60-90 g/h. Spécifique : 4-6 h avec efforts dans la dernière
  heure, deux jours longs d'affilée. Affûtage 10-14 j. Suivi : test de durabilité (5′ frais vs après 2 h 30) toutes les
  6-8 semaines + découplage. Calendrier envisagé : construction mars-mai, spécifique mai-juin (après le CAPEPS).
- Musculation : 30 min/sem. au poids du corps (genoux, prévention des blessures), choix de Titouan faute de temps.
  Musculation lourde (Rønnestad & Mujika 2014) à reproposer après le CAPEPS.
- Nutrition : la carte « maintien mesuré » apparaît dès 14 jours (provisoire, vers le 9/11/2026), puis confirmée à 3 semaines (vers le
  16/11/2026) : en parler avec Titouan AVANT qu'il l'accepte. Lui demander si ses saisies sont complètes (huile,
  sauces, grignotages : on oublie souvent 10-20 %, ce qui ferait baisser ses objectifs à tort), regarder performances et feux.
- Pesée 5 matins par semaine depuis le 27/10 (lun., mar., mer., sam., dim. ; jeudi et vendredi = internat).
- Nutrition : plus de comptage de pas depuis le 27/10 (v0.44.0) : vie quotidienne = métabolisme × 1,4 (essai à 1,5
  le 29/10, revenu à 1,4 : on ajuste selon le poids), marche, stages et activités occasionnelles (five, petite rando) compris : elles ne sont pas importées
  (choix de Titouan, v0.56.0 annulée). Le maintien mesuré (~16/11) dira si 1,4 est juste (Titouan pense être plutôt à 1,5).
- Zwift (repris dès le test du 1/11, ERG désactivé) : FTP Zwift = CP après chaque test (notification le lendemain à 9 h).
- Format « 1 h chrono » (Methodic Cycling, 29/10) : 10-15′ d'échauffement, 30-35′ de corps de séance à récupérations
  courtes, 6-10′ de retour au calme. Pour les créneaux d'1 h et les semaines chargées. L'échauffement adapté et le retour
  au calme dégressif sont faits (v0.54.0).
- SV1 / SV2 (29/10) : la CP ≈ SV2 ; SV1 n'est pas mesuré (Z2 calée par découplage + RPE). Plus tard : estimer SV1 avec
  la ceinture (DFA α1 ≈ 0,75, Rogers 2021 ; calculé par Intervals.icu) pour caler la Z2.
  6/11 : impossible avec les données actuelles (Zwift n'enregistre pas les intervalles RR ; l'appli ne les importe pas).
  Il faut enregistrer la séance sur un appareil Garmin avec l'enregistrement de la VFC activé, avec la HRM-Pro Plus.
- Règles chiffrées de progression (4 paliers, +2,5 % / −5 % de watts) : règles d'entraîneur (PDF kJ), sans essai dédié.
  Proposé le 29/10 de les faire relire ; à refaire si les tests CP ne progressent pas.
- Capteur de puissance dehors : vrais kJ des sorties extérieures. D'ici là, Titouan ne fait que du home trainer.
- Semaine chargée : le relecteur suggérait de la compter comme semaine allégée si celle-ci tombe dans les 2 semaines
  qui suivent (pas fait, pour rester simple) ; à revoir si les semaines chargées deviennent fréquentes.
- Autres modules : Nutrition (module à part, plus tard).
- Module course à pied (aujourd'hui saisi depuis Campus Coach) et vélo généré selon les objectifs de saison : à repenser plus tard.

## Fait
- 2/11/2026 (v0.65.0) : contrôle de chaque séance importée (blocs, séries 30/15, over-unders, Z2 < 5 min au-dessus du
  1er seuil) avec verdict ✅/⬇️/⬆️, FC de fin de bloc, RPE par bloc et bilan ; une séance d'intensité tenue valide la
  progression. À vérifier sur les premières vraies séances (recalage du fichier sur la séance prévue). Seuil « 5 min »
  = choix d'entraîneur, pas encore relu.
- 2/11/2026 (v0.64.0) : d'après le Système kJ (LSDC) et Just Push : compteur kJ 90 j vs 90 j d'avant, petites victoires
  (régularité, Z2 et intervalles comparés à la précédente), temps limite (CP + W′) sur les efforts, calculateurs col et
  glucides, test CP proposé explicitement (Titouan valide), carte « sortie hors plan » qui propose de recalculer la semaine.
  Pas repris : paliers polarisé → pyramidal (pas de preuve), indice E (CP suffit jusqu'à 20 min ; loi de puissance −0,08 au-delà
  dans le calculateur), défi tous les 21 jours, motivation/stress au bilan. Protocole muscu maison LSDC (endurance de force)
  : transition possible avant la muscu lourde, à décider.
- 2/11/2026 (v0.63.0) : bilan des 34 études. 1er seuil estimé à 70 % de la CP (Z2 56-70 %), domaines FC moyenne = Z3+Z4,
  zones de FC proposées à partir des sorties (Réglages → Avancé → Zones vélo), format 8′ plafonné à 4 × 8′, alerte « CP en
  hausse » (≥ 4 % au-dessus du test), catalogue 81 fiches (méthodes zones, VFC, glucides à l'effort). Reste : D (affûtage,
  durabilité, muscu) dans la prépa de l'Étape du Tour ; 1er seuil à mesurer (labo ou DFA-α1).
- 2/11/2026 (v0.61.0) : zones de puissance en % de CP ancrées sur les domaines (Z4 91-100 %, Z5 101-120 %), bouton
  « Recaler sur ma CP », intensité des séances vélo jugée par les watts (≥ 1 min > CP = haute ; ≥ 10 min 76-100 % = moyenne).
  Bornes de FC proposées par le relecteur, à saisir par Titouan dans Zones vélo, puis à recaler sur ses sorties
  (FC stabilisée après 20′ à 75 % CP ; bloc de 20′ à 95-100 %). Les séances déjà importées gardent le classement par FC.
- 30/10/2026 (v0.59.0) : séances prévues dans Google Agenda (lien iCal privé, journée entière, fonction « agenda » à créer).
- 29/10/2026 (v0.58.0) : bilan nutrition du dimanche (faim, énergie, tour de taille, rappel photo), ajustement du déficit
  proposé (200 à 600 kcal, ±100/200 au plus toutes les 2 semaines, pause de 7 jours si alerte), maintien mesuré provisoire
  dès 14 jours. Fonction « rappels » à redéployer (message du dimanche). Pas encore pris en compte : VFC orange/rouge
  ≥ 3 jours sur 7 et séances clés ratées comme signaux d'alerte (proposés par le relecteur).
- 29/10/2026 (v0.55.0) : plages de watts, repère de cadence, Entraînement branché sur le catalogue (78 séances, v3). Pas de séance de force sur le vélo (preuve faible) ; muscu lourde des jambes : après le CAPEPS.
- 29/10/2026 (v0.54.0) : échauffement selon la séance (seuil 15′, VO2 20′ avec 5′ de souffle), retour au calme dégressif.
- 29/10/2026 (v0.53.0) : abonnements dans le Budget, FTP estimée, rappel FTP Zwift ; fonction « rappels » redéployée par Titouan.
- 27/10/2026 (v0.42.0) : lignes d'explication sous le feu, nuit sans montre, case « pas de ceinture », semaine chargée
  (+ retour après semaines très légères), pesée reportée au mercredi (retirée en v0.45.0 : pesée 5 matins par semaine), contrôle du solde le dimanche, règle d'or du Budget.
- 27/10/2026 : garde-fou course → vélo, FC max vue dans les séances, reprise après maladie, Z2 sur 2 sorties.
- Rappels installés et testés le 23/10/2026 (matin 8 h 30, pesée le mardi).
