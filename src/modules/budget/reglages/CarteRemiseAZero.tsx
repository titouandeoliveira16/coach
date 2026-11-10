import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Repliable } from '../../../core/ui/Repliable'
import { remettreAZero } from '../donnees'

/** Repartir de zéro : efface comptes, mouvements, relevés et plafonds (catégories gardées). Deux touchers pour confirmer. */
export function CarteRemiseAZero() {
  const [confirmer, setConfirmer] = useState(false)
  const navigate = useNavigate()
  return (
    <Repliable titre="Repartir de zéro" libelle="Ouvrir" resume="Effacer et recommencer le suivi">
      <p className="text-sm text-texte-2">Efface tes comptes, tes mouvements, tes relevés et tes plafonds. Tes catégories et ton rappel du soir sont gardés. Tu retrouves ensuite l'écran de départ pour saisir tes soldes.</p>
      {confirmer ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-mauvais py-2.5 font-semibold text-fond"
            onClick={async () => { await remettreAZero(); navigate('/budget') }}>Oui, tout effacer</button>
          <button type="button" className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2" onClick={() => setConfirmer(false)}>Annuler</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmer(true)} className="mt-3 w-full rounded-xl border border-mauvais/50 py-2.5 font-semibold text-mauvais">Remettre le Budget à zéro</button>
      )}
    </Repliable>
  )
}
