import { useState } from 'react'
import { aujourdhui } from '../../core/dates'
import { formatDate } from '../../core/format'
import { Bouton } from '../../core/ui/Bouton'
import { Feuille } from '../../core/ui/Feuille'
import { supprimerMouvement, useBudget } from './donnees'
import { useOuvrirSaisie } from './ouvrirSaisie'
import type { Mouvement } from './types'
import { decrireMouvement } from './ui'

/** Feuille d'un mouvement : modifier, dupliquer (même chose, montant à ajuster), supprimer. */
export function DetailMouvement({ m, onFermer }: { m: Mouvement; onFermer: () => void }) {
  const d = useBudget()
  const ouvrir = useOuvrirSaisie()
  const [confirmer, setConfirmer] = useState(false)
  if (!d) return null
  const desc = decrireMouvement(m, d.categories, d.comptes)
  const compte = d.comptes.find((c) => c.id === m.compteId)

  return (
    <Feuille titre={`${desc.emoji} ${desc.titre}`} onFermer={onFermer}>
      <p className="text-3xl font-bold tabular-nums" style={{ color: desc.couleur }}>{desc.montant}</p>
      <p className="mt-1 text-texte-2">{formatDate(m.date)}{(m.type === 'depense' || m.type === 'revenu') && compte ? ` · ${compte.nom}` : ''}</p>
      {m.note && <p className="mt-1 text-texte-2">« {m.note} »</p>}
      <div className="mt-4 space-y-2">
        <Bouton onClick={() => { onFermer(); ouvrir(m) }}>Modifier</Bouton>
        <Bouton variante="secondaire" onClick={() => {
          onFermer()
          const { id: _id, montant: _montant, ...reste } = m
          ouvrir({ ...reste, date: aujourdhui() })
        }}>Dupliquer (nouveau montant)</Bouton>
        {confirmer ? (
          <Bouton className="!bg-[#f87171]" onClick={async () => { await supprimerMouvement(m.id); onFermer() }}>Confirmer la suppression</Bouton>
        ) : (
          <button type="button" onClick={() => setConfirmer(true)} className="w-full py-2 text-sm text-[#f87171]">Supprimer</button>
        )}
      </div>
    </Feuille>
  )
}
