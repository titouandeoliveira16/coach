import type { Creneau } from './programme'
import type { Rappel, Resultat } from './types'

/** Libellé d'un créneau (le sien s'il en a un). */
export const LIBELLES_CRENEAUX: Record<Creneau['type'], (c: Creneau) => string> = Object.fromEntries(
  ([
    ['notion', '📖 Nouvelle notion'], ['fixation', '✍️ Feuille blanche de la notion'], ['rappels', '🔁 Rappels (feuille blanche)'],
    ['stage', '🏫 Stage'], ['internat', '🌙 Stage à l’internat'], ['memoire', '📝 Mémoire de recherche'], ['sujet', '⏱️ Sujet complet'],
    ['express', '⚡ Sujet express'], ['correction', '🔍 Correction'], ['relecture', '👀 Relecture'], ['synthese', '🗂️ Fiches de synthèse'], ['libre', '🌿 Libre'],
  ] as const).map(([t, l]) => [t, (c: Creneau) => (c.libelle ? `${l.split(' ')[0]} ${c.libelle}` : l) + (c.optionnel ? ' (option)' : '')]),
) as Record<Creneau['type'], (c: Creneau) => string>

export const libelleRappel = (r: Rappel) => (r.cible === 'sujet' ? 'ciblé (sujet)' : r.cible === 'hesitant' ? 'à revoir' : `J+${r.intervalle}`)

/** Trois boutons d'auto-évaluation. */
export function BoutonsResultat({ onChoisir }: { onChoisir: (r: Resultat) => void }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {([['su', '✅ Su'], ['hesitant', '🟠 Hésitant'], ['rate', '🔁 Raté']] as const).map(([r, l]) => (
        <button key={r} type="button" onClick={() => onChoisir(r)} className="rounded-lg bg-surface-2 py-2 text-sm font-semibold active:scale-95">{l}</button>
      ))}
    </div>
  )
}
