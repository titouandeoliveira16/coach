"""Génère catalogue/seances.json (catalogue scientifique de séances). Les durées sont en secondes."""
import json, sys

def E(mn, lo, hi=None, cad=None, note=None, sec=None):
    d = {"type": "effort", "duree": sec if sec is not None else int(mn * 60), "intensite": [lo, hi if hi is not None else lo]}
    if cad: d["cadence"] = cad
    if note: d["note"] = note
    return d

def MAX(sec, cad=None, note=None):
    d = {"type": "effort", "duree": sec, "max": True}
    if cad: d["cadence"] = cad
    if note: d["note"] = note
    return d

def R(mn, lo=45, hi=55, sec=None, note=None):
    d = {"type": "recup", "duree": sec if sec is not None else int(mn * 60), "intensite": [lo, hi]}
    if note: d["note"] = note
    return d

def ECH(mn, lo=50, hi=75, note=None):
    d = {"type": "echauffement", "duree": int(mn * 60), "intensite": [lo, hi]}
    if note: d["note"] = note
    return d

def CALME(mn, lo=45, hi=55):
    return {"type": "retour", "duree": int(mn * 60), "intensite": [lo, hi]}

def X(n, *etapes, note=None):
    d = {"type": "repetition", "fois": n, "etapes": list(etapes)}
    if note: d["note"] = note
    return d

def ref(auteurs, annee, titre, revue, pmid=None):
    r = {"auteurs": auteurs, "annee": annee, "titre": titre, "revue": revue}
    if pmid: r["pmid"] = pmid
    return r

# Temps de qualité : efforts au-dessus de l'endurance (≥ 76 % CP, ≥ 80 % VMA) ou à fond
SEUIL_QUALITE = {"%CP": 76, "%VMA": 80}

def duree(etapes, unite):
    t = w = 0
    for e in etapes:
        if e["type"] == "repetition":
            a, b = duree(e["etapes"], unite); t += e["fois"] * a; w += e["fois"] * b
        else:
            t += e["duree"]
            if e["type"] == "effort" and (e.get("max") or e["intensite"][0] >= SEUIL_QUALITE.get(unite, 999)): w += e["duree"]
    return t, w

S = []

def seance(id, sport, famille, nom, objectif, resume, zone, rpe, niveau, deroule=None, exercices=None, unite=None,
           variantes=(), phases=(), parSemaine="", recuperation="", conseils=(), preuve=None, dureeMin=None, travailMin=None):
    s = {"id": id, "sport": sport, "famille": famille, "nom": nom, "objectif": objectif, "resume": resume}
    if unite: s["unite"] = unite
    s.update({"zone": zone, "rpe": rpe, "niveau": niveau})
    if deroule:
        t, w = duree(deroule, unite)
        s["dureeMin"] = int(t / 60 + 0.5); s["travailMin"] = round(w / 60, 1)
        s["deroule"] = deroule
    if exercices:
        s["exercices"] = exercices
        if dureeMin: s["dureeMin"] = dureeMin
    if dureeMin and not deroule: s["dureeMin"] = dureeMin
    if travailMin is not None and not deroule: s["travailMin"] = travailMin
    s["variantes"] = list(variantes)
    s["quand"] = {"phases": list(phases), "parSemaine": parSemaine, "recuperation": recuperation}
    s["conseils"] = list(conseils)
    s["preuve"] = preuve
    S.append(s)

P = lambda niveau, resultat, *refs: {"niveau": niveau, "resultat": resultat, "references": list(refs)}

