import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { depuisJour } from '../../../core/dates'
import { formatMinSec, formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Puces } from '../../../core/ui/Puces'
import { allureSecKm } from '../../../metrics/course'
import { AIDES } from '../aides'
import { chargeDe, chargerContexte, lundiDe } from '../seances/donnees'
import type { Seance } from '../types'

const FILTRES = ['Tous', 'Vélo', 'Course'] as const
type Filtre = (typeof FILTRES)[number]

/** Durée en "1 h 05" ou "45 min". */
export function formatDuree(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

/** Historique des séances, groupées par semaine, avec filtre par sport et totaux. */
export function Historique() {
  const [filtre, setFiltre] = useState<Filtre>('Tous')
  const seances = useLiveQuery(() => db.seances.orderBy('date').reverse().toArray())
  const contexte = useLiveQuery(chargerContexte)
  if (!seances || !contexte) return null

  const visibles = seances.filter((s) => filtre === 'Tous' || (filtre === 'Vélo' ? s.sport === 'velo' : s.sport === 'course'))
  const semaines = new Map<string, Seance[]>()
  for (const s of visibles) {
    const l = lundiDe(s.date)
    semaines.set(l, [...(semaines.get(l) ?? []), s])
  }

  return (
    <div className="space-y-3">
      <Puces options={FILTRES} valeur={filtre} onChoisir={(f) => setFiltre(f ?? 'Tous')} effacable={false} />

      {visibles.length === 0 && (
        <Carte>
          <p className="text-texte-2">Aucune séance pour l'instant.</p>
          <p className="mt-1 text-sm text-texte-3">Touche le bouton « + » pour en ajouter une, ou importe un fichier .FIT.</p>
        </Carte>
      )}

      {[...semaines].map(([lundi, liste]) => {
        const duree = liste.reduce((a, s) => a + s.dureeSec, 0)
        const kj = liste.reduce((a, s) => a + (s.kj ?? 0), 0)
        const charge = liste.reduce((a, s) => a + chargeDe(s, contexte), 0)
        return (
          <section key={lundi}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold text-texte-2">
                Semaine du {depuisJour(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </h2>
              <p className="text-xs text-texte-3">
                {formatDuree(duree)}{kj > 0 && ` · ${formatNombre(kj)} kJ`} · {Math.round(charge)} {contexte.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE'}
                <Aide titre={contexte.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE'} texte={contexte.chargeRef === 'trimp' ? AIDES.trimp : AIDES.srpe} />
              </p>
            </div>
            <div className="space-y-2">
              {liste.map((s) => <CarteSeance key={s.id} s={s} charge={chargeDe(s, contexte)} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function CarteSeance({ s, charge }: { s: Seance; charge: number }) {
  const details = [
    formatDuree(s.dureeSec),
    s.distanceKm && `${formatNombre(s.distanceKm, 1)} km`,
    s.sport === 'course' && s.distanceKm && `${formatMinSec(allureSecKm(s.distanceKm, s.dureeSec))}/km`,
    s.sport === 'velo' && s.kj && `${s.kj} kJ`,
    s.deniveleM && `${s.deniveleM} m D+`,
  ].filter(Boolean)
  return (
    <Link to={`/entrainement/seance/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-bordure bg-surface p-3 active:bg-surface-2">
      <span className="text-2xl">{s.sport === 'velo' ? (s.homeTrainer ? '🏠' : '🚴') : '🏃'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {s.titre ?? s.type ?? (s.sport === 'velo' ? 'Vélo' : 'Course')}
          {s.source !== 'manuel' && <span className="ml-1.5 text-xs font-normal text-texte-3">{s.source === 'fit' ? '.FIT' : 'Intervals'}</span>}
        </span>
        <span className="block text-sm text-texte-3">
          <span className="capitalize">{depuisJour(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span> · {details.join(' · ')}
        </span>
      </span>
      <span className="text-right">
        {s.rpe !== undefined && (
          <span className={`block text-sm font-bold ${s.rpe < 3 ? 'text-nutrition' : s.rpe >= 7.5 ? 'text-[#f87171]' : 'text-texte'}`}>RPE {formatNombre(s.rpe, 1)}</span>
        )}
        <span className="block text-xs text-texte-3">{Math.round(charge)}</span>
      </span>
    </Link>
  )
}
