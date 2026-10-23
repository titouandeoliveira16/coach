import { useState } from 'react'
import { Carte } from '../../../core/ui/Carte'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { SectionAnalyse } from './SectionAnalyse'
import { SectionIntervals } from './SectionIntervals'
import { ProgrammeAvance } from './SectionProgramme'
import { SectionVelo } from './SectionVelo'
import { ZonesVelo } from './ZonesVelo'

/** Réglages du module Entraînement : l'essentiel, puis « Avancé » replié. */
export function SectionReglagesEntrainement() {
  const [avance, setAvance] = useState(false)
  const [r, modifier] = useReglagesEntrainement()
  return (
    <>
      <SectionIntervals />
      <SectionVelo />
      <button type="button" onClick={() => setAvance(!avance)} className="w-full py-2 text-left text-sm font-semibold text-texte-3">
        {avance ? '▾ Avancé' : '▸ Avancé (zones, phases, tests, analyse)'}
      </button>
      {avance && (
        <>
          <Carte titre="Zones vélo">
            <ZonesVelo zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
          </Carte>
          <ProgrammeAvance />
          <SectionAnalyse />
        </>
      )}
    </>
  )
}
