import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { CarteBilan } from '../plan/CarteBilan'
import { lundiDe } from '../seances/donnees'
import { CarteAujourdhui } from '../forme/CarteAujourdhui'
import { CarteBesoins } from '../forme/CarteBesoins'
import { CarteRepas } from '../forme/CarteRepas'
import { CarteCalibration } from '../forme/CarteCalibration'
import { CarteBilanNutrition } from '../forme/CarteBilanNutrition'
import { CarteFcMax } from '../forme/CarteFcMax'
import { CartePanne } from '../forme/CartePanne'
import { CartePesee } from '../forme/CartePesee'
import { CartePlanCampus } from '../forme/CartePlanCampus'
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
  const jourSemaine = new Date(`${aujourdhui()}T12:00:00`).getDay()
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)
  const dateDuJour = new Date(`${aujourdhui()}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-3">
      <p className="text-lg capitalize text-texte-2">{dateDuJour}</p>
      <CarteRemise />
      <CartePlanCampus />
      <CarteResultat />
      <CarteFcMax />
      {/* Le dimanche : bilan de la semaine ; le lundi : celui de la semaine écoulée */}
      {jourSemaine === 0 && <CarteBilan lundi={lundiDe(aujourdhui())} />}
      {jourSemaine === 1 && <CarteBilan lundi={decalerJour(lundiDe(aujourdhui()), -7)} />}
      {complet && !edition ? (
        <>
          <CarteAujourdhui />
          <ResumeMatin mesure={duJour!} onModifier={() => setEdition(true)} />
        </>
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}
      <CarteRepas />
      <CarteBilanNutrition />
      <CarteBesoins />
      <CarteCalibration />
      <CartePanne />
      <CartePesee />
    </div>
  )
}