# ——— Références (relues par le relecteur scientifique le 28/10/2026 ; PMID seulement quand il a été vérifié) ———
SEILER_2010 = ref("Seiler S", 2010, "What is best practice for training intensity and duration distribution in endurance athletes?", "Int J Sports Physiol Perform", "20861519")
STOGGL_2014 = ref("Stöggl T, Sperlich B", 2014, "Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training", "Front Physiol", "24550842")
ROSENBLAT_2019 = ref("Rosenblat MA, Perrotta AS, Vicenzino B", 2019, "Polarized vs. threshold training intensity distribution on endurance sport performance: a systematic review and meta-analysis of randomized controlled trials", "J Strength Cond Res", "29863593")
ROSENBLAT_2025 = ref("Rosenblat MA, et al.", 2025, "Which training intensity distribution intervention will produce the greatest improvements in maximal oxygen uptake and time-trial performance in endurance athletes?", "Sports Med")
OLIVEIRA_2024 = ref("Silva Oliveira P, Boppre G, Fonseca H", 2024, "Comparison of polarized versus other types of endurance training intensity distribution on athletes' endurance performance: a systematic review with meta-analysis", "Sports Med")
NEAL_2013 = ref("Neal CM, Hunter AM, Brennan L, et al.", 2013, "Six weeks of a polarized training-intensity distribution leads to greater physiological and performance adaptations than a threshold model in trained cyclists", "J Appl Physiol", "23264537")
PERSINGER_2004 = ref("Persinger R, Foster C, Gibson M, Fater DC, Porcari JP", 2004, "Consistency of the talk test for exercise prescription", "Med Sci Sports Exerc", "15354048")
VAN_HOOREN_2018 = ref("Van Hooren B, Peake JM", 2018, "Do we need a cool-down after exercise? A narrative review of the psychophysiological effects and the effects on performance, injuries and the long-term adaptive response", "Sports Med", "29663142")
MAUNDER_2021 = ref("Maunder E, Seiler S, Mildenhall MJ, Kilding AE, Plews DJ", 2021, "The importance of 'durability' in the physiological profiling of endurance athletes", "Sports Med", "33886100")
VAN_ERP_2021 = ref("van Erp T, Sanders D, Lamberts RP", 2021, "Maintaining power output with accumulating levels of work done is a key determinant for success in professional cycling", "Med Sci Sports Exerc")
SPRAGG_2023 = ref("Spragg J, Leo P, Swart J", 2023, "The relationship between physiological characteristics and durability in male professional cyclists", "Med Sci Sports Exerc", "35977108")
SPRAGG_2024 = ref("Spragg J, Leo P, Giorgi A, Gonzalez BM, Swart J", 2024, "The intensity rather than the quantity of prior work determines the subsequent downward shift in the power duration relationship in professional cyclists", "Eur J Sport Sci")
RONNESTAD_2011 = ref("Rønnestad BR, Hansen EA, Raastad T", 2011, "Strength training improves 5-min all-out performance following 185 min of cycling", "Scand J Med Sci Sports", "19903319")
ALMQUIST_2020 = ref("Almquist NW, et al.", 2020, "Effects of including sprints in one weekly low-intensity training session during the transition period of elite cyclists", "Front Physiol", "33041839")
SEILER_2013 = ref("Seiler S, Jøranson K, Olesen BV, Hetlelid KJ", 2013, "Adaptations to aerobic interval training: interactive effects of exercise intensity and total work duration", "Scand J Med Sci Sports", "21812820")
SYLTA_2016 = ref("Sylta Ø, Tønnessen E, Hammarström D, et al.", 2016, "The effect of different high-intensity periodization models on endurance adaptations", "Med Sci Sports Exerc")
RONNESTAD_2015 = ref("Rønnestad BR, Hansen J, Vegge G, Tønnessen E, Slettaløkken G", 2015, "Short intervals induce superior training adaptations compared with long intervals in cyclists – an effort-matched approach", "Scand J Med Sci Sports")
RONNESTAD_2020 = ref("Rønnestad BR, Hansen J, Nygaard H, Lundby C", 2020, "Superior performance improvements in elite cyclists following short-interval vs effort-matched long-interval training", "Scand J Med Sci Sports", "31977120")
RONNESTAD_HANSEN_2016 = ref("Rønnestad BR, Hansen J", 2016, "Optimizing interval training at power output associated with peak oxygen uptake in well-trained cyclists", "J Strength Cond Res")
HELGERUD_2007 = ref("Helgerud J, Høydal K, Wang E, et al.", 2007, "Aerobic high-intensity intervals improve VO2max more than moderate training", "Med Sci Sports Exerc", "17414804")
BUCHHEIT_2013 = ref("Buchheit M, Laursen PB", 2013, "High-intensity interval training, solutions to the programming puzzle. Part I: cardiopulmonary emphasis", "Sports Med")
BILLAT_1999 = ref("Billat VL, Flechet B, Petit B, Muriaux G, Koralsztein JP", 1999, "Interval training at VO2max: effects on aerobic performance and overtraining markers", "Med Sci Sports Exerc", "9927024")
BILLAT_2000 = ref("Billat VL, Slawinski J, Bocquet V, et al.", 2000, "Intermittent runs at the velocity associated with maximal oxygen uptake enables subjects to remain at maximal oxygen uptake for a longer time than intense but submaximal runs", "Eur J Appl Physiol", "10638376")
BILLAT_2001 = ref("Billat LV", 2001, "Interval training for performance: a scientific and empirical practice. Special recommendations for middle- and long-distance running. Part I: aerobic interval training", "Sports Med", "11219499")
BOSSI_2020 = ref("Bossi AH, Mesquida C, Passfield L, Rønnestad BR, Hopker JG", 2020, "Optimizing interval training through power-output variation within the work intervals", "Int J Sports Physiol Perform", "32244222")
STEPTO_1999 = ref("Stepto NK, Hawley JA, Dennis SC, Hopkins WG", 1999, "Effects of different interval-training programs on cycling time-trial performance", "Med Sci Sports Exerc", "10331896")
LAURSEN_2002 = ref("Laursen PB, Shing CM, Peake JM, Coombes JS, Jenkins DG", 2002, "Interval training program optimization in highly trained endurance cyclists", "Med Sci Sports Exerc", "12439086")
GIBALA_2006 = ref("Gibala MJ, Little JP, van Essen M, et al.", 2006, "Short-term sprint interval versus traditional endurance training: similar initial adaptations in human skeletal muscle and exercise performance", "J Physiol", "16825308")
HAZELL_2010 = ref("Hazell TJ, Macpherson RE, Gravelle BM, Lemon PW", 2010, "10 or 30-s sprint interval training bouts enhance both aerobic and anaerobic performance", "Eur J Appl Physiol")
VOLLAARD_2017 = ref("Vollaard NBJ, Metcalfe RS, Williams S", 2017, "Effect of number of sprints in an SIT session on change in VO2max: a meta-analysis", "Med Sci Sports Exerc", "28079707")
TABATA_1996 = ref("Tabata I, Nishimura K, Kouzaki M, et al.", 1996, "Effects of moderate-intensity endurance and high-intensity intermittent training on anaerobic capacity and VO2max", "Med Sci Sports Exerc", "8897392")
PATON_2005 = ref("Paton CD, Hopkins WG", 2005, "Combining explosive and high-resistance training improves performance in competitive cyclists", "J Strength Cond Res", "16287351")
NIMMERICHTER_2012 = ref("Nimmerichter A, Eston R, Bachl N, Williams C", 2012, "Effects of low and high cadence interval training on power output in flat and uphill cycling time-trials", "Eur J Appl Physiol", "21479957")
KRISTOFFERSEN_2014 = ref("Kristoffersen M, Gundersen H, Leirdal S, Iversen VV", 2014, "Low cadence interval training at moderate intensity does not improve cycling performance in highly trained veteran cyclists", "Front Physiol")
KARSTEN_2015 = ref("Karsten B, Jobson SA, Hopker J, Stevens L, Beedie C", 2015, "Validity and reliability of critical power field testing", "Eur J Appl Physiol", "25260244")
KARSTEN_2017 = ref("Karsten B, Hopker J, Jobson SA, et al.", 2017, "Comparison of inter-trial recovery times for the determination of critical power and W′ in cycling", "J Sports Sci", "27531664")
KARSTEN_2021 = ref("Karsten B, Petrigna L, Klose A, et al.", 2021, "Relationship between the critical power test and a 20-min functional threshold power test in cycling", "Front Physiol")
SIMPSON_2017 = ref("Simpson LP, Kordi M", 2017, "Comparison of critical power and W′ derived from 2 or 3 maximal tests", "Int J Sports Physiol Perform")
BORSZCZ_2018 = ref("Borszcz FK, Tramontin AF, Bossi AH, Carminatti LJ, Costa VP", 2018, "Functional threshold power in cyclists: validity of the concept and physiological responses", "Int J Sports Med")
INGLIS_2020 = ref("Inglis EC, Iannetta D, Passfield L, Murias JM", 2020, "Maximal lactate steady state versus the 20-minute functional threshold power test in well-trained individuals: 'watts' the big deal?", "Int J Sports Physiol Perform", "31689684")
SITKO_2022 = ref("Sitko S, Cirer-Sastre R, Corbi F, López-Laval I", 2022, "Five-minute power-based test to predict maximal oxygen consumption in road cycling", "Int J Sports Physiol Perform")
RONNESTAD_2014B = ref("Rønnestad BR, Hansen J, Ellefsen S", 2014, "Block periodization of high-intensity aerobic intervals provides superior training effects in trained cyclists", "Scand J Med Sci Sports", "22646668")
MOLMEN_2019 = ref("Mølmen KS, Øfsteng SJ, Rønnestad BR", 2019, "Block periodization of endurance training – a systematic review and meta-analysis", "Open Access J Sports Med")
ALMQUIST_2022 = ref("Almquist NW, Eriksen HB, Wilhelmsen M, et al.", 2022, "No differences between 12 weeks of block- vs. traditional-periodized training in performance adaptations in trained cyclists", "Front Physiol", "35299664")
BOSQUET_2007 = ref("Bosquet L, Montpetit J, Arvisais D, Mujika I", 2007, "Effects of tapering on performance: a meta-analysis", "Med Sci Sports Exerc", "17762369")
WANG_2023 = ref("Wang Z, Wang YT, Gao W, Zhong Y", 2023, "Effects of tapering on performance in endurance athletes: a systematic review and meta-analysis", "PLoS One", "37163550")
MARQUET_2016 = ref("Marquet LA, Brisswalter J, Louis J, et al.", 2016, "Enhanced endurance performance by periodization of carbohydrate intake: 'sleep low' strategy", "Med Sci Sports Exerc", "26741119")
MARQUET_2016B = ref("Marquet LA, Hausswirth C, Molle O, et al.", 2016, "Periodization of carbohydrate intake: short-term effect on performance", "Nutrients", "27897989")
GEJL_2017 = ref("Gejl KD, Thams LB, Hansen M, et al.", 2017, "No superior adaptations to carbohydrate periodization in elite endurance athletes", "Med Sci Sports Exerc", "28723843")
GEJL_2021 = ref("Gejl KD, Nybo L", 2021, "Performance effects of periodized carbohydrate restriction in endurance trained athletes – a systematic review and meta-analysis", "J Int Soc Sports Nutr", "34001184")
CASADO_2023 = ref("Casado A, Foster C, Bakken M, Tjelta LI", 2023, "Does lactate-guided threshold interval training within a high-volume low-intensity approach represent the 'next step' in the evolution of distance running training?", "Int J Environ Res Public Health", "36900796")
DANIELS = ref("Daniels J", 2021, "Daniels' Running Formula (4e éd.)", "Human Kinetics (livre)")
BARNES_2013 = ref("Barnes KR, Hopkins WG, McGuigan MR, Kilding AE", 2013, "Effects of different uphill interval-training programs on running economy and performance", "Int J Sports Physiol Perform", "23538293")
GUNNARSSON_2012 = ref("Gunnarsson TP, Bangsbo J", 2012, "The 10-20-30 training concept improves performance and health profile in moderately trained runners", "J Appl Physiol", "22556401")
ESFARJANI_2007 = ref("Esfarjani F, Laursen PB", 2007, "Manipulating high-intensity interval training: effects on VO2max, the lactate threshold and 3000 m running performance in moderately trained males", "J Sci Med Sport")
BERTHON_1997 = ref("Berthon P, Fellmann N, Bedu M, et al.", 1997, "A 5-min running field test as a measurement of maximal aerobic velocity", "Eur J Appl Physiol Occup Physiol")
LEGER_1980 = ref("Léger LA, Boucher R", 1980, "An indirect continuous running multistage field test: the Université de Montréal track test", "Can J Appl Sport Sci", "7389053")
RONNESTAD_2010 = ref("Rønnestad BR, Hansen EA, Raastad T", 2010, "In-season strength maintenance training increases well-trained cyclists' performance", "Eur J Appl Physiol", "20799042")
RONNESTAD_MUJIKA_2014 = ref("Rønnestad BR, Mujika I", 2014, "Optimizing strength training for running and cycling endurance performance: a review", "Scand J Med Sci Sports", "23914932")
STOREN_2008 = ref("Støren Ø, Helgerud J, Støa EM, Hoff J", 2008, "Maximal strength training improves running economy in distance runners", "Med Sci Sports Exerc", "18460997")
BALSALOBRE_2016 = ref("Balsalobre-Fernández C, Santos-Concejero J, Grivas GV", 2016, "Effects of strength training on running economy in highly trained runners: a systematic review with meta-analysis of controlled trials", "J Strength Cond Res", "26694507")
LLANOS_LAGOS_2024 = ref("Llanos-Lagos C, Ramirez-Campillo R, Moran J, Sáez de Villarreal E", 2024, "Effect of strength training programs in middle- and long-distance runners' economy at different running speeds: a systematic review with meta-analysis", "Sports Med")
LAUERSEN_2014 = ref("Lauersen JB, Bertelsen DM, Andersen LB", 2014, "The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials", "Br J Sports Med", "24100287")
WU_2024 = ref("Wu H, Brooke-Wavell K, Fong DTP, Paquette MR, Blagrove RC", 2024, "Do exercise-based prevention programs reduce injury in endurance runners? A systematic review and meta-analysis", "Sports Med", "38261240")
PETERSEN_2011 = ref("Petersen J, Thorborg K, Nielsen MB, Budtz-Jørgensen E, Hölmich P", 2011, "Preventive effect of eccentric training on acute hamstring injuries in men's soccer: a cluster-randomized controlled trial", "Am J Sports Med", "21825112")
RIO_2015 = ref("Rio E, Kidgell D, Purdam C, et al.", 2015, "Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy", "Br J Sports Med", "25979840")
CLIFFORD_2020 = ref("Clifford C, Challoumas D, Paul L, Syme G, Millar NL", 2020, "Effectiveness of isometric exercise in the management of tendinopathy: a systematic review and meta-analysis of randomised trials", "BMJ Open Sport Exerc Med", "32818059")
ALFREDSON_1998 = ref("Alfredson H, Pietilä T, Jonsson P, Lorentzon R", 1998, "Heavy-load eccentric calf muscle training for the treatment of chronic Achilles tendinosis", "Am J Sports Med", "9617396")
GRGIC_2022 = ref("Grgic J, Schoenfeld BJ, Orazem J, Sabol F", 2022, "Effects of resistance training performed to repetition failure or non-failure on muscular strength and hypertrophy: a systematic review and meta-analysis", "J Sport Health Sci")
HELMS_2016 = ref("Helms ER, Cronin J, Storey A, Zourdos MC", 2016, "Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training", "Strength Cond J")
WENDLER = ref("Wendler J", 2011, "5/3/1: The Simplest and Most Effective Training System to Increase Raw Strength (2e éd.)", "Jim Wendler LLC (livre)")
ALLEN_COGGAN = ref("Allen H, Coggan A", 2019, "Training and Racing with a Power Meter (3e éd.)", "VeloPress (livre)")
FRIEL = ref("Friel J", 2018, "The Cyclist's Training Bible (5e éd.)", "VeloPress (livre)")

PRATIQUE = lambda resultat, *refs: P("pratique", resultat, *refs)
SANS_ERG = "Sans ERG : choisis ton braquet avant chaque effort (un ou deux pignons plus dur), lance les 5 premières secondes un peu au-dessus de la cible puis stabilise."

# ════════════════════════ VÉLO (intensité en % de la CP) ════════════════════════
V = dict(sport="velo", unite="%CP")

seance("velo-recuperation-active", famille="recuperation", nom="Récupération active",
       objectif="Récupérer sans ajouter de fatigue", resume="Pédalage très facile, souple, sans aucune pression.",
       zone="Z1", rpe="1-2", niveau="tous", deroule=[E(35, 40, 55, cad="85-95")],
       variantes=["20 min si très fatigué", "45 min maximum"], phases=["toutes"], parSemaine="0-2",
       recuperation="aucune", conseils=["Si les jambes piquent, c'est trop fort : baisse.", "Remplace sans regret par du repos complet."],
       preuve=P("faible", "La récupération active n'améliore presque pas la performance du jour même ou du lendemain par rapport au repos, sans effet négatif démontré ; utile surtout pour bouger sans charge. Aucune étude sur une sortie de récupération un autre jour.", VAN_HOOREN_2018), **V)

seance("velo-endurance-courte", famille="endurance", nom="Endurance fondamentale courte",
       objectif="Volume aérobie, capillarisation, mitochondries, économie", resume="45 à 90 min régulières sous le premier seuil.",
       zone="Z2", rpe="2-3", niveau="tous", deroule=[ECH(10, 50, 65), E(50, 56, 75, cad="85-95"), CALME(5)],
       variantes=["45 min", "60 min", "90 min"], phases=["toutes"], parSemaine="2-4", recuperation="< 24 h",
       conseils=["Test de la parole : tu dois pouvoir parler confortablement en phrases (= sous le premier seuil).", "Repère d'entraîneur : dérive de FC < 5 % = endurance solide."],
       preuve=P("prouvé", "Les athlètes d'endurance font ≈ 75-80 % de leurs séances sous le premier seuil (études descriptives). Dans les essais, les programmes qui gardent cette base facile (polarisés ou pyramidaux) progressent autant ou plus que ceux centrés sur le seuil.", SEILER_2010, ROSENBLAT_2019, ROSENBLAT_2025, PERSINGER_2004), **V)

