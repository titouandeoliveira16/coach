import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { NOMS_DISCIPLINES, NOMS_PHASES, type Discipline } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { z2Actuel } from '../plan/programme'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import type { ReglagesProgramme } from '../types'

const select = 'rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm'

/** Réglages avancés du programme : Z2 de départ, phases, tests CP, compétitions. */
export function ProgrammeAvance() {
  const [r, modifier] = useReglagesEntrainement()
  const p = programmeDe(r.programme)
  const changer = (c: Partial<ReglagesProgramme>) => modifier({ programme: { ...p, ...c } })
  const z2 = useLiveQuery(z2Actuel, [r.programme])
  const [nouvelleCompet, setNouvelleCompet] = useState({ date: '', nom: '' })
  const [nouveauTest, setNouveauTest] = useState('')

  return (
    <Carte titre="Programme vélo">
      <label className="flex items-center justify-between gap-2 py-1">
        <span className="text-texte-2">Discipline visée<Aide titre="Discipline visée" texte={AIDES.discipline} /></span>
        <select value={p.discipline ?? 'route'} className={select} onChange={(e) => changer({ discipline: e.target.value as Discipline })}>
          {Object.entries(NOMS_DISCIPLINES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {(p.discipline ?? 'route') !== 'route' && <p className="pb-1 text-xs text-texte-3">Régénère ta semaine (onglet Semaine) pour appliquer le changement.</p>}
      {((p.discipline ?? 'route') === 'route' || p.discipline === 'xcm') && (
        <ChampNombre libelle="Durée prévue de ta course" unite="min" decimales={0} valeur={p.dureeCourseMin} onValider={(dureeCourseMin) => changer({ dureeCourseMin })} />
      )}
      <ChampNombre libelle="Z2 de départ" unite="W" decimales={0} valeur={p.z2W} onValider={(z2W) => changer({ z2W })} />
      {z2 && (
        <p className="py-1 text-right text-xs text-texte-3">
          Z2 actuelle : <b className="text-texte">{z2.w} W</b> ({z2.ajustement >= 0 ? '+' : ''}{z2.ajustement} W d'ajustement)<Aide titre="Puissance Z2" texte={AIDES.z2Auto} />
        </p>
      )}
      <div className="mt-2 border-t border-bordure pt-2">
        <p className="mb-1 text-sm font-semibold">Phases (début, un lundi)</p>
        {[...p.phases].sort((a, b) => a.debut.localeCompare(b.debut)).map((ph) => (
          <label key={ph.type} className="flex items-center justify-between py-1 text-sm">
            <span className="text-texte-2">{NOMS_PHASES[ph.type]}</span>
            <input type="date" value={ph.debut} className={select}
              onChange={(e) => e.target.value && changer({ phases: p.phases.map((x) => (x.type === ph.type ? { ...x, debut: e.target.value } : x)) })} />
          </label>
        ))}
      </div>

      <div className="mt-2 border-t border-bordure pt-2">
        <p className="mb-1 text-sm font-semibold">Tests CP prévus</p>
        {[...p.testsCp].sort().map((d) => (
          <Ligne key={d} texte={depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            onSupprimer={() => changer({ testsCp: p.testsCp.filter((x) => x !== d) })} />
        ))}
        <div className="mt-1 flex gap-2">
          <input type="date" value={nouveauTest} onChange={(e) => setNouveauTest(e.target.value)} className={`${select} flex-1`} />
          <button type="button" disabled={!nouveauTest} className="px-3 font-semibold text-accent disabled:opacity-40"
            onClick={() => { changer({ testsCp: [...new Set([...p.testsCp, nouveauTest])] }); setNouveauTest('') }}>Ajouter</button>
        </div>
      </div>

      <div className="mt-2 border-t border-bordure pt-2">
        <p className="mb-1 text-sm font-semibold">Compétitions</p>
        {[...p.competitions].sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
          <Ligne key={c.date + c.nom} texte={`${depuisJour(c.date).toLocaleDateString('fr-FR')} · ${c.nom}`}
            onSupprimer={() => changer({ competitions: p.competitions.filter((x) => x !== c) })} />
        ))}
        <div className="mt-1 flex gap-2">
          <input type="date" value={nouvelleCompet.date} onChange={(e) => setNouvelleCompet({ ...nouvelleCompet, date: e.target.value })} className={select} />
          <input placeholder="Nom, ex. 10 km" value={nouvelleCompet.nom} onChange={(e) => setNouvelleCompet({ ...nouvelleCompet, nom: e.target.value })} className={`${select} min-w-0 flex-1`} />
          <button type="button" disabled={!nouvelleCompet.date || !nouvelleCompet.nom} className="px-2 font-semibold text-accent disabled:opacity-40"
            onClick={() => { changer({ competitions: [...p.competitions, nouvelleCompet] }); setNouvelleCompet({ date: '', nom: '' }) }}>+</button>
        </div>
      </div>
    </Carte>
  )
}

function Ligne({ texte, onSupprimer }: { texte: string; onSupprimer: () => void }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="capitalize">{texte}</span>
      <button type="button" className="px-2 text-texte-3" aria-label="Supprimer" onClick={onSupprimer}>×</button>
    </div>
  )
}
