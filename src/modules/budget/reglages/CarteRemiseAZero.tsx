import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Carte } from '../../../core/ui/Carte'
import { remettreAZero } from '../donnees'

/** Repartir de zéro : efface comptes, mouvements, relevés et plafonds (catégories gardées). Deux touchers pour confirmer. */
export function CarteRemiseAZero() {
  const [confirmer, setConfirmer] = useState(false)
  const navigate = useNavigate()
  return (
    <Carte titre="Repartir de zéro">
      <p className="text-sm text-texte-2">Efface tes comptes, tes mouvements, tes relevés et tes plafonds. Tes catégories et ton rappel du soir sont gardés. Tu retrouves ensuite l'écran de départ pour saisir tes soldes.</p>
      {confirmer ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-[#f87171] py-2.5 font-semibold text-fond"
            onClick={async () => { await remettreAZero(); navigate('/budget') }}>Oui, tout effacer</button>
          <button type="button" className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2" onClick={() => setConfirmer(false)}>Annuler</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmer(true)} className="mt-3 w-full rounded-xl border border-[#f87171]/50 py-2.5 font-semibold text-[#f87171]">Remettre le Budget à zéro</button>
      )}
    </Carte>
  )
}
