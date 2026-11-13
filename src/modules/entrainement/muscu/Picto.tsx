import type { Picto as TypePicto } from './force'

/** Petits schémas des exercices (bonhomme filaire, la partie qui travaille en violet). */
export function Picto({ type, taille = 48 }: { type: TypePicto; taille?: number }) {
  const v = 'var(--color-muscu)'
  return (
    <svg width={taille} height={taille} viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {type === 'squat' && <>
        <line x1="12" y1="16" x2="48" y2="16" stroke="var(--color-texte-3)" strokeWidth={4} /><circle cx="30" cy="9" r="5" />
        <path d="M30 14 L28 30" /><path d="M28 30 L40 36 L36 52" stroke={v} /><path d="M28 30 L18 38 L22 52" stroke={v} /><path d="M20 18 L30 16 L40 18" />
      </>}
      {type === 'fente' && <>
        <circle cx="28" cy="9" r="5" /><path d="M28 14 L28 32" /><path d="M28 32 L40 38 L40 52" stroke={v} /><path d="M28 32 L18 44 L8 44" />
        <rect x="2" y="44" width="14" height="4" stroke="var(--color-texte-3)" /><path d="M28 20 L22 28 M28 20 L34 28" />
      </>}
      {type === 'souleve' && <>
        <circle cx="16" cy="18" r="5" /><path d="M20 21 L40 28" /><path d="M40 28 L38 40 L38 52" stroke={v} /><path d="M24 23 L26 40" />
        <line x1="18" y1="42" x2="34" y2="42" stroke="var(--color-texte-3)" strokeWidth={4} />
      </>}
      {type === 'curl' && <>
        <circle cx="8" cy="34" r="5" /><path d="M13 36 L36 38" /><path d="M36 38 L46 26" stroke={v} /><circle cx="48" cy="24" r="3" stroke="var(--color-texte-3)" />
        <line x1="4" y1="44" x2="44" y2="44" stroke="var(--color-texte-3)" />
      </>}
      {type === 'mollet' && <>
        <circle cx="30" cy="8" r="5" /><path d="M30 13 L30 34" /><path d="M30 34 L30 46 L34 50" stroke={v} /><rect x="24" y="50" width="22" height="5" stroke="var(--color-texte-3)" />
        <path d="M30 20 L24 30 M30 20 L36 30" />
      </>}
      {type === 'stepup' && <>
        <circle cx="26" cy="8" r="5" /><path d="M26 13 L26 30" /><path d="M26 30 L36 34 L36 42" stroke={v} /><path d="M26 30 L22 42 L22 54" />
        <rect x="32" y="42" width="20" height="12" stroke="var(--color-texte-3)" />
      </>}
    </svg>
  )
}
