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
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { NOMS_FAMILLES } from '../../../metrics/programme'
import { Historique } from './Historique'

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })

/** Progrès : est-ce que je progresse, sans me cramer ? Évolutions, tests, graphiques puis l'historique. */
export function Progres() {
  const t = useLiveQuery(donneesProgres)
  const familles = useLiveQuery(progressionFamilles)
  const [r, modifier] = useReglagesEntrainement()
  const [dateTest, setDateTest] = useState('')
  const [court, setCourt] = useState(true)
  if (!t) return null
  const pct = (a?: number, b?: number) => (a !== undefined && b ? ((a - b) / b) * 100 : undefined)
  const prog = programmeDe(r.programme)
  const premierTest = t.tests[0]
  const dernierTest = t.tests[t.tests.length - 1]
  const avantDernier = t.tests[t.tests.length - 2]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Tuile libelle="CP" valeur={dernierTest?.wkg ? formatNombre(dernierTest.wkg, 2) : '–'} sous={dernierTest ? `W/kg · ${dernierTest.w} W` : 'W/kg'}
          evolution={dernierTest?.wkg && avantDernier?.wkg ? `${dernierTest.wkg >= avantDernier.wkg ? '+' : ''}${formatNombre(dernierTest.wkg - avantDernier.wkg, 2)}` : undefined}
          hausse={dernierTest?.wkg && avantDernier?.wkg ? dernierTest.wkg >= avantDernier.wkg : undefined} />
        <Tuile libelle="Efficacité" aide={AIDES.efficacite} valeur={t.effRecente ? formatNombre(t.effRecente, 2) : '–'} sous="W par bpm"
          evolution={signe(pct(t.effRecente, t.effAvant))} hausse={t.effAvant ? t.effRecente! >= t.effAvant : undefined} />
        <Tuile libelle="Vélo 28 j" valeur={formatNombre(t.kj28)} sous="kJ" evolution={signe(pct(t.kj28, t.kj28Avant))} hausse={t.kj28Avant ? t.kj28 >= t.kj28Avant : undefined} />
      </div>

      <Carte titre="Évolution de mes tests">
        {t.tests.length === 0 ? (
          <p className="text-sm text-texte-3">Ton premier test donnera ton point de départ.</p>
        ) : (
          <>
            {premierTest && dernierTest && t.tests.length >= 2 && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <Ecart libelle="W/kg" a={premierTest.wkg} b={dernierTest.wkg} decimales={2} />
                <Ecart libelle="CP (W)" a={premierTest.w} b={dernierTest.w} />
                <Ecart libelle="Poids (kg)" a={premierTest.poidsKg} b={dernierTest.poidsKg} decimales={1} inverse />
              </div>
            )}
            {t.tests.length >= 2 && (
              <>
                <p className="mt-3 text-xs text-texte-3">Depuis le {depuisJour(t.tests[0].date).toLocaleDateString('fr-FR')} · rapport poids / puissance (W/kg)<Aide titre="W/kg" texte={AIDES.wkg} /></p>
                <GraphiqueLignes etiquettes={t.tests.map((x) => jj(x.date))} format={(n) => n.toFixed(2).replace('.', ',')}
                  series={[{ nom: 'W/kg', couleur: SERIES[1], valeurs: t.tests.map((x) => x.wkg) }]} />
              </>
            )}
            <ul className="mt-2 text-sm">
              {[...t.tests].reverse().map((x, i, l) => {
                const avant = l[i + 1]
                const ecart = x.wkg && avant?.wkg ? x.wkg - avant.wkg : undefined
                return (
                  <li key={x.date + i} className="flex items-baseline justify-between gap-2 border-t border-bordure py-1.5">
                    <span className="text-texte-2">{depuisJour(x.date).toLocaleDateString('fr-FR')}</span>
                    <span className="text-right">
                      <b>{x.wkg ? `${formatNombre(x.wkg, 2)} W/kg` : `${x.w} W`}</b>
                      {ecart !== undefined && <span className={ecart >= 0 ? 'text-nutrition' : 'text-[#f87171]'}> ({ecart >= 0 ? '+' : ''}{formatNombre(ecart, 2)})</span>}
                      <span className="block text-xs text-texte-3">{x.w} W{x.poidsKg ? ` · ${formatNombre(x.poidsKg, 1)} kg` : ''}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {t.cpEstimee && (
          <p className="mt-2 text-sm text-texte-2">
            D'après tes meilleurs efforts des 6 dernières semaines : <b className="text-texte">~{t.cpEstimee} W</b>
            <Aide titre="Estimation entre deux tests" texte={AIDES.cpEstimee} />
            {t.cpW && t.cpEstimee > t.cpW * 1.03 && <span className="block font-semibold text-nutrition">Tu sembles avoir progressé : avance ton prochain test.</span>}
          </p>
        )}
      </Carte>

      <Carte titre="Mes prochains tests">
        <p className="text-sm text-texte-2">Chaque test recale tes zones et les watts de tes séances à venir.</p>
        {t.testsPrevus.length === 0 && <p className="text-sm text-texte-3">Aucun test programmé.</p>}
        {t.testsPrevus.map((d) => (
          <div key={d} className="flex items-center justify-between py-1 text-sm">
            <span>
              <span className="capitalize">{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span className="text-texte-3"> · {t.testsCourts.includes(d) ? "court (3' + 12')" : 'complet (12-7-3)'}</span>
            </span>
            <button type="button" className="px-2 text-texte-3" aria-label="Retirer ce test"
              onClick={() => modifier({ programme: { ...prog, testsCp: prog.testsCp.filter((x) => x !== d), testsCourts: (prog.testsCourts ?? []).filter((x) => x !== d) } })}>×</button>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <input type="date" value={dateTest} onChange={(e) => setDateTest(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm" />
          <select value={court ? 'court' : 'complet'} onChange={(e) => setCourt(e.target.value === 'court')} className="rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm">
            <option value="court">Court</option>
            <option value="complet">Complet</option>
          </select>
          <button type="button" disabled={!dateTest} className="px-2 text-sm font-semibold text-accent disabled:opacity-40"
            onClick={() => {
              modifier({ programme: { ...prog, testsCp: [...new Set([...prog.testsCp, dateTest])].sort(),
                testsCourts: court ? [...new Set([...(prog.testsCourts ?? []), dateTest])] : (prog.testsCourts ?? []).filter((x) => x !== dateTest) } })
              setDateTest('')
            }}>OK</button>
        </div>
        <p className="mt-2 text-xs text-texte-3">Conseil : un test toutes les 6 à 8 semaines, frais (après une semaine allégée). Complet = 1 h 50 (le dimanche), court = 1 h 15. Résultat à saisir dans <Link to="/entrainement/reglages" className="text-accent">Réglages → Vélo</Link>.</p>
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
            <Link to="/entrainement/reglages" className="text-accent">Importer 3 mois depuis Intervals ›</Link>
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

/** Écart entre le premier et le dernier test (vert = progrès ; pour le poids, une baisse compte comme un progrès). */
function Ecart({ libelle, a, b, decimales = 0, inverse = false }: { libelle: string; a?: number; b?: number; decimales?: number; inverse?: boolean }) {
  const d = a !== undefined && b !== undefined ? b - a : undefined
  const bien = d !== undefined && (inverse ? d <= 0 : d >= 0)
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className="text-xs text-texte-3">{libelle}</p>
      <p className={`text-lg font-bold tabular-nums ${d === undefined ? '' : bien ? 'text-nutrition' : 'text-[#f87171]'}`}>
        {d === undefined ? '–' : `${d >= 0 ? '+' : ''}${formatNombre(d, decimales)}`}
      </p>
      {a !== undefined && b !== undefined && a !== 0 && <p className="text-[11px] text-texte-3">{signe(((b - a) / a) * 100)}</p>}
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
