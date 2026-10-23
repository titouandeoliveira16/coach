import { SectionCourse } from './SectionCourse'
import { SectionVelo } from './SectionVelo'

/** Réglages du module Entraînement, affichés dans l'écran Réglages. */
export function SectionReglagesEntrainement() {
  return (
    <>
      <SectionCourse />
      <SectionVelo />
    </>
  )
}
