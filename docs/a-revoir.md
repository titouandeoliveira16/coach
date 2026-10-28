# À revoir avec Titouan

Points décidés ou mis de côté, à reprendre au bon moment.

## Après le 5 km du 13/12/2026
- Le vélo repasse en priorité : **4 séances vélo par semaine** au lieu de 3.
- La course passe de **3 à 2 séances** par semaine.
- À adapter alors : semaine type (Réglages → Vélo), budget kJ (le plafond actuel de ~2 300 kJ/sem. vient des 3 créneaux), placement des séances dures.

## À reprendre ensuite (dans l'ordre proposé)
1. Phases spécifique et affûtage : attendre les courses vélo 2027.
2. Point après 4 semaines de données réelles (watts Z2, durées, seuils du feu). Relecture scientifique du 27/10 :
   Z2 : ±5 W maintenant après 2 sorties de suite (fait le 27/10). Vérifier aussi le garde-fou course → vélo.
3. Nutrition « perte de gras légère » (depuis le 26/10/2026) : regarder la tendance du poids (visé ≈ −0,4 kg/sem.) et les performances ; ajuster le déficit si besoin.
   Depuis le 27/10 (v0.43.0) : glucides et déficit continus (3 g/kg + 1,5 × glucides brûlés ; déficit 500 − 0,6 × glucides
   brûlés, 100 à 500). Les jours de repos passent de 4 à 3 g/kg : vérifier la faim et les performances.

## Budget (construit le 26/10/2026 d'un bloc, à revoir ensemble)
- Faire le tour du module avec Titouan après quelques jours d'utilisation : ce qui manque, ce qui gêne, ce qui est en trop.
- Fonction serveur « rappels » à redéployer (v0.42.0 : contrôle du solde le dimanche).
- Contrôle du solde du courant chaque dimanche (choisi plutôt que le 15) : voir après un mois si la fréquence convient.
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
- Développé couché en 5/3/1 adapté (référence 85 % du max en perte, 90 % en maintien ; série « + » à 1 rep en réserve ;
  5×5 complémentaire ; progression selon la série à 95 %). Relu par le relecteur scientifique.
- Plus tard (demande de Titouan) : relier les séances muscu à la nutrition et au module Entraînement
  (jour de la séance dans la semaine, charge, besoins du jour). Pas pour l'instant.
- Quand il s'y met : choisir le jour (le mercredi avec le renfo genoux ?) et vérifier la durée (~35 min).

## Plus tard
- Repère pour l'avenir (infographie montrée par Titouan le 28/10, « on reste comme ça ») : répartition pyramidale par mois
  ~12 sorties Z1-Z2 (45′-2 h 30), 4 sorties longues 3-6 h avec effort en fin de sortie, 3-4 intervalles Z3 (20-60 min),
  2 intervalles Z4-Z5 (10-25 min), muscu lourde des jambes l'hiver 4-8×/mois. Pistes : effort en fin de sortie longue
  (durabilité), sortie longue dehors quand il aura un capteur, programme jambes dans Muscu (le développé couché n'aide pas le vélo).
- Envoi vers Garmin / Zwift (v0.52.0, 28/10) : boutons dans le détail d'une séance vélo → calendrier Intervals.icu
  (POST/PUT /athlete/{id}/events, champ `indoor` pour Zwift, watts absolus, « freeride » pour les efforts à fond, sans ERG).
  Testé avec succès par Titouan le 28/10 (l'envoi passe) ; reste à vérifier l'affichage sur la montre et dans Zwift. Limites : une séance
  déplacée de jour change d'identifiant (ancienne version à retirer à la main dans Intervals) ; pas d'envoi automatique.
- Catalogue scientifique (73 séances, `catalogue/`, module Catalogue) : à brancher plus tard sur le programme (choix des
  séances selon la qualité à travailler, progression). Certains PMID restent à vérifier (PubMed bloqué pendant la relecture).
- Banques de séances repérées (28/10) : bibliothèque Intervals.icu (déjà relié à l'appli), TrainerDay (communauté, export .zwo),
  WhatsOnZwift (séances Zwift). Idée : importer des séances .zwo dans l'appli ou envoyer les nôtres vers Zwift via Intervals.
- Étape du Tour 2027 (11/07, Cluses – Les Saisies, 154 km, 4 850 m) : simple idée pour l'instant. Si elle devient
  l'objectif : phase spécifique après le CAPEPS (montées longues Z3, sorties 4-6 h, 60-90 g/h), affûtage 10-14 j.
- Musculation : 30 min/sem. au poids du corps (genoux, prévention des blessures), choix de Titouan faute de temps.
  Musculation lourde (Rønnestad & Mujika 2014) à reproposer après le CAPEPS.
- Nutrition : la carte « maintien mesuré » apparaît seule après 3 semaines de repas notés et de pesées (vers le
  16/11/2026) : en parler avec Titouan AVANT qu'il l'accepte. Lui demander si ses saisies sont complètes (huile,
  sauces, grignotages : on oublie souvent 10-20 %, ce qui ferait baisser ses objectifs à tort), regarder performances et feux.
- Pesée 5 matins par semaine depuis le 27/10 (lun., mar., mer., sam., dim. ; jeudi et vendredi = internat).
- Nutrition : plus de comptage de pas depuis le 27/10 (v0.44.0) : vie quotidienne = métabolisme × 1,4, marche comprise
  (choix de Titouan). Le maintien mesuré (~16/11) dira si 1,4 est juste.
- Zwift (repris dès le test du 1/11, ERG désactivé : Titouan suit les watts aux vitesses virtuelles) : envoi possible
  des séances de l’appli dans Zwift via le calendrier Intervals.icu, à proposer après le test. FTP Zwift = CP.
- Capteur de puissance dehors : vrais kJ des sorties extérieures. D'ici là, Titouan ne fait que du home trainer.
- Semaine chargée : le relecteur suggérait de la compter comme semaine allégée si celle-ci tombe dans les 2 semaines
  qui suivent (pas fait, pour rester simple) ; à revoir si les semaines chargées deviennent fréquentes.
- Autres modules : Nutrition (module à part, plus tard).
- Module course à pied (aujourd'hui saisi depuis Campus Coach) et vélo généré selon les objectifs de saison : à repenser plus tard.

## Fait
- 27/10/2026 (v0.42.0) : lignes d'explication sous le feu, nuit sans montre, case « pas de ceinture », semaine chargée
  (+ retour après semaines très légères), pesée reportée au mercredi (retirée en v0.45.0 : pesée 5 matins par semaine), contrôle du solde le dimanche, règle d'or du Budget.
- 27/10/2026 : garde-fou course → vélo, FC max vue dans les séances, reprise après maladie, Z2 sur 2 sorties.
- Rappels installés et testés le 23/10/2026 (matin 8 h 30, pesée le mardi).
