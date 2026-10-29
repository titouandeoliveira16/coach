# Catalogue de séances

Base de séances d'entraînement **appuyées sur la littérature scientifique**, rangée pour qu'une appli (Coach ou une
appli future) puisse y piocher : « je veux travailler la VO2max à vélo », « un test de VMA », « du renfo pour les genoux ».
Depuis la v0.55.0, l'**Entraînement y pioche** sa banque de séances d'intensité vélo : chaque séance qui a un bloc
`programme` (paramètres et 4 paliers de progression) devient un format du programme (`src/metrics/programme.ts`, `FORMATS`),
et la séance prévue affiche sa fiche. Pour ajouter une séance au programme : l'écrire dans `generer.py`, puis appeler `prog(...)`.

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
| `programme` | (facultatif) format utilisé par l'Entraînement : `id` (gardé, l'historique s'y réfère), `famille` du programme, travail et récupération (s, % CP), `paliers` [séries, répétitions, durée du travail], `preuve`, `source`, `ordre` |

La `cadence` des efforts vélo est un **repère** (pas une consigne) : 85-95 tr/min de 76 à 99 % de la CP, 90-105 au-delà,
100-120 à fond, libre en endurance (Hansen & Rønnestad 2017, Lucía 2004), sauf séances à cadence imposée (force, vélocité).

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
