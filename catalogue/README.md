# Catalogue de séances

Base de séances d'entraînement **appuyées sur la littérature scientifique**, rangée pour qu'une appli (Coach ou une
appli future) puisse y piocher : « je veux travailler la VO2max à vélo », « un test de VMA », « du renfo pour les genoux ».
Le catalogue n'est pas encore branché sur l'appli : l'enchaînement des séances et leur progression viendront ensuite.

- Données : [`seances.json`](seances.json), généré par [`generer.py`](generer.py) (`python3 catalogue/generer.py catalogue/seances.json`).
  Pour modifier une séance, modifier `generer.py` puis regénérer.
- Contrôle : `src/catalogue.test.ts` vérifie la forme du fichier (identifiants uniques, durées, références…).
- Chaque séance et chaque référence ont été relues par le sous-agent `relecteur-scientifique`.

## Rangement

| Champ | Contenu |
|---|---|
| `sport` | `velo`, `course`, `force` (renforcement), `methode` (organisation de l'entraînement) |
| `famille` | ce que la séance travaille : `recuperation`, `endurance`, `durabilite`, `tempo`, `seuil`, `vo2max`, `anaerobie`, `sprint`, `force`, `specifique`, `test`, `force-lourde`, `force-explosive`, `prevention`, `organisation` |
| `objectif` | la qualité physiologique visée, en une ligne |
| `zone`, `rpe` | zone d'intensité (Z1 à Z7) et effort perçu (0-10) |
| `niveau` | `tous`, `intermédiaire`, `confirmé` |
| `unite` | `%CP` (vélo, puissance critique ≈ FTP), `%VMA` (course), `%1RM` (force) |
| `deroule` | étapes : `echauffement`, `effort`, `recup`, `retour`, `repetition` (avec `fois` et `etapes`). Durées en **secondes**, `intensite` = [min, max] dans l'unité, `max: true` = à fond, `cadence` en tr/min |
| `exercices` | renforcement : nom, séries, répétitions, repos (s) |
| `dureeMin`, `travailMin` | durée totale et temps de qualité (au-dessus de l'endurance : ≥ 76 % CP, ≥ 80 % VMA, ou à fond) |
| `variantes` | paliers de progression ou versions plus courtes / plus longues |
| `quand` | phases (`base`, `construction`, `spécifique`, `affûtage`…), fréquence par semaine, récupération nécessaire |
| `conseils` | exécution, dont la version **sans ERG** sur Zwift |
| `preuve` | `niveau`, `resultat` (ce que montrent les études) et `references` (auteurs, année, titre, revue, PMID) |

### Niveaux de preuve

- **prouvé** : au moins un essai contrôlé (ou une méta-analyse) montre l'effet, dans une population proche.
- **plausible** : mécanisme et données partielles (effet aigu, autre sport, petite étude).
- **mitigé** : études contradictoires.
- **pratique** : méthode d'entraîneur répandue, sans essai dédié.
- **faible** : peu ou pas d'effet démontré.

### Zones (vélo, en % de la CP)

Z1 < 55 % · Z2 56-75 % · Z3 76-90 % (sweet spot 88-94 %) · Z4 91-105 % · Z5 106-120 % · Z6 > 120 % · Z7 sprint.
Modèle à 3 zones (Seiler) : zone 1 sous le premier seuil (≈ Z1-Z2), zone 2 entre les seuils (≈ Z3-Z4), zone 3 au-dessus (≈ Z5+).

### Export futur

Le `deroule` est pensé pour être traduit en séance structurée (Intervals.icu → Zwift, fichier `.zwo`) : chaque étape
a une durée et une plage d'intensité ; `max: true` devient un effort libre (« free ride »). Toujours sans ERG.
