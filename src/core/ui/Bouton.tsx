import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secondaire' }

/** Gros bouton tactile. « principal » prend la couleur d'accent du module. */
export function Bouton({ variante = 'principal', className = '', ...props }: Props) {
  const styles =
    variante === 'principal'
      ? 'bg-accent text-fond'
      : 'border border-bordure bg-surface-2 text-texte'
  return (
    <button
      type="button"
      {...props}
      className={`w-full rounded-xl px-4 py-3 font-semibold active:scale-[0.98] disabled:opacity-40 ${styles} ${className}`}
    />
  )
}
