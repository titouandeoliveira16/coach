import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { CarteBilan } from '../plan/CarteBilan'
import { lundiDe } from '../seances/donnees'
import { CarteAujourdhui } from '../forme/CarteAujourdhui'
import { CarteNutrition } from '../forme/CarteNutrition'
import { CarteCalibration } from '../forme/CarteCalibration'
import { CarteCpEnHausse } from '../forme/CarteCpEnHausse'
import { CarteHorsPlan } from '../forme/CarteHorsPlan'
import { CarteBilanNutrition } from '../forme/CarteBilanNutrition'
import { CarteFcMax } from '../forme/CarteFcMax'
import { CartePanne } from '../forme/CartePanne'
import { CartePesee } from '../forme/CartePesee'
import { CartePlanCampus } from '../forme/CartePlanCampus'
import { CarteRemise } from '../forme/CarteRemise'
import { CarteResultat } from '../forme/CarteResultat'
import { SaisieMatin } from '../forme/SaisieMatin'
import { QUESTIONS, mesuresRecentes } from '../forme/donnees'

/** Hauteur pour remplir l'écran jusqu'à la barre du bas (112 px réservés par la coquille), recalculée si l'écran change. */
function useHauteurEcran(pret: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number>()
  useEffect(() => {
    const calculer = () => {
      if (!ref.current) return
      const haut = ref.current.getBoundingClientRect().top + window.scrollY
      setH(Math.max(0, window.innerHeight - haut - 112))
    }
    calculer()
    window.addEventListener('resize', calculer)
    return () => window.removeEventListener('resize', calculer)
  }, [pret])
  return { ref, h }
}

/** Aujourd'hui sur un seul écran : ta forme, la séance (la plus grande), la nutrition, puis pesée et imprévu en bas.
 *  Les cartes se partagent toute la hauteur ; ce qu'on ouvre prend sa place, et la page ne défile qu'ensuite. */
export function Aujourdhui() {
  const recentes = useLiveQuery(() => mesuresRecentes(1))
  const [edition, setEdition] = useState(false)
  const { ref, h } = useHauteurEcran(recentes !== undefined)

  if (!recentes) return null
  const jourSemaine = new Date(`${aujourdhui()}T12:00:00`).getDay()
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)
  const dateDuJour = new Date(`${aujourdhui()}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div ref={ref} className="flex flex-col gap-3" style={h ? { minHeight: h } : undefined}>
      <p className="text-lg capitalize text-texte-2">{dateDuJour}</p>
      <CarteRemise />
      <CartePlanCampus />
      <CarteResultat />
      <CarteFcMax />
      <CarteCpEnHausse />
      <CarteHorsPlan />
      {/* Le dimanche : bilan de la semaine ; le lundi : celui de la semaine écoulée */}
      {jourSemaine === 0 && <CarteBilan lundi={lundiDe(aujourdhui())} />}
      {jourSemaine === 1 && <CarteBilan lundi={decalerJour(lundiDe(aujourdhui()), -7)} />}
      {complet && !edition ? (
        <CarteAujourdhui onModifierMatin={() => setEdition(true)} />
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}
      <CarteNutrition />
      <CarteBilanNutrition />
      <CarteCalibration />
      {/* En bas : pesée et imprévu sur une ligne (la marge à droite laisse la place au bouton +) */}
      <div className="flex gap-2 pr-[76px]">
        <CartePesee compact />
        <CartePanne compact />
      </div>
    </div>
  )
}