seance("velo-endurance-longue", famille="endurance", nom="Sortie longue",
       objectif="Endurance de fond, utilisation des graisses, résistance à la fatigue", resume="2 à 4 h en Z2, sur terrain varié ou home trainer.",
       zone="Z2", rpe="2-3", niveau="intermédiaire", deroule=[ECH(15, 50, 65), E(150, 56, 75), CALME(10)],
       variantes=["1 h 45", "2 h 30", "3 h", "4 h et plus (objectif cyclosportive)"], phases=["base", "construction", "spécifique"],
       parSemaine="1", recuperation="24-48 h",
       conseils=["Glucides : 30-60 g/h au-delà de 1 h 15, 60-90 g/h au-delà de 2 h 30 (consensus ACSM).", "Bois selon la soif, davantage en intérieur."],
       preuve=P("plausible", "Le volume facile est la base des athlètes d'endurance. La tenue à la fatigue (durabilité) sépare les meilleurs pros en course ; la sortie longue l'entraîne logiquement, sans essai qui compare sorties longues et courtes à volume égal.", SEILER_2010, VAN_ERP_2021, MAUNDER_2021), **V)

seance("velo-endurance-sprints", famille="endurance", nom="Endurance + sprints",
       objectif="Garder la puissance de sprint pendant les blocs d'endurance", resume="Z2 avec quelques sprints répartis dans la sortie.",
       zone="Z2 + Z7", rpe="3 (sprints 9)", niveau="intermédiaire",
       deroule=[ECH(15, 50, 65), X(8, E(10, 56, 75), MAX(10, cad="> 100", note="assis puis debout")), E(15, 56, 75), CALME(10)],
       variantes=["6-10 sprints de 8-10 s (version courte)", "3 × 3 sprints de 30 s à fond (format des études), 2 min facile entre les sprints"],
       phases=["base", "construction"], parSemaine="1", recuperation="24 h", conseils=["Sprint à fond, puis 2 min très facile avant de reprendre la Z2.", SANS_ERG],
       preuve=P("plausible", "Chez 16 cyclistes élites, des sprints de 30 s ajoutés à une sortie facile par semaine (3 semaines) ont amélioré le sprint de 30 s par rapport au groupe sans sprints (+8 ± 11 %), avec la puissance sur 20 min maintenue. Format de l'étude : sprints de 30 s, pas de 10 s.", ALMQUIST_2020), **V)

seance("velo-durabilite-effort-final", famille="durabilite", nom="Sortie longue + effort final",
       objectif="Durabilité : rester fort quand on est déjà fatigué", resume="2 h 30 à 4 h en Z2, puis 2 × 10-15 min au seuil ou en sweet spot dans la dernière heure.",
       zone="Z2 puis Z3-Z4", rpe="3 puis 7", niveau="confirmé",
       deroule=[ECH(15, 50, 65), E(135, 56, 75), X(2, E(12, 88, 95), R(5, 55, 65)), CALME(10)],
       variantes=["1 × 15 min en fin de sortie", "2 × 12 min", "3 × 10 min", "20 min en continu à 90 %"],
       phases=["construction", "spécifique"], parSemaine="1 tous les 7-14 jours", recuperation="48 h",
       conseils=["Mange régulièrement avant l'effort final (60-90 g/h) : on entraîne la tenue, pas la panne.", SANS_ERG],
       preuve=P("plausible", "La baisse de puissance après un gros travail sépare les vainqueurs des autres chez les pros ; un travail préalable intense fatigue plus qu'un travail facile. Seul essai d'entraînement : la musculation lourde a amélioré un 5 min à fond fait après 185 min de vélo. Aucun essai sur l'effort final lui-même.", VAN_ERP_2021, SPRAGG_2024, RONNESTAD_2011, MAUNDER_2021), **V)

seance("velo-tempo-2x20", famille="tempo", nom="Tempo 2 × 20 min",
       objectif="Endurance aérobie haute, préparation au sweet spot", resume="2 blocs de 20 min en Z3 basse, récupération 5 min.",
       zone="Z3", rpe="5", niveau="tous", deroule=[ECH(15), X(2, E(20, 76, 85, cad="85-95"), R(5)), CALME(10)],
       variantes=["2 × 15", "2 × 20", "3 × 20", "60 min continu"], phases=["base", "construction"], parSemaine="1",
       recuperation="24-36 h", conseils=["Respiration appuyée mais régulière, phrases courtes possibles."],
       preuve=PRATIQUE("Permet d'accumuler du travail aérobie. Chez des cyclistes entraînés, un programme centré sur cette zone a moins progressé qu'un programme polarisé (Neal 2013 ; méta-analyse de 3 essais).", NEAL_2013, ROSENBLAT_2019, ALLEN_COGGAN), **V)

seance("velo-sweet-spot-3x15", famille="tempo", nom="Sweet spot 3 × 15 min",
       objectif="Beaucoup de travail proche du seuil pour une fatigue modérée", resume="3 × 15 min à 88-94 % de la CP, récupération 5 min.",
       zone="Z3-Z4", rpe="6", niveau="intermédiaire", deroule=[ECH(15), X(3, E(15, 88, 94, cad="85-95"), R(5)), CALME(10)],
       variantes=["3 × 10", "3 × 12", "3 × 15", "2 × 20", "3 × 20"], phases=["base", "construction"], parSemaine="1-2",
       recuperation="36 h", conseils=[SANS_ERG],
       preuve=PRATIQUE("Concept d'entraîneur (rapport travail / fatigue) ; aucun essai contrôlé sur le sweet spot. Repère indirect : centrer l'entraînement sur le seuil fait moins bien que le polarisé.", ALLEN_COGGAN, NEAL_2013), **V)

