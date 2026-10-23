/** Textes des « ? » : une phrase par chiffre affiché, pour savoir comment il est calculé. */
export const AIDES = {
  srpe: 'sRPE (Foster) = ton RPE (0 à 10) × la durée en minutes. Marche pour tous les sports, même sans capteur.',
  trimp:
    'TRIMP (Banister) = pour chaque minute, part de ta réserve de FC utilisée × 0,64 × e^(1,92 × cette part). Calculé seconde par seconde avec un fichier, sinon depuis ta FC moyenne (ou estimé depuis le RPE si pas de FC).',
  kj: 'kJ = puissance (W) × durée (s) / 1000 : le travail mécanique produit. Seulement avec un capteur de puissance (home trainer).',
  tss: 'TSS = durée × puissance normalisée × IF / (CP × 3600) × 100, avec IF = puissance normalisée / CP. 1 h à ta CP = 100.',
  rtss: 'rTSS = heures × (vitesse / vitesse au seuil 60)² × 100. Vitesse seuil estimée à 87 % de la VMA.',
  allure: 'Allure = durée / distance. % VMA = vitesse moyenne / ta VMA.',
  np: 'Puissance normalisée = moyenne glissante sur 30 s, élevée à la puissance 4, moyennée, puis racine 4e : reflète mieux le coût des efforts irréguliers.',
  decouplage:
    'Découplage = baisse du rapport vitesse (ou puissance) / FC entre la 1re et la 2de moitié de la séance. Sous 5 % : bonne endurance aérobie.',
  zones: 'Temps passé dans chaque zone de FC (bornes réglées dans Réglages → Vélo → Zones).',
  domaines: 'Basse = Z1-Z2 (sous le 1er seuil), moyenne = Z3, haute = Z4-Z5 (modèle à 3 zones de Seiler).',
  rpeRegle: 'Règle de ton PDF : RPE < 3 = « kJ faciles » (ton placement sûr), RPE ≥ 7,5 = « stress » (placement à risque, 2-3 fois par semaine maximum).',
  ctl: 'Fitness (CTL) = moyenne exponentielle de ta charge quotidienne sur 42 jours : ta « forme de fond ».',
  atl: 'Fatigue (ATL) = moyenne exponentielle de ta charge quotidienne sur 7 jours.',
  tsb: 'Fraîcheur (TSB) = fitness d’hier − fatigue d’hier. Négatif = fatigue accumulée ; sous −20, prudence.',
  ratio: 'Ratio fatigue / fitness (ATL / CTL). Indicatif seulement : la recherche récente doute de sa valeur pour prédire les blessures.',
  monotonie: 'Monotonie (Foster) = moyenne / écart-type de la charge des 7 derniers jours. Au-dessus de 2 : semaine trop uniforme.',
  contrainte: 'Contrainte (Foster) = charge de la semaine × monotonie.',
  pic: 'Charge des 7 derniers jours rapportée à ta moyenne hebdomadaire des 4 semaines précédentes.',
  vfc7: 'Moyenne sur 7 jours de ln(RMSSD) : plus fiable que la valeur d’un seul matin (Plews).',
  zoneVfc: 'Zone normale = ta moyenne de ln(RMSSD) sur 60 jours ± 0,5 écart-type (plus petit changement significatif).',
  cv: 'Coefficient de variation de ln(RMSSD) sur 7 jours : une forte hausse indique une VFC instable.',
  fcRepos7: 'Moyenne de ta FC de repos sur 7 jours, comparée à ta moyenne sur 60 jours.',
  budgetKj: 'Système kJ : travail vélo réalisé cette semaine (kJ des séances avec puissance) comparé au budget prévu (réalisé + kJ prévus des séances restantes). Valider le budget chaque semaine, puis le faire monter sur 90 jours.',
  objectifKj: 'Système kJ : total de kJ à accumuler sur la période. Le rythme attendu suppose une progression régulière jour après jour.',
  chargePrevue: 'Charge prévue = TRIMP estimé de chaque séance prévue, selon sa durée et son intensité.',
  efficience: 'Efficience = vitesse (km/h) ou puissance (W) par battement de FC moyenne, sur les séances en basse intensité. Plus elle monte, plus tu es efficace.',
  programme:
    "L'appli place 1 séance d'intensité vélo par semaine (jamais la veille ni le lendemain d'un seuil 60, seuil 30, VMA ou d'une compétition en course), une Z2 et une sortie longue Z2 avec sprints, une seule séance par jour. L'intensité suit la phase (reprise, dominante VO2, dominante seuil) en mélangeant les formats : à charge égale, l'ordre VO2 / seuil change peu les progrès (Sylta 2016, Almquist 2022). Chaque matin, le signal 🟢🟠🔴 adapte la séance du jour.",
  budgetAuto:
    'Système kJ : chaque semaine, budget de la précédente +7,5 % s’il a été réalisé à 90 % ou plus avec au plus 1 jour orange, stable si les signaux sont mitigés ou le budget pas atteint, −15 % avec 2 jours rouges ou plus. Semaine allégée (−35 %) 1 sur 4 et la semaine d’une compétition. La séance d’intensité est comptée d’abord, le reste en Z2 (60 % pour la sortie longue).',
  z2Auto:
    'Puissance Z2 : 62 % de ta CP au départ (ou ta valeur dans Réglages), puis +5 W après une sortie Z2 du programme avec découplage < 5 % et RPE ≤ 3, −5 W si découplage > 5 % ou RPE > 3. Repart de zéro à chaque test CP, toujours dans ta zone 2.',
  progression:
    "Règle 6 du système kJ : on allonge d'abord le temps de travail (4 paliers par famille : VO2 courts, VO2 longs, seuil…), puis +2,5 % de watts une fois le dernier palier réussi (et retour au 2e palier). Un bloc pas tenu : −5 % de watts la fois suivante. Une réussite fait avancer toute la famille (ex. un 30/30 réussi fait progresser le 30/15).",
  phases:
    "Reprise & endurance : volume en Z2, intensité sous le seuil ou 30/15 léger. Dominante VO2 : 2 séances VO2 pour 1 de seuil. Dominante seuil : l'inverse. À charge égale, l'ordre change peu les progrès (Sylta 2016) : on garde toujours un peu des deux. Une semaine allégée toutes les 4, et la semaine d'une course.",
  efficacite:
    "Efficacité aérobie = puissance moyenne / FC moyenne sur tes sorties faciles de 45 min et plus. Évolution : moyenne de tes 4 dernières sorties comparée aux 4 d'avant.",
  sommeil:
    "Une nuit de moins de 6 h (Craven 2022 : ≤ 6 h dégrade la performance) ou une dette de sommeil (moyenne sur 7 jours sous 7 h, seuil du « sommeil court » de Walsh 2021, ou sous ta moyenne habituelle de plus de 45 min) déclenchent une alerte : intensité raccourcie. Une seule alerte « sommeil et ressenti », même si plusieurs causes. Repère : 8 h, ou ta moyenne habituelle si elle est plus haute.",
  cpEstimee:
    "CP calculée sur tes meilleurs efforts de 3, 7 et 12 min des 6 dernières semaines (méthode validée par Karsten 2015 si ces efforts sont donnés à fond). À l'entraînement ils le sont rarement : l'estimation sert seulement à repérer un progrès (plus de 3 % au-dessus de ta CP), elle ne change jamais ta CP.",
} as const
