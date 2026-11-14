# À revoir (partie publique)

Depuis l'audit du 11/11/2026, les notes de suivi personnelles (santé, poids, budget, emploi du temps, saison) ne sont
plus dans ce dépôt public : Titouan les garde dans un fichier privé (« notes-privees-coach.md »), qu'il donne en début
de conversation quand il faut s'en servir. Ici ne restent que les chantiers techniques, sans aucune donnée personnelle.

## Audit du 11/11/2026 (voir AUDIT.md)
- Plan de correction en 9 étapes, suivi dans AUDIT.md.
- Supabase : exécuter `sql/05-synchro-seq.sql` si ce n'est pas déjà fait (`sql/06-rappels-secret.sql` : fait le 13/11/2026, rappels vérifiés).

## Audit des experts du 14/11/2026 (lot 1 fait en 14.1.0)
- Fait : synchro (coupures iPhone, ouverture hors ligne), limites serveur (`sql/08-limites.sql`, appliqué), inscription
  (8 caractères, codes valables 30 jours, 10 essais ratés par heure, accord santé), contrôles Intervals, CSP, mineurs sans perte de gras.
- Reste : écriture d'une semaine en une seule fois (atomique), rotation de la clé de chiffrement Intervals, nom du modèle `chauvin`
  dans le code, épingler les versions des actions GitHub.
- À régler dans le tableau de bord Supabase : protection contre les mots de passe compromis, inscriptions libres désactivées.

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
