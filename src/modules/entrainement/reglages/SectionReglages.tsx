import { lazy, Suspense, useState } from 'react'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Tuile } from '../../../core/ui/Repliable'
import { AIDES } from '../aides'
import { useReglage } from '../../../core/reglages'
// Catalogue (250 Ko) chargé seulement quand on ouvre l'encart
const ListeCatalogue = lazy(() => import('../../catalogue/ListeCatalogue').then((m) => ({ default: m.ListeCatalogue })))
import type { SeanceCatalogue } from '../../catalogue/donnees'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CalageFc } from './CalageFc'
import { SectionProfilSportif, type ProfilSportif } from './ProfilSportif'
import { SectionAgenda } from './SectionAgenda'
import { SectionIntervals } from './SectionIntervals'
import { SectionProfil } from './SectionProfil'
import { SectionVelo } from './SectionVelo'
import { SectionMuscu } from './SectionMuscu'
import { ZonesVelo } from './ZonesVelo'
import { Calculateurs } from '../analyse/Calculateurs'
import { useProfil } from '../../../core/profil'

/**
 * Réglages du module Entraînement, en encarts courts qu'on ouvre et qu'on réduit :
 * profil, profil sportif, vélo (CP et semaine type), Intervals.icu, puis trois carrés (agenda, catalogue, zones).
 * Le programme, la charge de référence et l'historique des tests ne se règlent plus ici (l'appli les gère ; tests dans Progrès).
 */
export function SectionReglagesEntrainement() {
  const [r, modifier] = useReglagesEntrainement()
  const [ps] = useReglage<ProfilSportif>('profil-sportif', { sports: [], materiel: [] })
  const [catalogue, setCatalogue] = useState(false)
  // Catalogue limité aux sports pratiqués, vélo seulement (la course à pied est mise de côté) ; renfo toujours ; sans réponse : route et renfo
  const VERS_CATALOGUE: Record<string, SeanceCatalogue['sport']> = { 'Vélo route': 'velo', VTT: 'vtt', Musculation: 'force' }
  const sports = [...new Set([...(ps.sports.length ? ps.sports.map((x) => VERS_CATALOGUE[x]).filter(Boolean) : ['velo']), 'force'])] as SeanceCatalogue['sport'][]
  const [agenda, setAgenda] = useState(false)
  const [avance, setAvance] = useState(false)
  const [profil] = useProfil()
  return (
    <>
      <SectionProfil />
      <SectionProfilSportif />
      <SectionVelo />
      <SectionMuscu />
      <SectionIntervals />
      <div className="flex flex-col gap-2">
        <Tuile titre="Google Agenda" ouvert={agenda} onClick={() => setAgenda(!agenda)} />
        <Tuile titre="Catalogue scientifique" ouvert={catalogue} onClick={() => setCatalogue(!catalogue)} />
        <Tuile titre="Avancé : zones et calculs" ouvert={avance} onClick={() => setAvance(!avance)} />
      </div>
      {agenda && <SectionAgenda className="border-accent!" />}
      {catalogue && (
        <Carte titre="Catalogue scientifique" className="border-accent!">
          <Suspense fallback={<p className="text-sm text-texte-3">Chargement…</p>}><ListeCatalogue sports={sports} /></Suspense>
        </Carte>
      )}
      {avance && (
        <Carte titre="Zones vélo" className="border-accent!">
          <p className="text-sm text-texte-2">En % de ta CP (domaines physiologiques).<Aide titre="Zones" texte={AIDES.zonesCp} /></p>
          <p className="mt-1 text-xs text-texte-3">À vélo, ce sont tes watts qui comptent : les bpm servent à vérifier (et pour la course à pied).</p>
          <CalageFc zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
          <ZonesVelo zones={r.zonesVelo} cpW={r.cpW} onModifier={(zonesVelo) => modifier({ zonesVelo })} />
        </Carte>
      )}
      {avance && <Calculateurs cpW={r.cpW} wPrimeKj={r.wPrimeKj} poidsKg={profil.poidsKg} />}
    </>
  )
}
