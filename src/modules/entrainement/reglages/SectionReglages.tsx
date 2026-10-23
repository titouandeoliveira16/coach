import { SectionAnalyse } from './SectionAnalyse'
import { SectionCourse } from './SectionCourse'
import { SectionIntervals } from './SectionIntervals'
import { SectionProgramme } from './SectionProgramme'
import { SectionVelo } from './SectionVelo'

/** Réglages du module Entraînement, affichés dans l'écran Réglages. */
export function SectionReglagesEntrainement() {
  return (
    <>
      <SectionIntervals />
      <SectionCourse />
      <SectionVelo />
      <SectionProgramme />
      <SectionAnalyse />
    </>
  )
}
