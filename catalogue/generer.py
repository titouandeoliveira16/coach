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

# ——— Références (vérifiées par le relecteur scientifique, voir catalogue/README.md) ———
SEILER_2010 = ref("Seiler S", 2010, "What is best practice for training intensity and duration distribution in endurance athletes?", "Int J Sports Physiol Perform")
STOGGL_2014 = ref("Stöggl T, Sperlich B", 2014, "Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training", "Front Physiol")
ROSENBLAT_2019 = ref("Rosenblat MA, Perrotta AS, Vicenzino B", 2019, "Polarized vs. threshold training intensity distribution on endurance sport performance: a systematic review and meta-analysis of randomized controlled trials", "J Strength Cond Res")
MAUNDER_2021 = ref("Maunder E, Seiler S, Mildenhall MJ, Kilding AE, Plews DJ", 2021, "The importance of 'durability' in the physiological profiling of endurance athletes", "Sports Med")
SPRAGG_2023 = ref("Spragg J, Leo P, Swart J", 2023, "The relationship between physiological characteristics and durability in male professional cyclists", "Med Sci Sports Exerc")
SEILER_2013 = ref("Seiler S, Jøranson K, Olesen BV, Hetlelid KJ", 2013, "Adaptations to aerobic interval training: interactive effects of exercise intensity and total work duration", "Scand J Med Sci Sports")
RONNESTAD_2015 = ref("Rønnestad BR, Hansen J, Vegge G, Tønnessen E, Slettaløkken G", 2015, "Short intervals induce superior training adaptations compared with long intervals in cyclists – an effort-matched approach", "Scand J Med Sci Sports")
RONNESTAD_2020 = ref("Rønnestad BR, Hansen J, Nygaard H, Lundby C", 2020, "Superior performance improvements in elite cyclists following short-interval vs effort-matched long-interval training", "Scand J Med Sci Sports")
HELGERUD_2007 = ref("Helgerud J, Høydal K, Wang E, et al.", 2007, "Aerobic high-intensity intervals improve VO2max more than moderate training", "Med Sci Sports Exerc")
BUCHHEIT_2013 = ref("Buchheit M, Laursen PB", 2013, "High-intensity interval training, solutions to the programming puzzle. Part I: cardiopulmonary emphasis", "Sports Med")
BILLAT_2001 = ref("Billat LV", 2001, "Interval training for performance: a scientific and empirical practice. Part I: aerobic interval training", "Sports Med")
BOSSI_2020 = ref("Bossi AH, Mesquida C, Passfield L, Rønnestad BR, Hopker JG", 2020, "Optimizing interval training through power-output variation within the work intervals", "Int J Sports Physiol Perform")
GIBALA_2006 = ref("Gibala MJ, Little JP, van Essen M, et al.", 2006, "Short-term sprint interval versus traditional endurance training: similar initial adaptations in human skeletal muscle and exercise performance", "J Physiol")
TABATA_1996 = ref("Tabata I, Nishimura K, Kouzaki M, et al.", 1996, "Effects of moderate-intensity endurance and high-intensity intermittent training on anaerobic capacity and VO2max", "Med Sci Sports Exerc")
CREER_2004 = ref("Creer AR, Ricard MD, Conlee RK, Hoyt GL, Parcell AC", 2004, "Neural, metabolic, and performance adaptations to four weeks of high intensity sprint-interval training in trained cyclists", "Int J Sports Med")
PATON_2005 = ref("Paton CD, Hopkins WG", 2005, "Combining explosive and high-resistance training improves performance in competitive cyclists", "J Strength Cond Res")
PATON_2009 = ref("Paton CD, Hopkins WG, Cook C", 2009, "Effects of low- vs. high-cadence interval training on cycling performance", "J Strength Cond Res")
KRISTOFFERSEN_2014 = ref("Kristoffersen M, Gundersen H, Leirdal S, Iversen VV", 2014, "Low cadence interval training at moderate intensity does not improve cycling performance in highly trained veteran cyclists", "Front Physiol")
KARSTEN_2015 = ref("Karsten B, Jobson SA, Hopker J, Stevens L, Beedie C", 2015, "Validity and reliability of critical power field testing", "Eur J Appl Physiol")
SIMPSON_2017 = ref("Simpson LP, Kordi M", 2017, "Comparison of critical power and W′ derived from 2 or 3 maximal tests", "Int J Sports Physiol Perform")
BORSZCZ_2018 = ref("Borszcz FK, Tramontin AF, Bossi AH, Carminatti LJ, Costa VP", 2018, "Functional threshold power in cyclists: validity of the concept and physiological responses", "Int J Sports Med")
RONNESTAD_2014B = ref("Rønnestad BR, Hansen J, Ellefsen S", 2014, "Block periodization of high-intensity aerobic intervals provides superior training effects in trained cyclists", "Scand J Med Sci Sports")
BOSQUET_2007 = ref("Bosquet L, Montpetit J, Arvisais D, Mujika I", 2007, "Effects of tapering on performance: a meta-analysis", "Med Sci Sports Exerc")
MARQUET_2016 = ref("Marquet LA, Brisswalter J, Louis J, et al.", 2016, "Enhanced endurance performance by periodization of carbohydrate intake: 'sleep low' strategy", "Med Sci Sports Exerc")
CASADO_2023 = ref("Casado A, Foster C, Bakken M, Tjelta LI", 2023, "Does lactate-guided threshold interval training within a high-volume low-intensity approach represent the 'next step' in the evolution of distance running training?", "Int J Environ Res Public Health")
DANIELS = ref("Daniels J", 2014, "Daniels' Running Formula (3e éd.)", "Human Kinetics (livre)")
BARNES_2013 = ref("Barnes KR, Hopkins WG, McGuigan MR, Kilding AE", 2013, "Effects of different uphill interval-training programs on running economy and performance", "Int J Sports Physiol Perform")
BERTHON_1997 = ref("Berthon P, Fellmann N, Bedu M, et al.", 1997, "A 5-min running field test as a measurement of maximal aerobic velocity", "Eur J Appl Physiol Occup Physiol")
LEGER_1980 = ref("Léger LA, Boucher R", 1980, "An indirect continuous running multistage field test: the Université de Montréal track test", "Can J Appl Sport Sci")
RONNESTAD_2010 = ref("Rønnestad BR, Hansen EA, Raastad T", 2010, "In-season strength maintenance training increases well-trained cyclists' performance", "Eur J Appl Physiol")
RONNESTAD_MUJIKA_2014 = ref("Rønnestad BR, Mujika I", 2014, "Optimizing strength training for running and cycling endurance performance: a review", "Scand J Med Sci Sports")
BALSALOBRE_2016 = ref("Balsalobre-Fernández C, Santos-Concejero J, Grivas GV", 2016, "Effects of strength training on running economy in highly trained runners: a systematic review with meta-analysis of controlled trials", "J Strength Cond Res")
LAUERSEN_2014 = ref("Lauersen JB, Bertelsen DM, Andersen LB", 2014, "The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials", "Br J Sports Med")
PETERSEN_2011 = ref("Petersen J, Thorborg K, Nielsen MB, Budtz-Jørgensen E, Hölmich P", 2011, "Preventive effect of eccentric training on acute hamstring injuries in men's soccer: a cluster-randomized controlled trial", "Am J Sports Med")
RIO_2015 = ref("Rio E, Kidgell D, Purdam C, et al.", 2015, "Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy", "Br J Sports Med")
GRGIC_2022 = ref("Grgic J, Schoenfeld BJ, Orazem J, Sabol F", 2022, "Effects of resistance training performed to repetition failure or non-failure on muscular strength and hypertrophy: a systematic review and meta-analysis", "J Sport Health Sci")
HELMS_2016 = ref("Helms ER, Cronin J, Storey A, Zourdos MC", 2016, "Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training", "Strength Cond J")
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
       preuve=P("faible", "Peu d'effet démontré de la récupération active sur la performance du lendemain par rapport au repos ; utile surtout pour bouger sans charge.", SEILER_2010), **V)