seance("velo-sweet-spot-long", famille="tempo", nom="Sweet spot long 2 × 30 min",
       objectif="Endurance au seuil, préparation aux longues ascensions", resume="2 × 30 min à 88-92 %, récupération 10 min.",
       zone="Z3-Z4", rpe="6-7", niveau="confirmé", deroule=[ECH(15), X(2, E(30, 88, 92), R(10)), CALME(10)],
       variantes=["2 × 25", "2 × 30", "1 × 45", "1 × 60"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Glucides pendant l'effort si la séance dépasse 75 min."],
       preuve=PRATIQUE("Pratique d'entraîneur pour les épreuves longues et les cols ; pas d'essai contrôlé.", ALLEN_COGGAN), **V)

seance("velo-seuil-2x20", famille="seuil", nom="Seuil 2 × 20 min",
       objectif="Puissance au seuil (CP, FTP)", resume="Le classique : 2 × 20 min à 95-100 % de la CP, récupération 5-10 min.",
       zone="Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15), X(2, E(20, 95, 100, cad="85-95"), R(8)), CALME(10)],
       variantes=["2 × 12", "2 × 15", "2 × 20", "3 × 15", "3 × 20"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["La FC monte un peu même sous ta CP. Tu es au-dessus seulement si elle grimpe de plus de 8 % dans le bloc et finit vers 95 % de ta FC max.", SANS_ERG],
       preuve=PRATIQUE("Séance de référence des entraîneurs pour la puissance au seuil ; l'intensité juste sous la CP permet un long temps de travail.", ALLEN_COGGAN), **V)

seance("velo-seuil-4x10", famille="seuil", nom="Seuil 4 × 10 min",
       objectif="Puissance au seuil, version fractionnée", resume="4 × 10 min à 95-102 %, récupération 3-4 min.",
       zone="Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15), X(4, E(10, 95, 102), R(4)), CALME(10)],
       variantes=["3 × 10", "4 × 10", "3 × 12", "4 × 12"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=[SANS_ERG],
       preuve=PRATIQUE("Variante fractionnée du 2 × 20, plus tenable en début de phase.", ALLEN_COGGAN), **V)

seance("velo-seuil-4x16", famille="seuil", nom="4 × 16 min (Seiler, Sylta)",
       objectif="Endurance au seuil, gros volume d'intensité modérée", resume="4 × 16 min à l'effort maximal tenable (~88 % FC max, ≈ 90-95 % de la CP), récupération 2 min.",
       zone="Z3-Z4", rpe="7", niveau="confirmé", deroule=[ECH(15), X(4, E(16, 90, 95, note="effort maximal tenable sur les 4 répétitions"), R(2, 45, 55)), CALME(10)],
       variantes=["3 × 16", "4 × 16"], phases=["base", "construction"], parSemaine="1", recuperation="48 h",
       conseils=["Le %CP est une estimation : les études règlent l'intensité à l'effort, pas en watts.", SANS_ERG],
       preuve=P("prouvé", "Chez des amateurs, 4 × 16 min a moins progressé que 4 × 8 min sur 7 semaines. Sur 12 semaines (63 cyclistes), alterner 4 × 16, 4 × 8 et 4 × 4 a donné +5 à 10 % de puissance sur 40 min, quel que soit l'ordre.", SEILER_2013, SYLTA_2016), **V)

seance("velo-over-unders", famille="seuil", nom="Over-unders",
       objectif="Tolérance aux variations autour du seuil (relances, attaques en côte)", resume="3 séries de 4 × (2 min à 95 % / 1 min à 105-110 %), récupération 5 min entre les séries.",
       zone="Z4", rpe="8", niveau="confirmé", deroule=[ECH(15), X(3, X(4, E(2, 93, 97), E(1, 105, 110)), R(5)), CALME(10)],
       variantes=["2 séries", "3 séries", "3 séries avec 1 min 30 au-dessus"], phases=["spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Change de braquet pour passer au-dessus, sans te mettre en danseuse.", SANS_ERG],
       preuve=PRATIQUE("Méthode d'entraîneur (« criss-cross ») ; pas d'essai contrôlé dédié trouvé.", ALLEN_COGGAN), **V)

seance("velo-seuil-continu", famille="seuil", nom="Seuil continu (simulation de contre-la-montre)",
       objectif="Tenue d'un effort long et régulier", resume="30 à 45 min continus à 90-95 % de la CP.",
       zone="Z4", rpe="7-8", niveau="confirmé", deroule=[ECH(15), E(35, 90, 95), CALME(10)],
       variantes=["25 min", "35 min", "45 min"], phases=["spécifique"], parSemaine="0-1", recuperation="48-72 h",
       conseils=["Reste assis, cadence stable, aucune accélération."],
       preuve=PRATIQUE("Spécificité de l'effort de contre-la-montre ; pratique d'entraîneur.", ALLEN_COGGAN), **V)

seance("velo-vo2-4x8-seiler", famille="vo2max", nom="4 × 8 min (Seiler)",
       objectif="VO2max et seuil : le meilleur compromis intensité-durée de l'étude", resume="4 × 8 min à l'effort maximal tenable (~90 % FC max, ≈ 100-105 % de la CP), récupération 2 min.",
       zone="Z4-Z5", rpe="8", niveau="intermédiaire", deroule=[ECH(15), X(4, E(8, 100, 105), R(2, 45, 55)), CALME(10)],
       variantes=["3 × 8", "4 × 8", "5 × 8"], phases=["construction", "spécifique"], parSemaine="1-2",
       recuperation="48 h", conseils=["Le %CP est une estimation : l'étude règle l'intensité à l'effort.", "Rythme réparti : la dernière répétition doit être la plus forte.", SANS_ERG],
       preuve=P("prouvé", "Petite étude (35 cyclistes amateurs en 4 groupes, 7 semaines) : 4 × 8 min à l'effort maximal tenable a donné de plus grands progrès que 4 × 16 min et 4 × 4 min.", SEILER_2013, SYLTA_2016), **V)

seance("velo-vo2-30-15-ronnestad", famille="vo2max", nom="30/15 (Rønnestad)",
       objectif="VO2max et puissance au seuil", resume="3 séries de 13 × (30 s dur / 15 s facile), récupération 3 min entre les séries.",
       zone="Z5", rpe="8-9", niveau="intermédiaire",
       deroule=[ECH(15), X(3, X(13, E(0, 115, 125, cad="90-100", sec=30), R(0, 50, 50, sec=15)), R(3, 45, 55)), CALME(10)],
       variantes=["2 × 10", "3 × 10", "3 × 11", "3 × 13 (protocole de l'étude)"], phases=["construction", "spécifique"],
       parSemaine="1-2", recuperation="48 h", conseils=["Dans l'étude : effort maximal tenable sur toute la série, pas un sprint. Le %CP est une estimation.", SANS_ERG + " Sur les 30 s, reste sur le même braquet et monte la cadence."],
       preuve=P("prouvé", "Cyclistes bien entraînés, 10 semaines : VO2max +8,7 % contre +2,6 % avec 4 × 5 min. Élites, 3 semaines : puissance sur 20 min +4,7 % contre −1,4 %, sans différence de VO2max. Petits groupes (7-9), même laboratoire.", RONNESTAD_2015, RONNESTAD_2020), **V)

seance("velo-vo2-15-15", famille="vo2max", nom="15/15",
       objectif="VO2max avec très peu de fatigue par répétition", resume="2 à 3 séries de 10-12 × (15 s à ~130-140 % / 15 s facile), récupération 3 min.",
       zone="Z5-Z6", rpe="8", niveau="intermédiaire", deroule=[ECH(15), X(3, X(10, E(0, 130, 140, sec=15), R(0, 50, 50, sec=15)), R(3, 45, 55)), CALME(10)],
       variantes=["2 × 10", "2 × 12", "3 × 10", "3 × 12"], phases=["base", "construction"], parSemaine="1", recuperation="36-48 h", conseils=[SANS_ERG],
       preuve=P("plausible", "Les intervalles très courts accumulent du temps près de la VO2max avec peu de fatigue ; pas d'étude d'entraînement dédiée au 15/15 à vélo.", BUCHHEIT_2013), **V)

seance("velo-vo2-20-40", famille="vo2max", nom="20/40",
       objectif="VO2max, efforts courts et intenses avec récupération longue", resume="2 à 3 séries de 8-10 × (20 s à ~135-145 % / 40 s facile), récupération 3 min.",
       zone="Z6", rpe="8", niveau="intermédiaire", deroule=[ECH(15), X(3, X(8, E(0, 135, 145, sec=20), R(0, 50, 50, sec=40)), R(3, 45, 55)), CALME(10)],
       variantes=["2 × 8", "2 × 10", "3 × 8", "3 × 10"], phases=["base", "construction"], parSemaine="1", recuperation="36-48 h", conseils=[SANS_ERG],
       preuve=P("plausible", "En aigu, des répétitions de 30 s donnent plus de temps au-dessus de 90 % de la VO2max que des efforts continus ; aucune étude ne compare 20/40 et 30/15.", RONNESTAD_HANSEN_2016, BUCHHEIT_2013), **V)

seance("velo-vo2-4x5", famille="vo2max", nom="VO2 longs 4 × 5 min",
       objectif="Temps passé près de la VO2max", resume="4 à 5 × 5 min à 106-115 % de la CP, récupération 2 min 30.",
       zone="Z5", rpe="8-9", niveau="intermédiaire", deroule=[ECH(15), X(4, E(5, 106, 115), R(2.5, 45, 55)), CALME(10)],
       variantes=["4 × 4", "4 × 5", "5 × 5", "6 × 5"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Vise ≥ 90 % de ta FC max pendant au moins 2-3 min de chaque répétition.", SANS_ERG],
       preuve=P("prouvé", "Les intervalles longs proches de la VO2max augmentent la VO2max ; ce format a servi de comparaison aux 30/15 dans les études de Rønnestad (où il a moins progressé).", BUCHHEIT_2013, RONNESTAD_2015), **V)

seance("velo-vo2-8x4-stepto", famille="vo2max", nom="8 × 4 min (Stepto)",
       objectif="Puissance aérobie, contre-la-montre", resume="8 × 4 min à ~85 % de la PMA (≈ 105-110 % de la CP), récupération ~1 min 30.",
       zone="Z5", rpe="8", niveau="confirmé", deroule=[ECH(15), X(8, E(4, 105, 110), R(1.5, 45, 55)), CALME(10)],
       variantes=["6 × 4", "8 × 4"], phases=["spécifique"], parSemaine="1-2", recuperation="48 h",
       conseils=["Conversion PMA → CP approximative ; récupération exacte de l'étude non vérifiée."],
       preuve=P("plausible", "Contre-la-montre de 40 km +2,8 % en 3 semaines (6 séances) chez des cyclistes entraînés ; très petits groupes.", STEPTO_1999), **V)

seance("velo-vo2-puissance-variee", famille="vo2max", nom="Intervalles à puissance variée (Bossi)",
       objectif="Passer plus de temps près de la VO2max à travail égal", resume="6 × 5 min : 3 × (30 s à 125-130 % puis 70 s à 95-100 %), récupération 2 min 30.",
       zone="Z5", rpe="8-9", niveau="confirmé", deroule=[ECH(15), X(6, X(3, E(0, 125, 130, sec=30), E(0, 95, 100, sec=70)), R(2.5, 30, 45)), CALME(10)],
       variantes=["4 répétitions", "5 répétitions", "6 répétitions"], phases=["spécifique"], parSemaine="1", recuperation="48 h",
       conseils=["Dans l'étude : 30 s à 100 % de la PMA intercalés avec 77 % de la PMA ; conversion en %CP estimée.", "Ce sont les accélérations répétées qui comptent : un seul départ rapide ne change rien à travail égal (Miller 2023).", SANS_ERG],
       preuve=P("plausible", "En aigu, faire varier la puissance (accélérations répétées) augmente le temps passé près de la VO2max par rapport à une puissance constante ; pas encore d'étude d'entraînement sur plusieurs semaines.", BOSSI_2020), **V)

seance("velo-vo2-4x4-helgerud", famille="vo2max", nom="4 × 4 min (Helgerud)",
       objectif="VO2max", resume="4 × 4 min à 90-95 % de la FC max, récupération active 3 min.",
       zone="Z5", rpe="8-9", niveau="tous", deroule=[ECH(10), X(4, E(4, 108, 118, note="cible réelle : 90-95 % de la FC max"), R(3, 50, 60)), CALME(5)],
       variantes=["3 × 4", "4 × 4", "5 × 4"], phases=["base", "construction"], parSemaine="1-2", recuperation="48 h",
       conseils=["Guidée par la FC : elle met 1-2 min à monter, le début peut être un peu plus fort.", "Conversion en %CP : estimation d'entraîneur."],
       preuve=P("prouvé", "Étude en course à pied : hommes modérément entraînés, 3 séances par semaine pendant 8 semaines ; la VO2max a augmenté plus qu'avec l'entraînement modéré (le 15/15 a fait des progrès proches).", HELGERUD_2007), **V)

seance("velo-vo2-30-30", famille="vo2max", nom="30/30",
       objectif="VO2max avec moins de charge que les intervalles longs", resume="2 à 3 séries de 10-12 × (30 s à 120-130 % / 30 s facile).",
       zone="Z5", rpe="8", niveau="tous", deroule=[ECH(15), X(2, X(12, E(0, 120, 130, sec=30), R(0, 50, 50, sec=30)), R(5)), CALME(10)],
       variantes=["2 × 8", "2 × 10", "2 × 12", "3 × 12"], phases=["base", "construction"], parSemaine="1",
       recuperation="36-48 h", conseils=[SANS_ERG],
       preuve=P("plausible", "Les intervalles courts maintiennent longtemps la VO2 élevée (travaux de Billat en course à pied) ; transposés au vélo par les entraîneurs.", BILLAT_2000, BUCHHEIT_2013), **V)

seance("velo-vo2-40-20", famille="vo2max", nom="40/20",
       objectif="VO2max, version plus dense que le 30/30", resume="3 séries de 8 × (40 s à 115-120 % / 20 s facile), récupération 4 min.",
       zone="Z5", rpe="9", niveau="confirmé", deroule=[ECH(15), X(3, X(8, E(0, 115, 120, sec=40), R(0, 50, 50, sec=20)), R(4)), CALME(10)],
       variantes=["2 × 8", "3 × 8", "3 × 10"], phases=["spécifique"], parSemaine="1", recuperation="48 h", conseils=[SANS_ERG],
       preuve=PRATIQUE("Aucune étude d'entraînement dédiée au 40/20 ; logique des intervalles courts (récupérations courtes, VO2 qui reste haute).", BUCHHEIT_2013), **V)

seance("velo-anaerobie-1min", famille="anaerobie", nom="Capacité anaérobie 1 min",
       objectif="Capacité anaérobie, tolérance à l'acidité", resume="6 à 8 × 1 min à 130-150 % de la CP, récupération 3-4 min.",
       zone="Z6", rpe="9", niveau="confirmé", deroule=[ECH(20), X(7, E(1, 130, 150), R(3.5)), CALME(10)],
       variantes=["5 × 1 min", "6 × 1 min", "8 × 1 min"], phases=["spécifique"], parSemaine="0-1", recuperation="48-72 h",
       conseils=["Seulement si ta discipline le demande (critériums, cyclo-cross, relances)."],
       preuve=PRATIQUE("Pratique d'entraîneur. Repère : 12 × 60 s à ~100 % de la PMA n'a pas amélioré significativement le contre-la-montre de 40 km.", ALLEN_COGGAN, STEPTO_1999), **V)

seance("velo-sit-30s", famille="anaerobie", nom="Sprints de 30 s (type Wingate)",
       objectif="Adaptations aérobies et anaérobies en très peu de temps", resume="4 à 6 × 30 s à fond, récupération 4 min très facile.",
       zone="Z7", rpe="10", niveau="confirmé", deroule=[ECH(15), X(5, MAX(30), R(4, 40, 50)), CALME(10)],
       variantes=["4 sprints", "5 sprints", "6 sprints"], phases=["construction", "spécifique"], parSemaine="0-2", recuperation="48-72 h",
       conseils=["Très éprouvant : jamais deux jours de suite, jamais un jour de feu orange."],
       preuve=P("prouvé", "Chez des hommes actifs non entraînés en endurance (8 par groupe), 2 semaines de 4-6 × 30 s à fond ont donné des adaptations comparables à l'endurance classique, pour bien moins de temps.", GIBALA_2006), **V)

seance("velo-sit-supramax-laursen", famille="anaerobie", nom="12 × 30 s supramaximaux (Laursen)",
       objectif="Contre-la-montre chez des cyclistes très entraînés", resume="12 × 30 s à ~175 % de la PMA (≈ 220 % de la CP), récupération 4 min 30.",
       zone="Z7", rpe="10", niveau="confirmé", deroule=[ECH(20), X(12, E(0, 210, 230, sec=30), R(4.5, 40, 50)), CALME(10)],
       variantes=["8 répétitions", "10", "12"], phases=["spécifique"], parSemaine="1-2", recuperation="72 h",
       conseils=["Conversion PMA → CP estimée. Sans ERG : quasiment un sprint, choisis un gros braquet."],
       preuve=P("prouvé", "Chez des cyclistes très entraînés, ce format a amélioré le contre-la-montre de 40 km de 4,4 à 5,8 %.", LAURSEN_2002), **V)

seance("velo-sit-10s", famille="anaerobie", nom="Sprints de 10 s (SIT court)",
       objectif="VO2max et performance avec un minimum de temps", resume="4 à 6 × 10 s à fond, récupération 4 min ; version mini : 2 × 20 s.",
       zone="Z7", rpe="9", niveau="tous", deroule=[ECH(15), X(5, MAX(10), R(4, 40, 50)), CALME(10)],
       variantes=["2 × 20 s (version mini)", "4 × 10 s", "6 × 10 s"], phases=["toutes"], parSemaine="2-3", recuperation="24-48 h",
       conseils=["Faire plus de sprints n'augmente pas le gain de VO2max."],
       preuve=P("prouvé", "Chez des sujets actifs, des sprints de 10 s (récupération 4 min, 2 semaines) ont amélioré VO2max (+9,2 %) et contre-la-montre (+3,5 %) ; méta-analyse : plus de sprints par séance n'apporte pas plus. Effet non démontré chez des cyclistes entraînés.", HAZELL_2010, VOLLAARD_2017), **V)

seance("velo-tabata", famille="anaerobie", nom="Tabata 20/10",
       objectif="VO2max et capacité anaérobie", resume="7 à 8 × (20 s à ~170 % de la puissance à VO2max / 10 s de repos) : à l'épuisement.",
       zone="Z7", rpe="10", niveau="confirmé", deroule=[ECH(15), X(8, MAX(20, note="≈ 170 % de la puissance à VO2max"), R(0, 0, 0, sec=10)), CALME(10)],
       variantes=["6 répétitions", "7 répétitions", "8 répétitions"], phases=["spécifique"], parSemaine="0-1", recuperation="72 h",
       conseils=["Protocole de laboratoire très dur ; la plupart des « tabata » des applis sont bien moins intenses."],
       preuve=P("plausible", "Une seule petite étude (7 jeunes hommes actifs) : 6 semaines, 4-5 jours par semaine ; VO2max en hausse et capacité anaérobie +28 %.", TABATA_1996), **V)

seance("velo-sprints-courts", famille="sprint", nom="Sprints courts",
       objectif="Puissance maximale, recrutement neuromusculaire", resume="8 à 10 × 8-10 s à fond, récupération complète 3-5 min.",
       zone="Z7", rpe="9", niveau="tous", deroule=[ECH(20), X(8, MAX(10, cad="> 100"), R(4, 45, 55)), CALME(10)],
       variantes=["6 sprints", "8 sprints", "10 sprints"], phases=["toutes"], parSemaine="1", recuperation="24-48 h",
       conseils=["Qualité avant quantité : arrête dès que la puissance baisse nettement.", SANS_ERG],
       preuve=PRATIQUE("Pour la puissance maximale de cyclistes entraînés, pratique d'entraîneur. Chez des sujets actifs, des sprints de 10 s ont aussi amélioré la VO2max.", ALLEN_COGGAN, HAZELL_2010), **V)

seance("velo-sprints-force-paton", famille="sprint", nom="Sprints en force (Paton & Hopkins)",
       objectif="Puissance et contre-la-montre court, en période de compétition", resume="3 séries de 5 × 30 s à fond à 60-70 tr/min (récupération 30 s), en alternance avec 20 sauts sur une jambe ; 3-5 min entre les séries.",
       zone="Z7", rpe="9", niveau="confirmé", deroule=[ECH(20), X(3, X(5, MAX(30, cad="60-70"), R(0.5, 40, 50)), R(4, 45, 55, note="+ 20 sauts sur une jambe, par jambe")), CALME(10)],
       variantes=["2 séries", "3 séries"], phases=["spécifique"], parSemaine="2-3 (12 séances en 4-5 semaines)", recuperation="48 h",
       conseils=["Gros braquet, cadence basse imposée ; sans ERG, c'est le braquet qui fait la résistance."],
       preuve=P("plausible", "Chez des cyclistes de compétition (12 séances en 4-5 semaines) : puissance sur 1 km +8,7 %, sur 4 km +8,1 %, puissance de pointe +6,8 %.", PATON_2005), **V)

seance("velo-departs-arretes", famille="sprint", nom="Départs arrêtés en gros braquet",
       objectif="Force explosive sur le vélo", resume="6 × 10-15 s en partant presque à l'arrêt (50 tr/min), récupération 4 min.",
       zone="Z7", rpe="9", niveau="intermédiaire", deroule=[ECH(20), X(6, MAX(12, cad="démarrage à 50"), R(4)), CALME(10)],
       variantes=["4 départs", "6 départs", "8 départs"], phases=["base", "construction"], parSemaine="0-1", recuperation="48 h",
       conseils=["En côte légère dehors ; sur home trainer, mets le braquet le plus dur avant de démarrer."],
       preuve=PRATIQUE("Méthode d'entraîneur ; pas d'étude dédiée.", ALLEN_COGGAN), **V)

seance("velo-velocite", famille="sprint", nom="Vélocité (spin-ups)",
       objectif="Technique de pédalage, souplesse à haute cadence", resume="8 × 30 s en montant progressivement à 110-130 tr/min, faible puissance.",
       zone="Z2", rpe="3-4", niveau="tous", deroule=[ECH(10), X(8, E(0.5, 60, 75, cad="110-130"), R(1.5, 50, 65)), CALME(10)],
       variantes=["6 × 30 s", "8 × 30 s", "5 × 1 min à 110"], phases=["base"], parSemaine="0-1", recuperation="aucune",
       conseils=["Le bassin ne doit pas rebondir sur la selle."],
       preuve=PRATIQUE("Exercice technique d'entraîneur ; effet sur la performance non démontré.", FRIEL), **V)

seance("velo-force-basse-cadence", famille="force", nom="Basse cadence (force sur le vélo)",
       objectif="Force-endurance, recrutement des fibres", resume="6 × 5 min autour de la CP à 60 tr/min, récupération 3-4 min (protocole Nimmerichter).",
       zone="Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15), X(6, E(5, 95, 100, cad="60"), R(3.5, 50, 60, note="cadence libre")), CALME(10)],
       variantes=["4 × 5", "6 × 5", "5 × 6 à 40 tr/min (format Kristoffersen)"], phases=["base", "construction"], parSemaine="0-2", recuperation="36-48 h",
       conseils=["Arrête si tes genoux tirent : la basse cadence charge l'articulation."],
       preuve=P("mitigé", "6 × 5 min à 60 tr/min (2 fois par semaine, 4 semaines) a un peu amélioré le contre-la-montre en côte, mais le groupe contrôle aussi. 5 × 6 min à 40 tr/min pendant 12 semaines n'a rien apporté chez des vétérans très entraînés. La musculation lourde a de meilleures preuves.", NIMMERICHTER_2012, KRISTOFFERSEN_2014), **V)

# ——— Tests vélo ———
seance("velo-test-cp-3-7-12", famille="test", nom="Test CP 3/7/12 min",
       objectif="Mesurer ta CP (puissance critique) ; W′ seulement approximatif", resume="3 efforts à fond, dans l'ordre 12, 7 puis 3 min, avec 30 min de récupération facile entre chaque.",
       zone="test", rpe="10", niveau="intermédiaire",
       deroule=[ECH(20, 50, 75, note="avec 2 × 1 min à 110 %"), MAX(720, note="12 min à fond, réparti"), R(30, 45, 55), MAX(420, note="7 min à fond"), R(30, 45, 55), MAX(180, note="3 min à fond"), CALME(10)],
       variantes=["Efforts sur 3 jours séparés (plus juste pour W′)", "Version courte 3 + 12 min (test CP 2 points)"], phases=["début et fin de phase"], parSemaine="toutes les 6-8 semaines",
       recuperation="48 h", conseils=["Frais (feu vert), même heure, même vélo, mêmes conditions.", "Sans ERG, c'est ce qu'il faut : effort libre."],
       preuve=P("prouvé", "Tests de terrain valides et fiables pour la CP quand les efforts sont maximaux. Avec 30 min de récupération entre les efforts, l'erreur moyenne est de 3,7 % sur la CP mais de 33 % sur W′.", KARSTEN_2015, KARSTEN_2017), **V)

seance("velo-test-cp-2-points", famille="test", nom="Test CP 2 points (3 + 12 min)",
       objectif="CP en moins de temps", resume="3 min puis 12 min à fond, 30 min de récupération entre les deux.",
       zone="test", rpe="10", niveau="intermédiaire", deroule=[ECH(20), MAX(180), R(30, 45, 55), MAX(720), CALME(10)],
       variantes=[], phases=["début et fin de phase"], parSemaine="toutes les 6-8 semaines", recuperation="48 h",
       conseils=["Un peu moins précis que 3 efforts, mais suffisant pour recaler les zones."],
       preuve=P("plausible", "Deux efforts maximaux donnent une CP quasi identique à celle obtenue avec trois (283 contre 282 W dans l'étude).", SIMPSON_2017), **V)

seance("velo-test-ftp-20", famille="test", nom="Test FTP 20 min",
       objectif="Estimer le seuil (FTP ≈ 95 % de la puissance sur 20 min)", resume="5 min à fond, 10 min facile, puis 20 min à fond.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20), MAX(300, note="5 min à fond pour vider la réserve anaérobie"), R(10), MAX(1200), CALME(10)],
       variantes=[], phases=["début de phase"], parSemaine="toutes les 6-8 semaines",
       recuperation="48 h", conseils=["Le coefficient 0,95 est une moyenne : il varie d'un cycliste à l'autre.", "L'appli raisonne en CP : préfère le test CP."],
       preuve=PRATIQUE("La FTP (95 % des 20 min) se tient en moyenne 51 ± 16 min avec de gros écarts entre cyclistes ; elle surestime l'état stable lactique (≈ 93 % de la FTP). La CP est en moyenne un peu plus haute (+7 W), mais les deux ne sont pas interchangeables.", BORSZCZ_2018, INGLIS_2020, KARSTEN_2021), **V)

seance("velo-test-rampe", famille="test", nom="Test rampe (PMA)",
       objectif="Puissance maximale aérobie (PMA)", resume="Paliers de 1 min augmentant de 20-25 W jusqu'à l'épuisement.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(10), MAX(720, note="+20 à 25 W chaque minute jusqu'à l'arrêt"), CALME(10)],
       variantes=[], phases=["début de phase"], parSemaine="toutes les 6-8 semaines", recuperation="24-48 h",
       conseils=["« Seuil ≈ 75 % de la meilleure minute » est une convention des applis (Zwift, TrainerRoad), pas un résultat d'étude.", "La PMA dépend de la pente de la rampe : garde toujours la même.", "Sans ERG : monte d'une dent toutes les minutes en gardant la cadence."],
       preuve=PRATIQUE("Test de laboratoire adapté au home trainer ; l'estimation du seuil à partir de la PMA reste approximative.", ALLEN_COGGAN), **V)

seance("velo-test-5min", famille="test", nom="Test 5 min",
       objectif="Estimer la VO2max (et suivre ta puissance aérobie)", resume="5 min à fond après un bon échauffement.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20), MAX(300), CALME(10)],
       variantes=[], phases=["début de phase"], parSemaine="toutes les 6-8 semaines", recuperation="24-48 h",
       conseils=["La puissance sur 5 min est un bon repère de suivi en soi, même sans formule."],
       preuve=P("plausible", "Formule de prédiction de la VO2max à partir des 5 min ; une étude sur un autre groupe de cyclistes la trouve un peu basse.", SITKO_2022), **V)

seance("velo-test-durabilite", famille="test", nom="Test de durabilité",
       objectif="Mesurer combien tu perds quand tu es fatigué", resume="Un jour : 5 min à fond frais. Un autre jour : 5 min à fond après 2 h 30 à intensité modérée. Compare l'écart en %.",
       zone="test", rpe="10", niveau="confirmé", deroule=[ECH(15, 50, 65), E(150, 60, 70), MAX(300, note="5 min à fond fatigué"), CALME(10)],
       variantes=["Variante : ≈ 2 000 kJ sous 70 % de la CP puis 12 min à fond"], phases=["construction"], parSemaine="1-2 fois par saison", recuperation="72 h",
       conseils=["Mange comme en course pendant la partie modérée."],
       preuve=P("plausible", "Protocoles de recherche, pas encore validés comme test de suivi ; la baisse de puissance après un gros travail distingue les meilleurs pros.", SPRAGG_2024, VAN_ERP_2021), **V)

seance("velo-test-sprint", famille="test", nom="Test de sprint",
       objectif="Puissance maximale (1-10 s)", resume="3 sprints de 10 s à fond, récupération complète 5 min.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20), X(3, MAX(10), R(5, 45, 55)), CALME(10)],
       variantes=["Départ lancé", "Départ arrêté"], phases=["toutes"], parSemaine="toutes les 6-8 semaines", recuperation="24 h",
       conseils=["Note le meilleur des 3."], preuve=PRATIQUE("Mesure simple de la puissance maximale.", ALLEN_COGGAN), **V)

seance("velo-test-derive", famille="test", nom="Test de dérive cardiaque",
       objectif="Solidité de l'endurance (découplage puissance / FC)", resume="60 à 90 min à puissance constante à tes watts Z2, au frais, bien hydraté.",
       zone="Z2", rpe="3", niveau="tous", deroule=[ECH(10, 50, 65), E(70, 65, 70), CALME(5)],
       variantes=["60 min", "90 min"], phases=["base"], parSemaine="toutes les 4-6 semaines", recuperation="< 24 h",
       conseils=["On ignore les 10 premières minutes. Dérive < 5 % : endurance solide ; > 10 % : trop dur ou fatigue.", "L'appli le mesure déjà sur chaque sortie Z2."],
       preuve=PRATIQUE("Indicateur d'entraîneur de la solidité aérobie ; à lire en tendance.", FRIEL, MAUNDER_2021), **V)

# ════════════════════════ COURSE À PIED (intensité en % de la VMA) ════════════════════════
C = dict(sport="course", unite="%VMA")

seance("course-footing", famille="endurance", nom="Footing en endurance fondamentale",
       objectif="Volume aérobie, économie de course", resume="30 à 60 min à allure de conversation.",
       zone="Z2", rpe="2-3", niveau="tous", deroule=[E(45, 60, 72)],
       variantes=["30 min", "45 min", "60 min"], phases=["toutes"], parSemaine="2-4", recuperation="< 24 h",
       conseils=["Test de la parole. Mieux vaut trop lent que trop vite."],
       preuve=P("prouvé", "Base du volume des coureurs d'endurance (≈ 80 % du temps sous le premier seuil) ; les programmes qui gardent cette base progressent autant ou plus.", SEILER_2010, STOGGL_2014, PERSINGER_2004), **C)

seance("course-sortie-longue", famille="endurance", nom="Sortie longue",
       objectif="Endurance de fond", resume="60 à 100 min en endurance fondamentale.",
       zone="Z2", rpe="3", niveau="intermédiaire", deroule=[E(75, 62, 72)],
       variantes=["60 min", "75 min", "90 min", "dernières 10 min à allure semi-marathon"], phases=["base", "construction"],
       parSemaine="1", recuperation="24-48 h", conseils=["Repère d'entraîneur : ne dépasse pas ~25-30 % de ton volume hebdomadaire."],
       preuve=P("plausible", "Le volume en basse intensité est associé à la performance ; l'intérêt propre d'une sortie longue (par rapport au même volume réparti) n'est pas isolé.", SEILER_2010), **C)

seance("course-lignes-droites", famille="sprint", nom="Lignes droites (accélérations)",
       objectif="Foulée, économie, vitesse sans fatigue", resume="Après un footing : 6 à 10 × 15-20 s en accélération progressive jusqu'à ton allure 1 500 m, relâché, retour en marchant.",
       zone="Z2 + vitesse", rpe="4", niveau="tous", deroule=[E(30, 60, 72), X(8, E(0, 105, 115, sec=20, note="relâché, pas un sprint"), R(0, 0, 40, sec=60))],
       variantes=["6 lignes droites", "8", "10"], phases=["toutes"], parSemaine="1-2", recuperation="aucune",
       conseils=["Relâché, sur terrain plat et souple."], preuve=PRATIQUE("Pratique d'entraîneur pour la foulée et l'économie de course.", DANIELS), **C)

seance("course-tempo-continu", famille="tempo", nom="Tempo continu",
       objectif="Seuil, endurance à allure soutenue", resume="20 à 30 min à allure « confortablement difficile » (85-88 % VMA, allure T).",
       zone="Z3", rpe="6", niveau="intermédiaire", deroule=[ECH(15, 60, 72), E(25, 85, 88), CALME(10, 60, 70)],
       variantes=["15 min", "20 min", "25 min", "30 min"], phases=["construction"], parSemaine="1", recuperation="48 h",
       conseils=["Tu peux dire quelques mots, pas des phrases."], preuve=PRATIQUE("Allure « T » de Daniels (≈ seuil), largement utilisée.", DANIELS), **C)

seance("course-seuil-fractionne", famille="seuil", nom="Seuil fractionné (cruise intervals)",
       objectif="Seuil, avec plus de volume au seuil qu'en continu", resume="4 à 6 × 5 min (ou 1 km) à 85-90 % VMA, récupération 1 min.",
       zone="Z3-Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15, 60, 72), X(5, E(5, 85, 90), R(1, 50, 60)), CALME(10, 60, 70)],
       variantes=["3 × 5 min", "4 × 5", "5 × 5", "6 × 5", "3 × 10 min (récup 2 min)", "3 × 2 km"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Récupération courte volontaire : on reste au seuil."],
       preuve=PRATIQUE("Séance de Daniels ; base du « double seuil » norvégien.", DANIELS, CASADO_2023), **C)

seance("course-double-seuil", famille="seuil", nom="Double seuil (modèle norvégien)",
       objectif="Beaucoup de volume au seuil, contrôlé", resume="Matin : 5 × 6 min au seuil ; soir : 10 × 1 000 m au seuil ; récupérations 1 min (déroulé = séance du matin).",
       zone="Z3-Z4", rpe="6-7", niveau="confirmé", deroule=[ECH(15, 60, 72), X(5, E(6, 83, 88), R(1, 50, 60)), CALME(10, 60, 70)],
       variantes=["Une seule séance de seuil", "Deux séances le même jour"], phases=["construction"], parSemaine="1-2 jours",
       recuperation="48 h", conseils=["Réservé à un gros volume (dans les descriptions : 3-4 séances de ce type par semaine pour 150-180 km) ; intensité contrôlée (lactate 2 à 4,5 mmol/L)."],
       preuve=P("plausible", "Méthode d'athlètes de haut niveau, cohérente avec la science du seuil, mais peu d'essais contrôlés.", CASADO_2023), **C)

seance("course-vma-30-30", famille="vo2max", nom="VMA courte 30/30",
       objectif="VO2max, vitesse maximale aérobie", resume="2 séries de 8 à 12 × (30 s à 100-105 % VMA / 30 s trot à 50 %), récupération 3-5 min.",
       zone="Z5", rpe="8", niveau="tous", deroule=[ECH(20, 60, 72), X(2, X(10, E(0, 100, 105, sec=30), R(0, 45, 55, sec=30)), R(4, 45, 55)), CALME(10, 60, 70)],
       variantes=["2 × 8", "2 × 10", "2 × 12", "3 × 10"], phases=["base", "construction"], parSemaine="1", recuperation="48 h",
       conseils=["La récupération est trottinée, pas marchée."],
       preuve=P("plausible", "À 100 % VMA avec 30 s de récupération à 50 %, on reste plus longtemps à VO2max qu'en courant en continu (étude d'une séance, 8 coureurs). L'effet propre du 30/30 sur plusieurs semaines est peu étudié.", BILLAT_2000, BILLAT_2001), **C)

seance("course-vma-longue", famille="vo2max", nom="VMA longue",
       objectif="VO2max, endurance à haute vitesse", resume="5 à 6 × 1 000 m (ou 3 min) à 95-100 % VMA, récupération 2-3 min.",
       zone="Z5", rpe="8-9", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(5, E(3.5, 95, 100), R(2.5, 45, 55)), CALME(10, 60, 70)],
       variantes=["4 × 1 000", "5 × 1 000", "6 × 1 000", "4 × 1 200", "Durée = 50-60 % de ton temps limite à VMA, récupération égale (Billat)"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48-72 h", conseils=[], preuve=P("prouvé", "Les intervalles de 2-5 min proches de la VMA augmentent la VO2max. Coureurs entraînés : une séance par semaine à la VMA (durée = 50 % du temps limite) pendant 4 semaines a amélioré la vitesse à VO2max ; coureurs modérément entraînés : des répétitions à 60 % du temps limite ont amélioré VO2max et 3 000 m.", BILLAT_1999, ESFARJANI_2007, BUCHHEIT_2013), **C)

seance("course-4x4-helgerud", famille="vo2max", nom="4 × 4 min (Helgerud)",
       objectif="VO2max", resume="4 × 4 min à 90-95 % de la FC max, récupération 3 min en trottinant (~70 % FC max).",
       zone="Z5", rpe="8-9", niveau="tous", deroule=[ECH(10, 60, 70), X(4, E(4, 90, 95, note="cible réelle : 90-95 % de la FC max"), R(3, 50, 60)), CALME(5, 60, 70)],
       variantes=["3 × 4", "4 × 4"], phases=["base", "construction"], parSemaine="1-2 (3 dans l'étude)", recuperation="48 h", conseils=[],
       preuve=P("prouvé", "+7,2 % de VO2max en 8 semaines (3 séances par semaine, 40 hommes modérément entraînés), plus que l'entraînement modéré à dépense égale.", HELGERUD_2007), **C)

seance("course-10-20-30", famille="vo2max", nom="10-20-30 (Bangsbo)",
       objectif="VO2max et performance avec moins de volume", resume="3-4 blocs de 5 min : chaque minute = 30 s lent, 20 s modéré, 10 s presque à fond ; 2 min de récupération entre les blocs.",
       zone="Z2-Z6", rpe="8", niveau="tous", deroule=[ECH(15, 60, 72), X(3, X(5, E(0, 55, 65, sec=30), E(0, 75, 85, sec=20), E(0, 115, 130, sec=10)), R(2, 0, 50)), CALME(10, 60, 70)],
       variantes=["2 blocs", "3 blocs", "4 blocs"], phases=["base", "construction"], parSemaine="2-3", recuperation="36-48 h",
       conseils=["Les %VMA de chaque partie sont estimés : dans l'étude, lent / modéré / presque à fond."],
       preuve=P("plausible", "En 7 semaines et avec 54 % de volume en moins, VO2max +4 % et 5 km −48 s (18 coureurs modérément entraînés).", GUNNARSSON_2012), **C)

seance("course-sprints-30s", famille="anaerobie", nom="Sprints de 30 s",
       objectif="Capacité anaérobie, vitesse", resume="8 à 12 × 30 s à ~130 % VMA, récupération 4 min 30.",
       zone="Z6", rpe="9", niveau="confirmé", deroule=[ECH(20, 60, 72), X(8, E(0, 125, 135, sec=30), R(4.5, 0, 50)), CALME(10, 60, 70)],
       variantes=["6", "8", "10", "12 répétitions"], phases=["spécifique"], parSemaine="0-1", recuperation="48-72 h", conseils=[],
       preuve=P("plausible", "A amélioré le 3 000 m dans l'étude, mais moins que les intervalles à la VMA.", ESFARJANI_2007), **C)

seance("course-allure-5km", famille="specifique", nom="Allure 5 km",
       objectif="Spécifique 5 km : tenir l'allure de course", resume="5 × 1 000 m ou 3 × 1 600 m à allure 5 km (~95 % VMA), récupération 2-3 min.",
       zone="Z5", rpe="8", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(5, E(3.7, 93, 96), R(2.5, 45, 55)), CALME(10, 60, 70)],
       variantes=["4 × 1 000", "5 × 1 000", "3 × 1 600", "2 × 2 000"], phases=["spécifique"], parSemaine="1", recuperation="48-72 h",
       conseils=["Allure régulière, la dernière doit être la plus rapide."], preuve=PRATIQUE("Proche de l'allure « I » de Daniels, un peu plus lente ; principe de spécificité.", DANIELS), **C)

seance("course-allure-10km", famille="specifique", nom="Allure 10 km / semi",
       objectif="Spécifique 10 km ou semi-marathon", resume="3 × 3 km ou 5 × 2 km à allure 10 km, récupération 2 min ; semi : 2 × 5 km à allure semi.",
       zone="Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(3, E(12, 88, 92), R(2, 45, 55)), CALME(10, 60, 70)],
       variantes=["5 × 2 km (10 km)", "3 × 3 km (10 km)", "2 × 5 km (semi)"], phases=["spécifique"], parSemaine="1", recuperation="48-72 h",
       conseils=["Le %VMA de l'allure 10 km (≈ 88-92 %) est un repère, pas une valeur vérifiée."],
       preuve=PRATIQUE("Principe de spécificité, choix d'entraîneur.", DANIELS), **C)

seance("course-cotes-courtes", famille="sprint", nom="Côtes courtes (sprints en côte)",
       objectif="Force, puissance, foulée", resume="8 à 10 × 10 s de sprint en côte raide, retour en marchant (2 min).",
       zone="vitesse", rpe="8", niveau="tous", deroule=[E(20, 60, 72), X(8, MAX(10, note="côte de 6-10 %"), R(2, 0, 40, note="marche"))],
       variantes=["6 côtes", "8", "10"], phases=["base", "construction"], parSemaine="1", recuperation="24-48 h", conseils=["Conseil d'entraîneur : la pente limite la vitesse et l'impact."],
       preuve=PRATIQUE("Pratique d'entraîneur (force spécifique).", DANIELS), **C)

seance("course-cotes-longues", famille="vo2max", nom="Côtes longues",
       objectif="VO2max, force-endurance, économie", resume="6 à 8 × 1 min 30-2 min en côte à l'effort 5 km, retour en trottinant.",
       zone="Z5", rpe="8", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(6, E(2, 90, 100, note="effort, pas allure"), R(2.5, 45, 55, note="descente en trottinant")), CALME(10, 60, 70)],
       variantes=["5 côtes", "6", "8"], phases=["base", "construction"], parSemaine="1", recuperation="48 h", conseils=[],
       preuve=P("plausible", "20 coureurs entraînés, 6 semaines, 5 formats de côtes : tous ont amélioré le 5 km (≈ 2 %). Selon les auteurs, n'importe quel format de côtes à haute intensité est utile.", BARNES_2013), **C)

seance("course-fartlek", famille="vo2max", nom="Fartlek",
       objectif="Variété, VO2max sans pression du chrono", resume="30-45 min avec des accélérations libres (1 à 3 min) quand tu en as envie.",
       zone="Z2-Z5", rpe="6", niveau="tous", deroule=[ECH(10, 60, 72), X(8, E(1.5, 90, 100), R(2, 60, 70)), CALME(5, 60, 70)],
       variantes=["Libre", "Pyramide 1-2-3-2-1 min"], phases=["base"], parSemaine="0-1", recuperation="24-48 h", conseils=["Au ressenti, sans montre."],
       preuve=PRATIQUE("Méthode suédoise historique ; pratique d'entraîneur.", DANIELS), **C)

seance("course-test-vma-5min", famille="test", nom="Test VMA 5 min",
       objectif="Estimer ta VMA", resume="Après échauffement, cours la plus grande distance possible en 5 min (VMA ≈ distance / 5 min).",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20, 60, 72), MAX(300, note="allure régulière, la plus haute possible"), CALME(10, 60, 70)],
       variantes=["Demi-Cooper (6 min) : VMA (km/h) = distance (m) / 100 — pratique sans source"], phases=["début de phase"], parSemaine="toutes les 6-8 semaines",
       recuperation="48 h", conseils=["Sur piste ou terrain plat mesuré."],
       preuve=P("prouvé", "Sur 48 hommes, la vitesse moyenne sur 5 min est très liée à la VMA mesurée sur tapis (r = 0,94). Le test estime mal la VO2max.", BERTHON_1997), **C)

seance("course-test-vameval", famille="test", nom="Test par paliers (Léger-Boucher / VAMEVAL)",
       objectif="VMA par paliers", resume="Vitesse qui augmente par paliers, rythmée par des bips, jusqu'à l'arrêt (Léger-Boucher : paliers de 2 min ; VAMEVAL : +0,5 km/h par minute).",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(15, 60, 72), MAX(900, note="paliers jusqu'à l'épuisement"), CALME(10, 60, 70)],
       variantes=[], phases=["début de phase"], parSemaine="toutes les 6-8 semaines", recuperation="48 h", conseils=["Besoin d'une piste balisée et de la bande-son. Le VAMEVAL (Cazorla & Léger 1993) vient d'un ouvrage français, hors PubMed."],
       preuve=P("prouvé", "Léger-Boucher : prédit la VO2max (r = 0,96, 25 adultes), fiable d'un test à l'autre (r = 0,97).", LEGER_1980), **C)

# ════════════════════════ RENFORCEMENT ════════════════════════
F = dict(sport="force", unite="%1RM")

seance("force-lourde-jambes-cycliste", famille="force-lourde", nom="Force lourde des jambes (cycliste)",
       objectif="Économie et puissance à vélo, tenue en fin d'effort", resume="Demi-squat, presse une jambe, flexion de hanche une jambe et mollets : 3 séries lourdes, 2 fois par semaine pendant 12 semaines, puis 1 fois pour entretenir.",
       zone="force", rpe="8-9", niveau="intermédiaire", dureeMin=45,
       exercices=[
           {"nom": "Demi-squat (barre)", "series": 3, "reps": "sem. 1-3 : 10RM / 6RM ; 4-6 : 8RM / 5RM ; 7-12 : 6RM / 4RM", "repos": 180},
           {"nom": "Presse à cuisses une jambe", "series": 3, "reps": "idem", "repos": 120},
           {"nom": "Flexion de hanche une jambe (poulie)", "series": 3, "reps": "idem", "repos": 120},
           {"nom": "Mollets (flexion plantaire)", "series": 3, "reps": "idem", "repos": 90},
       ],
       variantes=["Hiver : 2 séances/semaine", "Saison : 1 séance/semaine (entretien)"], phases=["base (hiver)", "entretien en saison"],
       parSemaine="2 puis 1", recuperation="48 h (pas la veille d'une séance dure)",
       conseils=["Montée explosive, descente contrôlée.", "L'étude faisait des séries RM (à l'échec ou presque) ; garder 1-2 reps en réserve est une adaptation d'entraîneur.", "Découpage des RM par semaines : repris des études du même groupe, à confirmer pour 2010."],
       preuve=P("prouvé", "Ajoutée à l'endurance, la musculation lourde améliore l'économie de pédalage et la performance des cyclistes entraînés ; 1 séance par semaine en saison maintient les gains (et améliore la performance).", RONNESTAD_2010, RONNESTAD_MUJIKA_2014, RONNESTAD_2011), **F)

seance("force-maxi-coureur", famille="force-lourde", nom="Force maximale (coureur)",
       objectif="Économie de course", resume="Demi-squat 4 × 4RM, 3 fois par semaine pendant 8 semaines, montée la plus rapide possible.",
       zone="force", rpe="8-9", niveau="intermédiaire", dureeMin=30,
       exercices=[{"nom": "Demi-squat (barre)", "series": 4, "reps": "4RM, montée explosive", "repos": 180}],
       variantes=["2 fois par semaine en saison"], phases=["base"], parSemaine="3 (étude)", recuperation="48 h",
       conseils=["Repos de 3 min : choix d'entraîneur."],
       preuve=P("prouvé", "17 coureurs : économie de course +5 %, temps limite à la VMA +21 %, sans changement de VO2max ni de poids. Les méta-analyses récentes confirment l'effet de la force sur l'économie.", STOREN_2008, LLANOS_LAGOS_2024), **F)

seance("force-explosive-coureur", famille="force-explosive", nom="Force explosive et pliométrie (coureur)",
       objectif="Économie de course, raideur du tendon", resume="Sauts, bondissements, squat sauté léger : 2 fois par semaine, 20-30 min.",
       zone="force", rpe="6-7", niveau="intermédiaire", dureeMin=25,
       exercices=[
           {"nom": "Squat sauté (poids du corps ou léger)", "series": 3, "reps": "6-8", "repos": 90},
           {"nom": "Bondissements alternés", "series": 3, "reps": "8 par jambe", "repos": 90},
           {"nom": "Sauts à la corde / pogos", "series": 3, "reps": "20 s", "repos": 60},
           {"nom": "Fentes sautées", "series": 2, "reps": "6 par jambe", "repos": 90},
       ],
       variantes=["Poids du corps", "Gilet lesté léger"], phases=["base", "construction"], parSemaine="2", recuperation="48 h",
       conseils=["Contacts au sol courts et légers ; arrête avant de t'écraser."],
       preuve=P("prouvé", "Méta-analyses : la pliométrie, la force lourde et surtout leur combinaison améliorent l'économie de course (effet petit à modéré) ; la pliométrie seule agit surtout aux allures lentes (≤ 12 km/h).", LLANOS_LAGOS_2024, BALSALOBRE_2016), **F)

seance("force-prevention-genoux", famille="prevention", nom="Prévention des blessures (renfo général + ischios)",
       objectif="Réduire le risque de blessure", resume="Squat, fentes, nordic hamstring, gainage, mollets au poids du corps : 30 min, 2 fois par semaine.",
       zone="force", rpe="5-6", niveau="tous", dureeMin=30,
       exercices=[
           {"nom": "Squat au poids du corps", "series": 3, "reps": "12-15", "repos": 60},
           {"nom": "Fentes arrière", "series": 3, "reps": "10 par jambe", "repos": 60},
           {"nom": "Nordic hamstring", "series": 2, "reps": "5-8", "repos": 90},
           {"nom": "Pont fessier une jambe", "series": 3, "reps": "10 par jambe", "repos": 45},
           {"nom": "Gainage (face, côtés)", "series": 3, "reps": "30-45 s", "repos": 30},
           {"nom": "Mollets une jambe", "series": 3, "reps": "15 par jambe", "repos": 45},
       ],
       variantes=["1 fois par semaine (minimum)", "2 fois par semaine (conseillé)"], phases=["toutes"], parSemaine="1-2", recuperation="24 h",
       conseils=["La régularité compte plus que la charge.", "Nordic : progression sur 10 semaines, puis 1 fois par semaine (protocole de Petersen)."],
       preuve=P("plausible", "Dans les essais contrôlés (surtout sports collectifs et militaires), le renforcement a divisé le risque de blessure par environ 3 (RR 0,32). Chez les coureurs, une méta-analyse de 2024 ne trouve pas d'effet global, seulement avec des séances encadrées. Le nordic a réduit les blessures aiguës des ischios d'environ 70 % chez des footballeurs.", LAUERSEN_2014, WU_2024, PETERSEN_2011), **F)

seance("force-isometrie-tendon-rotulien", famille="prevention", nom="Isométrie pour tendon rotulien douloureux",
       objectif="Calmer une douleur de tendon rotulien", resume="Extension de jambe en isométrie : 5 × 45 s à ~70 % de l'effort max, 2 min de repos.",
       zone="force", rpe="6", niveau="tous", dureeMin=15,
       exercices=[{"nom": "Extension de jambe isométrique (ou chaise au mur, adaptation non étudiée)", "series": 5, "reps": "45 s", "repos": 120}],
       variantes=[], phases=["si douleur"], parSemaine="selon besoin", recuperation="aucune",
       conseils=["Si la douleur persiste plus de 2 semaines : kiné."],
       preuve=P("mitigé", "Effet antidouleur immédiat dans une étude de 6 volleyeurs (une seule séance) ; une méta-analyse de 2020 conclut que l'isométrie ne fait pas mieux que les exercices avec charge classiques.", RIO_2015, CLIFFORD_2020), **F)

seance("force-mollets-achille", famille="prevention", nom="Excentrique des mollets (tendon d'Achille)",
       objectif="Soigner une tendinopathie d'Achille chronique", resume="Descentes lentes sur la pointe des pieds, jambe tendue puis genou fléchi : 3 × 15, deux fois par jour, 12 semaines.",
       zone="force", rpe="5-7", niveau="tous", dureeMin=10,
       exercices=[{"nom": "Descente excentrique jambe tendue", "series": 3, "reps": "15", "repos": 60},
                  {"nom": "Descente excentrique genou fléchi", "series": 3, "reps": "15", "repos": 60}],
       variantes=[], phases=["si douleur"], parSemaine="14 (2 par jour)", recuperation="aucune",
       conseils=["Seulement en cas de douleur au tendon ; dosage vu en source secondaire, à confirmer.", "Avis d'un kiné conseillé."],
       preuve=P("mitigé", "15 coureurs de loisir sont revenus à la course ; petite étude, groupe de comparaison non tiré au sort.", ALFREDSON_1998), **F)

seance("force-haut-du-corps-531", famille="force-lourde", nom="Développé couché 5/3/1 (dans l'appli)",
       objectif="Force du haut du corps", resume="Cycle de 4 semaines à partir d'une référence (85-90 % du max), dernière série au maximum en gardant 1 rep en réserve, 5 × 5 en complément.",
       zone="force", rpe="7-9", niveau="intermédiaire", dureeMin=35,
       exercices=[{"nom": "Développé couché", "series": 3, "reps": "5/5/5+, 3/3/3+, 5/3/1+, allègement", "repos": 180},
                  {"nom": "Développé couché (5 × 5 à la 1re charge)", "series": 5, "reps": "5", "repos": 120}],
       variantes=["Voir le module Muscu"], phases=["toutes"], parSemaine="1", recuperation="48 h",
       conseils=["N'aide pas la performance à vélo : c'est un objectif de force à part."],
       preuve=P("plausible", "Aller à l'échec n'est pas nécessaire pour progresser en force ; les répétitions en réserve permettent de doser l'effort. Le 5/3/1 lui-même n'a pas été étudié.", GRGIC_2022, HELMS_2016, WENDLER), **F)

# ════════════════════════ MÉTHODES (organisation, pour plus tard) ════════════════════════
M = dict(sport="methode")

def methode(id, nom, objectif, resume, preuve, conseils=(), phases=()):
    seance(id, famille="organisation", nom=nom, objectif=objectif, resume=resume, zone="—", rpe="—", niveau="—",
           variantes=[], phases=phases, conseils=conseils, preuve=preuve, **M)

methode("methode-polarise", "Répartition polarisée (80/20)", "Répartir l'intensité sur la semaine",
        "≈ 80 % des séances sous le premier seuil, ≈ 20 % au-dessus du second, très peu entre les deux.",
        P("plausible", "Au moins aussi efficace que les autres répartitions ; méta-analyse 2024 (17 études) : léger avantage sur la VO2max seulement (athlètes très entraînés, moins de 12 semaines), pas sur les contre-la-montre.", OLIVEIRA_2024, ROSENBLAT_2019, STOGGL_2014, ROSENBLAT_2025), phases=["toutes"])
methode("methode-pyramidal", "Répartition pyramidale", "Répartir l'intensité sur la semaine",
        "Beaucoup de Z1-Z2, une part notable de Z3 (tempo, sweet spot), un peu de Z4-Z5.",
        P("plausible", "Répartition fréquente chez les élites, surtout en période de base ; elle fait jeu égal avec le polarisé dans les comparaisons récentes.", OLIVEIRA_2024, ROSENBLAT_2025), phases=["base"])
methode("methode-bloc-vo2", "Bloc d'intensité concentré", "Choc VO2max sur une semaine",
        "1 semaine avec 5 séances de VO2max, puis 3 semaines à 1 séance par semaine (et le reste en endurance).",
        P("mitigé", "Un petit essai favorable (VO2max +4,6 %) et une méta-analyse avec un petit effet de faible certitude ; mais sur 12 semaines à charge égale, aucune différence de performance.", RONNESTAD_2014B, MOLMEN_2019, ALMQUIST_2022), phases=["construction"],
        conseils=["Seulement avec une bonne récupération (feu vert) et un volume d'endurance déjà solide."])
methode("methode-ordre-intervalles", "Ordre des formats d'intervalles", "Enchaîner les séances dures sur plusieurs semaines",
        "Alterner intervalles longs (4 × 16), moyens (4 × 8) et courts (4 × 4), dans n'importe quel ordre, à charge égale.",
        P("prouvé", "Sur 12 semaines (63 cyclistes), longs puis courts, l'inverse ou un mélange : +5 à 10 % pour tous les groupes ; l'ordre change peu.", SYLTA_2016), phases=["toutes"])
methode("methode-affutage", "Affûtage avant l'objectif", "Arriver frais et en forme le jour J",
        "Sur 8 à 14 jours (jusqu'à 21) : baisser le volume de 40 à 60 % (en exponentielle), garder l'intensité et la fréquence des séances.",
        P("prouvé", "Méta-analyses : une baisse de volume de 41-60 % sur ~2 semaines, en gardant l'intensité, donne le meilleur effet ; confirmé chez les athlètes d'endurance.", BOSQUET_2007, WANG_2023), phases=["affûtage"])
methode("methode-semaine-allegee", "Semaine allégée", "Assimiler la charge",
        "1 semaine sur 3 ou 4 avec ~30-40 % de volume en moins, sans supprimer toute l'intensité.",
        PRATIQUE("Principe d'entraîneur (surcompensation) ; durée et ampleur exactes non établies par des essais.", FRIEL), phases=["toutes"])
methode("methode-sleep-low", "« Sleep low » (glucides périodisés)", "Stimuler les adaptations aérobies",
        "Séance intense le soir, dîner pauvre en glucides, puis séance facile à jeun le lendemain matin.",
        P("mitigé", "Triathlètes (3 semaines) : 10 km de course −2,9 % de temps ; cyclistes (1 semaine) : +3,2 % sur 20 km. Mais aucun effet chez des élites, et une méta-analyse de 9 études ne trouve pas d'effet global. À éviter en déficit calorique (risque de RED-S).", MARQUET_2016, MARQUET_2016B, GEJL_2017, GEJL_2021), phases=["base"],
        conseils=["Pas compatible avec une perte de poids en cours."])

# ——— Contrôle et écriture ———
ids = [s["id"] for s in S]
assert len(ids) == len(set(ids)), "identifiants en double"
data = {
    "version": 2,
    "majLe": "2026-10-28",
    "description": "Catalogue scientifique de séances (vélo, course à pied, renforcement, tests, méthodes). Voir catalogue/README.md.",
    "unites": {"%CP": "pourcentage de la puissance critique (≈ FTP)", "%VMA": "pourcentage de la vitesse maximale aérobie", "%1RM": "pourcentage du maximum sur 1 répétition"},
    "seances": S,
}
json.dump(data, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print(len(S), "séances")
