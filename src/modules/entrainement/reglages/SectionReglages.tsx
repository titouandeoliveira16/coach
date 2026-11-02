import { useState } from 'react'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CalageFc } from './CalageFc'
import { SectionAgenda } from './SectionAgenda'
import { SectionAnalyse } from './SectionAnalyse'
import { SectionIntervals } from './SectionIntervals'
import { SectionProfil } from './SectionProfil'
import { ProgrammeAvance } from './SectionProgramme'
import { SectionVelo } from './SectionVelo'
import { ZonesVelo } from './ZonesVelo'

/** Réglages du module Entraînement : l'essentiel, puis « Avancé » replié. */
export function SectionReglagesEntrainement() {
  const [avance, setAvance] = useState(false)
  const [r, modifier] = useReglagesEntrainement()
  return (
    <>
      <SectionProfil />
      <SectionIntervals />
      <SectionVelo />
      <SectionAgenda />
      <button type="button" onClick={() => setAvance(!avance)} className="w-full py-2 text-left text-sm font-semibold text-texte-3">
        {avance ? '▾ Avancé' : '▸ Avancé (zones, phases, tests, analyse)'}
      </button>
      {avance && (
        <>
          <Carte titre="Zones vélo">
            <p className="text-sm text-texte-2">En % de ta CP (domaines physiologiques).<Aide titre="Zones" texte={AIDES.zonesCp} /></p>
            <p className="mt-1 text-xs text-texte-3">À vélo, ce sont tes watts qui comptent : les bpm servent à vérifier (et pour la course à pied). Sur des efforts courts, la FC met 1 à 3 min à monter et reste sous la zone de tes watts : c'est normal.</p>
            <CalageFc zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
            <ZonesVelo zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
          </Carte>
          <ProgrammeAvance />
          <SectionAnalyse />
        </>
      )}
    </>
  )
}
