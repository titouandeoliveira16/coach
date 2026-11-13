import { useLiveQuery } from 'dexie-react-hooks'
import { TuilesMatin } from '../forme/TuilesMatin'
import { useState } from 'react'
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
import { CarteEnchainement } from '../forme/CarteEnchainement'
import { CartePanne } from '../forme/CartePanne'
import { CartePesee, FeuillePesee } from '../forme/CartePesee'
import { CarteResultat } from '../forme/CarteResultat'
import { SaisieMatin } from '../forme/SaisieMatin'
import { BandeauAVoir } from '../forme/BandeauAVoir'
import { AstuceDuJour, VisiteGuidee } from '../forme/VisiteGuidee'
import { BravoSeance, CarteVictoire } from '../forme/Celebration'
import { QUESTIONS, mesuresRecentes } from '../forme/donnees'

/** Aujourd'hui sur un seul écran : ta forme, la séance (la plus grande), la nutrition, puis pesée et imprévu en bas.
 *  Les cartes se partagent toute la hauteur ; ce qu'on ouvre prend sa place, et la page ne défile qu'ensuite. */
export function Aujourdhui() {
  const recentes = useLiveQuery(() => mesuresRecentes(1))
  const [edition, setEdition] = useState(false)
  const [nutriOuverte, setNutriOuverte] = useState(false)
  const [peseeOuverte, setPeseeOuverte] = useState(false)
  // Nutrition en option (Réglages → Mon profil sportif → Module nutrition)
  const nutrition = useNutritionActive()
  // Bilan du dimanche : une fois le bilan nutrition rempli, il quitte Aujourd'hui (rappel le lundi dans Semaine)
  const bilanRempli = useLiveQuery(async () => !!(await lireReglagesNutrition()).bilans?.some((b) => b.date === aujourdhui()))

  if (!recentes) return null
  const jourSemaine = new Date(`${aujourdhui()}T12:00:00`).getDay()
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)

  return (
    <div className="flex min-h-full flex-col gap-2.5">
      {/* Cartes ponctuelles : un seul bandeau qui les ouvre */}
      <BravoSeance />
      {/* Premiers jours : visite guidée (une fois les notes du matin remplies), puis une astuce par jour */}
      {complet && !edition && <VisiteGuidee />}
      <AstuceDuJour />
      <BandeauAVoir>
        <CarteVictoire />
        <CarteResultat />
        <CarteEnchainement />
        <CarteFcMax />
        <CarteCpEnHausse />
        <CarteHorsPlan />
        {/* Le dimanche seulement : bilan de la semaine (le lundi, il est rappelé dans Semaine) */}
        {jourSemaine === 0 && !(nutrition && bilanRempli) && <CarteBilan lundi={lundiDuBilan()!} />}
        <CarteBilanNutrition lieu="aujourdhui" />
        <CarteCalibration />
      </BandeauAVoir>
      {peseeOuverte && <FeuillePesee onFermer={() => setPeseeOuverte(false)} />}
      {complet && !edition ? (
        <CarteAujourdhui onModifierMatin={() => setEdition(true)} autreOuvert={nutriOuverte} remplir={!nutrition} apresForme={<TuilesMatin onPoids={() => setPeseeOuverte(true)} />} />
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}
      {nutrition && <CarteNutrition ouverte={nutriOuverte} onBasculer={setNutriOuverte} />}
      {/* Avant les notes du matin : pesée et imprévu en bas (ensuite, l'imprévu est un lien dans la carte de la séance) */}
      {!(complet && !edition) && (
        <div className="flex shrink-0 gap-2">
          <CartePesee compact />
          <CartePanne compact />
        </div>
      )}
    </div>
  )
}
