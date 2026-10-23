import { Navigate, Route, Routes } from 'react-router-dom'
import { EnTete } from '../../core/ui/EnTete'
import { Onglets } from '../../core/ui/Onglets'
import { IconePlus } from '../../core/ui/icones'
import { Bord } from './ecrans/Bord'
import { Forme } from './ecrans/Forme'
import { Historique } from './ecrans/Historique'

const ONGLETS = [
  { libelle: 'Forme', vers: '/entrainement/forme' },
  { libelle: 'Bord', vers: '/entrainement/bord' },
  { libelle: 'Historique', vers: '/entrainement/historique' },
]

/** Écran racine du module : onglets en haut, bouton « + » en bas à droite. */
export function EcranEntrainement() {
  return (
    <>
      <EnTete titre="Entraînement">
        <Onglets onglets={ONGLETS} />
      </EnTete>
      <div className="px-4">
        <Routes>
          <Route path="forme" element={<Forme />} />
          <Route path="bord" element={<Bord />} />
          <Route path="historique" element={<Historique />} />
          <Route path="*" element={<Navigate to="forme" replace />} />
        </Routes>
      </div>

      {/* Action principale : nouvelle séance (formulaire à l'étape 4) */}
      <button
        type="button"
        aria-label="Nouvelle séance"
        onClick={() => alert('La saisie des séances arrive à l’étape 4 😉')}
        className="fixed right-5 bottom-28 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-fond shadow-lg shadow-black/50 active:scale-95"
      >
        <IconePlus className="h-8 w-8" />
      </button>
    </>
  )
}
