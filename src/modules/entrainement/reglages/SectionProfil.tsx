import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { formatDate } from '../../../core/format'
import { fcMaxObservee } from '../forme/fcMax'
import { HEURE_PESEE, RAPPELS } from '../../../core/notifications'
import { useProfil } from '../../../core/profil'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'

/** Profil (FC max, objectif nutrition) et rappels du module Entraînement. */
export function SectionProfil() {
  const [profil, modifierProfil] = useProfil()
  const vue = useLiveQuery(fcMaxObservee)
  return (
    <>
      <Carte titre="Profil">
        <ChampNombre libelle="FC max" unite="bpm" decimales={0} valeur={profil.fcMax} onValider={(v) => modifierProfil({ fcMax: v })} />
        <ChampNombre libelle="Taille" unite="cm" decimales={0} valeur={profil.tailleCm} onValider={(v) => modifierProfil({ tailleCm: v })} />
        <label className="flex items-center justify-between py-1.5">
          <span className="text-texte-2">Date de naissance</span>
          <input type="date" value={profil.naissance ?? ''} onChange={(e) => e.target.value && modifierProfil({ naissance: e.target.value })}
            className="rounded-lg border border-bordure bg-surface-2 px-2 py-2" />
        </label>
        {!profil.naissance && <p className="text-xs text-[#fb923c]">Renseigne ta date de naissance : elle sert au calcul de tes besoins du jour.</p>}
        {vue && (
          <p className="text-sm text-texte-2">
            Plus haute vue dans tes séances : <b className="text-texte">{vue.fc} bpm</b> ({vue.titre}, {formatDate(vue.date).slice(0, 5)})
            {vue.isolee && <span className="text-texte-3"> · pic isolé : vérifie que ce n'est pas un raté du capteur</span>}
            {vue.fc !== profil.fcMax && (
              <button type="button" onClick={() => modifierProfil({ fcMax: vue.fc })} className="ml-2 font-semibold text-accent">Utiliser {vue.fc}</button>
            )}
          </p>
        )}
        <p className="text-xs text-texte-3">Sert à la charge de chaque séance (TRIMP) et aux minutes à 90 % en VO2. La meilleure valeur : la plus haute vue sur un effort à fond (test CP, 1 500 m, fin de VO2), avec une ceinture. Les zones FC se règlent à part (Avancé → Zones).</p>
        <label className="mt-2 flex items-center justify-between py-1.5">
          <span className="text-texte-2">Objectif nutrition</span>
          <select value={profil.objectif ?? 'maintien'} onChange={(e) => modifierProfil({ objectif: e.target.value as 'maintien' | 'perte' })}
            className="rounded-lg border border-bordure bg-surface-2 px-3 py-2 font-semibold outline-none">
            <option value="maintien">Garder mon poids</option>
            <option value="perte">Perte de gras légère</option>
          </select>
        </label>
      </Carte>
      <Carte titre="Rappels">
        <ul className="space-y-1 text-sm text-texte-2">
          <li>☀️ Chaque matin à {RAPPELS.heure.replace(':', ' h ')} : tes 5 notes du matin (VFC, FC de repos et sommeil arrivent seuls de ta montre)</li>
          <li>⚖️ Lundi, mardi, mercredi, samedi et dimanche à {HEURE_PESEE.replace(':00', ' h')} : la pesée (à jeun, après les toilettes). L'appli suit la tendance, pas le poids d'un jour</li>
        </ul>
        <p className="mt-1 text-xs text-texte-3">Pas de rappel si c'est déjà fait. Les notifications s'activent une fois pour toute l'appli : <Link to="/reglages" className="underline">Accueil → ⚙️</Link>.</p>
      </Carte>
    </>
  )
}
