import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { GraphiqueBarres, GraphiqueLignes, SERIES } from '../../../core/ui/graphiques'
import { AIDES } from '../aides'
import { JOURS_AMORCAGE } from '../analyse/donnees'
import { donneesProgres } from '../analyse/progres'
import { z2Actuel } from '../plan/programme'
import { Historique } from './Historique'

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })

/** Progrès : est-ce que je progresse, sans me cramer ? 4 graphiques puis l'historique. */
export function Progres() {
  const t = useLiveQuery(donneesProgres)
  const z2 = useLiveQuery(z2Actuel)
  if (!t) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Tuile libelle="CP" valeur={t.cpW ? `${t.cpW} W` : '–'} />
        <Tuile libelle="Z2" valeur={z2 ? `${z2.w} W` : '–'} aide={AIDES.z2Auto} />
        <Tuile libelle="VMA" valeur={t.vmaKmh ? `${formatNombre(t.vmaKmh, 1)}` : '–'} sous="km/h" />
      </div>

      <Carte titre="Mes watts">
        <GraphiqueLignes etiquettes={t.watts.map((p) => jj(p.date))}
          series={[
            { nom: 'CP (tests)', couleur: SERIES[1], valeurs: t.watts.map((p) => p.cp) },
            { nom: 'Sorties Z2', couleur: SERIES[0], valeurs: t.watts.map((p) => p.z2) },
          ]} />
        <p className="mt-1 text-xs text-texte-3">Plus de watts en Z2 pour le même effort = tu progresses.</p>
      </Carte>

      <Carte titre="Ma semaine d'entraînement">
        <p className="text-sm text-texte-2">🚴 Vélo (kJ)</p>
        <GraphiqueBarres etiquettes={t.semaines.map(jj)} series={[{ nom: 'kJ vélo', couleur: SERIES[0], valeurs: t.kjVelo }]} />
        <p className="mt-3 text-sm text-texte-2">🏃 Course (charge {t.unite})</p>
        <GraphiqueBarres etiquettes={t.semaines.map(jj)} series={[{ nom: 'Course', couleur: SERIES[1], valeurs: t.chargeCourse }]} />
      </Carte>

      <Carte titre="Forme et fatigue">
        {t.a.amorcage ? (
          <p className="text-sm text-texte-2">
            Encore {JOURS_AMORCAGE - t.a.joursHistorique} jours d'historique avant d'afficher ce graphique.{' '}
            <Link to="/reglages" className="text-accent">Importer 3 mois depuis Intervals ›</Link>
          </p>
        ) : (
          <>
            <GraphiqueLignes zero etiquettes={t.forme.map((p) => jj(p.date))}
              series={[
                { nom: 'Forme de fond', couleur: SERIES[0], valeurs: t.forme.map((p) => p.ctl) },
                { nom: 'Fatigue', couleur: SERIES[1], valeurs: t.forme.map((p) => p.atl) },
                { nom: 'Fraîcheur', couleur: SERIES[2], valeurs: t.forme.map((p) => p.tsb) },
              ]} />
            <p className="mt-1 text-xs text-texte-3">
              Fraîcheur sous −20 : fatigue accumulée, prudence.<Aide titre="Forme et fatigue" texte={`${AIDES.ctl} ${AIDES.atl} ${AIDES.tsb}`} />
            </p>
          </>
        )}
      </Carte>

      <Carte titre="Récupération">
        <p className="text-sm text-texte-2">VFC (moyenne 7 jours) et ta zone normale<Aide titre="VFC" texte={`${AIDES.vfc7} ${AIDES.zoneVfc}`} /></p>
        <GraphiqueLignes etiquettes={t.physio.map((p) => jj(p.date))} format={(n) => n.toFixed(1).replace('.', ',')}
          bande={{ nom: 'Zone normale', bas: t.physio.map((p) => p.bas), haut: t.physio.map((p) => p.haut) }}
          series={[{ nom: 'VFC 7 j', couleur: SERIES[0], valeurs: t.physio.map((p) => p.ln7) }]} />
        <p className="mt-3 text-sm text-texte-2">FC de repos (bpm)</p>
        <GraphiqueLignes etiquettes={t.physio.map((p) => jj(p.date))} series={[{ nom: 'FC repos', couleur: SERIES[1], valeurs: t.physio.map((p) => p.fcRepos) }]} />
      </Carte>

      <h2 className="px-1 pt-2 text-lg font-bold">Mes séances</h2>
      <Historique />
    </div>
  )
}

function Tuile({ libelle, valeur, aide, sous }: { libelle: string; valeur: string; aide?: string; sous?: string }) {
  return (
    <div className="rounded-xl border border-bordure bg-surface p-2.5 text-center">
      <p className="text-xs text-texte-3">{libelle}{aide && <Aide titre={libelle} texte={aide} />}</p>
      <p className="text-xl font-bold tabular-nums">{valeur}</p>
      {sous && <p className="text-[11px] text-texte-3">{sous}</p>}
    </div>
  )
}