seance("velo-endurance-courte", famille="endurance", nom="Endurance fondamentale courte",
       objectif="Volume aérobie, capillarisation, mitochondries, économie", resume="45 à 90 min régulières sous le premier seuil.",
       zone="Z2", rpe="2-3", niveau="tous", deroule=[ECH(10, 50, 65), E(50, 56, 75, cad="85-95"), CALME(5)],
       variantes=["45 min", "60 min", "90 min"], phases=["toutes"], parSemaine="2-4", recuperation="< 24 h",
       conseils=["Test de la parole : tu dois pouvoir parler en phrases.", "Dérive de FC < 5 % = endurance solide."],
       preuve=P("prouvé", "La grande majorité du volume des athlètes d'endurance se fait sous le premier seuil (≈ 80 % des séances) ; c'est la base sur laquelle l'intensité agit.", SEILER_2010, STOGGL_2014, ROSENBLAT_2019), **V)

seance("velo-endurance-longue", famille="endurance", nom="Sortie longue",
       objectif="Endurance de fond, utilisation des graisses, résistance à la fatigue", resume="2 à 4 h en Z2, sur terrain varié ou home trainer.",
       zone="Z2", rpe="2-3", niveau="intermédiaire", deroule=[ECH(15, 50, 65), E(150, 56, 75), CALME(10)],
       variantes=["1 h 45", "2 h 30", "3 h", "4 h et plus (objectif cyclosportive)"], phases=["base", "construction", "spécifique"],
       parSemaine="1", recuperation="24-48 h",
       conseils=["Glucides : 30-60 g/h au-delà de 1 h 15, 60-90 g/h au-delà de 2 h 30.", "Bois selon la soif, davantage en intérieur."],
       preuve=P("prouvé", "Le volume en basse intensité est associé au niveau de performance chez les athlètes d'endurance ; la durée d'effort conditionne la « durabilité ».", SEILER_2010, MAUNDER_2021), **V)

seance("velo-endurance-sprints", famille="endurance", nom="Endurance + sprints",
       objectif="Garder la puissance neuromusculaire pendant les blocs d'endurance", resume="Z2 avec 6 à 10 sprints de 8-10 s espacés de 10 min.",
       zone="Z2 + Z7", rpe="3 (sprints 9)", niveau="intermédiaire",
       deroule=[ECH(15, 50, 65), X(8, E(10, 56, 75), MAX(10, cad="> 100", note="assis puis debout")), E(15, 56, 75), CALME(10)],
       variantes=["6 sprints", "8 sprints", "10 sprints, dont 2 départs arrêtés"], phases=["base", "construction"], parSemaine="1",
       recuperation="24 h", conseils=["Sprint à fond, puis 2 min très facile avant de reprendre la Z2.", SANS_ERG],
       preuve=PRATIQUE("Choix d'entraîneur : courts sprints répartis dans une sortie facile, faible coût de fatigue. Pas d'étude dédiée trouvée.", ALLEN_COGGAN), **V)

seance("velo-durabilite-effort-final", famille="durabilite", nom="Sortie longue + effort final",
       objectif="Durabilité : rester fort quand on est déjà fatigué", resume="2 h 30 à 4 h en Z2, puis 2 × 10-15 min au seuil ou en sweet spot dans la dernière heure.",
       zone="Z2 puis Z3-Z4", rpe="3 puis 7", niveau="confirmé",
       deroule=[ECH(15, 50, 65), E(135, 56, 75), X(2, E(12, 88, 95), R(5, 55, 65)), CALME(10)],
       variantes=["1 × 15 min en fin de sortie", "2 × 12 min", "3 × 10 min", "20 min en continu à 90 %"],
       phases=["construction", "spécifique"], parSemaine="1 tous les 7-14 jours", recuperation="48 h",
       conseils=["Mange régulièrement avant l'effort final (60-90 g/h) : on entraîne la tenue, pas la panne.", SANS_ERG],
       preuve=P("plausible", "La baisse de puissance après plusieurs heures (durabilité) distingue les meilleurs cyclistes ; l'entraîner par des efforts en fin de sortie est logique mais peu testé directement.", MAUNDER_2021, SPRAGG_2023), **V)

seance("velo-tempo-2x20", famille="tempo", nom="Tempo 2 × 20 min",
       objectif="Endurance aérobie haute, préparation au sweet spot", resume="2 blocs de 20 min en Z3 basse, récupération 5 min.",
       zone="Z3", rpe="5", niveau="tous", deroule=[ECH(15), X(2, E(20, 76, 85, cad="85-95"), R(5)), CALME(10)],
       variantes=["2 × 15", "2 × 20", "3 × 20", "60 min continu"], phases=["base", "construction"], parSemaine="1",
       recuperation="24-36 h", conseils=["Respiration appuyée mais régulière, phrases courtes possibles."],
       preuve=PRATIQUE("Zone dite « grise » : efficace pour accumuler du travail aérobie, mais pas meilleure que le modèle polarisé dans les comparaisons.", ROSENBLAT_2019, ALLEN_COGGAN), **V)

