import { useProfil } from '../../../core/profil'
import { useState, type ReactNode } from 'react'
import { DetailMuscu } from './SectionMuscu'
import { useReglage } from '../../../core/reglages'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { Repliable } from '../../../core/ui/Repliable'
import { ANCIENNETES, DISCIPLINES_PROPOSEES, HEURES_RECENTES, NOMS_DISCIPLINES, dureeDeCourse, facteursVitesse, niveauDuProfil, niveauxCourses, type Discipline, type ReponsesNiveau } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { useLiveQuery } from 'dexie-react-hooks'
import { datesCoursesA, phasesAvecCoursesA } from '../../../metrics/saison'
import { poidsDesTests, recalculerSemainesAVenir, referencesVitesse } from '../plan/programme'
import { CalageVitesse, CoursePrincipale, ListeCourses } from './ListeCourses'
import type { ReglagesProgramme } from '../types'

/**
 * Profil sportif : les réponses qui te décrivent (comme le questionnaire d'une appli de coaching).
 * Toutes les réponses règlent le programme (niveau, heures, genoux, muscu, course) ; seul le matériel est noté pour plus tard.
 */
export interface ProfilSportif extends ReponsesNiveau {
  sports: string[]
  heuresSemaine?: string
  materiel: string[]
  pointsSensibles?: string
  muscu?: string
  /** Repas du jour (besoins du jour, repas du soir, bilan du dimanche) : absent = activé */
  nutrition?: boolean
  /** Nutrition à l'effort (glucides par heure sur les sorties longues et les courses) : absent = activée */
  nutritionEffort?: boolean
}
const DEFAUT: ProfilSportif = { sports: [], materiel: [] }

/** Nutrition à l'effort activée ? (repères de glucides des séances) */
export function useNutritionEffort() {
  const [ps] = useReglage<ProfilSportif>('profil-sportif', DEFAUT)
  return ps.nutritionEffort !== false
}

/** Module repas du jour activé ? (Réglages → Mon profil sportif → Repas du jour) */
export function useNutritionActive() {
  const [ps] = useReglage<ProfilSportif>('profil-sportif', DEFAUT)
  return ps.nutrition !== false
}

// Vélo seul depuis 11/2026 : la course à pied et la natation n'ont plus d'effet sur le programme
const SPORTS = ['Vélo route', 'VTT', 'Musculation']
const HEURES = ['Moins de 4 h', '4 à 6 h', '6 à 8 h', '8 à 10 h', '10 à 12 h', 'Plus de 12 h']
const MATERIEL = ['Home trainer connecté', 'Capteur de puissance', 'Ceinture cardio', 'Montre GPS']
const NOMS_NIVEAUX = { debutant: 'débutant', intermediaire: 'intermédiaire', confirme: 'confirmé', expert: 'expert' }

