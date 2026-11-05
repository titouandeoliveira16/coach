import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Tuile } from '../../../core/ui/Repliable'
import { AIDES } from '../aides'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CalageFc } from './CalageFc'
import { SectionProfilSportif } from './ProfilSportif'
import { SectionAgenda } from './SectionAgenda'
import { SectionIntervals } from './SectionIntervals'
import { SectionProfil } from './SectionProfil'
import { SectionVelo } from './SectionVelo'
import { ZonesVelo } from './ZonesVelo'

/**
 * Réglages du module Entraînement, en encarts courts qu'on ouvre et qu'on réduit :
 * profil, profil sportif, vélo (CP et semaine type), Intervals.icu, puis trois carrés (agenda, catalogue, zones).
 * Le programme, la charge de référence et l'historique des tests ne se règlent plus ici (l'appli les gère ; tests dans Progrès).
 */
export function SectionReglagesEntrainement() {
  const [r, modifier] = useReglagesEntrainement()
  const navigate = useNavigate()
  const [agenda, setAgenda] = useState(false)
  const [avance, setAvance] = useState(false)
  return (
    <>
      <SectionProfil />
      <SectionProfilSportif />
      <SectionVelo />
      <SectionIntervals />
      <div className="grid grid-cols-3 gap-2">
        <Tuile titre="Google Agenda" ouvert={agenda} onClick={() => setAgenda(!agenda)} />
        <Tuile titre="Catalogue scientifique" fleche="›" onClick={() => navigate('/catalogue')} />
        <Tuile titre="Avancé : zones" ouvert={avance} onClick={() => setAvance(!avance)} />
      </div>
      {agenda && <SectionAgenda className="border-accent!" />}
      {avance && (
        <Carte titre="Zones vélo" className="border-accent!">
          <p className="text-sm text-texte-2">En % de ta CP (domaines physiologiques).<Aide titre="Zones" texte={AIDES.zonesCp} /></p>
          <p className="mt-1 text-xs text-texte-3">À vélo, ce sont tes watts qui comptent : les bpm servent à vérifier (et pour la course à pied).</p>
          <CalageFc zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
          <ZonesVelo zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
        </Carte>
      )}
    </>
  )
}
