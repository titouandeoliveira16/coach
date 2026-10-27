import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { formatNombre } from '../../../core/format'
import { enregistrer } from '../../../core/stockage'
import { SEUIL_TENU } from '../plan/blocs'
import { categorieDe, controleFc, questionReserve, texteReserve } from '../plan/controleFc'
import { chargerContexte, domaineDe } from '../seances/donnees'
import { LIBELLES_RPE } from '../seances/FormulaireSeance'
import { Aide } from '../../../core/ui/Aide'
import { AIDES } from '../aides'
import { iconeSport } from '../sports'
import type { Seance } from '../types'

/** Séances faites aujourd'hui : résumé, RPE en un toucher, watts des blocs. */
export function SeancesFaites({ jour }: { jour: string }) {
  const seances = useLiveQuery(() => db.seances.where('date').equals(jour).toArray(), [jour])
  if (!seances?.length) return null
  return (
    <div className="space-y-3">
      {seances.sort((a, b) => (a.debut ?? '').localeCompare(b.debut ?? '')).map((s) => <SeanceFaite key={s.id} s={s} />)}
    </div>
  )
}

const COULEURS = { vert: '#4ade80', orange: '#fb923c', rouge: '#f87171', gris: 'var(--color-texte-3)' }
const PASTILLES = { vert: '✅', orange: '🟠', rouge: '🔴', gris: '❤️' }

function SeanceFaite({ s }: { s: Seance }) {
  const [edition, setEdition] = useState(false)
  const info = useLiveQuery(async () => {
    const prevue = s.prevueId ? await db.prevues.get(s.prevueId) : undefined
    const c = await chargerContexte()
    return { categorie: categorieDe(s, prevue, domaineDe(s, c.bornes)), fcMax: c.fcMax }
  }, [s.id, s.prevueId, s.fcMoy, s.tempsZones?.join()])
  const categorie = info?.categorie
  const verdict = info ? controleFc(s, info.categorie, info.fcMax) : undefined
  const reserve = categorie && (s.sport === 'velo' || s.sport === 'course') ? questionReserve(categorie) : undefined
  const min = Math.round(s.dureeSec / 60)
  const resume = [`${min} min`, s.distanceKm && `${formatNombre(s.distanceKm, 1)} km`, s.kj && `${s.kj} kJ`, s.parties && s.parties > 1 && `${s.parties} parties`].filter(Boolean).join(' · ')
  return (
    <div>
      <p className="font-semibold">✅ Faite · {iconeSport(s.sport)} {s.titre ?? 'Séance'}</p>
      <p className="text-sm text-texte-2">{resume}</p>
      {s.blocs && <Blocs b={s.blocs} />}
      {verdict && <p className="mt-1 text-sm" style={{ color: COULEURS[verdict.couleur] }}>{PASTILLES[verdict.couleur]} {verdict.texte}<Aide titre="Contrôle FC" texte={AIDES.controleFc} /></p>}
      {s.rpe === undefined || edition ? (
        <div className="mt-2">
          <p className="text-sm">Ton ressenti (RPE) ?</p>
          <div className="mt-1 grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" onClick={async () => { await enregistrer(db.seances, { ...s, rpe: n }); setEdition(false) }}
                className={`rounded-md py-2 text-sm font-semibold ${s.rpe === n ? 'bg-accent text-fond' : 'bg-surface text-texte-2'}`}>{n}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-texte-3">0 repos · 3 modéré · 5 dur · 7 très dur · 10 maximal</p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-texte-2">
          RPE <b className="text-texte">{s.rpe}</b> · {LIBELLES_RPE[Math.round(s.rpe)]}
          <button type="button" onClick={() => setEdition(true)} className="ml-2 text-texte-3 underline">modifier</button>
        </p>
      )}
      {s.fcMoy !== undefined && (s.sport === 'velo' || s.sport === 'course') && <CaseCeinture s={s} />}
      {reserve && s.rpe !== undefined && !edition && (
        <div className="mt-2">
          <p className="text-sm">{reserve.question}</p>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {(['ok', 'moyen', 'non'] as const).map((r) => (
              <button key={r} type="button" onClick={() => enregistrer(db.seances, { ...s, reserve: r })}
                className={`rounded-md py-2 text-sm font-semibold ${s.reserve === r ? 'bg-accent text-fond' : 'bg-surface text-texte-2'}`}>{reserve.choix[r]}</button>
            ))}
          </div>
          {s.reserve && <p className="mt-1 text-xs text-texte-3">{texteReserve(categorie!, s.reserve)}</p>}
        </div>
      )}
      <Link to={`/entrainement/seance/${s.id}`} className="mt-1 inline-block text-sm text-accent">Voir la séance ›</Link>
    </div>
  )
}

/** « Pas de ceinture cardio » : la FC (au poignet) n'est ni jugée ni gardée comme FC max. */
function CaseCeinture({ s }: { s: Seance }) {
  return (
    <label className="mt-2 flex items-center gap-2 text-sm text-texte-2">
      <input type="checkbox" checked={!!s.sansCeinture} onChange={(e) => enregistrer(db.seances, { ...s, sansCeinture: e.target.checked || undefined })}
        className="h-5 w-5 accent-[var(--color-accent)]" />
      Pas de ceinture cardio (FC au poignet, pas jugée)
    </label>
  )
}

/** « 4 blocs : 248 · 251 · 246 · 240 W (cible 250) » */
export function Blocs({ b }: { b: NonNullable<Seance['blocs']> }) {
  return (
    <p className="mt-1 text-sm text-texte-2">
      {b.w.length} bloc{b.w.length > 1 ? 's' : ''} de {Math.round(b.dureeSec / 60)} min :{' '}
      {b.w.map((w, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <b style={{ color: w >= SEUIL_TENU * b.cibleW ? '#4ade80' : '#fb923c' }}>{w}</b>
        </span>
      ))}{' '}
      W <span className="text-texte-3">(cible {b.cibleW})</span>
    </p>
  )
}

