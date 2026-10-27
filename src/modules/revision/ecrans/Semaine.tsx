import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour, ecartJours } from '../../../core/dates'
import { useParametres, useRevision } from '../donnees'
import { NOMS_PERIODES, capacite, creneauxDu, dureeRappel, periodeDu, placerRappels, projection, type Periode } from '../programme'
import { LIBELLES_CRENEAUX } from '../ui'

/** Lundi de la semaine d'un jour */
const lundiDe = (j: string) => decalerJour(j, -((depuisJour(j).getDay() + 6) % 7))

const COULEURS_PERIODES: Record<Periode, string> = {
  vacances: '#4ade80', cours: '#60a5fa', sujets: '#e879f9', 'sujets-vacances': '#c084fc', derniere: '#fb923c', repos: '#94a3b8', veille: '#facc15', concours: '#f87171',
}

/** La semaine : période de chaque jour, notion prévue, minutes de rappels, créneaux. */
export function Semaine() {
  const d = useRevision()
  const [p] = useParametres()
  const jour = aujourdhui()
  const [lundi, setLundi] = useState(lundiDe(jour))
  if (!d) return null
  const finieAujourdhui = d.notions.some((n) => n.j0 === jour)
  const { parJour } = projection(d.notions, jour, p, finieAujourdhui)
  const plan = placerRappels(d.rappels, jour, p, Math.max(7, ecartJours(jour, decalerJour(lundi, 7))))
  const jours = Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i))

  return (
    <div className="space-y-2 pb-4">
      <div className="flex items-center justify-between py-1">
        <button type="button" onClick={() => setLundi(decalerJour(lundi, -7))} className="px-4 py-2 text-2xl text-texte-2" aria-label="Semaine précédente">‹</button>
        <p className="font-semibold">Semaine du {depuisJour(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
        <button type="button" onClick={() => setLundi(decalerJour(lundi, 7))} className="px-4 py-2 text-2xl text-texte-2" aria-label="Semaine suivante">›</button>
      </div>
      {jours.map((j) => {
        const per = periodeDu(j, p)
        const passe = j < jour
        const notion = parJour.get(j)
        const finie = d.notions.find((n) => n.j0 === j)
        const rappels = passe ? d.rappels.filter((r) => r.fait === j) : (plan.get(j) ?? [])
        const minutes = rappels.reduce((s, r) => s + dureeRappel(r), 0)
        const creneaux = creneauxDu(j, p, !!notion)
        return (
          <section key={j} className={`rounded-2xl border bg-surface p-3 ${j === jour ? 'border-accent' : 'border-bordure'} ${passe ? 'opacity-60' : ''}`}
            style={{ borderLeft: `4px solid ${COULEURS_PERIODES[per]}` }}>
            <div className="flex items-baseline justify-between">
              <p className="font-semibold capitalize">{depuisJour(j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</p>
              <p className="text-xs" style={{ color: COULEURS_PERIODES[per] }}>{NOMS_PERIODES[per]}</p>
            </div>
            {finie ? <p className="text-sm">✅ {finie.nom}</p> : notion && <p className="text-sm">📖 {notion.nom}</p>}
            <p className="text-sm text-texte-2">
              🔁 {passe ? `${rappels.length} rappel${rappels.length > 1 ? 's' : ''} fait${rappels.length > 1 ? 's' : ''}` : `${minutes} min de rappels prévues`}
              <span className="text-texte-3"> · capacité {capacite(j, p)} min</span>
            </p>
            {!passe && (
              <p className="mt-1 text-xs leading-relaxed text-texte-3">
                {creneaux.filter((c) => c.type !== 'libre').map((c) => `${c.debut.replace(':', 'h')} ${LIBELLES_CRENEAUX[c.type](c)}`).join(' · ')}
              </p>
            )}
          </section>
        )
      })}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-texte-2">
        {(Object.keys(COULEURS_PERIODES) as Periode[]).map((k) => <span key={k}><span style={{ color: COULEURS_PERIODES[k] }}>■</span> {NOMS_PERIODES[k]}</span>)}
      </div>
    </div>
  )
}
