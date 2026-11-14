import { X } from 'lucide-react'
import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { Feuille } from '../../../core/ui/Feuille'
import { Aide } from '../../../core/ui/Aide'
import { AIDES } from '../aides'
import { ciblesCols, dureeDeCourse, type Col, epreuveDe, estimerDureeCourse, NOMS_EPREUVES, type Competition, type CourseReference, type Discipline, type Epreuve, type FamilleVitesse, type NiveauCourse } from '../../../metrics/programme'

const COULEURS: Record<NiveauCourse, string> = { A: 'bg-accent', B: 'bg-yellow-400', C: 'bg-sky-400' }
const NOTES: Record<NiveauCourse, string> = {
  A: 'objectif : affûtage avant, récupération après',
  B: 'semaine allégée, la course est ta séance dure',
  C: 'compte comme ta séance dure',
}
const puce = (actif: boolean) => `rounded-full border px-3 py-1.5 text-sm ${actif ? 'border-accent bg-accent text-fond font-semibold' : 'border-bordure text-texte-2'}`
const champ = 'min-w-0 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm text-texte'

const heures = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`.replace(/ h 00$/, ' h'))
const virgule = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const nombre = (t: string) => { const v = Number(t.replace(',', '.')); return t.trim() && v > 0 ? v : undefined }
type Contexte = { discipline: Discipline; typeCourse?: 'en-ligne' | 'cyclo'; dureeCourseMin?: number; cpW?: number; wPrimeKj?: number; poidsKg?: number; facteurs?: Partial<Record<FamilleVitesse, number>> }

export interface Parcours { distance: string; denivele: string; duree: string }
export const parcoursVide: Parcours = { distance: '', denivele: '', duree: '' }
export const parcoursDe = (c?: Partial<Competition>): Parcours => ({
  distance: c?.distanceKm ? virgule(c.distanceKm) : '', denivele: c?.deniveleM ? String(c.deniveleM) : '', duree: c?.dureeMin ? String(c.dureeMin) : '',
})
/** Distance, dénivelé, durée donnée : ce que la course enregistre. */
export const champsParcours = (p: Parcours): Pick<Competition, 'distanceKm' | 'deniveleM' | 'dureeMin'> => {
  const distanceKm = nombre(p.distance), deniveleM = nombre(p.denivele), dureeMin = nombre(p.duree)
  return { ...(distanceKm ? { distanceKm } : {}), ...(deniveleM ? { deniveleM: Math.round(deniveleM) } : {}), ...(dureeMin ? { dureeMin: Math.round(dureeMin) } : {}) }
}

/** Distance, dénivelé et durée estimée (corrigeable) d'une course : les mêmes champs pour la principale et les autres. */
export function ChampsParcours({ epreuve, valeur: depart, onChanger: remonter, contexte }: { epreuve: Epreuve; valeur: Parcours; onChanger: (p: Parcours) => void; contexte: Contexte }) {
  // Texte tapé gardé tel quel (« 12, » en cours de saisie) ; le parent reçoit chaque changement
  const [valeur, setValeur] = useState(depart)
  const onChanger = (p: Parcours) => { setValeur(p); remonter(p) }
  const [modifier, setModifier] = useState(!!depart.duree)
  const distanceKm = nombre(valeur.distance)
  const estimee = distanceKm ? estimerDureeCourse(epreuve, distanceKm, nombre(valeur.denivele), contexte, contexte.facteurs?.[epreuve === 'en-ligne' || epreuve === 'cyclo' ? 'route' : 'vtt']) : undefined
  return (
    <div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-texte-3">Distance (km)<input inputMode="decimal" value={valeur.distance} onChange={(e) => onChanger({ ...valeur, distance: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
        <label className="flex-1 text-xs text-texte-3">Dénivelé (m)<input inputMode="numeric" value={valeur.denivele} onChange={(e) => onChanger({ ...valeur, denivele: e.target.value })} className={`${champ} mt-1 block w-full`} /></label>
      </div>
      {(estimee || modifier) && (
        <div className="mt-2 text-sm">
          {modifier
            ? <label className="flex items-center gap-2 text-texte-2">Durée prévue (min)<input inputMode="numeric" value={valeur.duree} placeholder={estimee ? String(estimee) : ''} onChange={(e) => onChanger({ ...valeur, duree: e.target.value })} className={`${champ} w-24`} /></label>
            : <>Durée estimée : <b>≈ {heures(estimee!)}</b> <button type="button" className="font-semibold text-accent" onClick={() => setModifier(true)}>· modifier</button></>}
          <p className="mt-0.5 text-xs text-texte-3">Calculée avec ta CP, ton poids et ta vitesse en course (calée sur tes courses faites) : corrige-la si tu connais ton temps.</p>
        </div>
      )}
      {!estimee && !modifier && <button type="button" className="mt-2 text-sm font-semibold text-accent" onClick={() => setModifier(true)}>Je connais ma durée</button>}
    </div>
  )
}

export function Pastille({ niveau }: { niveau: NiveauCourse }) {
  return <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold text-fond ${COULEURS[niveau]}`}>{niveau}</span>
}