seance("velo-sweet-spot-3x15", famille="tempo", nom="Sweet spot 3 × 15 min",
       objectif="Beaucoup de travail proche du seuil pour une fatigue modérée", resume="3 × 15 min à 88-94 % de la CP, récupération 5 min.",
       zone="Z3-Z4", rpe="6", niveau="intermédiaire", deroule=[ECH(15), X(3, E(15, 88, 94, cad="85-95"), R(5)), CALME(10)],
       variantes=["3 × 10", "3 × 12", "3 × 15", "2 × 20", "3 × 20"], phases=["base", "construction"], parSemaine="1-2",
       recuperation="36 h", conseils=[SANS_ERG],
       preuve=PRATIQUE("Concept d'entraîneur (rapport efficacité / fatigue) ; pas d'essai contrôlé qui le compare directement au seuil ou au polarisé.", ALLEN_COGGAN), **V)

seance("velo-sweet-spot-long", famille="tempo", nom="Sweet spot long 2 × 30 min",
       objectif="Endurance au seuil, préparation aux longues ascensions", resume="2 × 30 min à 88-92 %, récupération 10 min.",
       zone="Z3-Z4", rpe="6-7", niveau="confirmé", deroule=[ECH(15), X(2, E(30, 88, 92), R(10)), CALME(10)],
       variantes=["2 × 25", "2 × 30", "1 × 45", "1 × 60"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Glucides pendant l'effort si la séance dépasse 75 min."],
       preuve=PRATIQUE("Pratique d'entraîneur pour les épreuves longues et les cols.", ALLEN_COGGAN), **V)

seance("velo-seuil-2x20", famille="seuil", nom="Seuil 2 × 20 min",
       objectif="Puissance au seuil (CP, FTP)", resume="Le classique : 2 × 20 min à 95-100 % de la CP, récupération 5-10 min.",
       zone="Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15), X(2, E(20, 95, 100, cad="85-95"), R(8)), CALME(10)],
       variantes=["2 × 12", "2 × 15", "2 × 20", "3 × 15", "3 × 20"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["La FC doit se stabiliser après 5-6 min ; si elle monte sans arrêt, tu es au-dessus de ta CP.", SANS_ERG],
       preuve=PRATIQUE("Séance de référence des entraîneurs pour la puissance au seuil ; l'intensité juste sous la CP permet un long temps de travail.", ALLEN_COGGAN), **V)

seance("velo-seuil-4x10", famille="seuil", nom="Seuil 4 × 10 min",
       objectif="Puissance au seuil, version fractionnée", resume="4 × 10 min à 95-102 %, récupération 3-4 min.",
       zone="Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15), X(4, E(10, 95, 102), R(4)), CALME(10)],
       variantes=["3 × 10", "4 × 10", "3 × 12", "4 × 12"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=[SANS_ERG],
       preuve=PRATIQUE("Variante fractionnée du 2 × 20, plus tenable en début de phase.", ALLEN_COGGAN), **V)

seance("velo-seuil-4x8-seiler", famille="seuil", nom="4 × 8 min (Seiler)",
       objectif="VO2max et seuil : le meilleur compromis intensité-durée de l'étude", resume="4 × 8 min à l'effort maximal tenable (≈ 100-105 % de la CP, ~90 % FC max), récupération 2 min.",
       zone="Z4-Z5", rpe="8", niveau="intermédiaire", deroule=[ECH(15), X(4, E(8, 100, 105), R(2, 45, 55)), CALME(10)],
       variantes=["3 × 8", "4 × 8", "5 × 8"], phases=["construction", "spécifique"], parSemaine="1-2",
       recuperation="48 h", conseils=["Rythme réparti : la dernière répétition doit être la plus forte.", SANS_ERG],
       preuve=P("prouvé", "Chez des amateurs entraînés (7 semaines), 4 × 8 min a donné de plus grands progrès que 4 × 16 min et 4 × 4 min à l'effort maximal tenable.", SEILER_2013), **V)

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

seance("velo-vo2-30-15-ronnestad", famille="vo2max", nom="30/15 (Rønnestad)",
       objectif="VO2max et puissance au seuil", resume="3 séries de 13 × (30 s dur / 15 s facile), récupération 3 min entre les séries.",
       zone="Z5", rpe="8-9", niveau="intermédiaire",
       deroule=[ECH(15), X(3, X(13, E(0, 115, 125, cad="90-100", sec=30), R(0, 50, 50, sec=15)), R(3, 45, 55)), CALME(10)],
       variantes=["2 × 10", "3 × 10", "3 × 11", "3 × 13 (protocole de l'étude)"], phases=["construction", "spécifique"],
       parSemaine="1-2", recuperation="48 h", conseils=["Dans l'étude : effort maximal tenable sur toute la série, pas un sprint.", SANS_ERG + " Sur les 30 s, reste sur le même braquet et monte la cadence."],
       preuve=P("prouvé", "Chez des cyclistes entraînés puis élites, les 30/15 ont donné plus de progrès (VO2max, puissance aérobie maximale, puissance au seuil) que 4 × 5 min à effort égal.", RONNESTAD_2015, RONNESTAD_2020), **V)

seance("velo-vo2-4x5", famille="vo2max", nom="VO2 longs 4 × 5 min",
       objectif="Temps passé près de la VO2max", resume="4 à 5 × 5 min à 106-115 % de la CP, récupération 2 min 30 à 4 min.",
       zone="Z5", rpe="8-9", niveau="intermédiaire", deroule=[ECH(15), X(4, E(5, 106, 115), R(3, 45, 55)), CALME(10)],
       variantes=["4 × 4", "4 × 5", "5 × 5", "6 × 5"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Vise ≥ 90 % de ta FC max pendant au moins 2-3 min de chaque répétition.", SANS_ERG],
       preuve=P("prouvé", "Les intervalles longs proches de la VO2max augmentent la VO2max ; ils ont servi de comparaison aux 30/15 dans les études de Rønnestad.", BUCHHEIT_2013, RONNESTAD_2015), **V)

seance("velo-vo2-4x4-helgerud", famille="vo2max", nom="4 × 4 min (Helgerud)",
       objectif="VO2max", resume="4 × 4 min à 90-95 % de la FC max, récupération active 3 min.",
       zone="Z5", rpe="8-9", niveau="tous", deroule=[ECH(10), X(4, E(4, 108, 118, note="cible réelle : 90-95 % de la FC max"), R(3, 50, 60)), CALME(5)],
       variantes=["3 × 4", "4 × 4", "5 × 4"], phases=["base", "construction"], parSemaine="1-2", recuperation="48 h",
       conseils=["Guidée par la FC dans l'étude : la FC met 1-2 min à monter, le début peut être un peu plus fort."],
       preuve=P("prouvé", "4 × 4 min à 90-95 % FC max a augmenté la VO2max plus que l'entraînement modéré (étude en course à pied, sujets modérément entraînés).", HELGERUD_2007), **V)

seance("velo-vo2-30-30", famille="vo2max", nom="30/30",
       objectif="VO2max avec moins de charge que les intervalles longs", resume="2 à 3 séries de 10-12 × (30 s à 120-130 % / 30 s facile).",
       zone="Z5", rpe="8", niveau="tous", deroule=[ECH(15), X(2, X(12, E(0, 120, 130, sec=30), R(0, 50, 50, sec=30)), R(5)), CALME(10)],
       variantes=["2 × 8", "2 × 10", "2 × 12", "3 × 12"], phases=["base", "construction"], parSemaine="1",
       recuperation="36-48 h", conseils=[SANS_ERG],
       preuve=P("plausible", "Les intervalles courts maintiennent longtemps la VO2 élevée (travaux de Billat en course) ; transposés au vélo par les entraîneurs.", BILLAT_2001, BUCHHEIT_2013), **V)

seance("velo-vo2-40-20", famille="vo2max", nom="40/20",
       objectif="VO2max, version plus dense que le 30/30", resume="3 séries de 8 × (40 s à 115-120 % / 20 s facile), récupération 4 min.",
       zone="Z5", rpe="9", niveau="confirmé", deroule=[ECH(15), X(3, X(8, E(0, 115, 120, sec=40), R(0, 50, 50, sec=20)), R(4)), CALME(10)],
       variantes=["2 × 8", "3 × 8", "3 × 10"], phases=["spécifique"], parSemaine="1", recuperation="48 h", conseils=[SANS_ERG],
       preuve=P("plausible", "Récupérations courtes = VO2 qui reste haute ; pratique d'entraîneur appuyée sur la logique des intervalles courts.", BUCHHEIT_2013), **V)

seance("velo-vo2-depart-rapide", famille="vo2max", nom="Intervalles à départ rapide",
       objectif="Atteindre plus vite et plus longtemps la VO2max", resume="5 × 5 min : 1 min 30 à 120 % puis 3 min 30 à ~105 %, récupération 2 min 30.",
       zone="Z5", rpe="9", niveau="confirmé", deroule=[ECH(15), X(5, E(1.5, 118, 125), E(3.5, 102, 108), R(2.5, 45, 55)), CALME(10)],
       variantes=["3 répétitions", "4 répétitions", "5 répétitions"], phases=["spécifique"], parSemaine="1", recuperation="48 h",
       conseils=["Le départ fort fait monter la VO2 tout de suite ; la suite la maintient sans exploser.", SANS_ERG],
       preuve=P("plausible", "En aigu, faire varier la puissance (départ rapide) augmente le temps passé près de la VO2max à travail égal ; effet à long terme encore peu étudié.", BOSSI_2020), **V)

seance("velo-anaerobie-1min", famille="anaerobie", nom="Capacité anaérobie 1 min",
       objectif="Capacité anaérobie, tolérance à l'acidité", resume="6 à 8 × 1 min à 130-150 % de la CP, récupération 3-4 min.",
       zone="Z6", rpe="9", niveau="confirmé", deroule=[ECH(20), X(7, E(1, 130, 150), R(3.5)), CALME(10)],
       variantes=["5 × 1 min", "6 × 1 min", "8 × 1 min"], phases=["spécifique"], parSemaine="0-1", recuperation="48-72 h",
       conseils=["Seulement si ta discipline le demande (critériums, cyclo-cross, relances)."],
       preuve=PRATIQUE("Pratique d'entraîneur pour la capacité anaérobie.", ALLEN_COGGAN), **V)

seance("velo-sit-30s", famille="anaerobie", nom="Sprints de 30 s (type Wingate)",
       objectif="Adaptations aérobies et anaérobies en très peu de temps", resume="4 à 6 × 30 s à fond, récupération 4 min très facile.",
       zone="Z7", rpe="10", niveau="confirmé", deroule=[ECH(15), X(5, MAX(30), R(4, 40, 50)), CALME(10)],
       variantes=["4 sprints", "5 sprints", "6 sprints"], phases=["construction", "spécifique"], parSemaine="0-2", recuperation="48-72 h",
       conseils=["Très éprouvant : jamais deux jours de suite, jamais un jour de feu orange."],
       preuve=P("prouvé", "Chez des sujets actifs, 2 semaines de 4-6 × 30 s à fond ont donné des adaptations musculaires et des progrès comparables à l'endurance classique, pour bien moins de temps.", GIBALA_2006), **V)

seance("velo-tabata", famille="anaerobie", nom="Tabata 20/10",
       objectif="VO2max et capacité anaérobie", resume="7 à 8 × (20 s à ~170 % de la VO2max / 10 s de repos) : à l'épuisement.",
       zone="Z7", rpe="10", niveau="confirmé", deroule=[ECH(15), X(8, E(0, 150, 170, sec=20), R(0, 0, 0, sec=10)), CALME(10)],
       variantes=["6 répétitions", "7 répétitions", "8 répétitions"], phases=["spécifique"], parSemaine="0-1", recuperation="72 h",
       conseils=["Protocole de laboratoire très dur ; la plupart des « tabata » des applis sont bien moins intenses."],
       preuve=P("prouvé", "6 semaines de ce protocole ont augmenté à la fois la VO2max et la capacité anaérobie (sujets actifs).", TABATA_1996), **V)

seance("velo-sprints-courts", famille="sprint", nom="Sprints courts",
       objectif="Puissance maximale, recrutement neuromusculaire", resume="8 à 10 × 8-10 s à fond, récupération complète 3-5 min.",
       zone="Z7", rpe="9", niveau="tous", deroule=[ECH(20), X(8, MAX(10, cad="> 100"), R(4, 45, 55)), CALME(10)],
       variantes=["6 sprints", "8 sprints", "10 sprints"], phases=["toutes"], parSemaine="1", recuperation="24-48 h",
       conseils=["Qualité avant quantité : arrête dès que la puissance baisse nettement.", SANS_ERG],
       preuve=P("plausible", "Chez des cyclistes entraînés, 4 semaines de sprints ajoutées à l'endurance ont amélioré la puissance de sprint.", CREER_2004), **V)

seance("velo-departs-arretes", famille="sprint", nom="Départs arrêtés en gros braquet",
       objectif="Force explosive sur le vélo", resume="6 × 10-15 s en partant presque à l'arrêt (50 tr/min), récupération 4 min.",
       zone="Z7", rpe="9", niveau="intermédiaire", deroule=[ECH(20), X(6, MAX(12, cad="démarrage à 50"), R(4)), CALME(10)],
       variantes=["4 départs", "6 départs", "8 départs"], phases=["base", "construction"], parSemaine="0-1", recuperation="48 h",
       conseils=["En côte légère dehors ; sur home trainer, mets le braquet le plus dur avant de démarrer."],
       preuve=P("plausible", "Les efforts explosifs à haute résistance, ajoutés à l'endurance, ont amélioré la performance de cyclistes de compétition.", PATON_2005), **V)

seance("velo-velocite", famille="sprint", nom="Vélocité (spin-ups)",
       objectif="Technique de pédalage, souplesse à haute cadence", resume="8 × 30 s en montant progressivement à 110-130 tr/min, faible puissance.",
       zone="Z2", rpe="3-4", niveau="tous", deroule=[ECH(10), X(8, E(0.5, 60, 75, cad="110-130"), R(1.5, 50, 65)), CALME(10)],
       variantes=["6 × 30 s", "8 × 30 s", "5 × 1 min à 110"], phases=["base"], parSemaine="0-1", recuperation="aucune",
       conseils=["Le bassin ne doit pas rebondir sur la selle."],
       preuve=PRATIQUE("Exercice technique d'entraîneur ; effet sur la performance non démontré.", FRIEL), **V)

seance("velo-force-basse-cadence", famille="force", nom="Basse cadence (force sur le vélo)",
       objectif="Force-endurance, recrutement des fibres", resume="4 à 5 × 6-8 min à 85-95 % de la CP à 50-60 tr/min, récupération 4 min.",
       zone="Z3-Z4", rpe="6-7", niveau="intermédiaire", deroule=[ECH(15), X(4, E(7, 85, 95, cad="50-60"), R(4, 50, 60, note="cadence libre")), CALME(10)],
       variantes=["3 × 6", "4 × 7", "5 × 8"], phases=["base", "construction"], parSemaine="0-1", recuperation="36-48 h",
       conseils=["Arrête si tes genoux tirent : la basse cadence charge l'articulation."],
       preuve=P("mitigé", "Une étude trouve un avantage à la basse cadence, une autre aucun chez des cyclistes très entraînés : ne remplace pas la musculation lourde.", PATON_2009, KRISTOFFERSEN_2014), **V)

# ——— Tests vélo ———
seance("velo-test-cp-3-7-12", famille="test", nom="Test CP 3/7/12 min",
       objectif="Mesurer ta CP (puissance critique) et ta réserve W′", resume="3 efforts à fond de 12, 7 et 3 min (dans l'ordre que tu préfères), 30 min de récupération facile entre chaque.",
       zone="test", rpe="10", niveau="intermédiaire",
       deroule=[ECH(20, 50, 75, note="avec 2 × 1 min à 110 %"), MAX(720, note="12 min à fond, réparti"), R(30, 45, 55), MAX(420, note="7 min à fond"), R(30, 45, 55), MAX(180, note="3 min à fond"), CALME(10)],
       variantes=["Version courte 3 + 12 min (voir test CP 2 points)"], phases=["début et fin de phase"], parSemaine="toutes les 6-8 semaines",
       recuperation="48 h", conseils=["Frais (feu vert), même heure, même vélo, mêmes conditions.", "Sans ERG, c'est ce qu'il faut : effort libre."],
       preuve=P("prouvé", "Tests de terrain valides et fiables pour la CP quand les efforts sont maximaux ; 30 min de récupération entre les efforts conviennent.", KARSTEN_2015), **V)

seance("velo-test-cp-2-points", famille="test", nom="Test CP 2 points (3 + 12 min)",
       objectif="CP et W′ en moins de temps", resume="3 min puis 12 min à fond, 30 min de récupération entre les deux.",
       zone="test", rpe="10", niveau="intermédiaire", deroule=[ECH(20), MAX(180), R(30, 45, 55), MAX(720), CALME(10)],
       variantes=[], phases=["début et fin de phase"], parSemaine="toutes les 6-8 semaines", recuperation="48 h",
       conseils=["Un peu moins précis que 3 efforts, mais suffisant pour recaler les zones."],
       preuve=P("plausible", "Deux efforts maximaux donnent une CP proche de celle obtenue avec trois.", SIMPSON_2017), **V)

seance("velo-test-ftp-20", famille="test", nom="Test FTP 20 min",
       objectif="Estimer le seuil (FTP ≈ 95 % de la puissance sur 20 min)", resume="5 min à fond, 10 min facile, puis 20 min à fond.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20), MAX(300, note="5 min à fond pour vider la réserve anaérobie"), R(10), MAX(1200), CALME(10)],
       variantes=["Sans les 5 min préalables : retirer plutôt 7-8 %"], phases=["début de phase"], parSemaine="toutes les 6-8 semaines",
       recuperation="48 h", conseils=["Le coefficient 0,95 est une moyenne : il varie d'un cycliste à l'autre."],
       preuve=PRATIQUE("Test de terrain très répandu ; le coefficient de 95 % n'est pas valable pour tout le monde.", ALLEN_COGGAN, BORSZCZ_2018), **V)

seance("velo-test-rampe", famille="test", nom="Test rampe (PMA)",
       objectif="Puissance maximale aérobie (PMA) et estimation du seuil", resume="Paliers de 1 min augmentant de 20-25 W jusqu'à l'épuisement.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(10), MAX(720, note="+20 à 25 W chaque minute jusqu'à l'arrêt"), CALME(10)],
       variantes=[], phases=["début de phase"], parSemaine="toutes les 6-8 semaines", recuperation="24-48 h",
       conseils=["Seuil estimé ≈ 75 % de la meilleure minute : estimation grossière.", "Sans ERG : monte d'une dent toutes les minutes en gardant la cadence."],
       preuve=PRATIQUE("Test de laboratoire adapté au home trainer ; l'estimation du seuil à partir de la PMA reste approximative.", ALLEN_COGGAN), **V)

seance("velo-test-sprint", famille="test", nom="Test de sprint",
       objectif="Puissance maximale (1-10 s)", resume="3 sprints de 10 s à fond, récupération complète 5 min.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20), X(3, MAX(10), R(5, 45, 55)), CALME(10)],
       variantes=["Départ lancé", "Départ arrêté"], phases=["toutes"], parSemaine="toutes les 6-8 semaines", recuperation="24 h",
       conseils=["Note le meilleur des 3."], preuve=PRATIQUE("Mesure simple de la puissance maximale.", ALLEN_COGGAN), **V)

seance("velo-test-derive", famille="test", nom="Test de dérive cardiaque",
       objectif="Solidité de l'endurance (découplage puissance / FC)", resume="60 à 90 min à puissance constante en Z2, au frais, bien hydraté.",
       zone="Z2", rpe="3", niveau="tous", deroule=[ECH(10, 50, 65), E(70, 65, 70), CALME(5)],
       variantes=["60 min", "90 min"], phases=["base"], parSemaine="toutes les 4-6 semaines", recuperation="< 24 h",
       conseils=["On ignore les 10 premières minutes. Dérive < 5 % : endurance solide ; > 10 % : trop dur ou fatigue."],
       preuve=PRATIQUE("Indicateur d'entraîneur de la durabilité aérobie ; à lire en tendance.", FRIEL, MAUNDER_2021), **V)

# ════════════════════════ COURSE À PIED (intensité en % de la VMA) ════════════════════════
C = dict(sport="course", unite="%VMA")

seance("course-footing", famille="endurance", nom="Footing en endurance fondamentale",
       objectif="Volume aérobie, économie de course", resume="30 à 60 min à allure de conversation.",
       zone="Z2", rpe="2-3", niveau="tous", deroule=[E(45, 60, 72)],
       variantes=["30 min", "45 min", "60 min"], phases=["toutes"], parSemaine="2-4", recuperation="< 24 h",
       conseils=["Test de la parole. Mieux vaut trop lent que trop vite."],
       preuve=P("prouvé", "Base du volume des coureurs d'endurance (≈ 80 % du temps sous le premier seuil).", SEILER_2010, STOGGL_2014), **C)

seance("course-sortie-longue", famille="endurance", nom="Sortie longue",
       objectif="Endurance de fond", resume="60 à 100 min en endurance fondamentale.",
       zone="Z2", rpe="3", niveau="intermédiaire", deroule=[E(75, 62, 72)],
       variantes=["60 min", "75 min", "90 min", "dernières 10 min à allure semi-marathon"], phases=["base", "construction"],
       parSemaine="1", recuperation="24-48 h", conseils=["Ne dépasse pas ~25-30 % de ton volume hebdomadaire."],
       preuve=P("prouvé", "Volume en basse intensité associé à la performance en endurance.", SEILER_2010), **C)

seance("course-lignes-droites", famille="sprint", nom="Lignes droites (accélérations)",
       objectif="Foulée, économie, vitesse sans fatigue", resume="Après un footing : 6 à 10 × 15-20 s en accélération progressive jusqu'à ~90 % de ta vitesse max, retour en marchant.",
       zone="Z2 + vitesse", rpe="4", niveau="tous", deroule=[E(30, 60, 72), X(8, E(0, 120, 140, sec=20, note="relâché, pas un sprint"), R(0, 0, 40, sec=60))],
       variantes=["6 lignes droites", "8", "10"], phases=["toutes"], parSemaine="1-2", recuperation="aucune",
       conseils=["Relâché, sur terrain plat et souple."], preuve=PRATIQUE("Pratique d'entraîneur pour la foulée et l'économie de course.", DANIELS), **C)

seance("course-tempo-continu", famille="tempo", nom="Tempo continu",
       objectif="Seuil lactique, endurance à allure soutenue", resume="20 à 30 min à allure « confortablement difficile » (80-88 % VMA).",
       zone="Z3", rpe="6", niveau="intermédiaire", deroule=[ECH(15, 60, 72), E(25, 80, 88), CALME(10, 60, 70)],
       variantes=["15 min", "20 min", "25 min", "30 min"], phases=["construction"], parSemaine="1", recuperation="48 h",
       conseils=["Tu peux dire quelques mots, pas des phrases."], preuve=PRATIQUE("Allure « T » de Daniels, largement utilisée.", DANIELS), **C)

seance("course-seuil-fractionne", famille="seuil", nom="Seuil fractionné (cruise intervals)",
       objectif="Seuil, avec plus de volume au seuil qu'en continu", resume="4 à 6 × 5 min (ou 1 km) à 85-90 % VMA, récupération 1 min.",
       zone="Z3-Z4", rpe="7", niveau="intermédiaire", deroule=[ECH(15, 60, 72), X(5, E(5, 85, 90), R(1, 50, 60)), CALME(10, 60, 70)],
       variantes=["3 × 5 min", "4 × 5", "5 × 5", "6 × 5", "3 × 2 km"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48 h", conseils=["Récupération courte volontaire : on reste au seuil."],
       preuve=PRATIQUE("Séance de Daniels ; base du « double seuil » norvégien.", DANIELS, CASADO_2023), **C)

seance("course-double-seuil", famille="seuil", nom="Double seuil (modèle norvégien)",
       objectif="Beaucoup de volume au seuil, contrôlé", resume="Matin : 5 × 6 min au seuil ; soir : 10 × 1 000 m au seuil. Récupérations 1 min.",
       zone="Z3-Z4", rpe="6-7", niveau="confirmé", deroule=[ECH(15, 60, 72), X(5, E(6, 83, 88), R(1, 50, 60)), CALME(10, 60, 70)],
       variantes=["Une seule séance de seuil", "Deux séances le même jour"], phases=["construction"], parSemaine="1-2 jours",
       recuperation="48 h", conseils=["Réservé à un gros volume d'entraînement ; intensité contrôlée (lactate ~2-4 mmol/L)."],
       preuve=P("plausible", "Méthode d'athlètes de haut niveau, cohérente avec la science du seuil, mais peu d'essais contrôlés.", CASADO_2023), **C)

seance("course-vma-30-30", famille="vo2max", nom="VMA courte 30/30",
       objectif="VO2max, vitesse maximale aérobie", resume="2 séries de 8 à 12 × (30 s à 100-105 % VMA / 30 s trot), récupération 3-5 min.",
       zone="Z5", rpe="8", niveau="tous", deroule=[ECH(20, 60, 72), X(2, X(10, E(0, 100, 105, sec=30), R(0, 45, 55, sec=30)), R(4, 45, 55)), CALME(10, 60, 70)],
       variantes=["2 × 8", "2 × 10", "2 × 12", "3 × 10"], phases=["base", "construction"], parSemaine="1", recuperation="48 h",
       conseils=["La récupération est trottinée, pas marchée."],
       preuve=P("prouvé", "Le 30/30 à la VMA permet de rester longtemps près de la VO2max (Billat) ; séance de référence en France.", BILLAT_2001, BUCHHEIT_2013), **C)

seance("course-vma-longue", famille="vo2max", nom="VMA longue",
       objectif="VO2max, endurance à haute vitesse", resume="5 à 6 × 1 000 m (ou 3 min) à 95-100 % VMA, récupération 2-3 min.",
       zone="Z5", rpe="8-9", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(5, E(3.5, 95, 100), R(2.5, 45, 55)), CALME(10, 60, 70)],
       variantes=["4 × 1 000", "5 × 1 000", "6 × 1 000", "4 × 1 200"], phases=["construction", "spécifique"], parSemaine="1",
       recuperation="48-72 h", conseils=[], preuve=P("prouvé", "Les intervalles de 2-5 min proches de la VMA augmentent la VO2max.", BILLAT_2001, BUCHHEIT_2013), **C)

seance("course-4x4-helgerud", famille="vo2max", nom="4 × 4 min (Helgerud)",
       objectif="VO2max", resume="4 × 4 min à 90-95 % de la FC max, récupération 3 min en trottinant.",
       zone="Z5", rpe="8-9", niveau="tous", deroule=[ECH(10, 60, 70), X(4, E(4, 92, 98, note="cible réelle : 90-95 % de la FC max"), R(3, 50, 60)), CALME(5, 60, 70)],
       variantes=["3 × 4", "4 × 4"], phases=["base", "construction"], parSemaine="1-2", recuperation="48 h", conseils=[],
       preuve=P("prouvé", "A augmenté la VO2max plus que l'entraînement modéré, à travail égal.", HELGERUD_2007), **C)

seance("course-allure-5km", famille="specifique", nom="Allure 5 km",
       objectif="Spécifique 5 km : tenir l'allure de course", resume="5 × 1 000 m ou 3 × 1 600 m à allure 5 km (~95 % VMA), récupération 2-3 min.",
       zone="Z5", rpe="8", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(5, E(3.7, 93, 96), R(2.5, 45, 55)), CALME(10, 60, 70)],
       variantes=["4 × 1 000", "5 × 1 000", "3 × 1 600", "2 × 2 000"], phases=["spécifique"], parSemaine="1", recuperation="48-72 h",
       conseils=["Allure régulière, la dernière doit être la plus rapide."], preuve=PRATIQUE("Allure « I » de Daniels, spécifique au 5 km.", DANIELS), **C)

seance("course-cotes-courtes", famille="sprint", nom="Côtes courtes (sprints en côte)",
       objectif="Force, puissance, foulée", resume="8 à 10 × 10 s de sprint en côte raide, retour en marchant (2 min).",
       zone="vitesse", rpe="8", niveau="tous", deroule=[E(20, 60, 72), X(8, MAX(10, note="côte de 6-10 %"), R(2, 0, 40, note="marche"))],
       variantes=["6 côtes", "8", "10"], phases=["base", "construction"], parSemaine="1", recuperation="24-48 h", conseils=["Peu de risque de blessure : la pente limite la vitesse."],
       preuve=PRATIQUE("Pratique d'entraîneur (force spécifique, faible impact).", DANIELS), **C)

seance("course-cotes-longues", famille="vo2max", nom="Côtes longues",
       objectif="VO2max, force-endurance, économie", resume="6 à 8 × 1 min 30-2 min en côte à l'effort 5 km, retour en trottinant.",
       zone="Z5", rpe="8", niveau="intermédiaire", deroule=[ECH(20, 60, 72), X(6, E(2, 90, 100, note="effort, pas allure"), R(2.5, 45, 55, note="descente en trottinant")), CALME(10, 60, 70)],
       variantes=["5 côtes", "6", "8"], phases=["base", "construction"], parSemaine="1", recuperation="48 h", conseils=[],
       preuve=P("plausible", "Différents formats de côtes ont amélioré l'économie et la performance de coureurs entraînés ; les côtes à intensité proche de la VO2max semblaient les plus efficaces.", BARNES_2013), **C)

seance("course-fartlek", famille="vo2max", nom="Fartlek",
       objectif="Variété, VO2max sans pression du chrono", resume="30-45 min avec des accélérations libres (1 à 3 min) quand tu en as envie.",
       zone="Z2-Z5", rpe="6", niveau="tous", deroule=[ECH(10, 60, 72), X(8, E(1.5, 90, 100), R(2, 60, 70)), CALME(5, 60, 70)],
       variantes=["Libre", "Pyramide 1-2-3-2-1 min"], phases=["base"], parSemaine="0-1", recuperation="24-48 h", conseils=["Au ressenti, sans montre."],
       preuve=PRATIQUE("Méthode suédoise historique ; pratique d'entraîneur.", DANIELS), **C)

seance("course-test-vma-5min", famille="test", nom="Test VMA 5 min",
       objectif="Estimer ta VMA", resume="Après échauffement, cours la plus grande distance possible en 5 min (VMA ≈ distance / 5 min).",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(20, 60, 72), MAX(300, note="allure régulière, la plus haute possible"), CALME(10, 60, 70)],
       variantes=["Demi-Cooper (6 min) : VMA (km/h) = distance (m) / 100"], phases=["début de phase"], parSemaine="toutes les 6-8 semaines",
       recuperation="48 h", conseils=["Sur piste ou terrain plat mesuré."],
       preuve=P("prouvé", "Un test de 5 min sur piste estime correctement la vitesse maximale aérobie.", BERTHON_1997), **C)

seance("course-test-vameval", famille="test", nom="Test VAMEVAL / Léger-Boucher",
       objectif="VMA par paliers", resume="Vitesse qui augmente de 0,5 à 1 km/h par palier, rythmée par des bips, jusqu'à l'arrêt.",
       zone="test", rpe="10", niveau="tous", deroule=[ECH(15, 60, 72), MAX(900, note="paliers jusqu'à l'épuisement"), CALME(10, 60, 70)],
       variantes=[], phases=["début de phase"], parSemaine="toutes les 6-8 semaines", recuperation="48 h", conseils=["Besoin d'une piste balisée et de la bande-son."],
       preuve=P("prouvé", "Test de terrain par paliers validé pour estimer la VO2max et la VMA.", LEGER_1980), **C)

# ════════════════════════ RENFORCEMENT ════════════════════════
F = dict(sport="force", unite="%1RM")

seance("force-lourde-jambes-cycliste", famille="force-lourde", nom="Force lourde des jambes (cycliste)",
       objectif="Économie et puissance à vélo, tenue en fin d'effort", resume="Demi-squat, presse inclinée, step-up et mollets : 3 séries de 4 à 10 reps lourdes, 2 fois par semaine pendant 10-12 semaines, puis 1 fois pour entretenir.",
       zone="force", rpe="7-8", niveau="intermédiaire", dureeMin=45,
       exercices=[
           {"nom": "Demi-squat (barre)", "series": 3, "reps": "10RM → 6RM → 4RM sur 12 semaines", "repos": 180},
           {"nom": "Presse à cuisses une jambe", "series": 3, "reps": "idem", "repos": 120},
           {"nom": "Step-up une jambe avec haltères", "series": 3, "reps": "idem", "repos": 120},
           {"nom": "Mollets debout", "series": 3, "reps": "idem", "repos": 90},
       ],
       variantes=["Hiver : 2 séances/semaine", "Saison : 1 séance/semaine (entretien)"], phases=["base (hiver)", "entretien en saison"],
       parSemaine="2 puis 1", recuperation="48 h (pas la veille d'une séance dure)",
       conseils=["Montée explosive, descente contrôlée.", "Garde 1-2 reps en réserve ; pas d'échec."],
       preuve=P("prouvé", "Ajoutée à l'endurance, la musculation lourde améliore l'économie de pédalage et la performance des cyclistes entraînés, sans prise de masse gênante ; 1 séance/semaine suffit à entretenir les gains en saison.", RONNESTAD_2010, RONNESTAD_MUJIKA_2014), **F)

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
       preuve=P("prouvé", "Chez des coureurs entraînés, la force (lourde ou pliométrique) améliore l'économie de course.", BALSALOBRE_2016, RONNESTAD_MUJIKA_2014), **F)

seance("force-prevention-genoux", famille="prevention", nom="Prévention des blessures (genoux, ischios)",
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
       conseils=["La régularité compte plus que la charge."],
       preuve=P("prouvé", "Le renforcement musculaire réduit d'environ deux tiers les blessures sportives dans les essais contrôlés ; le nordic hamstring réduit les blessures des ischios.", LAUERSEN_2014, PETERSEN_2011), **F)

seance("force-isometrie-tendon-rotulien", famille="prevention", nom="Isométrie pour tendon rotulien douloureux",
       objectif="Calmer une douleur de tendon rotulien", resume="Chaise ou extension de jambe en isométrie : 5 × 45 s à ~70 % de l'effort max, 2 min de repos.",
       zone="force", rpe="6", niveau="tous", dureeMin=15,
       exercices=[{"nom": "Chaise au mur ou extension de jambe isométrique", "series": 5, "reps": "45 s", "repos": 120}],
       variantes=[], phases=["si douleur"], parSemaine="selon besoin", recuperation="aucune",
       conseils=["Si la douleur persiste plus de 2 semaines : kiné."],
       preuve=P("mitigé", "Effet antidouleur immédiat dans une petite étude ; les études suivantes sont moins nettes.", RIO_2015), **F)

seance("force-haut-du-corps-531", famille="force-lourde", nom="Développé couché 5/3/1 (dans l'appli)",
       objectif="Force du haut du corps", resume="Cycle de 4 semaines à partir d'une référence (85-90 % du max), dernière série au maximum en gardant 1 rep en réserve, 5 × 5 en complément.",
       zone="force", rpe="7-9", niveau="intermédiaire", dureeMin=35,
       exercices=[{"nom": "Développé couché", "series": 3, "reps": "5/5/5+, 3/3/3+, 5/3/1+, allègement", "repos": 180},
                  {"nom": "Développé couché (5 × 5 à la 1re charge)", "series": 5, "reps": "5", "repos": 120}],
       variantes=["Voir le module Muscu"], phases=["toutes"], parSemaine="1", recuperation="48 h",
       conseils=["N'aide pas la performance à vélo : c'est un objectif de force à part."],
       preuve=P("plausible", "Aller à l'échec n'est pas nécessaire pour progresser en force ; les répétitions en réserve permettent de doser l'effort. Le 5/3/1 lui-même n'a pas été étudié.", GRGIC_2022, HELMS_2016), **F)

# ════════════════════════ MÉTHODES (organisation, pour plus tard) ════════════════════════
M = dict(sport="methode")

def methode(id, nom, objectif, resume, preuve, conseils=(), phases=()):
    seance(id, famille="organisation", nom=nom, objectif=objectif, resume=resume, zone="—", rpe="—", niveau="—",
           variantes=[], phases=phases, conseils=conseils, preuve=preuve, **M)

methode("methode-polarise", "Répartition polarisée (80/20)", "Répartir l'intensité sur la semaine",
        "≈ 80 % des séances sous le premier seuil, ≈ 20 % au-dessus du second, très peu entre les deux.",
        P("prouvé", "Chez des athlètes entraînés, le polarisé donne des progrès au moins égaux, souvent supérieurs, aux répartitions centrées sur le seuil.", STOGGL_2014, ROSENBLAT_2019, SEILER_2010), phases=["toutes"])
methode("methode-pyramidal", "Répartition pyramidale", "Répartir l'intensité sur la semaine",
        "Beaucoup de Z1-Z2, une part notable de Z3 (tempo, sweet spot), un peu de Z4-Z5.",
        P("plausible", "Répartition fréquente chez les élites, surtout en période de base ; pas de supériorité démontrée face au polarisé.", ROSENBLAT_2019, CASADO_2023), phases=["base"])
methode("methode-bloc-vo2", "Bloc d'intensité concentré", "Choc VO2max sur une semaine",
        "1 semaine avec 5 séances de VO2max, puis 3 semaines à 1 séance par semaine (et le reste en endurance).",
        P("prouvé", "Chez des cyclistes entraînés, ce bloc a donné de meilleurs progrès que la même quantité d'intensité répartie régulièrement.", RONNESTAD_2014B), phases=["construction"],
        conseils=["Seulement avec une bonne récupération (feu vert) et un volume d'endurance déjà solide."])
methode("methode-affutage", "Affûtage avant l'objectif", "Arriver frais et en forme le jour J",
        "Sur 1 à 3 semaines : baisser le volume de 40 à 60 %, garder l'intensité et la fréquence des séances.",
        P("prouvé", "Méta-analyse : une baisse de volume de 41-60 % sur ~2 semaines, en gardant l'intensité, donne le meilleur effet.", BOSQUET_2007), phases=["affûtage"])
methode("methode-semaine-allegee", "Semaine allégée", "Assimiler la charge",
        "1 semaine sur 3 ou 4 avec ~30-40 % de volume en moins, sans supprimer toute l'intensité.",
        PRATIQUE("Principe d'entraîneur (surcompensation) ; durée et ampleur exactes non établies par des essais.", FRIEL), phases=["toutes"])
methode("methode-sleep-low", "« Sleep low » (glucides périodisés)", "Stimuler les adaptations aérobies",
        "Séance intense le soir, dîner pauvre en glucides, puis séance facile à jeun le lendemain matin, 3 fois par semaine.",
        P("plausible", "A amélioré la performance en triathlon (+ ~3 % sur 20 km de vélo) dans un essai de 3 semaines ; à éviter en déficit calorique (risque de RED-S).", MARQUET_2016), phases=["base"],
        conseils=["Pas compatible avec une perte de poids en cours."])

# ——— Contrôle et écriture ———
ids = [s["id"] for s in S]
assert len(ids) == len(set(ids)), "identifiants en double"
data = {
    "version": 1,
    "majLe": "2026-10-28",
    "description": "Catalogue scientifique de séances (vélo, course à pied, renforcement, tests, méthodes). Voir catalogue/README.md.",
    "unites": {"%CP": "pourcentage de la puissance critique (≈ FTP)", "%VMA": "pourcentage de la vitesse maximale aérobie", "%1RM": "pourcentage du maximum sur 1 répétition"},
    "seances": S,
}
json.dump(data, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print(len(S), "séances")
