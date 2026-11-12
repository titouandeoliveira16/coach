import { useEffect } from 'react'

/**
 * Tant qu'une fenêtre (feuille, aide « ? », saisie) est ouverte, la page derrière ne défile plus (12/11/2026 : avant,
 * certaines fenêtres laissaient la page bouger et ne défilaient pas elles-mêmes). Compte les fenêtres ouvertes.
 */
let ouvertes = 0
let avant = ''
export function useBloquerFond(actif = true) {
  useEffect(() => {
    if (!actif) return
    if (ouvertes++ === 0) {
      avant = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      document.documentElement.dataset.feuille = ''
    }
    return () => {
      if (--ouvertes === 0) {
        document.documentElement.style.overflow = avant
        delete document.documentElement.dataset.feuille
      }
    }
  }, [actif])
}
