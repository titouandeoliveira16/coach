import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import { dureeDeCourse, epreuveDe, estimerDureeCourse, NOMS_EPREUVES, type Competition, type CourseReference, type Discipline, type Epreuve, type FamilleVitesse, type NiveauCourse } from '../../../metrics/programme'

const COULEURS: Record<NiveauCourse, string> = { A: 'bg-accent', B: 'bg-yellow-400', C: 'bg-sky-400' }
const NOTES: Record<NiveauCourse, string> = {
  A: 'ta saison est construite autour',
  B: 'semaine allégée, la course est ta séance dure',
  C: 'compte comme ta séance dure',
}
const puce = (actif: boolean) => `rounded-full border px-3 py-1.5 text-sm ${actif ? 'border-accent bg-accent text-fond font-semibold' : 'border-bordure text-texte-2'}`
const champ = 'min-w-0 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm'

const heures = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`.replace(/^0 h /, '').replace(/ h 00$/, ' h')
const nombre = (t: string) => { const v = Number(t.replace(',', '.')); return t.trim() && v > 0 ? v : undefined }
type Contexte = { discipline: Discipline; typeCourse?: 'en-ligne' | 'cyclo'; dureeCourseMin?: number; cpW?: number; poidsKg?: number; facteurs?: Partial<Record<FamilleVitesse, number>> }

export function Pastille({ niveau }: { niveau: NiveauCourse }) {
  return <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold text-fond ${COULEURS[niveau]}`}>{niveau}</span>
}

/**
 * Courses avec leur niveau (A principale, B importante, C pour s'entraîner) et ajout d'une course B ou C.
 * `effectifs` : niveau appliqué par l'appli (une B trop proche de la A, d'une autre B ou en reprise compte comme une C).
 */
