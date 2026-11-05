import { useState, type ReactNode } from 'react'
import { jourCourt } from '../../../core/dates'
import { useReglage } from '../../../core/reglages'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { Repliable } from '../../../core/ui/Repliable'
import { DISCIPLINES_PROPOSEES, NOMS_DISCIPLINES, type Discipline } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import type { ReglagesProgramme } from '../types'

/**
 * Profil sportif : les réponses qui te décrivent (comme le questionnaire d'une appli de coaching).
 * Toutes les réponses règlent le programme (niveau, heures, genoux, muscu, course) ; seul le matériel est noté pour plus tard.
 */
export interface ProfilSportif {
  sports: string[]
  niveau?: string
  heuresSemaine?: string
  materiel: string[]
  pointsSensibles?: string
  muscu?: string
}
const DEFAUT: ProfilSportif = { sports: [], materiel: [] }

const SPORTS = ['Vélo route', 'VTT', 'Course à pied', 'Natation', 'Musculation']
const NIVEAUX = ['Débutant (moins d’un an)', 'Intermédiaire (1 à 3 ans)', 'Confirmé (3 à 5 ans)', 'Expert (plus de 5 ans)']
const HEURES = ['Moins de 4 h', '4 à 6 h', '6 à 8 h', '8 à 10 h', '10 à 12 h', 'Plus de 12 h']
const MATERIEL = ['Home trainer connecté', 'Capteur de puissance', 'Ceinture cardio', 'Montre GPS']
const MUSCU = ['Pas pour l’instant', '1 séance par semaine', '2 séances par semaine']

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
  const [r, modifier] = useReglagesEntrainement()
  const prog = programmeDe(r.programme)
  const changerProg = (c: Partial<ReglagesProgramme>) => modifier({ programme: { ...prog, ...c } })
  const [ligne, setLigne] = useState<string>()
  const [compet, setCompet] = useState({ date: '', nom: '' })

  const objectifs = [...prog.competitions].sort((a, b) => a.date.localeCompare(b.date))
  const discipline = prog.discipline ?? 'route'
  const resume = [NOMS_DISCIPLINES[discipline], objectifs[objectifs.length - 1]?.nom, ps.heuresSemaine && `${ps.heuresSemaine}/sem.`].filter(Boolean).join(' · ')

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
        {ps.sports.includes('Course à pied') && <p className="mt-1.5 text-xs text-texte-3">{AIDES.profilCourse}</p>}
      </Ligne>
      <Ligne {...props('discipline')} libelle="Discipline visée" valeur={NOMS_DISCIPLINES[discipline]}>
        {choixUnique(DISCIPLINES_PROPOSEES.map((d) => NOMS_DISCIPLINES[d]), NOMS_DISCIPLINES[discipline], (nom) => {
          const d = (Object.keys(NOMS_DISCIPLINES) as Discipline[]).find((k) => NOMS_DISCIPLINES[k] === nom)
          if (d) changerProg({ discipline: d })
        })}
        <p className="mt-1.5 text-xs text-texte-3">Pense à recalculer ta semaine (onglet Semaine) après un changement.</p>
      </Ligne>
      <Ligne {...props('objectifs')} libelle="Objectifs (courses)" valeur={objectifs.map((c) => c.nom).join(', ')}>
        <ul className="space-y-1 text-sm">
          {objectifs.map((c) => (
            <li key={c.date + c.nom} className="flex items-center justify-between gap-2">
              <span>{c.nom} <span className="text-texte-3">· {jourCourt(c.date)}</span></span>
              <button type="button" className="px-2 text-texte-3" aria-label={`Retirer ${c.nom}`}
                onClick={() => changerProg({ competitions: prog.competitions.filter((x) => x !== c) })}>×</button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input type="date" value={compet.date} onChange={(e) => setCompet({ ...compet, date: e.target.value })} className="rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm" />
          <input value={compet.nom} onChange={(e) => setCompet({ ...compet, nom: e.target.value })} placeholder="Nom (ex. Étape du Tour)" className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm" />
          <button type="button" disabled={!compet.date || !compet.nom.trim()} className="rounded-lg bg-accent px-3 font-bold text-fond disabled:opacity-40"
            onClick={() => { changerProg({ competitions: [...prog.competitions, { date: compet.date, nom: compet.nom.trim() }] }); setCompet({ date: '', nom: '' }) }}>+</button>
        </div>
        <p className="mt-1.5 text-xs text-texte-3">La semaine d'une course est allégée toute seule.</p>
      </Ligne>
      <Ligne {...props('niveau')} libelle="Niveau" valeur={ps.niveau ?? ''}>
        {choixUnique(NIVEAUX, ps.niveau, (niveau) => modifierPs({ niveau }))}
        <p className="mt-1.5 text-xs text-texte-3">{AIDES.profilNiveau}</p>
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
      <Ligne {...props('muscu')} libelle="Musculation" valeur={ps.muscu ?? ''}>
        {choixUnique(MUSCU, ps.muscu, (muscu) => modifierPs({ muscu }))}
        <p className="mt-1.5 text-xs text-texte-3">{AIDES.profilMuscu}</p>
      </Ligne>
    </Repliable>
  )
}
