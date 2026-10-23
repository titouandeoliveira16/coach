import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { NOMS_PHASES, type Role } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { z2Actuel } from '../plan/programme'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import type { ReglagesProgramme } from '../types'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const ROLES: Record<Role, string> = {
  course: '🏃 Course', renfo: '🏋️ Renfo', 'velo-dur': '🚴 Vélo intensité', 'velo-z2': '🚴 Vélo Z2', 'velo-long': '🚴 Vélo long', libre: '— Libre / repos',
}
const select = 'rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm'

/** Mes jours : semaine type et créneaux (le programme vélo se place sur ces jours). */
export function JoursVelo() {
  const [r, modifier] = useReglagesEntrainement()
  const p = programmeDe(r.programme)
  const changer = (c: Partial<ReglagesProgramme>) => modifier({ programme: { ...p, ...c } })

  return (
    <div className="mt-3 border-t border-bordure pt-3">
      <p className="text-sm font-semibold">Ma semaine type<Aide titre="Programme vélo" texte={AIDES.programme} /></p>
      <p className="mb-2 text-xs text-texte-3">Les jours où tu fais habituellement chaque chose : l'appli y place ton vélo, et met l'intensité loin de ta séance dure de course.</p>
      {JOURS.map((j, i) => (
        <label key={j} className="flex items-center justify-between py-1">
          <span className="text-texte-2">{j}</span>
          <select value={p.semaineType[i]} className={select}
            onChange={(e) => changer({ semaineType: p.semaineType.map((x, k) => (k === i ? (e.target.value as Role) : x)) })}>
            {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      ))}

      <div className="mt-2 border-t border-bordure pt-2">
        <ChampNombre libelle="Vélo en semaine, max" unite="min" decimales={0} valeur={p.maxSemaineMin} onValider={(v) => v && changer({ maxSemaineMin: v })} />
        <ChampNombre libelle="Sortie longue, min" unite="min" decimales={0} valeur={p.minLongMin} onValider={(v) => v && changer({ minLongMin: v })} />
        <ChampNombre libelle="Sortie longue, max" unite="min" decimales={0} valeur={p.maxLongMin} onValider={(v) => v && changer({ maxLongMin: v })} />
      </div>
    </div>
  )
}

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