export function ListeCourses({ courses, effectifs, onChanger, min, contexte }: {
  courses: Competition[]; effectifs: Map<string, NiveauCourse>; onChanger: (c: Competition[]) => void; min?: string; contexte: Contexte
}) {
  const vide = { date: '', nom: '', niveau: 'B' as 'B' | 'C', epreuve: epreuveDe(contexte.discipline, contexte.typeCourse), distance: '', denivele: '', duree: '' }
  const [nouvelle, setNouvelle] = useState(vide)
  const [modifierDuree, setModifierDuree] = useState(false)
  const distanceKm = nombre(nouvelle.distance)
  const deniveleM = nombre(nouvelle.denivele)
  const estimee = distanceKm ? estimerDureeCourse(nouvelle.epreuve, distanceKm, deniveleM, contexte, contexte.facteurs?.[nouvelle.epreuve === 'en-ligne' || nouvelle.epreuve === 'cyclo' ? 'route' : 'vtt']) : undefined
  const dureeDonnee = nombre(nouvelle.duree)
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
                <p className="text-xs text-texte-3">{[c.epreuve && NOMS_EPREUVES[c.epreuve], c.distanceKm && `${c.distanceKm} km`, c.deniveleM && `${c.deniveleM} m`, `≈ ${heures(dureeDeCourse(c, contexte))}`].filter(Boolean).join(' · ')}</p>
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
      <p className="mt-2 text-xs text-texte-3">Discipline</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(Object.keys(NOMS_EPREUVES) as Epreuve[]).map((e) => (
          <button key={e} type="button" className={puce(nouvelle.epreuve === e)} onClick={() => setNouvelle({ ...nouvelle, epreuve: e })}>{NOMS_EPREUVES[e]}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <label className="flex-1 text-xs text-texte-3">Distance (km)<input inputMode="decimal" value={nouvelle.distance} onChange={(e) => setNouvelle({ ...nouvelle, distance: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
        <label className="flex-1 text-xs text-texte-3">Dénivelé (m)<input inputMode="numeric" value={nouvelle.denivele} onChange={(e) => setNouvelle({ ...nouvelle, denivele: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
      </div>
      {(estimee || modifierDuree) && (
        <div className="mt-2 text-sm">
          {modifierDuree
            ? <label className="flex items-center gap-2 text-texte-2">Durée prévue (min)<input inputMode="numeric" value={nouvelle.duree} placeholder={estimee ? String(estimee) : ''} onChange={(e) => setNouvelle({ ...nouvelle, duree: e.target.value })} className={`${champ} w-24`} /></label>
            : <>Durée estimée : <b>≈ {heures(estimee!)}</b> <button type="button" className="font-semibold text-accent" onClick={() => setModifierDuree(true)}>· modifier</button></>}
          <p className="mt-0.5 text-xs text-texte-3">Calculée avec ta CP, ton poids et ta vitesse en course (calée sur tes courses faites) : corrige-la si tu connais ton temps.</p>
        </div>
      )}
      {!estimee && !modifierDuree && <button type="button" className="mt-2 text-sm font-semibold text-accent" onClick={() => setModifierDuree(true)}>Je connais ma durée</button>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={puce(nouvelle.niveau === 'B')} onClick={() => setNouvelle({ ...nouvelle, niveau: 'B' })}>B · importante</button>
        <button type="button" className={puce(nouvelle.niveau === 'C')} onClick={() => setNouvelle({ ...nouvelle, niveau: 'C' })}>C · pour s’entraîner</button>
      </div>
      <p className="mt-1.5 text-xs text-texte-3">B : semaine allégée d’un tiers, la course est ta séance dure. C : semaine normale, la course remplace ta séance dure (ou ta sortie longue au-delà de 2 h).</p>
      <button type="button" disabled={!nouvelle.date || !nouvelle.nom.trim() || courses.some((x) => x.date === nouvelle.date)}
        className="mt-2 w-full rounded-xl bg-accent py-2.5 font-bold text-fond disabled:opacity-40"
        onClick={() => {
          onChanger([...courses, {
            date: nouvelle.date, nom: nouvelle.nom.trim(), niveau: nouvelle.niveau, epreuve: nouvelle.epreuve,
            ...(distanceKm ? { distanceKm } : {}), ...(deniveleM ? { deniveleM: Math.round(deniveleM) } : {}), ...(dureeDonnee ? { dureeMin: Math.round(dureeDonnee) } : {}),
          }])
          setNouvelle(vide)
          setModifierDuree(false)
        }}>
        + Ajouter
      </button>
    </div>
  )
}

/** Caler les vitesses sur des courses déjà faites : ton facteur personnel (route, VTT). */
export function CalageVitesse({ refs, auto, facteurs, onChanger }: {
  refs: CourseReference[]; auto: number; facteurs: Partial<Record<FamilleVitesse, { facteur: number; n: number }>>; onChanger: (r: CourseReference[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [f, setF] = useState({ epreuve: 'cyclo' as Epreuve, distance: '', denivele: '', h: '', min: '' })
  const distanceKm = nombre(f.distance)
  const dureeMin = (nombre(f.h) ?? 0) * 60 + (nombre(f.min) ?? 0)
  const texte = (x?: { facteur: number; n: number }) => (x ? `× ${x.facteur.toLocaleString('fr-FR')} (${x.n} course${x.n > 1 ? 's' : ''})` : 'vitesses de base')
  return (
    <div className="mt-3 border-t border-bordure pt-2">
      <p className="text-sm text-texte-2">Ta vitesse en course</p>
      <p className="text-xs text-texte-3">Route : {texte(facteurs.route)} · VTT : {texte(facteurs.vtt)}. Calée sur tes 3 dernières courses faites{auto ? ` (dont ${auto} importée${auto > 1 ? 's' : ''} de ta montre)` : ''} : elle se recale toute seule après chaque course prévue.</p>
      <ul>
        {refs.map((x, i) => (
          <li key={i} className="flex items-center justify-between gap-2 py-1 text-xs text-texte-2">
            <span>{NOMS_EPREUVES[x.epreuve]} · {x.distanceKm} km · {x.deniveleM} m · {heures(x.dureeMin)}</span>
            <button type="button" className="px-2 text-texte-3" aria-label="Retirer cette course" onClick={() => onChanger(refs.filter((_, k) => k !== i))}>×</button>
          </li>
        ))}
      </ul>
      {!ouvert ? (
        <button type="button" className="mt-1 text-sm font-semibold text-accent" onClick={() => setOuvert(true)}>+ Caler sur une course faite</button>
      ) : (
        <div className="mt-1">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(NOMS_EPREUVES) as Epreuve[]).map((e) => (
              <button key={e} type="button" className={puce(f.epreuve === e)} onClick={() => setF({ ...f, epreuve: e })}>{NOMS_EPREUVES[e]}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <label className="flex-1 text-xs text-texte-3">Distance (km)<input inputMode="decimal" value={f.distance} onChange={(e) => setF({ ...f, distance: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
            <label className="flex-1 text-xs text-texte-3">Dénivelé (m)<input inputMode="numeric" value={f.denivele} onChange={(e) => setF({ ...f, denivele: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
          </div>
          <div className="mt-2 flex items-end gap-2 text-xs text-texte-3">
            <label className="flex-1">Ton temps (h)<input inputMode="numeric" value={f.h} onChange={(e) => setF({ ...f, h: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
            <label className="flex-1">(min)<input inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
          </div>
          <button type="button" disabled={!distanceKm || dureeMin < 15} className="mt-2 w-full rounded-xl bg-accent py-2.5 font-bold text-fond disabled:opacity-40"
            onClick={() => {
              onChanger([...refs, { epreuve: f.epreuve, distanceKm: distanceKm!, deniveleM: Math.round(nombre(f.denivele) ?? 0), dureeMin: Math.round(dureeMin), date: new Date().toISOString().slice(0, 10) }])
              setF({ epreuve: f.epreuve, distance: '', denivele: '', h: '', min: '' })
              setOuvert(false)
            }}>Caler</button>
        </div>
      )}
    </div>
  )
}
