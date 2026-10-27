/** Liste de choix sous forme de pastilles (un seul choix ; toucher le choix actif l'efface si `effacable`). */
export function Puces<T extends string>({
  options,
  valeur,
  onChoisir,
  effacable = true,
  libelle = (o) => o,
}: {
  options: readonly T[]
  valeur?: T
  onChoisir: (v: T | undefined) => void
  effacable?: boolean
  libelle?: (o: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const actif = o === valeur
        return (
          <button
            key={o}
            type="button"
            aria-pressed={actif}
            onClick={() => onChoisir(actif && effacable ? undefined : o)}
            className={`rounded-full border px-3.5 py-2 text-sm font-semibold active:scale-95 ${
              actif ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface-2 text-texte-2'
            }`}
          >
            {libelle(o)}
          </button>
        )
      })}
    </div>
  )
}
