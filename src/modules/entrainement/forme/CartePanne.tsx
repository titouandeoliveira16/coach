import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { declarerPanneVelo, panneEnCours, veloRepare } from '../plan/imprevus'

const jourLong = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })

/** Imprévu : vélo en panne. L'appli annule le vélo de ces jours-là et rallonge un peu le footing facile qui suit. */
export function CartePanne() {
  const panne = useLiveQuery(async () => (await panneEnCours()) ?? null)
  const [ouverte, setOuverte] = useState(false)
  const [au, setAu] = useState(aujourdhui())
  const [bilan, setBilan] = useState<string[]>()
  const [occupe, setOccupe] = useState(false)
  if (panne === undefined) return null

  if (bilan)
    return (
      <Carte titre="🔧 Programme adapté">
        <ul className="space-y-1 text-sm">{bilan.map((b, i) => <li key={i}>• {b}</li>)}</ul>
        <button type="button" onClick={() => setBilan(undefined)} className="mt-2 text-sm text-texte-3">OK</button>
      </Carte>
    )

  if (panne)
    return (
      <div className="flex items-center justify-between rounded-2xl border border-[#fb923c]/50 bg-[#fb923c]/10 px-4 py-3 text-sm">
        <span>🔧 Vélo en panne jusqu'au {jourLong(panne.au)}</span>
        <button type="button" className="font-semibold text-accent" onClick={() => veloRepare()}>Il remarche</button>
      </div>
    )

  return (
    <>
      <button type="button" onClick={() => setOuverte(true)} className="w-full rounded-2xl border border-bordure bg-surface px-4 py-3 text-left text-sm text-texte-2">
        🔧 Un imprévu ? Vélo en panne…
      </button>
      {ouverte && (
        <Feuille titre="Vélo en panne" onFermer={() => setOuverte(false)}>
          <p className="text-sm text-texte-2">Jusqu'à quand (inclus) ?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((n) => {
              const d = decalerJour(aujourdhui(), n)
              return (
                <button key={n} type="button" onClick={() => setAu(d)}
                  className={`rounded-xl border py-2 text-sm font-semibold ${au === d ? 'border-accent bg-accent text-fond' : 'border-bordure text-texte-2'}`}>
                  {n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : 'Après-demain'}
                </button>
              )
            })}
          </div>
          <label className="mt-2 flex items-center justify-between text-sm text-texte-2">
            Autre date
            <input type="date" value={au} min={aujourdhui()} onChange={(e) => e.target.value && setAu(e.target.value)} className="rounded-lg border border-bordure bg-surface-2 px-2 py-2" />
          </label>
          <p className="mt-3 text-xs text-texte-3">
            Le vélo de ces jours-là est annulé (l'intensité est déplacée après la réparation si possible). Le footing facile qui suit est rallongé de 15 min au plus, pour compenser sans risque.
          </p>
          <Bouton className="mt-3" disabled={occupe} onClick={async () => {
            setOccupe(true)
            const phrases = await declarerPanneVelo(aujourdhui(), au)
            setOccupe(false)
            setOuverte(false)
            setBilan(phrases.length ? phrases : ['Aucune séance vélo prévue ces jours-là : rien à changer.'])
          }}>Adapter mon programme</Bouton>
        </Feuille>
      )}
    </>
  )
}
