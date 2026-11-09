import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { Puces } from '../../../core/ui/Puces'
import { iconeSport, NOMS_SPORTS } from '../sports'
import { TYPES_SEANCE, type Intensite, type SeancePrevue, type Sport } from '../types'
import { enregistrerPrevue } from './donnees'

const INTENSITES = ['basse', 'moyenne', 'haute'] as const
const SPORTS_PREVUS: Sport[] = ['velo', 'renfo']
const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 outline-none focus:border-accent'

/** Ajout ou modification d'une séance prévue à la main : vélo ou renfo (l'appli ne planifie plus la course à pied). */
export function FormulairePrevue({ initiale, jours, onTermine }: { initiale: SeancePrevue; jours: string[]; onTermine: () => void }) {
  const [p, setP] = useState(initiale)
  const changer = (c: Partial<SeancePrevue>) => setP((x) => ({ ...x, ...c }))

  const choisirSport = (sport: Sport) =>
    changer(sport === 'renfo'
      ? { sport, titre: p.titre || 'Renfo', intensite: 'basse', typeCourse: undefined, minutesCle: undefined }
      : { sport, typeCourse: undefined })

  return (
    <div className="space-y-3">
      <Puces options={SPORTS_PREVUS} valeur={p.sport} effacable={false} libelle={(s) => `${iconeSport(s)} ${NOMS_SPORTS[s]}`} onChoisir={(s) => s && choisirSport(s)} />
      <select value={p.date} onChange={(e) => changer({ date: e.target.value })} className="w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 capitalize">
        {jours.map((d) => <option key={d} value={d}>{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</option>)}
      </select>

      <input placeholder="Titre" value={p.titre} onChange={(e) => changer({ titre: e.target.value })} className={champ} />
      <ChampNombre libelle="Durée totale" unite="min" decimales={0} valeur={p.dureeMin} onValider={(v) => v && changer({ dureeMin: v })} />

      {p.sport === 'velo' && (
        <>
          <Puces options={TYPES_SEANCE} valeur={p.type} onChoisir={(type) => changer({ type, longue: type === 'Sortie longue' || p.longue })} />
          <div>
            <p className="mb-2 text-sm text-texte-2">Intensité</p>
            <Puces options={INTENSITES} valeur={p.intensite} effacable={false} onChoisir={(intensite) => changer({ intensite: intensite as Intensite })} />
          </div>
          <ChampNombre libelle="Travail prévu" unite="kJ" decimales={0} valeur={p.kjPrevu} onValider={(kjPrevu) => changer({ kjPrevu })} />
        </>
      )}

      <textarea placeholder="Consignes (facultatif)" value={p.detail ?? ''} rows={2} onChange={(e) => changer({ detail: e.target.value || undefined })}
        className="w-full rounded-xl border border-bordure bg-surface-2 p-3 outline-none focus:border-accent" />
      <Bouton disabled={!p.titre.trim()} onClick={async () => { await enregistrerPrevue(p); onTermine() }}>Enregistrer</Bouton>
    </div>
  )
}
