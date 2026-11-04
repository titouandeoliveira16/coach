import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { effacerPesee, enregistrerPesee, lireSansPesee, marquerSansPesee, peseesValides } from './pesees'

/** Poids : une ligne avec la dernière pesée ; on se pèse quand on veut (toucher pour saisir ou effacer). */
export function CartePesee() {
  const [profil] = useProfil()
  const dernieres = useLiveQuery(peseesValides)
  const sansPesee = useLiveQuery(async () => (await lireSansPesee()).includes(aujourdhui()))
  const [poids, setPoids] = useState<number>()
  const [ouverte, setOuverte] = useState(false)

  if (!dernieres || sansPesee === undefined) return null
  const [derniere, precedente] = dernieres
  const duJour = derniere?.date === aujourdhui() ? derniere : undefined
  const ecart = derniere && precedente ? derniere.poidsKg - precedente.poidsKg : undefined

  if (sansPesee && !ouverte) {
    return (
      <div className="flex w-full items-center justify-between rounded-2xl border border-bordure bg-surface px-4 py-3">
        <span className="text-texte-2">⚖️ Pas de pesée aujourd'hui</span>
        <button type="button" className="text-sm text-texte-3 underline" onClick={() => marquerSansPesee(aujourdhui(), false)}>Annuler</button>
      </div>
    )
  }

  if (!ouverte) {
    return (
      <div className="space-y-1">
      <button type="button" onClick={() => setOuverte(true)} className="flex w-full items-center justify-between rounded-2xl border border-bordure bg-surface px-4 py-3">
        <span className="text-texte-2">⚖️ Poids</span>
        <span>
          <span className="font-semibold">{derniere ? `${formatNombre(derniere.poidsKg, 1)} kg` : 'Me peser'}</span>
          {ecart !== undefined && <span className="ml-2 text-sm text-texte-3">{ecart > 0 ? '+' : ''}{formatNombre(ecart, 1)}</span>}
          {derniere && <span className="ml-2 text-xs text-texte-3">{jourCourt(derniere.date)}</span>}
        </span>
      </button>
      {!duJour && (
        <div className="flex justify-end">
          <button type="button" className="rounded-xl border border-[#f87171]/50 bg-[#f87171]/10 px-3.5 py-2 text-sm font-semibold text-[#f87171] active:opacity-60"
            onClick={() => marquerSansPesee(aujourdhui(), true)}>
            ✕ Pas de pesée aujourd'hui
          </button>
        </div>
      )}
      </div>
    )
  }

  const kg = poids ?? duJour?.poidsKg ?? profil.poidsKg
  return (
    <Carte titre="⚖️ Pesée du jour">
      <p className="mb-1 text-xs text-texte-3">Le matin, à jeun, après être passé aux toilettes.</p>
      <ChampNombre libelle="Poids" unite="kg" valeur={kg} onValider={setPoids} />
      <Bouton className="mt-2" disabled={!kg} onClick={async () => {
        if (!kg) return
        await enregistrerPesee(aujourdhui(), kg)
        setOuverte(false)
      }}>Enregistrer</Bouton>
      {duJour && (
        <button type="button" className="mt-1 w-full py-2 text-sm text-[#f87171]" onClick={async () => {
          await effacerPesee(duJour.date)
          setOuverte(false)
        }}>Supprimer la pesée d'aujourd'hui</button>
      )}
      <button type="button" className="w-full py-2 text-sm text-texte-3" onClick={() => setOuverte(false)}>Fermer</button>
    </Carte>
  )
}