const dateCourte = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.slice(0, 4) === new Date().getFullYear().toString() ? undefined : 'numeric' })
const resumeParcours = (c: Competition, contexte: Contexte) =>
  [c.epreuve && NOMS_EPREUVES[c.epreuve], c.distanceKm && `${virgule(c.distanceKm)} km`, c.deniveleM && `${c.deniveleM} m`, `≈ ${heures(dureeDeCourse(c, contexte))}`].filter(Boolean).join(' · ')

/** Ta course principale (A) : distance, dénivelé et durée modifiables sur place ; sa date ne bouge pas (la saison est construite dessus). */
/** Croix rouge pour supprimer une course, avec confirmation. */
function BoutonSupprimer({ nom, onSupprimer }: { nom: string; onSupprimer: () => void }) {
  return (
    <button type="button" aria-label={`Supprimer ${nom}`} className="presse -mr-1 ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mauvais"
      onClick={(e) => {
        e.stopPropagation()
        if (confirm(`Supprimer « ${nom} » de tes courses ? Ta saison sera recalculée.`)) onSupprimer()
      }}>
      <X className="h-5 w-5" strokeWidth={2.2} />
    </button>
  )
}

export function CoursePrincipale({ course, contexte, onChanger, onRetirer }: { course: Competition; contexte: Contexte; onChanger: (c: Competition) => void; onRetirer?: () => void }) {
  const [parcours, setParcours] = useState(parcoursDe(course))
  const [cols, setCols] = useState<Col[]>(course.cols ?? [])
  const [cle, setCle] = useState(0)
  const change = JSON.stringify(champsParcours(parcours)) !== JSON.stringify(champsParcours(parcoursDe(course))) || JSON.stringify(cols) !== JSON.stringify(course.cols ?? [])
  const epreuve = course.epreuve ?? epreuveDe(contexte.discipline, contexte.typeCourse)
  return (
    <div className="rounded-xl border border-accent p-3">
      <div className="flex items-center gap-2.5">
        <Pastille niveau="A" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{course.nom}</p>
          <p className="text-xs text-texte-2">{dateCourte(course.date)} · {NOMS_EPREUVES[epreuve]} · ≈ {heures(dureeDeCourse({ ...course, ...champsParcours(parcours), epreuve }, contexte))}</p>
        </div>
        {onRetirer && <BoutonSupprimer nom={course.nom} onSupprimer={onRetirer} />}
      </div>
      <div className="mt-2">
        <ChampsParcours key={cle} epreuve={epreuve} valeur={parcours} onChanger={setParcours} contexte={contexte} />
      </div>
      {epreuve !== 'xcc' && <div className="mt-2"><EditeurCols cols={cols} onChanger={setCols} /></div>}
      {change && (
        <button type="button" className="mt-2 w-full rounded-xl bg-accent py-2.5 font-bold text-fond"
          onClick={() => { onChanger({ date: course.date, nom: course.nom, niveau: 'A', epreuve, ...champsParcours(parcours), ...(cols.length ? { cols } : {}) }); setCle(cle + 1) }}>Enregistrer</button>
      )}
      {!change && <CiblesCols course={course} contexte={contexte} />}
      <p className="mt-1.5 text-xs text-texte-3">Ta saison est construite autour de cette course (sa date ne se change pas ici).</p>
    </div>
  )
}

/**
 * Tes autres courses (B importante, C pour s'entraîner) : la liste, et une feuille pour en ajouter ou en modifier une.
 * `courses` : toutes les courses (la A comprise, gardée telle quelle). `effectifs` : niveau appliqué par l'appli (une B
 * trop proche de la A, d'une autre B ou en reprise compte comme une C).
 */
