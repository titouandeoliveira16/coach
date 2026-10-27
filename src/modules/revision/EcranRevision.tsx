import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { aujourdhui } from '../../core/dates'
import { EnTete } from '../../core/ui/EnTete'
import { Onglets } from '../../core/ui/Onglets'
import { installerNotions, useParametres } from './donnees'
import { Aujourdhui } from './ecrans/Aujourdhui'
import { Notions } from './ecrans/Notions'
import { Semaine } from './ecrans/Semaine'
import { Sujets } from './ecrans/Sujets'
import { joursAvant } from './programme'

const ONGLETS = [
  { libelle: 'Aujourd’hui', vers: '/revision/aujourdhui' },
  { libelle: 'Notions', vers: '/revision/notions' },
  { libelle: 'Semaine', vers: '/revision/semaine' },
  { libelle: 'Sujets', vers: '/revision/sujets' },
]

/** Écran racine du module Révision CAPEPS : compte à rebours, puis onglets. */
export function EcranRevision() {
  const [p] = useParametres()
  useEffect(() => {
    installerNotions()
  }, [])
  const j = joursAvant(aujourdhui(), p)

  return (
    <>
      <EnTete titre="Révision CAPEPS">
        <p className="mt-1 text-sm text-texte-2">
          {j > 1 ? <>⏳ <b className="text-accent">J-{j}</b> avant l'écrit 1 · {new Date(`${p.concours}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</>
            : j === 1 ? '⏳ Demain : écrit 1. Repos, tu es prêt.'
            : j >= -1 ? '✍️ Jour J : tu as tout ce qu’il faut.' : 'Concours passé.'}
        </p>
        <Onglets onglets={ONGLETS} />
      </EnTete>
      <div className="px-4">
        <Routes>
          <Route path="aujourdhui" element={<Aujourdhui />} />
          <Route path="notions" element={<Notions />} />
          <Route path="semaine" element={<Semaine />} />
          <Route path="sujets" element={<Sujets />} />
          <Route path="*" element={<Navigate to="aujourdhui" replace />} />
        </Routes>
      </div>
    </>
  )
}
