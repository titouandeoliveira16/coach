import { useEffect } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { EnTete } from '../../core/ui/EnTete'
import { Onglets } from '../../core/ui/Onglets'
import { IconePlus } from '../../core/ui/icones'
import { Aujourdhui } from './ecrans/Aujourdhui'
import { Progres } from './ecrans/Progres'
import { Saison } from './ecrans/Saison'
import { Semaine } from './ecrans/Semaine'
import { AideFit } from './import/AideFit'
import { importerIntervalsSiBesoin } from './import/intervals'
import { nettoyerPeseesEffacees } from './forme/pesees'
import { corrigerSortieReprise } from './plan/remiseAZero'
import { nettoyerDoublons } from './seances/donnees'
import { regrouperEnchainements } from './seances/enchainements'
import { FormulaireSeance } from './seances/FormulaireSeance'

const ONGLETS = [
  { libelle: 'Aujourd’hui', vers: '/entrainement/aujourdhui' },
  { libelle: 'Semaine', vers: '/entrainement/semaine' },
  { libelle: 'Saison', vers: '/entrainement/saison' },
  { libelle: 'Progrès', vers: '/entrainement/progres' },
]

/** Écran racine du module : onglets en haut, bouton « + » en bas à droite. */
export function EcranEntrainement() {
  // Nouvelles données Intervals.icu à l'ouverture (au plus une fois par heure)
  // (et fusion des éventuels doublons déjà enregistrés)
  useEffect(() => {
    nettoyerDoublons().then(regrouperEnchainements).then(nettoyerPeseesEffacees).then(corrigerSortieReprise).then(importerIntervalsSiBesoin)
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
      <EnTete titre="Entraînement">
        <Onglets onglets={ONGLETS} />
      </EnTete>
      <div className="px-4">
        <Routes>
          <Route path="aujourdhui" element={<Aujourdhui />} />
          <Route path="semaine" element={<Semaine />} />
          <Route path="saison" element={<Saison />} />
          <Route path="progres" element={<Progres />} />
          <Route path="*" element={<Navigate to="aujourdhui" replace />} />
        </Routes>
      </div>

      {/* Action principale : nouvelle séance */}
      <Link
        to="/entrainement/seance/nouvelle"
        aria-label="Nouvelle séance"
        className="fixed right-5 bottom-28 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-fond shadow-lg shadow-black/50 active:scale-95"
      >
        <IconePlus className="h-8 w-8" />
      </Link>
    </>
  )
}
