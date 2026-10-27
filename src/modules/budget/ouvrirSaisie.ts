import { createContext, useContext } from 'react'
import type { Mouvement } from './types'

/** Ouvre la saisie rapide depuis n'importe quel écran du module (vide, pour modifier ou pour dupliquer). */
export const ContexteSaisie = createContext<(initial?: Partial<Mouvement>) => void>(() => {})
export const useOuvrirSaisie = () => useContext(ContexteSaisie)
