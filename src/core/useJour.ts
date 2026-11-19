import { useEffect, useState } from 'react'
import { aujourdhui } from './dates'

/**
 * Le jour en cours, qui change tout seul (audit du 18/11/2026) : appli restée ouverte la veille puis rouverte le matin,
 * passage de minuit. Sans ça, l'écran gardait le feu et la séance d'hier.
 */
export function useJour() {
  const [jour, setJour] = useState(aujourdhui)
  useEffect(() => {
    const verifier = () => setJour((j) => (aujourdhui() !== j ? aujourdhui() : j))
    // Retour dans l'appli, et un coup d'œil chaque minute (minuit pendant que l'écran est ouvert)
    document.addEventListener('visibilitychange', verifier)
    window.addEventListener('focus', verifier)
    window.addEventListener('pageshow', verifier)
    const t = setInterval(verifier, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', verifier)
      window.removeEventListener('focus', verifier)
      window.removeEventListener('pageshow', verifier)
      clearInterval(t)
    }
  }, [])
  return jour
}
