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
import { BandeauAVoir } from '../forme/BandeauAVoir'
import { QUESTIONS, mesuresRecentes } from '../forme/donnees'

/** Hauteur pour remplir l'écran jusqu'à la barre du bas, recalculée si l'écran change. */
function useHauteurEcran(pret: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number>()
  const [bas, setBas] = useState(112)
  useEffect(() => {
    const calculer = () => {
      if (!ref.current) return
      const haut = ref.current.getBoundingClientRect().top + window.scrollY
      // Barre du bas fixe : on s'arrête juste au-dessus (8 px d'air)
      const barre = ([...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed')?.getBoundingClientRect().height ?? 104) + 8
      setBas(barre)
      setH(Math.max(0, window.innerHeight - haut - barre))
    }
    calculer()
    window.addEventListener('resize', calculer)
    return () => window.removeEventListener('resize', calculer)
  }, [pret])
  return { ref, h, bas }
}

/** Aujourd'hui sur un seul écran : ta forme, la séance (la plus grande), la nutrition, puis pesée et imprévu en bas.
 *  Les cartes se partagent toute la hauteur ; ce qu'on ouvre prend sa place, et la page ne défile qu'ensuite. */
export function Aujourdhui() {
  const recentes = useLiveQuery(() => mesuresRecentes(1))
  const [edition, setEdition] = useState(false)
  const { ref, h, bas } = useHauteurEcran(recentes !== undefined)

  if (!recentes) return null
  const jourSemaine = new Date(`${aujourdhui()}T12:00:00`).getDay()
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)

  return (
    <div ref={ref} className="flex flex-col gap-2.5 overflow-y-auto" style={h ? { height: h, marginBottom: bas - 112 } : undefined}>
      {/* (la coquille réserve 112 px sous le contenu : la marge négative les ramène à la hauteur de la barre, la page ne défile pas) */}
      {/* Cartes ponctuelles : un seul bandeau qui les ouvre */}
      <BandeauAVoir>
        <CarteRemise />
        <CartePlanCampus />
        <CarteResultat />
        <CarteFcMax />
        <CarteCpEnHausse />
        <CarteHorsPlan />
        {/* Le dimanche : bilan de la semaine ; le lundi : celui de la semaine écoulée */}
        {jourSemaine === 0 && <CarteBilan lundi={lundiDe(aujourdhui())} />}
        {jourSemaine === 1 && <CarteBilan lundi={decalerJour(lundiDe(aujourdhui()), -7)} />}
        <CarteBilanNutrition />
        <CarteCalibration />
      </BandeauAVoir>
      {complet && !edition ? (
        <CarteAujourdhui onModifierMatin={() => setEdition(true)} />
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}
      <CarteNutrition />
      {/* En bas : pesée et imprévu sur une ligne */}
      <div className="flex shrink-0 gap-2">
        <CartePesee compact />
        <CartePanne compact />
      </div>
    </div>
  )
}
