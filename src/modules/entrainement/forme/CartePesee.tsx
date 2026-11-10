import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { Feuille } from '../../../core/ui/Feuille'
import { effacerPesee, enregistrerPesee, lireSansPesee, marquerSansPesee, peseesValides } from './pesees'

/** Saisie de la pesée du jour dans une feuille qui monte du bas (ouverte depuis la tuile Poids d'Aujourd'hui). */
export function FeuillePesee({ onFermer }: { onFermer: () => void }) {
  const [profil] = useProfil()
  const dernieres = useLiveQuery(peseesValides)
  const sansPesee = useLiveQuery(async () => (await lireSansPesee()).includes(aujourdhui()))
  const [poids, setPoids] = useState<number>()
  if (!dernieres || sansPesee === undefined) return null
  const duJour = dernieres[0]?.date === aujourdhui() ? dernieres[0] : undefined
  const kg = poids ?? duJour?.poidsKg ?? dernieres[0]?.poidsKg ?? profil.poidsKg
  return (
    <Feuille titre="Pesée du jour" onFermer={onFermer}>
      <p className="mb-1 text-xs text-texte-3">Le matin, à jeun, après être passé aux toilettes.</p>
      <ChampNombre libelle="Poids" unite="kg" valeur={kg} onValider={setPoids} />
      <Bouton className="mt-2" disabled={!kg} onClick={async () => {
        if (!kg) return
        if (sansPesee) await marquerSansPesee(aujourdhui(), false)
        await enregistrerPesee(aujourdhui(), kg)
        onFermer()
      }}>Enregistrer</Bouton>
      {duJour ? (
        <button type="button" className="mt-1 w-full py-2 text-sm text-mauvais" onClick={async () => {
          await effacerPesee(duJour.date)
          onFermer()
        }}>Supprimer la pesée d'aujourd'hui</button>
      ) : (
        <button type="button" className="mt-1 w-full py-2 text-sm text-texte-2" onClick={async () => {
          await marquerSansPesee(aujourdhui(), !sansPesee)
          onFermer()
        }}>{sansPesee ? 'Annuler « pas de pesée »' : 'Pas de pesée aujourd’hui'}</button>
      )}
      <button type="button" className="w-full py-2 text-sm text-texte-3" onClick={onFermer}>Fermer</button>
    </Feuille>
  )
}

/** Poids : une ligne avec la dernière pesée ; on se pèse quand on veut (toucher pour saisir ou effacer). */
export function CartePesee({ compact = false }: { compact?: boolean } = {}) {
  const [profil] = useProfil()
  const dernieres = useLiveQuery(peseesValides)
  const sansPesee = useLiveQuery(async () => (await lireSansPesee()).includes(aujourdhui()))
  const [poids, setPoids] = useState<number>()
  const [ouverte, setOuverte] = useState(false)

  if (!dernieres || sansPesee === undefined) return null
  const [derniere, precedente] = dernieres
  const duJour = derniere?.date === aujourdhui() ? derniere : undefined
  const ecart = derniere && precedente ? derniere.poidsKg - precedente.poidsKg : undefined

  const bouton = 'min-h-12 flex-1 whitespace-nowrap rounded-xl border px-1 text-[13px] font-semibold'
  // Version compacte (bas de l'écran Aujourd'hui) : deux boutons, la saisie monte du bas
  if (compact && !ouverte) {
    if (sansPesee)
      return (
        <button type="button" className={`${bouton} border-bordure bg-surface text-texte-3`} onClick={() => marquerSansPesee(aujourdhui(), false)}>
          Pas de pesée ✓ <span className="font-normal underline">annuler</span>
        </button>
      )
    return (
      <>
        <button type="button" onClick={() => setOuverte(true)} className={`${bouton} border-bordure bg-surface`}>
          {duJour ? `${formatNombre(duJour.poidsKg, 1)} kg` : 'Me peser'}
        </button>
        {!duJour && (
          <button type="button" onClick={() => marquerSansPesee(aujourdhui(), true)} className={`${bouton} border-mauvais/50 bg-mauvais/10 text-mauvais`}>
            Pas de pesée
          </button>
        )}
      </>
    )
  }

  if (sansPesee && !ouverte) {
    return (
      <div className="flex w-full items-center justify-between rounded-[14px] bg-surface px-4 py-3">
        <span className="text-texte-2">Pas de pesée aujourd'hui</span>
        <button type="button" className="text-sm text-texte-3 underline" onClick={() => marquerSansPesee(aujourdhui(), false)}>Annuler</button>
      </div>
    )
  }

  if (!ouverte) {
    return (
      <div className="space-y-1">
      <button type="button" onClick={() => setOuverte(true)} className="flex w-full items-center justify-between rounded-[14px] bg-surface px-4 py-3">
        <span className="text-texte-2">Poids</span>
        <span>
          <span className="font-semibold">{derniere ? `${formatNombre(derniere.poidsKg, 1)} kg` : 'Me peser'}</span>
          {ecart !== undefined && <span className="ml-2 text-sm text-texte-3">{ecart > 0 ? '+' : ''}{formatNombre(ecart, 1)}</span>}
          {derniere && <span className="ml-2 text-xs text-texte-3">{jourCourt(derniere.date)}</span>}
        </span>
      </button>
      {!duJour && (
        <div className="flex justify-end">
          <button type="button" className="rounded-xl border border-mauvais/50 bg-mauvais/10 px-3.5 py-2 text-sm font-semibold text-mauvais active:opacity-60"
            onClick={() => marquerSansPesee(aujourdhui(), true)}>
            Pas de pesée aujourd'hui
          </button>
        </div>
      )}
      </div>
    )
  }

  const kg = poids ?? duJour?.poidsKg ?? profil.poidsKg
  const contenu = (
    <>
      <p className="mb-1 text-xs text-texte-3">Le matin, à jeun, après être passé aux toilettes.</p>
      <ChampNombre libelle="Poids" unite="kg" valeur={kg} onValider={setPoids} />
      <Bouton className="mt-2" disabled={!kg} onClick={async () => {
        if (!kg) return
        await enregistrerPesee(aujourdhui(), kg)
        setOuverte(false)
      }}>Enregistrer</Bouton>
      {duJour && (
        <button type="button" className="mt-1 w-full py-2 text-sm text-mauvais" onClick={async () => {
          await effacerPesee(duJour.date)
          setOuverte(false)
        }}>Supprimer la pesée d'aujourd'hui</button>
      )}
      <button type="button" className="w-full py-2 text-sm text-texte-3" onClick={() => setOuverte(false)}>Fermer</button>
    </>
  )
  return compact
    ? <Feuille titre="Pesée du jour" onFermer={() => setOuverte(false)}>{contenu}</Feuille>
    : <Carte titre="Pesée du jour">{contenu}</Carte>
}
