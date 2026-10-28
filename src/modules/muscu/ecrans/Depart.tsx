import { useState } from 'react'
import { formatNombre, lireNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { AIDES_MUSCU } from '../aides'
import { demarrer, useObjectif } from '../donnees'
import { maxEstime, PART_REFERENCE, referenceDepuisMax } from '../programme'

const champ = 'w-24 rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-right text-lg font-semibold outline-none focus:border-accent'

/** Point de départ : ton max (connu, ou estimé d'après une série récente). */
export function Depart({ onFini }: { onFini?: () => void }) {
  const objectif = useObjectif()
  const [kg, setKg] = useState('')
  const [reps, setReps] = useState('1')
  const k = lireNombre(kg)
  const r = Math.round(lireNombre(reps) ?? 0)
  const valide = !!k && k >= 20 && r >= 1 && r <= 10
  const max = valide ? maxEstime(k!, r) : undefined

  return (
    <Carte titre="🏋️ Ton point de départ">
      <p className="text-sm text-texte-2">
        Ton max au développé couché, ou une série récente faite près de ton maximum (3 à 8 reps).
        <Aide titre="Ton max" texte={AIDES_MUSCU.max} />
      </p>
      <label className="mt-2 flex items-center justify-between gap-3 py-1.5">
        <span className="text-texte-2">Charge</span>
        <span className="flex items-center gap-2"><input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className={champ} /> kg</span>
      </label>
      <label className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-texte-2">Répétitions <span className="text-xs text-texte-3">(1 = ton max)</span></span>
        <span className="flex items-center gap-2"><input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className={champ} /> reps</span>
      </label>
      {max && objectif && (
        <p className="mt-2 text-sm text-texte-2">
          {r > 1 && <>Max estimé : <b className="text-texte">{formatNombre(max, 1)} kg</b> · </>}
          Référence du cycle : <b className="text-texte">{formatNombre(referenceDepuisMax(max, objectif), 1)} kg</b>
          {' '}({Math.round(PART_REFERENCE[objectif] * 100)} % de ton max, objectif {objectif === 'perte' ? 'perte de gras' : 'maintien'})
        </p>
      )}
      <Bouton className="mt-3" disabled={!valide} onClick={async () => { await demarrer(k!, r); onFini?.() }}>Démarrer le cycle</Bouton>
    </Carte>
  )
}
