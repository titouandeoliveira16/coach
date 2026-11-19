# À revoir (partie publique)

Depuis l'audit du 11/11/2026, les notes de suivi personnelles (santé, poids, budget, emploi du temps, saison) ne sont
plus dans ce dépôt public : Titouan les garde dans un fichier privé (« notes-privees-coach.md »), qu'il donne en début
de conversation quand il faut s'en servir. Ici ne restent que les chantiers techniques, sans aucune donnée personnelle.

## Audit du 11/11/2026 (voir AUDIT.md)
- Plan de correction en 9 étapes, suivi dans AUDIT.md.
- Supabase : `sql/05` et `sql/06` sont joués (colonne `seq` présente, rappels vérifiés le 13/11/2026).

## Audit des experts du 14/11/2026 (lot 1 fait en 14.1.0)
- Fait : synchro (coupures iPhone, ouverture hors ligne), limites serveur (`sql/08-limites.sql`, appliqué), inscription
  (8 caractères, codes valables 30 jours, 10 essais ratés par heure, accord santé), contrôles Intervals, CSP, mineurs sans perte de gras.
- Reste : rotation de la clé de chiffrement Intervals, nom du modèle `chauvin`
  dans le code, épingler les versions des actions GitHub.
- À régler dans le tableau de bord Supabase : protection contre les mots de passe compromis, inscriptions libres désactivées.

## Lot 2 de l'audit des experts (fait en 14.2.0, règles relues)
- Tranché le 16/11/2026 : course très loin → base plus longue au début (14.2.1) ; débutant à +5 % par semaine.
- À confirmer à l'usage : bilan de semaine du dimanche (séance du jour comptée comme faite).
- À vérifier à l'usage : séance dédiée au 1er seuil qui avance d'un cran par séance ; test CP à la place de la sortie
  longue ; muscu à 4 exercices (volume à ajuster plus tard si besoin).

## Compteur iGPSPORT (14.3.0, 16/11/2026)
- Fonction `igpsport` + `sql/09` : accès non officiel à iGPSPORT (même chemin que l'outil libre intervalssync) →
  .fit envoyés dans Intervals.icu (external_id `igpsport_<id>`), 12 par compte et par passage, toutes les 15 min.
- À surveiller : si iGPSPORT change son site, l'erreur s'affiche dans Réglages → Compteur iGPSPORT ; comptes chinois
  (app.igpsport.cn) pas gérés.

## Sans course et appareils (14.6.0, 16/11/2026)
- Sans course : cycle vers un test de début de saison (1er mars par défaut), sans semaines course, affûtage ni
  récupération ; carte « Ton cycle est fini » ensuite. Saisons « forme générale » existantes recalculées une fois (V7).
- Appareils (questionnaire + Mon profil sportif) : conseils de connexion Intervals et boutons d'envoi selon le matériel.
  Bryton : pas encore de lien automatique (l'outil libre intervalssync sait le faire : à ajouter si un élève en a un).

## Chantiers techniques en attente
- Mode sans capteur de puissance (FC / RPE, charge en sRPE) pour les comptes invités.
- Prise en main guidée des premiers jours pour les comptes invités.
- Questionnaire santé (PAR-Q+) et accord parental avant d'ouvrir à plus de monde.
- Envoi des séances vers un compteur (iGPSPORT…) ; Intervals → TrainingPeaks ou fichier .FIT.
- 1er seuil mesuré (DFA-α1 avec une ceinture qui enregistre les intervalles RR) plutôt qu'estimé.
- Durabilité : efforts en fin de sortie longue, test 5′ frais vs après 2 h 30.
- Catalogue : certains PMID restent à vérifier (PubMed inaccessible depuis l'environnement).
- Budget de l'entretien après la dernière course A (reste au niveau d'avant).
- Plafond « heures par semaine » du profil sportif : vérifier qu'il ne bloque pas la hausse des kJ.

## Audit complet du 18/11/2026 (32 experts, lot 1 fait en 14.12.0)
- Fait : recalcul de la semaine qui n'écrase plus une séance faite ou déplacée (test `plan/regeneration.test.ts`), muscu
  jamais sur un jour passé ni deux fois le même jour, classement « dure » sur la puissance lissée 30 s (≥ 3 min au-dessus de
  la CP), technique VTT non jugée sur les watts, test CP impossible refusé, VFC et pouls hors limites ignorés, feu sans
  « tout est normal » quand il manque des mesures, célébration remise à l'écran, Aujourd'hui qui voit le nouveau jour,
  remboursement du mois suivant, rappels de Révision qui ne se remplissent plus, synchro (horloge, changement de compte,
  Safari qui vide la base, envoi refusé coupé en deux), écran « Nouvelle version » après une mise à jour, aides corrigées.
- Lot 2 fait en 14.13.0 (choix du 19/11) : règle « saturation » retirée, pouls haut 2 matins de suite → orange (relu,
  Alavi 2022), muscu bloquée avant 18 ans, charge en TSS comme Intervals, FTP = 97 % de la CP partout (relu, Karsten 2021),
  ancien module Muscu, alerte de course à pied et séances course / enduro du catalogue supprimés. Révision mise de côté.
- Reste : saison route et VTT (allégées, sortie longue, semaine de course A, affûtage VTT),
  dimanche → lundi (jours durs), changement de montre, nutrition (plancher du maintien, rappels de pesée, mineurs), muscu des mineurs, Révision recalée sur
  le concours, accessibilité, textes, sauvegarde chiffrée, clé de chiffrement dédiée, page de confidentialité, audit en CI.
- Lot 1 bis fait en 14.14.0 : bouton « J'ai changé de montre » (Réglages → Intervals.icu), fond et fatigue qui partent de
  la charge des 4 premières semaines (plus de « +91 % »), W/kg du jour du test partout, alerte des zones qui ne revient
  plus, VFC en ms, axe du pouls d'au moins 10 bpm, « 7 derniers jours » seulement avec assez d'historique, « 1 h 60 »,
  .FIT à 1 point toutes les 2-4 s et pauses, sortie à la main + importée = une seule, une petite sortie n'emporte plus la
  séance d'un autre jour, clé Intervals refusée signalée sur Aujourd'hui, flux non reçu relu au prochain import.
- 19/11/2026 : jeton `SUPABASE_ACCESS_TOKEN` des GitHub Actions renouvelé (l'ancien était refusé) ; déploiement des 5
  fonctions vérifié. Il expire : penser à le renouveler avant sa date de fin (supabase.com → Access Tokens).
