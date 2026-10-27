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
    'Système kJ : chaque semaine, budget de la précédente +7,5 % s’il a été réalisé à 90 % ou plus avec au plus 1 jour orange, stable si les signaux sont mitigés ou le budget pas atteint, −15 % avec 2 jours rouges ou plus. Semaine allégée (−35 %) 1 sur 4 et la semaine d’une compétition. La séance d’intensité est comptée d’abord, le reste en Z2 (60 % pour la sortie longue). Garde-fou course → vélo : quand ta course prévue grimpe nettement (+30 % par rapport à tes 4 dernières semaines) ou que ta charge totale fait un pic (plus de 1,3 fois ta moyenne), tes sorties Z2 de la semaine baissent de 10 à 15 %, jamais ta séance clé ; la semaine suivante repart normalement. Précaution d’entraîneur : aucune étude ne montre que ce rapport prédit les blessures (Impellizzeri 2020 ; Frandsen 2025).',
  z2Auto:
    'Puissance Z2 : 62 % de ta CP au départ (ou ta valeur dans Réglages), puis +5 W quand 2 sorties Z2 de suite ont un découplage < 5 % et un RPE ≤ 3, −5 W quand 2 sorties de suite ont un découplage > 5 % ou un RPE > 3 (une sortie isolée est trop bruitée : chaleur, café, sommeil). Repart de zéro à chaque test CP, toujours dans ta zone 2.',
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
  wkg:
    "Rapport poids / puissance = CP / poids le jour du test (la pesée saisie, sinon la plus proche dans les 30 jours avant). C'est lui qui compte en montée et pour comparer tes tests : plus de watts en prenant du poids n'est pas forcément un progrès.",
  besoins:
    "Estimation, pas une mesure (±10-15 %). Énergie : ton métabolisme de base (Mifflin-St Jeor) × 1,3 pour ta vie quotidienne (digestion, posture, petits mouvements), plus ta marche pas par pas : 0,5 kcal par kg et par km (coût net de la marche, ACSM), foulée ≈ 0,415 × ta taille ; les pas de course sont retirés car déjà comptés dans la séance ; aujourd'hui, le plus grand entre tes pas déjà faits et ta moyenne des 7 derniers jours ; plus tes séances du jour (1 kcal par kJ à vélo, environ 1 kcal par kg et par km en course ; jamais les calories de la montre). Une séance faite remplace la séance prévue. Macros à suivre : GLUCIDES selon la charge du jour (consensus ACSM 2016) : 4 g/kg repos, 5 g/kg séance courte, 6 g/kg 45-90 min, 7 g/kg 45-90 min intense ou 1 h 30-3 h, 8 g/kg 1 h 30-3 h avec intensité, 10 g/kg au-delà de 4 h. PROTÉINES 1,6 g/kg (Morton 2018), 1,8 g/kg en perte de gras, à répartir sur 3-4 repas. LIPIDES : le reste, jamais sous 20 % de l'énergie. Perte de gras légère : −500 kcal les jours faciles, −300 modérés, −100 les grosses séances (Impey 2018), visée ~0,5 % du poids par semaine (Garthe 2011), jamais sous 30 kcal par kg de masse maigre une fois le sport déduit (consensus CIO RED-S 2023). Ton poids sur plusieurs semaines reste le meilleur juge : après 3 semaines de repas notés et de pesées, l'appli te propose ton maintien mesuré (moyenne mangée corrigée de la tendance du poids, 1 kg ≈ 7 700 kcal) à la place de la formule. Un excès d'un jour peut être étalé sur les jours faciles suivants (−250 kcal max par jour, jamais sous le plancher) : jamais de jeûne le lendemain.",
  nutritionSeance:
    "Repères du consensus ACSM 2016 (complété par Podlogar 2022) : moins de 45 min, de l'eau ; 45-75 min intense, un peu de glucides ou un bain de bouche sucré ; 1 h 15-2 h 30, 30-60 g de glucides par heure ; au-delà, 60-90 g/h en mélangeant glucose et fructose (120 g/h est possible avec un ventre entraîné, sans gain de performance prouvé). Boire selon la soif, davantage sur home trainer, avec du sodium au-delà d'1 h. Après une séance dure ou longue : 20-25 g de protéines dans les 2 h. Les glucides pris pendant l'effort comptent dans tes glucides du jour.",
  controleFc:
    "Contrôle FC (repères d'entraîneur, à lire en tendance, sur plusieurs séances au frais) : sortie facile → dérive de la FC à watts égaux, mesurée après les 10 premières minutes (Friel) : moins de 5 % = endurance solide, 5-10 % = limite (chaleur, hydratation, fatigue), plus de 10 % = trop dur. Blocs au seuil ou sweet spot → la FC doit se stabiliser : sous ta CP elle monte encore un peu (Jones 2019), on ne parle d'effort au-dessus du seuil que si elle grimpe de plus de 8 % ET finit à 95 % de ta FC max. VO2 longs → minutes à 90 % ou plus de ta FC max, visé ≈ 10 min (Buchheit & Laursen 2013). Intervalles courts (30/15) : pas de verdict, la FC suit avec retard. Puis ta réserve : test de la parole pour le facile, 1-3 min en réserve au seuil, 0-1 répétition en VO2.",
} as const
