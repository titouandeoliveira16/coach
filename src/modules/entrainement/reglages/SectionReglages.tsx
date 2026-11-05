import { useEffect, useRef, useState } from 'react'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Tuile } from '../../../core/ui/Repliable'
import { AIDES } from '../aides'
import { useReglage } from '../../../core/reglages'
import { ListeCatalogue } from '../../catalogue/ListeCatalogue'
import type { SeanceCatalogue } from '../../catalogue/donnees'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CalageFc } from './CalageFc'
import { SectionProfilSportif, type ProfilSportif } from './ProfilSportif'
import { SectionAgenda } from './SectionAgenda'
import { SectionIntervals } from './SectionIntervals'
import { SectionProfil } from './SectionProfil'
import { SectionVelo } from './SectionVelo'
import { ZonesVelo } from './ZonesVelo'

/**
 * Hauteur pour que les carrés descendent jusqu'au menu du bas quand rien n'est ouvert au-dessus
 * (72 px au moins). Recalculée quand un encart au-dessus s'ouvre ou se réduit.
 */
function useHauteurJusquABarre() {
  const ref = useRef<HTMLDivElement>(null)
  const [hauteur, setHauteur] = useState<number>()
  useEffect(() => {
    const el = ref.current
    if (!el?.parentElement) return
    const calculer = () => {
      const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed')
      const hautBarre = (nav?.getBoundingClientRect().top ?? window.innerHeight - 90) + window.scrollY
      const haut = el.getBoundingClientRect().top + window.scrollY
      const h = Math.max(72, Math.floor(hautBarre - 12 - haut))
      setHauteur((avant) => (avant === h ? avant : h))
    }
    calculer()
    const obs = new ResizeObserver(calculer)
    obs.observe(el.parentElement)
    window.addEventListener('resize', calculer)
    return () => { obs.disconnect(); window.removeEventListener('resize', calculer) }
  }, [])
  return { ref, hauteur }
}

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
  const { ref: grille, hauteur } = useHauteurJusquABarre()
  return (
    <>
      <SectionProfil />
      <SectionProfilSportif />
      <SectionVelo />
      <SectionIntervals />
      <div ref={grille} className="grid grid-cols-3 gap-2" style={{ height: hauteur }}>
        <Tuile titre="Google Agenda" ouvert={agenda} onClick={() => setAgenda(!agenda)} />
        <Tuile titre="Catalogue scientifique" ouvert={catalogue} onClick={() => setCatalogue(!catalogue)} />
        <Tuile titre="Avancé : zones" ouvert={avance} onClick={() => setAvance(!avance)} />
      </div>
      {agenda && <SectionAgenda className="border-accent!" />}
      {catalogue && (
        <Carte titre="Catalogue scientifique" className="border-accent!">
          <ListeCatalogue sports={sports} />
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
    </>
  )
}