export function ListeCourses({ courses, effectifs, onChanger, min, contexte, principale }: {
  courses: Competition[]; effectifs: Map<string, NiveauCourse>; onChanger: (c: Competition[]) => void; min?: string; contexte: Contexte
  /** Date de la course principale (affichée à part) */
  principale?: string
}) {
  // undefined : feuille fermée ; null : ajout ; une course : modification
  const [feuille, setFeuille] = useState<Competition | null>()
  const autres = [...courses].filter((c) => c.date !== principale).sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div>
      {autres.length === 0 && <p className="text-sm text-texte-2">Aucune pour l’instant.</p>}
      <ul>
        {autres.map((c) => {
          const n = effectifs.get(c.date) ?? c.niveau ?? 'B'
          const declasse = (c.niveau === 'B' && n === 'C') || (c.niveau === 'A' && n !== 'A')
          return (
            <li key={c.date + c.nom} className="flex items-center border-b border-bordure">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left" aria-label={`Modifier ${c.nom}`} onClick={() => setFeuille(c)}>
                <Pastille niveau={n} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{c.nom}</span>
                  <span className="block text-xs text-texte-3">{dateCourte(c.date)} · {resumeParcours(c, contexte)}</span>
                  <span className="block text-xs text-texte-3">{declasse ? (c.niveau === 'A' ? 'moins de 3 semaines après une autre A (ou plus de 4 A) : comptée comme une B' : 'trop proche d’une autre course ou en reprise : comptée comme une C') : NOTES[n]}</span>
                </span>
                <span className="text-texte-3">›</span>
              </button>
              <BoutonSupprimer nom={c.nom} onSupprimer={() => onChanger(courses.filter((x) => x !== c))} />
            </li>
          )
        })}
      </ul>
      <button type="button" className="mt-2 w-full rounded-xl border border-dashed border-accent py-2.5 font-bold text-accent" onClick={() => setFeuille(null)}>+ Ajouter une course</button>
      {feuille !== undefined && (
        <Feuille titre={feuille ? `Modifier « ${feuille.nom} »` : 'Ajouter une course'} onFermer={() => setFeuille(undefined)}>
          <FormulaireCourse course={feuille ?? undefined} min={min} contexte={contexte}
            dateDejaPrise={(d) => courses.some((x) => x.date === d && x !== feuille)}
            onValider={(c) => { onChanger(feuille ? courses.map((x) => (x === feuille ? c : x)) : [...courses, c]); setFeuille(undefined) }}
            onRetirer={feuille ? () => { onChanger(courses.filter((x) => x !== feuille)); setFeuille(undefined) } : undefined} />
        </Feuille>
      )}
    </div>
  )
}

/** Formulaire d'une course B ou C (dans la feuille). */
function FormulaireCourse({ course, min, contexte, dateDejaPrise, onValider, onRetirer }: {
  course?: Competition; min?: string; contexte: Contexte; dateDejaPrise: (d: string) => boolean; onValider: (c: Competition) => void; onRetirer?: () => void
}) {
  const [f, setF] = useState({
    date: course?.date ?? '', nom: course?.nom ?? '', niveau: (course?.niveau === 'C' || course?.niveau === 'A' ? course.niveau : 'B') as NiveauCourse,
    epreuve: course?.epreuve ?? epreuveDe(contexte.discipline, contexte.typeCourse), parcours: parcoursDe(course),
    cols: course?.cols ?? [],
  })
  return (
    <div>
      <div className="flex gap-2">
        <input type="date" min={min} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`${champ} w-36`} />
        <input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Nom" className={`${champ} flex-1`} />
      </div>
      <p className="mt-3 text-xs text-texte-3">Discipline</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(Object.keys(NOMS_EPREUVES) as Epreuve[]).map((e) => (
          <button key={e} type="button" className={puce(f.epreuve === e)} onClick={() => setF({ ...f, epreuve: e })}>{NOMS_EPREUVES[e]}</button>
        ))}
      </div>
      <div className="mt-3">
        <ChampsParcours epreuve={f.epreuve} valeur={f.parcours} onChanger={(parcours) => setF({ ...f, parcours })} contexte={contexte} />
      </div>
      {f.epreuve !== 'xcc' && <div className="mt-3"><EditeurCols cols={f.cols} onChanger={(cols) => setF({ ...f, cols })} /></div>}
      <p className="mt-3 text-xs text-texte-3">Niveau</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button type="button" className={puce(f.niveau === 'A')} onClick={() => setF({ ...f, niveau: 'A' })}>A · objectif</button>
        <button type="button" className={puce(f.niveau === 'B')} onClick={() => setF({ ...f, niveau: 'B' })}>B · importante</button>
        <button type="button" className={puce(f.niveau === 'C')} onClick={() => setF({ ...f, niveau: 'C' })}>C · pour s’entraîner</button>
      </div>
      <p className="mt-1.5 text-xs text-texte-3">A : à fond, avec affûtage avant et récupération après ; entre deux A, l’appli adapte le bloc à l’écart (3 semaines au moins, 4 A au plus). B : semaine allégée d’un tiers, la course est ta séance dure. C : semaine normale, la course remplace ta séance dure (ou ta sortie longue au-delà de 2 h).</p>
      <button type="button" disabled={!f.date || !f.nom.trim() || dateDejaPrise(f.date)}
        className="mt-3 w-full rounded-xl bg-accent py-3 font-bold text-fond disabled:opacity-40"
        onClick={() => onValider({ date: f.date, nom: f.nom.trim(), niveau: f.niveau, epreuve: f.epreuve, ...champsParcours(f.parcours), ...(f.cols.length ? { cols: f.cols } : {}) })}>
        {course ? 'Enregistrer' : 'Ajouter'}
      </button>
      {onRetirer && <button type="button" className="mt-1 w-full py-2.5 text-sm text-mauvais" onClick={onRetirer}>Retirer cette course</button>}
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
    <div className="mt-1">
      <p className="text-xs text-texte-3">Route : {texte(facteurs.route)} · VTT : {texte(facteurs.vtt)}. Calée sur tes 3 dernières courses faites{auto ? ` (dont ${auto} importée${auto > 1 ? 's' : ''} de ta montre)` : ''} : elle se recale toute seule après chaque course prévue.</p>
      <ul>
        {refs.map((x, i) => (
          <li key={i} className="flex items-center justify-between gap-2 py-1 text-xs text-texte-2">
            <span>{NOMS_EPREUVES[x.epreuve]} · {virgule(x.distanceKm)} km · {x.deniveleM} m · {heures(x.dureeMin)}</span>
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
              onChanger([...refs, { epreuve: f.epreuve, distanceKm: distanceKm!, deniveleM: Math.round(nombre(f.denivele) ?? 0), dureeMin: Math.round(dureeMin), date: aujourdhui() }])
              setF({ epreuve: f.epreuve, distance: '', denivele: '', h: '', min: '' })
              setOuvert(false)
            }}>Caler</button>
        </div>
      )}
    </div>
  )
}

