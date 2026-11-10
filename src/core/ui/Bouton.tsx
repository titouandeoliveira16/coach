import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secondaire' }

/** Gros bouton tactile. « principal » prend la couleur d'accent du module. */
export function Bouton({ variante = 'principal', className = '', ...props }: Props) {
  const styles =
    variante === 'principal'
      ? 'bg-accent text-fond chiffre uppercase tracking-wide'
      : 'bg-surface-2 text-texte font-semibold'
  return (
    <button
      type="button"
      {...props}
      className={`presse w-full rounded-full px-4 py-3.5 disabled:opacity-40 ${styles} ${className}`}
    />
  )
}
