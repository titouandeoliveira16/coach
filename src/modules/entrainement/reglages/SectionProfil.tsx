import { useLiveQuery } from 'dexie-react-hooks'
import { formatDate, formatNombre } from '../../../core/format'
import { fcMaxObservee } from '../forme/fcMax'
import { useProfil } from '../../../core/profil'
import { Repliable } from '../../../core/ui/Repliable'
import { ChampNombre } from '../../../core/ui/ChampNombre'

/** Profil (FC max, taille, objectif nutrition) : une ligne, à ouvrir pour modifier. La date de naissance n'est demandée qu'une fois. */
export function SectionProfil() {
  const [profil, modifierProfil] = useProfil()
  const vue = useLiveQuery(fcMaxObservee)
  const resume = [
    profil.fcMax && `FC max ${profil.fcMax}`,
    profil.tailleCm && `${formatNombre(profil.tailleCm / 100, 2)} m`,
    profil.objectif === 'perte' ? 'perte de gras légère' : 'garder mon poids',
  ].filter(Boolean).join(' · ')
  return (
    <Repliable titre="Profil" resume={resume}>
      <ChampNombre libelle="FC max" unite="bpm" decimales={0} valeur={profil.fcMax} onValider={(v) => modifierProfil({ fcMax: v })} />
      {vue && (
        <p className="text-xs text-texte-3">
          Plus haute vue dans tes séances : <b className="text-texte-2">{vue.fc} bpm</b> ({vue.titre}, {formatDate(vue.date).slice(0, 5)})
          {vue.isolee && ' · pic isolé : vérifie que ce n\'est pas un raté du capteur'}
          {vue.fc !== profil.fcMax && (
            <button type="button" onClick={() => modifierProfil({ fcMax: vue.fc })} className="ml-2 font-semibold text-accent">Utiliser {vue.fc}</button>
          )}
        </p>
      )}
      <ChampNombre libelle="Taille" unite="cm" decimales={0} valeur={profil.tailleCm} onValider={(v) => modifierProfil({ tailleCm: v })} />
      {/* Demandée une seule fois (besoins du jour) : plus de champ une fois renseignée */}
      {!profil.naissance && (
        <label className="flex items-center justify-between py-1.5">
          <span className="text-attention">Date de naissance</span>
          <input type="date" onChange={(e) => e.target.value && modifierProfil({ naissance: e.target.value })}
            className="rounded-lg border border-bordure bg-surface-2 px-2 py-2" />
        </label>
      )}
      <label className="flex items-center justify-between py-1.5">
        <span className="text-texte-2">Objectif nutrition</span>
        <select value={profil.objectif ?? 'maintien'} onChange={(e) => modifierProfil({ objectif: e.target.value as 'maintien' | 'perte' })}
          className="rounded-lg border border-bordure bg-surface-2 px-3 py-2 font-semibold outline-none">
          <option value="maintien">Garder mon poids</option>
          <option value="perte">Perte de gras légère</option>
        </select>
      </label>
    </Repliable>
  )
}
