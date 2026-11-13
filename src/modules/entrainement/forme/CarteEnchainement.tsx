import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { Carte } from '../../../core/ui/Carte'
import { clePaire, fusionnerPaire, paireAConfirmer } from '../seances/enchainements'

const heure = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
const jourCourt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })

/** Deux sorties qui se suivent (moins de 30 min d'écart) : les mettre bout à bout ? (13/11/2026 : on demande, plus d'automatique) */
export function CarteEnchainement() {
  const [occupe, setOccupe] = useState(false)
  const refusees = useLiveQuery(async () => ((await db.reglages.get('enchainements-refuses'))?.valeur as { cles: string[] } | undefined)?.cles ?? [])
  const paire = useLiveQuery(async () => (refusees ? (await paireAConfirmer(decalerJour(aujourdhui(), -14), refusees)) ?? null : undefined), [refusees?.join()])
  if (!paire || !refusees) return null
  const [a, b] = paire
  const min = (s: typeof a) => Math.round(s.dureeSec / 60)
  return (
    <Carte titre="Deux sorties à la suite">
      <p className="text-sm text-texte-2">
        {jourCourt(a.date)} : <b className="text-texte">{a.titre ?? 'Sortie'}</b> à {heure(a.debut)} ({min(a)} min{a.kj ? `, ${a.kj} kJ` : ''}) puis <b className="text-texte">{b.titre ?? 'Sortie'}</b> à {heure(b.debut)} ({min(b)} min{b.kj ? `, ${b.kj} kJ` : ''}). C’est la même séance, coupée en deux ?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={occupe} onClick={async () => { setOccupe(true); await fusionnerPaire(a, b); setOccupe(false) }} className="rounded-xl bg-accent py-2.5 font-semibold text-fond">Oui, bout à bout</button>
        <button type="button" onClick={() => enregistrer(db.reglages, { id: 'enchainements-refuses', valeur: { cles: [...refusees, clePaire(a, b)].slice(-50) } })} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Non, deux séances</button>
      </div>
    </Carte>
  )
}
