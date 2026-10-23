import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { enregistrer, supprimer } from '../../../core/stockage'
import { aujourdhui, jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'

/** Poids : une ligne avec la dernière pesée ; on se pèse quand on veut (toucher pour saisir ou effacer). */
export function CartePesee() {
  const [profil, modifierProfil] = useProfil()
  const dernieres = useLiveQuery(() => db.pesees.orderBy('date').reverse().limit(2).toArray())
  const [poids, setPoids] = useState<number>()
  const [ouverte, setOuverte] = useState(false)

  if (!dernieres) return null
  const [derniere, precedente] = dernieres
  const duJour = derniere?.date === aujourdhui() ? derniere : undefined
  const ecart = derniere && precedente ? derniere.poidsKg - precedente.poidsKg : undefined

  if (!ouverte) {
    return (
      <button type="button" onClick={() => setOuverte(true)} className="flex w-full items-center justify-between rounded-2xl border border-bordure bg-surface px-4 py-3">
        <span className="text-texte-2">⚖️ Poids</span>
        <span>
          <span className="font-semibold">{derniere ? `${formatNombre(derniere.poidsKg, 1)} kg` : 'Me peser'}</span>
          {ecart !== undefined && <span className="ml-2 text-sm text-texte-3">{ecart > 0 ? '+' : ''}{formatNombre(ecart, 1)}</span>}
          {derniere && <span className="ml-2 text-xs text-texte-3">{jourCourt(derniere.date)}</span>}
        </span>
      </button>
    )
  }

  const kg = poids ?? duJour?.poidsKg ?? profil.poidsKg
  return (
    <Carte titre="⚖️ Pesée du jour">
      <p className="mb-1 text-xs text-texte-3">Le matin, à jeun, après être passé aux toilettes.</p>
      <ChampNombre libelle="Poids" unite="kg" valeur={kg} onValider={setPoids} />
      <Bouton className="mt-2" disabled={!kg} onClick={async () => {
        if (!kg) return
        await enregistrer(db.pesees, { date: aujourdhui(), poidsKg: kg })
        await modifierProfil({ poidsKg: kg })
        setOuverte(false)
      }}>Enregistrer</Bouton>
      {duJour && (
        <button type="button" className="mt-1 w-full py-2 text-sm text-[#f87171]" onClick={async () => {
          await supprimer(db.pesees, duJour.date)
          setOuverte(false)
        }}>Supprimer la pesée d'aujourd'hui</button>
      )}
      <button type="button" className="w-full py-2 text-sm text-texte-3" onClick={() => setOuverte(false)}>Fermer</button>
    </Carte>
  )
}
