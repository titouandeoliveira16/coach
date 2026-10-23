import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { GraphiqueBarres, GraphiqueLignes, SERIES } from '../../../core/ui/graphiques'
import { AIDES } from '../aides'
import { JOURS_AMORCAGE } from '../analyse/donnees'
import { donneesProgres } from '../analyse/progres'
import { progressionFamilles } from '../plan/programme'
import { PROGRAMME_DEFAUT, useReglagesEntrainement } from '../reglagesEntrainement'
import { NOMS_FAMILLES } from '../../../metrics/programme'
import { Historique } from './Historique'

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })

/** Progrès : est-ce que je progresse, sans me cramer ? Évolutions, tests, graphiques puis l'historique. */
export function Progres() {
  const t = useLiveQuery(donneesProgres)
  const familles = useLiveQuery(progressionFamilles)
  const [r, modifier] = useReglagesEntrainement()
  const [dateTest, setDateTest] = useState('')
  if (!t) return null
  const pct = (a?: number, b?: number) => (a !== undefined && b ? ((a - b) / b) * 100 : undefined)
  const prog = { ...PROGRAMME_DEFAUT, ...r.programme }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Tuile libelle="CP" valeur={t.cpW ? `${t.cpW} W` : '–'} evolution={t.cpW && t.cpPrecedente ? `${t.cpW - t.cpPrecedente >= 0 ? '+' : ''}${t.cpW - t.cpPrecedente} W` : undefined}
          hausse={t.cpW && t.cpPrecedente ? t.cpW >= t.cpPrecedente : undefined} sous="vs test précédent" />
        <Tuile libelle="Efficacité" aide={AIDES.efficacite} valeur={t.effRecente ? formatNombre(t.effRecente, 2) : '–'} sous="W par bpm"
          evolution={signe(pct(t.effRecente, t.effAvant))} hausse={t.effAvant ? t.effRecente! >= t.effAvant : undefined} />
        <Tuile libelle="Vélo 28 j" valeur={formatNombre(t.kj28)} sous="kJ" evolution={signe(pct(t.kj28, t.kj28Avant))} hausse={t.kj28Avant ? t.kj28 >= t.kj28Avant : undefined} />
      </div>

      <Carte titre="Tests et zones">
        <p className="text-sm text-texte-2">Chaque test CP recale tes zones et les watts de toutes tes séances.</p>
        {t.tests.length > 0 && (
          <ul className="mt-2 text-sm">
            {[...t.tests].reverse().map((x, i, l) => (
              <li key={x.date + i} className="flex justify-between border-t border-bordure py-1.5">
                <span className="text-texte-2">{depuisJour(x.date).toLocaleDateString('fr-FR')}</span>
                <span className="font-semibold">CP {x.valeur} W{l[i + 1] && <span className={x.valeur >= l[i + 1].valeur ? 'text-nutrition' : 'text-[#f87171]'}> ({x.valeur - l[i + 1].valeur >= 0 ? '+' : ''}{x.valeur - l[i + 1].valeur})</span>}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm font-semibold">Prochains tests</p>
        {t.testsPrevus.length === 0 && <p className="text-sm text-texte-3">Aucun test programmé.</p>}
        {t.testsPrevus.map((d) => (
          <div key={d} className="flex items-center justify-between py-1 text-sm">
            <span className="capitalize">{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <button type="button" className="px-2 text-texte-3" aria-label="Retirer ce test"
              onClick={() => modifier({ programme: { ...prog, testsCp: prog.testsCp.filter((x) => x !== d) } })}>×</button>
          </div>
        ))}
        <div className="mt-1 flex gap-2">
          <input type="date" value={dateTest} onChange={(e) => setDateTest(e.target.value)} className="flex-1 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm" />
          <button type="button" disabled={!dateTest} className="px-3 text-sm font-semibold text-accent disabled:opacity-40"
            onClick={() => { modifier({ programme: { ...prog, testsCp: [...new Set([...prog.testsCp, dateTest])] } }); setDateTest('') }}>Programmer</button>
        </div>
        <p className="mt-2 text-xs text-texte-3">Conseil : un test toutes les 6 à 8 semaines, en fin de semaine allégée. Résultat à saisir dans <Link to="/reglages" className="text-accent">Réglages → Vélo</Link>.</p>
      </Carte>

      {familles && familles.length > 0 && (
        <Carte titre="Mes séances d'intensité">
          <ul className="text-sm">
            {familles.map((f) => (
              <li key={f.famille} className="flex items-center justify-between border-t border-bordure py-1.5 first:border-0">
                <span>{NOMS_FAMILLES[f.famille]}</span>
                <span className="text-texte-2">
                  palier <b className="text-texte">{f.palier}/4</b>
                  {f.bonus !== 0 && <span className={f.bonus > 0 ? 'text-nutrition' : 'text-[#f87171]'}> · {f.bonus > 0 ? '+' : ''}{formatNombre(f.bonus * 100, 1)} % W</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-texte-3">Monte d'un palier à chaque séance tenue.<Aide titre="Progression" texte={AIDES.progression} /></p>
        </Carte>
      )}

      <Carte titre="Efficacité aérobie (vélo)">
        <GraphiqueLignes etiquettes={t.efficacite.map((p) => jj(p.date))} format={(n) => n.toFixed(2).replace('.', ',')}
          series={[{ nom: 'W par bpm', couleur: SERIES[0], valeurs: t.efficacite.map((p) => p.valeur) }]} />
        <p className="mt-1 text-xs text-texte-3">Sorties faciles de 45 min et plus. Si la courbe monte, tu produis plus de watts pour le même cœur : tu progresses.</p>
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

const signe = (n?: number) => (n === undefined ? undefined : `${n >= 0 ? '+' : ''}${Math.round(n)} %`)

function Tuile({ libelle, valeur, aide, sous, evolution, hausse }: { libelle: string; valeur: string; aide?: string; sous?: string; evolution?: string; hausse?: boolean }) {
  return (
    <div className="rounded-xl border border-bordure bg-surface p-2.5 text-center">
      <p className="text-xs text-texte-3">{libelle}{aide && <Aide titre={libelle} texte={aide} />}</p>
      <p className="text-xl font-bold tabular-nums">{valeur}</p>
      {evolution && <p className={`text-xs font-semibold ${hausse ? 'text-nutrition' : 'text-[#f87171]'}`}>{hausse ? '▲' : '▼'} {evolution}</p>}
      {sous && <p className="text-[11px] text-texte-3">{sous}</p>}
    </div>
  )
}
