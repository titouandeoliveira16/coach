import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { EnTete } from '../../core/ui/EnTete'
import { Onglets } from '../../core/ui/Onglets'
import { IconePlus } from '../../core/ui/icones'
import { mettreAJour, useBudget } from './donnees'
import { Demarrage } from './ecrans/Demarrage'
import { Analyses } from './ecrans/Analyses'
import { Mois } from './ecrans/Mois'
import { Mouvements } from './ecrans/Mouvements'
import { Patrimoine } from './ecrans/Patrimoine'
import { Plafonds } from './ecrans/Plafonds'
import { ContexteSaisie } from './ouvrirSaisie'
import { Saisie } from './Saisie'
import type { Mouvement } from './types'

const ONGLETS = [
  { libelle: 'Mois', vers: '/budget/mois' },
  { libelle: 'Liste', vers: '/budget/mouvements' },
  { libelle: 'Patrimoine', vers: '/budget/patrimoine' },
  { libelle: 'Analyses', vers: '/budget/analyses' },
]

/** Écran racine du module Budget : onglets en haut, bouton « + » toujours accessible. */
export function EcranBudget() {
  const d = useBudget()
  const [saisie, setSaisie] = useState<Partial<Mouvement> | null>(null)
  const [message, setMessage] = useState<string>()

  // Mise à jour unique des données (catégories choisies ensemble, départ au 1er octobre)
  const demarre = !!d?.comptes.length
  useEffect(() => {
    if (demarre) mettreAJour()
  }, [demarre])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(undefined), 4000)
    return () => clearTimeout(t)
  }, [message])

  if (!d) return null
  if (!d.comptes.length) return <Demarrage />

  return (
    <ContexteSaisie.Provider value={(initial) => setSaisie(initial ?? {})}>
      <Routes>
        <Route path="plafonds" element={<Plafonds />} />
        <Route path="*" element={
          <>
            <EnTete titre="Budget">
              <Onglets onglets={ONGLETS} />
            </EnTete>
            <div className="px-4">
              <Routes>
                <Route path="mois" element={<Mois />} />
                <Route path="mouvements" element={<Mouvements />} />
                <Route path="patrimoine" element={<Patrimoine />} />
                <Route path="analyses" element={<Analyses />} />
                <Route path="*" element={<Navigate to="mois" replace />} />
              </Routes>
            </div>
          </>
        } />
      </Routes>

      {message && (
        <div className="fixed inset-x-4 bottom-48 z-30 mx-auto max-w-md rounded-2xl border border-bordure bg-surface-2 px-4 py-3 text-center font-semibold shadow-lg shadow-black/50"
          onClick={() => setMessage(undefined)}>{message}</div>
      )}

      <button type="button" onClick={() => setSaisie({})} aria-label="Nouveau mouvement"
        className="fixed right-5 bottom-28 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-fond shadow-lg shadow-black/50 active:scale-95">
        <IconePlus className="h-8 w-8" />
      </button>

      {saisie && <Saisie initial={saisie} onFermer={(m) => { setSaisie(null); if (m) setMessage(m) }} />}
    </ContexteSaisie.Provider>
  )
}
