import { SectionAnalyse } from './SectionAnalyse'
import { SectionCourse } from './SectionCourse'
import { SectionStrava } from './SectionStrava'
import { SectionVelo } from './SectionVelo'

/** Réglages du module Entraînement, affichés dans l'écran Réglages. */
export function SectionReglagesEntrainement() {
  return (
    <>
      <SectionStrava />
      <SectionCourse />
      <SectionVelo />
      <SectionAnalyse />
    </>
  )
}
