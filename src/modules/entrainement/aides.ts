/** Textes des « ? » : une phrase par chiffre affiché, pour savoir comment il est calculé. */
export const AIDES = {
  srpe: 'sRPE (Foster) = ton RPE (0 à 10) × la durée en minutes. Marche pour tous les sports, même sans capteur.',
  trimp:
    'TRIMP (Banister) = pour chaque minute, part de ta réserve de FC utilisée × 0,64 × e^(1,92 × cette part). Calculé seconde par seconde avec un fichier, sinon depuis ta FC moyenne (ou estimé depuis le RPE si pas de FC).',
  kj: 'kJ = puissance (W) × durée (s) / 1000 : le travail mécanique produit. Seulement avec un capteur de puissance (home trainer).',
  tss: 'TSS = durée × puissance normalisée × IF / (CP × 3600) × 100, avec IF = puissance normalisée / CP. 1 h à ta CP = 100.',
  rtss: 'rTSS = heures × (vitesse / vitesse seuil)² × 100. Vitesse seuil = % de ta VMA réglé dans Réglages (87 % par défaut).',
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
  chargePrevue: 'Charge prévue = TRIMP estimé de chaque séance prévue, selon sa durée et son intensité.',
  efficience: 'Efficience = vitesse (km/h) ou puissance (W) par battement de FC moyenne, sur les séances en basse intensité. Plus elle monte, plus tu es efficace.',
} as const
