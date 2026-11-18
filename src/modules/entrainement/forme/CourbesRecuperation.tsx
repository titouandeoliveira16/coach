import { useLiveQuery } from 'dexie-react-hooks'
import { depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { GraphiqueLignes, SERIES } from '../../../core/ui/graphiques'
import { AIDES } from '../aides'
import { donneesProgres } from '../analyse/progres'

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })

/** VFC 7 jours (avec ta zone normale) et pouls au repos sur 60 jours : dans le détail du feu (déplacé de Progrès le 18/11/2026). */
export function CourbesRecuperation() {
  const t = useLiveQuery(donneesProgres)
  if (!t) return null
  return (
    <div>
      <p className="text-xs text-texte-2">Ta VFC (moyenne 7 jours) et ta zone normale<Aide titre="VFC" texte={`${AIDES.vfc7} ${AIDES.zoneVfc}`} /></p>
      <GraphiqueLignes etiquettes={t.physio.map((p) => jj(p.date))} format={(n) => n.toFixed(1).replace('.', ',')}
        bande={{ nom: 'Zone normale', bas: t.physio.map((p) => p.bas), haut: t.physio.map((p) => p.haut) }}
        series={[{ nom: 'VFC 7 j', couleur: SERIES[0], valeurs: t.physio.map((p) => p.ln7) }]} />
      <p className="mt-3 text-xs text-texte-2">Pouls au repos (bpm)</p>
      <GraphiqueLignes etiquettes={t.physio.map((p) => jj(p.date))} series={[{ nom: 'FC repos', couleur: SERIES[1], valeurs: t.physio.map((p) => p.fcRepos) }]} />
    </div>
  )
}
