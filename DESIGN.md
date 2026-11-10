# Coach : charte visuelle

Version retenue le 10/11/2026 (direction « Nuit », maquettes V1 à V6). **La forme change, pas le fond** : toutes les
fonctions, tous les réglages et toutes les aides restent.

## Couleurs (thème sombre uniquement)

| Rôle | Jeton CSS | Hex |
|---|---|---|
| Fond | `--color-fond` | `#000000` |
| Carte | `--color-surface` | `#0e0e0f` |
| Carte surélevée, champ | `--color-surface-2` | `#18181a` |
| Ligne, bordure | `--color-bordure` | `#1f1f21` |
| Texte principal | `--color-texte` | `#ffffff` |
| Texte secondaire | `--color-texte-2` | `#a1a1a6` |
| Texte discret | `--color-texte-3` | `#8a8a90` (contraste ≥ 4,5 sur les cartes) |
| Accent Entraînement (orange) | `--color-entrainement` | `#ff6a13` |
| Orange doux (fond de pastille) | `--color-accent-doux` | `#2a1206` |
| Orange clair (texte sur fond doux) | `--color-accent-clair` | `#ff9a5c` |

Couleurs qui codent une information, **toujours avec un mot ou un nom à côté** :

| Information | Hex |
|---|---|
| Zones Z1 · Z2 · Z3 · Z4 · Z5 · Z6 | `#7c7b74` · `#3b9eff` · `#46a758` · `#ffc53d` · `#f76b15` · `#e5484d` |
| Feu vert · orange · rouge | `#30d158` · `#ff9f0a` · `#ff453a` (tokens `bon` · `attention` · `mauvais`, jamais de couleur écrite en dur) |
| Sommeil | `#9b87f5` |
| Nutrition | `#2ec5d3` |
| Course A · B · C | orange accent · `#ffc53d` · `#3b9eff` |
| Réalisé différent du prévu | `#ffd60a` |

Les autres modules gardent leur accent (Révision `#60a5fa`, Budget `#facc15`), sur les mêmes noirs.

## Police

Une seule famille, **Archivo** (variable, hébergée dans l'appli : `@fontsource-variable/archivo`, axes graisse et largeur).
- Titres d'écran : 800, largeur 125 %, MAJUSCULES, 30 px.
- Petits titres de carte (étiquettes) : 600, casse normale, 13 px, texte secondaire (10/11/2026 : moins de majuscules).
- Capitales larges réservées au titre de l'écran et aux gros chiffres ; boutons en casse normale, gras.
- Échelle de tailles : 11 · 13 · 15 · 18 · 22 · 28 px.
- Gros chiffres : 800, largeur 112 %, chiffres tabulaires.
- Texte : 400 / 600, largeur 100 %, 14-15 px.

## Formes et espacements

- Arrondis : cartes 14 px, champs et petites tuiles 10 px, boutons principaux 14 px, pastilles (onglets, choix) en pilule (999 px).
- Cartes sans bordure (fond `surface` sur fond noir).
- Espacements : 4 · 8 · 12 · 16 · 24 px ; marges d'écran 18 px.

## Icônes

**Lucide** (`lucide-react`), trait 1,8, 16 à 22 px, couleur du texte. Elles remplacent les emojis d'interface
(vélo, renfo, course, repos, nutrition, sommeil, réglages…).

## Animations (sans en faire trop)

- Au toucher : tout élément cliquable s'enfonce légèrement (`scale(.97)`, 120 ms).
- À l'ouverture : les cartes apparaissent en glissant de 8 px (350 ms) ; les barres montent, les courbes se dessinent,
  l'anneau se remplit.
- Feuilles : elles montent du bas (250 ms).
- Tout s'arrête si l'iPhone demande de réduire les animations.

## Écrans de référence (maquettes)

https://claude.ai/artifact/5d8Z1P4j6tLbnmN4A3w3YN, section « Version retenue » :
V1 Aujourd'hui (tuiles avec mini-courbes, séance avec barre par zones, semaine en barres), V2 Accueil, V3 Semaine,
V4 Saison, V5 Progrès, V6 Réglages (semaine type à flèches ‹ ›).
