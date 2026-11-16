const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'

/**
 * Champ de solde : le clavier décimal de l'iPhone n'a pas de signe moins, d'où le bouton « ± » pour un découvert.
 */
export function ChampSolde({ valeur, onChanger, placeholder, className = '' }: {
  valeur: string; onChanger: (t: string) => void; placeholder?: string; className?: string
}) {
  const negatif = valeur.trim().startsWith('-')
  return (
    <div className={`flex min-w-0 flex-1 gap-1.5 ${className}`}>
      <button type="button" aria-label={negatif ? 'Solde positif' : 'Solde négatif (découvert)'}
        onClick={() => onChanger(negatif ? valeur.trim().slice(1) : `-${valeur.trim()}`)}
        className={`min-h-11 w-11 shrink-0 rounded-lg border text-lg font-bold ${negatif ? 'border-mauvais text-mauvais' : 'border-bordure text-texte-2'}`}>±</button>
      <input value={valeur} onChange={(e) => onChanger(e.target.value)} inputMode="decimal" placeholder={placeholder} className={champ} />
    </div>
  )
}
