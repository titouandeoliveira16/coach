/** Note subjective de 1 (mauvais) à 5 (excellent) : plus c'est haut, mieux c'est. */
export type Note = 1 | 2 | 3 | 4 | 5

/** Couleur de chaque note, du rouge (1) au vert (5). */
export const COULEURS_NOTE = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#4ade80']

interface Props {
  libelle: string
  /** Textes des extrémités, ex. ["Épuisé", "En forme"] */
  bornes: [string, string]
  valeur?: Note
  onChoisir: (n: Note | undefined) => void
}

/** 5 pastilles à toucher (1 = mauvais, 5 = excellent). Toucher la note choisie l'efface. */
export function ChoixNote({ libelle, bornes, valeur, onChoisir }: Props) {
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-texte-2">{libelle}</span>
        <span className="text-xs text-texte-3">
          {bornes[0]} → {bornes[1]}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {([1, 2, 3, 4, 5] as Note[]).map((n) => {
          const actif = valeur === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={actif}
              onClick={() => onChoisir(actif ? undefined : n)}
              className="h-12 rounded-xl border text-lg font-bold active:scale-95"
              style={
                actif
                  ? { background: COULEURS_NOTE[n - 1], borderColor: COULEURS_NOTE[n - 1], color: '#0b0d10' }
                  : { borderColor: 'var(--color-bordure)', background: 'var(--color-surface-2)', color: 'var(--color-texte-2)' }
              }
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
