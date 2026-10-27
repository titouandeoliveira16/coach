import { useEffect, useState } from 'react'
import { formatNombre, lireNombre } from '../format'

interface Props {
  libelle: string
  valeur: number | undefined
  unite?: string
  decimales?: number
  /** Appelé quand on quitte le champ (valeur vide → undefined) */
  onValider: (v: number | undefined) => void
}

/**
 * Ligne « libellé ……… [ valeur ] unité ».
 * Ouvre le pavé numérique sur iPhone, accepte la virgule, enregistre en quittant le champ.
 */
export function ChampNombre({ libelle, valeur, unite, decimales = 1, onValider }: Props) {
  const [texte, setTexte] = useState(formatNombre(valeur, decimales))
  const [enSaisie, setEnSaisie] = useState(false)

  // Suit la valeur enregistrée (chargement, import…) sauf pendant la saisie
  useEffect(() => {
    if (!enSaisie) setTexte(formatNombre(valeur, decimales))
  }, [valeur, decimales, enSaisie])

  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-texte-2">{libelle}</span>
      <span className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onFocus={() => setEnSaisie(true)}
          onBlur={() => {
            setEnSaisie(false)
            const n = lireNombre(texte)
            if (n !== valeur) onValider(n)
          }}
          className="w-24 rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-right text-lg font-semibold outline-none focus:border-accent"
        />
        {unite && <span className="w-10 text-sm text-texte-3">{unite}</span>}
      </span>
    </label>
  )
}