/** Cols du parcours (option) : longueur, pente, position. Ils règlent les montées de ta préparation et tes watts cibles. */
export function EditeurCols({ cols, onChanger }: { cols: Col[]; onChanger: (c: Col[]) => void }) {
  const [f, setF] = useState({ km: '', pente: '', a: '' })
  const ok = nombre(f.km) && nombre(f.pente)
  return (
    <div>
      <p className="text-xs text-texte-3">Cols (option) : ils calent tes montées en fin de prépa et tes watts cibles</p>
      <ul>
        {cols.map((c, i) => (
          <li key={i} className="flex items-center justify-between py-0.5 text-xs text-texte-2">
            <span>Col {i + 1} · {virgule(c.longueurKm)} km à {virgule(c.pentePct)} %{c.aKm !== undefined ? ` · au km ${c.aKm}` : ''}</span>
            <button type="button" className="min-h-9 min-w-9 px-2 text-lg text-texte-3" aria-label={`Retirer le col ${i + 1}`} onClick={() => onChanger(cols.filter((_, k) => k !== i))}>×</button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-end gap-1.5 text-[11px] text-texte-3">
        <label className="flex-1">Longueur (km)<input inputMode="decimal" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} className={`${champ} mt-0.5 block w-full`} /></label>
        <label className="flex-1">Pente (%)<input inputMode="decimal" value={f.pente} onChange={(e) => setF({ ...f, pente: e.target.value })} className={`${champ} mt-0.5 block w-full`} /></label>
        <label className="flex-1">Au km<input inputMode="decimal" value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} className={`${champ} mt-0.5 block w-full`} /></label>
        <button type="button" disabled={!ok} className="h-11 w-11 shrink-0 rounded-lg bg-accent text-xl font-bold text-fond disabled:opacity-40"
          onClick={() => { onChanger([...cols, { longueurKm: nombre(f.km)!, pentePct: nombre(f.pente)!, ...(nombre(f.a) !== undefined ? { aKm: nombre(f.a) } : {}) }]); setF({ km: '', pente: '', a: '' }) }}>+</button>
      </div>
    </div>
  )
}

/** Watts cibles de chaque col pour faire la course à 100 % théorique. */
export function CiblesCols({ course, contexte }: { course: Competition; contexte: Contexte }) {
  if (!course.cols?.length || !contexte.cpW) return null
  const cibles = ciblesCols({ cols: course.cols, distanceKm: course.distanceKm, dureeMin: dureeDeCourse(course, contexte), cpW: contexte.cpW, wPrimeKj: contexte.wPrimeKj, poidsKg: contexte.poidsKg })
  return (
    <div className="mt-2 rounded-lg bg-surface-2 p-2.5">
      <p className="text-xs font-semibold text-texte-2">Tes watts cibles dans les cols<Aide titre="Watts cibles des cols" texte={AIDES.ciblesCols} /></p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {cibles.map((x) => (
          <li key={x.index} className="flex justify-between gap-2">
            <span className="text-texte-2">Col {x.index + 1} · {virgule(x.col.longueurKm)} km à {virgule(x.col.pentePct)} %{x.dernier ? ' · dernier' : ''}</span>
            <span><b>{x.watts} W</b> <span className="text-texte-3">≈ {heures(x.minutes)}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-texte-3">À plat entre les cols : un peu en dessous (environ 5 %). Seul le dernier col se monte sans garder de réserve.</p>
    </div>
  )
}
