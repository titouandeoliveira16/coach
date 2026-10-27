/**
 * Icônes de l'appli, dessinées en SVG (aucune dépendance, fonctionne hors ligne).
 * Elles prennent la couleur du texte courant (currentColor).
 */
type Props = { className?: string }

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

/** Éclair : module Entraînement */
export function IconeEntrainement({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  )
}

export function IconeReglages({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function IconePlus({ className }: Props) {
  return (
    <svg {...base} strokeWidth={2.5} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Livre ouvert : mode d'emploi */
export function IconeAide({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

/** Pièce : module Argent */
export function IconeArgent({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.6a4 4 0 1 0 0 6.8M7.5 11h5.5M7.5 13h5.5" />
    </svg>
  )
}

/** Maison : accueil */
export function IconeAccueil({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}

/** Toque de diplômé : module Révision CAPEPS */
export function IconeRevision({ className }: Props) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M2 9.5 12 5l10 4.5L12 14z" />
      <path d="M6 11.3v4.2c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.2M22 9.5V15" />
    </svg>
  )
}
