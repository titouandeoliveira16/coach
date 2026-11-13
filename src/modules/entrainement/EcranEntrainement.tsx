import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { aujourdhui } from '../../core/dates'
import { EnTete } from '../../core/ui/EnTete'
import { Onglets } from '../../core/ui/Onglets'
import { Pager } from '../../core/ui/Pager'
import { Aujourdhui } from './ecrans/Aujourdhui'
import { Progres } from './ecrans/Progres'
import { Saison } from './ecrans/Saison'
import { Semaine } from './ecrans/Semaine'
import { AideFit } from './import/AideFit'
import { importerIntervalsSiBesoin } from './import/intervals'
import { nettoyerPeseesEffacees } from './forme/pesees'
import { retirerCourseAVenir } from './plan/donnees'
import { nettoyerDoublons } from './seances/donnees'
import { FormulaireSeance } from './seances/FormulaireSeance'

const ONGLETS = [
  { libelle: 'Aujourd’hui', vers: '/entrainement/aujourdhui' },
  { libelle: 'Semaine', vers: '/entrainement/semaine' },
  { libelle: 'Saison', vers: '/entrainement/saison' },
  { libelle: 'Progrès', vers: '/entrainement/progres' },
]

/** Écran racine du module : onglets en haut (la date du jour à droite du titre). */
export function EcranEntrainement() {
  // Nouvelles données Intervals.icu à l'ouverture (au plus une fois par heure)
  // (et fusion des éventuels doublons déjà enregistrés)
  useEffect(() => {
    nettoyerDoublons().then(nettoyerPeseesEffacees).then(retirerCourseAVenir).then(importerIntervalsSiBesoin)
  }, [])

  return (
    <Routes>
      {/* Pages pleines (sans onglets) */}
      <Route path="seance/:id" element={<FormulaireSeance />} />
      <Route path="aide-fit" element={<AideFit />} />
      <Route path="*" element={<AvecOnglets />} />
    </Routes>
  )
}

function AvecOnglets() {
  return (
    <>
      <EnTete titre="Entraînement" aDroite={new Date(`${aujourdhui()}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}>
        <Onglets onglets={ONGLETS} />
      </EnTete>
      <Pager pages={[
        { vers: '/entrainement/aujourdhui', element: <Aujourdhui /> },
        { vers: '/entrainement/semaine', element: <Semaine /> },
        { vers: '/entrainement/saison', element: <Saison /> },
        { vers: '/entrainement/progres', element: <Progres /> },
      ]} />
    </>
  )
}
