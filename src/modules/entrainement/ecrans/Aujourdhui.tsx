import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { CarteBilan, lundiDuBilan } from '../plan/CarteBilan'
import { lireReglagesNutrition } from '../forme/besoins'
import { CarteAujourdhui } from '../forme/CarteAujourdhui'
import { CarteNutrition } from '../forme/CarteNutrition'
import { useNutritionActive } from '../reglages/ProfilSportif'
import { CarteCalibration } from '../forme/CarteCalibration'
import { CarteCpEnHausse } from '../forme/CarteCpEnHausse'
import { CarteHorsPlan } from '../forme/CarteHorsPlan'
import { CarteBilanNutrition } from '../forme/CarteBilanNutrition'
import { CarteFcMax } from '../forme/CarteFcMax'
import { CartePanne } from '../forme/CartePanne'
import { CartePesee } from '../forme/CartePesee'
import { CarteResultat } from '../forme/CarteResultat'
import { SaisieMatin } from '../forme/SaisieMatin'
import { BandeauAVoir } from '../forme/BandeauAVoir'
import { BravoSeance, CarteVictoire } from '../forme/Celebration'
import { QUESTIONS, mesuresRecentes } from '../forme/donnees'

/**
 * Zone de l'écran entre le haut de la page (sous les onglets) et la barre du bas : l'écran Aujourd'hui y est posé
 * en position fixe. Sous lui, la page garde une hauteur plus grande que l'écran : sur iPhone (appli installée), une
 * page qui ne peut pas défiler fait remonter la barre du bas fixe en laissant un vide dessous (comme Semaine, qui
 * défile, la barre reste alors collée en bas). Faire défiler cette page ne déplace rien à l'écran.
 */
function useZoneEcran(pret: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [zone, setZone] = useState<{ haut: number; bas: number }>()
  useEffect(() => {
    const calculer = () => {
      if (!ref.current) return
      const haut = ref.current.getBoundingClientRect().top
      const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed')
      const hautBarre = nav?.getBoundingClientRect().top ?? window.innerHeight - 90
      setZone({ haut, bas: window.innerHeight - hautBarre + 8 })
    }
    window.scrollTo(0, 0)
    calculer()
    window.addEventListener('resize', calculer)
    return () => window.removeEventListener('resize', calculer)
  }, [pret])
  return { ref, zone }
}

/** Aujourd'hui sur un seul écran : ta forme, la séance (la plus grande), la nutrition, puis pesée et imprévu en bas.
 *  Les cartes se partagent toute la hauteur ; ce qu'on ouvre prend sa place, et la page ne défile qu'ensuite. */
export function Aujourdhui() {
  const recentes = useLiveQuery(() => mesuresRecentes(1))
  const [edition, setEdition] = useState(false)
  const [nutriOuverte, setNutriOuverte] = useState(false)
  // Nutrition en option (Réglages → Mon profil sportif → Module nutrition)
  const nutrition = useNutritionActive()
  const { ref, zone } = useZoneEcran(recentes !== undefined)
  // Bilan du dimanche : une fois le bilan nutrition rempli, il quitte Aujourd'hui (rappel le lundi dans Semaine)
  const bilanRempli = useLiveQuery(async () => !!(await lireReglagesNutrition()).bilans?.some((b) => b.date === aujourdhui()))

  if (!recentes) return null
  const jourSemaine = new Date(`${aujourdhui()}T12:00:00`).getDay()
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)

  return (
    <>
    {/* Repère (là où commence l'écran sous les onglets) et hauteur de page plus grande que l'écran */}
    <div ref={ref} style={{ height: zone ? window.innerHeight - zone.haut + 40 : '100vh' }} aria-hidden />
    <div className="fixed inset-x-0 mx-auto flex max-w-lg flex-col gap-2.5 overflow-y-auto overscroll-contain px-4"
      style={zone ? { top: zone.haut, bottom: zone.bas } : { visibility: 'hidden' }}>
      {/* Cartes ponctuelles : un seul bandeau qui les ouvre */}
      <BravoSeance />
      <BandeauAVoir>
        <CarteVictoire />
        <CarteResultat />
        <CarteFcMax />
        <CarteCpEnHausse />
        <CarteHorsPlan />
        {/* Le dimanche seulement : bilan de la semaine (le lundi, il est rappelé dans Semaine) */}
        {jourSemaine === 0 && !(nutrition && bilanRempli) && <CarteBilan lundi={lundiDuBilan()!} />}
        <CarteBilanNutrition lieu="aujourdhui" />
        <CarteCalibration />
      </BandeauAVoir>
      {complet && !edition ? (
        <CarteAujourdhui onModifierMatin={() => setEdition(true)} autreOuvert={nutriOuverte} />
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}
      {nutrition && <CarteNutrition ouverte={nutriOuverte} onBasculer={setNutriOuverte} />}
      {/* En bas : pesée et imprévu sur une ligne */}
      <div className="flex shrink-0 gap-2">
        <CartePesee compact />
        <CartePanne compact />
      </div>
    </div>
    </>
  )
}
