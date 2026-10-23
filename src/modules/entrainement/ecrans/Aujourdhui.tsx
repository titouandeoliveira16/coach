import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { CarteAujourdhui } from '../forme/CarteAujourdhui'
import { CartePanne } from '../forme/CartePanne'
import { CartePesee } from '../forme/CartePesee'
import { CarteRemise } from '../forme/CarteRemise'
import { CarteResultat } from '../forme/CarteResultat'
import { ResumeMatin } from '../forme/ResumeMatin'
import { SaisieMatin } from '../forme/SaisieMatin'
import { QUESTIONS, mesuresRecentes } from '../forme/donnees'

/** Aujourd'hui : saisie du matin → feu du jour → séance du jour. */
export function Aujourdhui() {
  const recentes = useLiveQuery(() => mesuresRecentes(1))
  const [edition, setEdition] = useState(false)

  if (!recentes) return null
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)
  const dateDuJour = new Date(`${aujourdhui()}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-3">
      <p className="text-lg capitalize text-texte-2">{dateDuJour}</p>
      <CarteRemise />
      <CarteResultat />
      {complet && !edition ? (
        <>
          <CarteAujourdhui />
          <ResumeMatin mesure={duJour!} onModifier={() => setEdition(true)} />
        </>
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}
      <CartePanne />
      <CartePesee />
    </div>
  )
}
