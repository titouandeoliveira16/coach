import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import type { Competition, NiveauCourse } from '../../../metrics/programme'

const COULEURS: Record<NiveauCourse, string> = { A: 'bg-accent', B: 'bg-yellow-400', C: 'bg-sky-400' }
const NOTES: Record<NiveauCourse, string> = {
  A: 'ta saison est construite autour',
  B: 'semaine allégée, la course est ta séance dure',
  C: 'compte comme ta séance dure',
}
const puce = (actif: boolean) => `rounded-full border px-3 py-1.5 text-sm ${actif ? 'border-accent bg-accent text-fond font-semibold' : 'border-bordure text-texte-2'}`
const champ = 'min-w-0 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm'

export function Pastille({ niveau }: { niveau: NiveauCourse }) {
  return <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold text-fond ${COULEURS[niveau]}`}>{niveau}</span>
}

/**
 * Courses avec leur niveau (A principale, B importante, C pour s'entraîner) et ajout d'une course B ou C.
 * `effectifs` : niveau appliqué par l'appli (une B trop proche de la A, d'une autre B ou en reprise compte comme une C).
 */
export function ListeCourses({ courses, effectifs, onChanger, min }: {
  courses: Competition[]; effectifs: Map<string, NiveauCourse>; onChanger: (c: Competition[]) => void; min?: string
}) {
  const [nouvelle, setNouvelle] = useState<{ date: string; nom: string; niveau: 'B' | 'C' }>({ date: '', nom: '', niveau: 'B' })
  const triees = [...courses].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div>
      <ul>
        {triees.map((c) => {
          const n = effectifs.get(c.date) ?? c.niveau ?? 'B'
          const declasse = c.niveau === 'B' && n === 'C'
          return (
            <li key={c.date + c.nom} className="flex items-center gap-2.5 border-b border-bordure py-1.5">
              <Pastille niveau={n} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.nom}</p>
                <p className="text-xs text-texte-3">{depuisJour(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: c.date.slice(0, 4) === new Date().getFullYear().toString() ? undefined : 'numeric' })} · {declasse ? 'trop proche d’une autre course ou en reprise : comptée comme une C' : NOTES[n]}</p>
              </div>
              {n !== 'A' && (
                <button type="button" className="px-2 text-texte-3" aria-label={`Retirer ${c.nom}`} onClick={() => onChanger(courses.filter((x) => x !== c))}>×</button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-sm text-texte-2">Ajouter une course</p>
      <div className="mt-1 flex gap-2">
        <input type="date" min={min} value={nouvelle.date} onChange={(e) => setNouvelle({ ...nouvelle, date: e.target.value })} className={`${champ} w-36`} />
        <input value={nouvelle.nom} onChange={(e) => setNouvelle({ ...nouvelle, nom: e.target.value })} placeholder="Nom" className={`${champ} flex-1`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={puce(nouvelle.niveau === 'B')} onClick={() => setNouvelle({ ...nouvelle, niveau: 'B' })}>B · importante</button>
        <button type="button" className={puce(nouvelle.niveau === 'C')} onClick={() => setNouvelle({ ...nouvelle, niveau: 'C' })}>C · pour s’entraîner</button>
      </div>
      <p className="mt-1.5 text-xs text-texte-3">B : semaine allégée d’un tiers, la course est ta séance dure. C : semaine normale, la course remplace ta séance dure (ou ta sortie longue au-delà de 2 h).</p>
      <button type="button" disabled={!nouvelle.date || !nouvelle.nom.trim() || courses.some((x) => x.date === nouvelle.date)}
        className="mt-2 w-full rounded-xl bg-accent py-2.5 font-bold text-fond disabled:opacity-40"
        onClick={() => { onChanger([...courses, { date: nouvelle.date, nom: nouvelle.nom.trim(), niveau: nouvelle.niveau }]); setNouvelle({ date: '', nom: '', niveau: 'B' }) }}>
        + Ajouter
      </button>
    </div>
  )
}
