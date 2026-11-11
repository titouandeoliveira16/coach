import { lazy, Suspense, useEffect, useState } from 'react'
import { formatDe, type SeanceVelo } from '../../../metrics/programme'
import type { SeanceCatalogue } from '../../catalogue/donnees'
// Fiche et catalogue complet (250 Ko) chargés seulement quand une fiche s'affiche
const Fiche = lazy(() => import('../../catalogue/Fiche').then((m) => ({ default: m.Fiche })))

/** Fiche du catalogue scientifique d'où vient une séance vélo du programme. */
const AUTRES: Partial<Record<SeanceVelo['famille'], string>> = { z2: 'velo-endurance-courte', 'z2-long': 'velo-endurance-sprints', test: 'velo-test-cp-3-7-12', 'vtt-terrain': 'vtt-technique', 'vtt-speciales': 'vtt-enduro-speciales' }

export function FicheSeance({ velo }: { velo?: SeanceVelo }) {
  // Séance du cycle 1er seuil : sa propre fiche (ce n'est pas un format d'intensité)
  const id = !velo ? undefined : velo.formatId === 'sv1-dedie' ? 'velo-cycle-1er-seuil' : (velo.formatId && formatDe(velo.formatId)?.catalogueId) ?? AUTRES[velo.famille]
  // Catalogue complet (250 Ko) chargé seulement quand une fiche s'affiche
  const [s, setS] = useState<SeanceCatalogue>()
  useEffect(() => {
    if (!id) return
    let actif = true
    import('../../catalogue/donnees').then((m) => actif && setS(m.CATALOGUE.seances.find((x) => x.id === id)))
    return () => { actif = false }
  }, [id])
  if (!velo || !s || s.id !== id) return null
  return (
    <div className="mt-3">
      <p className="mb-1 text-[13px] font-semibold text-texte-2">Fiche scientifique</p>
      <Suspense fallback={null}><Fiche s={s} /></Suspense>
    </div>
  )
}
