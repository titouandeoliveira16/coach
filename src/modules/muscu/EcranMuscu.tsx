import { Navigate, Route, Routes } from 'react-router-dom'
import { EnTete } from '../../core/ui/EnTete'
import { Onglets } from '../../core/ui/Onglets'
import { useMuscu } from './donnees'
import { Depart } from './ecrans/Depart'
import { Progres } from './ecrans/Progres'
import { Seance } from './ecrans/Seance'

const ONGLETS = [
  { libelle: 'Séance', vers: '/muscu/seance' },
  { libelle: 'Progrès', vers: '/muscu/progres' },
]

/** Écran racine du module Muscu : développé couché, méthode 5/3/1. */
export function EcranMuscu() {
  const e = useMuscu()
  if (!e) return null
  if (!e.reference) {
    return (
      <>
        <EnTete titre="Muscu" />
        <div className="px-4"><Depart /></div>
      </>
    )
  }
  return (
    <>
      <EnTete titre="Muscu">
        <p className="mt-1 text-sm text-texte-2">Développé couché · méthode 5/3/1</p>
        <Onglets onglets={ONGLETS} />
      </EnTete>
      <div className="px-4">
        <Routes>
          <Route path="seance" element={<Seance key={`${e.cycle}-${e.semaine}`} e={e} />} />
          <Route path="progres" element={<Progres e={e} />} />
          <Route path="*" element={<Navigate to="seance" replace />} />
        </Routes>
      </div>
    </>
  )
}
