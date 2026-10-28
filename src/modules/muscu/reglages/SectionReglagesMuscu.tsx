import { useState } from 'react'
import { formatDate, formatNombre } from '../../../core/format'
import { Carte } from '../../../core/ui/Carte'
import { useMuscu, useObjectif } from '../donnees'
import { Depart } from '../ecrans/Depart'
import { PART_REFERENCE } from '../programme'

/** Réglages du module Muscu : ton max et ta référence ; changer de max relance un cycle (l'historique est gardé). */
export function SectionReglagesMuscu() {
  const e = useMuscu()
  const objectif = useObjectif()
  const [changer, setChanger] = useState(false)
  if (!e || !objectif) return null
  return (
    <>
      <Carte titre="Développé couché">
        {e.max ? (
          <ul className="space-y-1 text-sm text-texte-2">
            <li>Max de départ : <b className="text-texte">{formatNombre(e.max, 1)} kg</b>{e.maxLe && ` (le ${formatDate(e.maxLe)})`}</li>
            <li>Référence actuelle : <b className="text-texte">{formatNombre(e.reference ?? 0, 1)} kg</b></li>
            <li>Objectif {objectif === 'perte' ? 'perte de gras' : 'maintien'} (Entraînement → Réglages → Profil) : référence à {Math.round(PART_REFERENCE[objectif] * 100)} % du max, appliqué au prochain cycle.</li>
          </ul>
        ) : <p className="text-sm text-texte-2">Pas encore de max : ouvre le module Muscu pour démarrer.</p>}
        {e.max && !changer && (
          <button type="button" onClick={() => setChanger(true)} className="mt-2 text-sm font-semibold text-accent">Changer mon max (relance un cycle)</button>
        )}
      </Carte>
      {changer && <Depart onFini={() => setChanger(false)} />}
    </>
  )
}
