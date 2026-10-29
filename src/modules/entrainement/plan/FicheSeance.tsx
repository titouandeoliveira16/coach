import { formatDe, type SeanceVelo } from '../../../metrics/programme'
import { CATALOGUE } from '../../catalogue/donnees'
import { Fiche } from '../../catalogue/Fiche'

/** Fiche du catalogue scientifique d'où vient une séance vélo du programme. */
const AUTRES: Partial<Record<SeanceVelo['famille'], string>> = { z2: 'velo-endurance-courte', 'z2-long': 'velo-endurance-sprints', test: 'velo-test-cp-3-7-12' }

export function FicheSeance({ velo }: { velo?: SeanceVelo }) {
  if (!velo) return null
  const id = (velo.formatId && formatDe(velo.formatId)?.catalogueId) ?? AUTRES[velo.famille]
  const s = id && CATALOGUE.seances.find((x) => x.id === id)
  if (!s) return null
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-texte-3">📖 Fiche scientifique</p>
      <Fiche s={s} />
    </div>
  )
}
