import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { Puces } from '../../../core/ui/Puces'
import { TYPES_SEANCE, type Intensite, type SeancePrevue, type Sport } from '../types'
import { enregistrerPrevue } from './donnees'

const INTENSITES = ['basse', 'moyenne', 'haute'] as const
const SPORTS = ['velo', 'course'] as const

/** Ajout ou modification d'une séance prévue (vélo de ta prépa, ou course). */
export function FormulairePrevue({ initiale, jours, onTermine }: { initiale: SeancePrevue; jours: string[]; onTermine: () => void }) {
  const [p, setP] = useState(initiale)
  const changer = (c: Partial<SeancePrevue>) => setP((x) => ({ ...x, ...c }))
  return (
    <div className="space-y-3">
      <Puces options={SPORTS} valeur={p.sport} effacable={false} libelle={(s) => (s === 'velo' ? '🚴 Vélo' : '🏃 Course')} onChoisir={(sport) => changer({ sport: sport as Sport })} />
      <select value={p.date} onChange={(e) => changer({ date: e.target.value })} className="w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 capitalize">
        {jours.map((d) => <option key={d} value={d}>{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</option>)}
      </select>
      <input placeholder="Titre, ex. 3 × 10' seuil" value={p.titre} onChange={(e) => changer({ titre: e.target.value })}
        className="w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 outline-none focus:border-accent" />
      <Puces options={TYPES_SEANCE} valeur={p.type} onChoisir={(type) => changer({ type, longue: type === 'Sortie longue' || p.longue })} />
      <div>
        <p className="mb-2 text-sm text-texte-2">Intensité</p>
        <Puces options={INTENSITES} valeur={p.intensite} effacable={false} onChoisir={(intensite) => changer({ intensite: intensite as Intensite })} />
      </div>
      <ChampNombre libelle="Durée" unite="min" decimales={0} valeur={p.dureeMin} onValider={(v) => v && changer({ dureeMin: v })} />
      <label className="flex items-center justify-between py-1">
        <span className="text-texte-2">⭐ Séance clé (à reporter plutôt qu'abandonner)</span>
        <input type="checkbox" checked={p.priorite === 'cle'} onChange={(e) => changer({ priorite: e.target.checked ? 'cle' : 'normale' })} className="h-6 w-6 accent-[var(--color-accent)]" />
      </label>
      <label className="flex items-center justify-between py-1">
        <span className="text-texte-2">Sortie longue (plutôt le week-end)</span>
        <input type="checkbox" checked={!!p.longue} onChange={(e) => changer({ longue: e.target.checked })} className="h-6 w-6 accent-[var(--color-accent)]" />
      </label>
      <textarea placeholder="Consignes (facultatif)" value={p.detail ?? ''} rows={2} onChange={(e) => changer({ detail: e.target.value || undefined })}
        className="w-full rounded-xl border border-bordure bg-surface-2 p-3 outline-none focus:border-accent" />
      <Bouton disabled={!p.titre.trim()} onClick={async () => { await enregistrerPrevue(p); onTermine() }}>Enregistrer</Bouton>
    </div>
  )
}