const heures = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`)
const puce = (actif: boolean) => `rounded-full border px-3 py-1.5 text-sm ${actif ? 'border-accent bg-accent text-fond font-semibold' : 'border-bordure text-texte-2'}`

/** Une question : libellé, réponse, et sa modification juste en dessous quand on la touche. */
function Ligne({ libelle, valeur, ouvert, onBasculer, children }: { libelle: string; valeur: string; ouvert: boolean; onBasculer: () => void; children: ReactNode }) {
  return (
    <div className="border-b border-bordure last:border-0">
      <button type="button" onClick={onBasculer} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
        <span className="shrink-0 text-texte-2">{libelle}</span>
        <span className={`truncate text-right text-sm ${ouvert ? 'text-accent' : ''}`}>{valeur || 'à remplir'} {ouvert ? '▴' : '›'}</span>
      </button>
      {ouvert && <div className="pb-3">{children}</div>}
    </div>
  )
}

export function SectionProfilSportif() {
  const [ps, modifierPs] = useReglage<ProfilSportif>('profil-sportif', DEFAUT)
  const [profil, modifierProfil] = useProfil()
  const [r, modifier] = useReglagesEntrainement()
  const prog = programmeDe(r.programme)
  // Durées changées : la semaine en cours (et les suivantes déjà calculées) suit tout de suite
  const changerProg = async (c: Partial<ReglagesProgramme>) => {
    await modifier({ programme: { ...prog, ...c } })
    await recalculerSemainesAVenir()
  }
  const [ligne, setLigne] = useState<string>()

  const discipline = prog.discipline ?? 'route'
  const objectifs = [...prog.competitions].sort((a, b) => a.date.localeCompare(b.date))
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  // Ta vitesse en course : courses données à la main + courses prévues faites et importées
  const vitesse = useLiveQuery(async () => {
    const refs = await referencesVitesse(prog)
    return { facteurs: facteursVitesse(refs, { cpW: r.cpW, poidsKg: poidsDesTests(r) }), auto: refs.length - (prog.coursesReference?.length ?? 0) }
  }, [r])
  const contexteCourses = { discipline, typeCourse: prog.typeCourse, dureeCourseMin: prog.dureeCourseMin, cpW: r.cpW, wPrimeKj: r.wPrimeKj, poidsKg: poidsDesTests(r), facteurs: { route: vitesse?.facteurs.route?.facteur, vtt: vitesse?.facteurs.vtt?.facteur } }
  const principale = objectifs.find((c) => niveaux.get(c.date) === 'A')
  // La durée de la course principale règle aussi la sortie longue visée
  const changerCourses = (competitions: typeof prog.competitions) => {
    const a = competitions.find((c) => niveaux.get(c.date) === 'A' || c.niveau === 'A')
    // Courses A : la saison après la 1re se recalcule (récupération, puis bloc adapté à l'écart jusqu'à la suivante)
    const datesA = datesCoursesA(competitions.map((c) => ({ ...c, niveau: c.niveau ?? niveaux.get(c.date) })))
    void changerProg({ competitions, ...(prog.modele === 'chauvin' && datesA.length ? { phases: phasesAvecCoursesA(prog.phases, datesA) } : {}), ...(a && (a.distanceKm || a.dureeMin) ? { dureeCourseMin: dureeDeCourse(a, contexteCourses) } : {}) })
      // Saison calculée : la préparation vise la 1re course A, puis un bloc par A suivante (recalcul complet)
      .then(() => (prog.modele === 'chauvin' ? import('../arrivee/donnees').then((m) => m.recalculerSaison()) : undefined))
  }
  const resume = [NOMS_DISCIPLINES[discipline], objectifs.find((c) => niveaux.get(c.date) === 'A')?.nom, ps.heuresSemaine && `${ps.heuresSemaine}/sem.`].filter(Boolean).join(' · ')

  const props = (id: string) => ({ ouvert: ligne === id, onBasculer: () => setLigne(ligne === id ? undefined : id) })
  const choixMultiple = (liste: string[], valeurs: string[], onChanger: (v: string[]) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {liste.map((x) => (
        <button key={x} type="button" className={puce(valeurs.includes(x))}
          onClick={() => onChanger(valeurs.includes(x) ? valeurs.filter((v) => v !== x) : [...valeurs, x])}>{x}</button>
      ))}
    </div>
  )
  const choixUnique = (liste: string[], valeur: string | undefined, onChanger: (v: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {liste.map((x) => <button key={x} type="button" className={puce(valeur === x)} onClick={() => { onChanger(x); setLigne(undefined) }}>{x}</button>)}
    </div>
  )

  return (
    <Repliable titre="Mon profil sportif" resume={resume || 'à remplir'}>
      <p className="mb-1 text-xs text-texte-3">Tes réponses règlent le programme. Touche une ligne pour la changer.</p>
      <Ligne {...props('sports')} libelle="Sports pratiqués" valeur={ps.sports.join(', ')}>
        {choixMultiple(SPORTS, ps.sports, (sports) => modifierPs({ sports }))}
      </Ligne>
      <Ligne {...props('discipline')} libelle="Discipline visée" valeur={NOMS_DISCIPLINES[discipline]}>
        {choixUnique(DISCIPLINES_PROPOSEES.map((d) => NOMS_DISCIPLINES[d]), NOMS_DISCIPLINES[discipline], (nom) => {
          const d = (Object.keys(NOMS_DISCIPLINES) as Discipline[]).find((k) => NOMS_DISCIPLINES[k] === nom)
          if (d) changerProg({ discipline: d })
        })}
        <p className="mt-1.5 text-xs text-texte-3">Ta semaine se recalcule toute seule après un changement.</p>
      </Ligne>
      {discipline === 'route' && (
        <Ligne {...props('typeCourse')} libelle="Type de course" valeur={prog.typeCourse === 'en-ligne' ? 'Course en ligne' : 'Cyclosportive'}>
          {choixUnique(['Course en ligne', 'Cyclosportive'], prog.typeCourse === 'en-ligne' ? 'Course en ligne' : 'Cyclosportive', (v) => changerProg({ typeCourse: v === 'Course en ligne' ? 'en-ligne' : 'cyclo' }))}
          <p className="mt-1.5 text-xs text-texte-3">{AIDES.typeCourse}</p>
        </Ligne>
      )}
      <Ligne {...props('objectifs')} libelle="Mes courses" valeur={objectifs.map((c) => `${niveaux.get(c.date) ?? ''} ${c.nom}`).join(', ')}>
        <p className="mb-1.5 text-[13px] font-semibold text-texte-2">Ta course principale</p>
        {principale
          ? <CoursePrincipale key={principale.date} course={principale} contexte={contexteCourses} onChanger={(a) => changerCourses(prog.competitions.map((c) => (c === principale ? a : c)))} onRetirer={() => changerCourses(prog.competitions.filter((c) => c !== principale))} />
          : <p className="text-sm text-texte-2">Aucune : ajoute une course de niveau A ci-dessous, elle devient ta course principale et ta saison se construit autour.</p>}
        <p className="mt-4 mb-1.5 text-[13px] font-semibold text-texte-2">Tes autres courses</p>
        <ListeCourses courses={prog.competitions} effectifs={niveaux} contexte={contexteCourses} onChanger={changerCourses} principale={principale?.date} />
        <p className="mt-4 text-[13px] font-semibold text-texte-2">Ta vitesse en course</p>
        <CalageVitesse refs={prog.coursesReference ?? []} auto={vitesse?.auto ?? 0} facteurs={vitesse?.facteurs ?? {}} onChanger={(coursesReference) => changerProg({ coursesReference })} />
        <p className="mt-1.5 text-xs text-texte-3">{AIDES.niveauxCourses}</p>
      </Ligne>
      <Ligne {...props('anciennete')} libelle="Vélo régulier depuis" valeur={ps.anciennete ?? ''}>
        <p className="mb-1.5 text-xs text-texte-3">Au moins 2 fois par semaine, sans arrêt de plus de 2 mois.</p>
        {choixUnique(ANCIENNETES, ps.anciennete, (anciennete) => modifierPs({ anciennete }))}
      </Ligne>
      <Ligne {...props('recentes')} libelle="Ces 3 derniers mois" valeur={ps.heuresRecentes ? `${ps.heuresRecentes}/sem.` : ''}>
        <p className="mb-1.5 text-xs text-texte-3">Heures de vélo par semaine, en moyenne.</p>
        {choixUnique(HEURES_RECENTES, ps.heuresRecentes, (heuresRecentes) => modifierPs({ heuresRecentes }))}
      </Ligne>
      <Ligne {...props('intervalles')} libelle="Déjà suivi un plan à intervalles" valeur={ps.intervalles === undefined ? '' : ps.intervalles ? 'Oui' : 'Non'}>
        <p className="mb-1.5 text-xs text-texte-3">Pendant au moins 6 semaines.</p>
        {choixUnique(['Oui', 'Non'], ps.intervalles === undefined ? undefined : ps.intervalles ? 'Oui' : 'Non', (v) => modifierPs({ intervalles: v === 'Oui' }))}
        <p className="mt-1.5 text-xs text-texte-3">Niveau retenu : <b>{NOMS_NIVEAUX[niveauDuProfil(ps)]}</b>. {AIDES.profilNiveau}</p>
      </Ligne>
      <Ligne {...props('heures')} libelle="Temps par semaine" valeur={ps.heuresSemaine ?? ''}>
        {choixUnique(HEURES, ps.heuresSemaine, (heuresSemaine) => modifierPs({ heuresSemaine }))}
        <p className="mt-1.5 text-xs text-texte-3">{AIDES.profilTemps}</p>
      </Ligne>
      <Ligne {...props('semaine')} libelle="Vélo en semaine, au plus" valeur={heures(prog.maxSemaineMin)}>
        <ChampNombre libelle="Durée max" unite="min" decimales={0} valeur={prog.maxSemaineMin} onValider={(v) => v && changerProg({ maxSemaineMin: v })} />
      </Ligne>
      <Ligne {...props('long')} libelle="Sortie longue" valeur={`${heures(prog.minLongMin)} à ${heures(prog.maxLongMin)}`}>
        <ChampNombre libelle="Au moins" unite="min" decimales={0} valeur={prog.minLongMin} onValider={(v) => v && changerProg({ minLongMin: v })} />
        <ChampNombre libelle="Au plus" unite="min" decimales={0} valeur={prog.maxLongMin} onValider={(v) => v && changerProg({ maxLongMin: v })} />
      </Ligne>
      <Ligne {...props('materiel')} libelle="Matériel" valeur={ps.materiel.join(', ')}>{choixMultiple(MATERIEL, ps.materiel, (materiel) => modifierPs({ materiel }))}</Ligne>
      <Ligne {...props('sensibles')} libelle="Points sensibles" valeur={ps.pointsSensibles ?? ''}>
        <input defaultValue={ps.pointsSensibles} placeholder="Ex. genoux, tendon d'Achille…" onBlur={(e) => modifierPs({ pointsSensibles: e.target.value.trim() || undefined })}
          className="w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-sm" />
        {/genou/i.test(ps.pointsSensibles ?? '') && <p className="mt-1.5 text-xs text-texte-3">{AIDES.profilGenoux}</p>}
      </Ligne>
      <Ligne {...props('nutrition')} libelle="Repas du jour" valeur={ps.nutrition === false ? 'Désactivé' : 'Activé'}>
        {choixUnique(['Activé', 'Désactivé'], ps.nutrition === false ? 'Désactivé' : 'Activé', (v) => modifierPs({ nutrition: v === 'Activé' }))}
        {/* Objectif nutrition : seulement quand le module est activé (11/2026) */}
        {ps.nutrition !== false && (
          <>
            <p className="mt-3 mb-1.5 text-[13px] font-semibold text-texte-2">Ton objectif</p>
            {choixUnique(['Garder mon poids', 'Perte de gras légère'], profil.objectif === 'perte' ? 'Perte de gras légère' : 'Garder mon poids', (v) => modifierProfil({ objectif: v === 'Perte de gras légère' ? 'perte' : 'maintien' }))}
          </>
        )}
        <p className="mt-1.5 text-xs text-texte-3">Activé : tes besoins du jour selon ta séance, ce que tu as mangé et l'écart, et le bilan nutrition du dimanche.</p>
      </Ligne>
      <Ligne {...props('nutritionEffort')} libelle="Nutrition à l'effort" valeur={ps.nutritionEffort === false ? 'Désactivée' : 'Activée'}>
        {choixUnique(['Activée', 'Désactivée'], ps.nutritionEffort === false ? 'Désactivée' : 'Activée', (v) => modifierPs({ nutritionEffort: v === 'Activée' }))}
        <p className="mt-1.5 text-xs text-texte-3">Activée : les glucides par heure à prendre sur tes sorties longues et tes courses. Plus tard : un plan pour habituer ton estomac.</p>
      </Ligne>
      <Ligne {...props('muscu')} libelle="Musculation" valeur={ps.muscu ?? ''}>
        <DetailMuscu />
      </Ligne>
    </Repliable>
  )
}
