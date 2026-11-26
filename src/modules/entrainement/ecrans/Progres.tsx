import { duree } from '../../../core/format'
import { Repartition } from '../analyse/RecordsEtRepartition'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { GraphiqueLignes, SERIES } from '../../../core/ui/graphiques'
import { Repliable } from '../../../core/ui/Repliable'
import { AIDES } from '../aides'
import { FTP_SUR_CP } from '../../../metrics/puissance'
import { donneesProgres, HAUSSE_CP } from '../analyse/progres'
import { progressionFamilles } from '../plan/programme'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { construireTest, NOMS_FAMILLES } from '../../../metrics/programme'

/** Durée réelle d'un test (celle de sa fiche), ex. « 1 h 52 » */
const dureeTest = (court: boolean) => { const m = construireTest(250, court).dureeMin; return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` }
import { Historique } from './Historique'
import { ListeVictoires } from '../forme/Celebration'
import { victoiresRecentes } from '../forme/victoires'
import { CourbePuissance } from '../analyse/CourbePuissance'

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })

/** Progrès : est-ce que je progresse, sans me cramer ? Évolutions, tests, graphiques puis l'historique. */
export function Progres() {
  const t = useLiveQuery(donneesProgres)
  const familles = useLiveQuery(progressionFamilles)
  const [r, modifier] = useReglagesEntrainement()
  const [dateTest, setDateTest] = useState('')
  const [court, setCourt] = useState(true)
  const [testsOuverts, setTestsOuverts] = useState(false)
  const nVictoires = useLiveQuery(async () => (await victoiresRecentes(30)).length)
  if (!t) return null
  const pct = (a?: number, b?: number) => (a !== undefined && b ? ((a - b) / b) * 100 : undefined)
  const prog = programmeDe(r.programme)
  const premierTest = t.tests[0]
  const dernierTest = t.tests[t.tests.length - 1]
  const avantDernier = t.tests[t.tests.length - 2]

  const prochain = t.testsPrevus[0]

  return (
    <div className="space-y-3">
      {/* Progrès allégé (maquette validée le 18/11/2026) : CP et prochain test, puis ce qui dit « je progresse » */}
      <div className="grid grid-cols-2 gap-2">
        <Tuile libelle="CP" aide={AIDES.wkg} valeur={dernierTest?.wkg ? formatNombre(dernierTest.wkg, 2) : dernierTest ? `${dernierTest.w}` : t.cpW ? `${Math.round(t.cpW)}` : '–'}
          sous={`${dernierTest ? (dernierTest.wkg ? `W/kg · ${dernierTest.w} W` : 'W') : t.cpW ? 'W · déclarée' : 'après ton 1er test'}${(t.cpW ?? t.cpEstimee) ? ` · FTP ≈ ${Math.round((t.cpW ?? t.cpEstimee)! * FTP_SUR_CP)} W` : ''}`}
          evolution={dernierTest?.wkg && avantDernier?.wkg ? `${dernierTest.wkg >= avantDernier.wkg ? '+' : ''}${formatNombre(dernierTest.wkg - avantDernier.wkg, 2)}` : undefined}
          hausse={dernierTest?.wkg && avantDernier?.wkg ? dernierTest.wkg >= avantDernier.wkg : undefined} />
        <button type="button" onClick={() => setTestsOuverts(!testsOuverts)} className={`entree rounded-[14px] border-[1.5px] bg-surface p-3 text-left ${testsOuverts ? 'border-accent' : 'border-transparent'}`}>
          <p className="text-[13px] font-semibold text-texte-2">Prochain test</p>
          <p className="chiffre mt-0.5 text-2xl">{prochain ? depuisJour(prochain).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '–'}</p>
          <p className="text-xs text-texte-3">{prochain ? (t.testsCourts.includes(prochain) ? "court 3′ + 12′" : 'complet 12-7-3') : 'aucun prévu'}</p>
          <p className="text-xs font-semibold text-accent">{t.testsPrevus.length ? `${t.testsPrevus.length} test${t.testsPrevus.length > 1 ? 's' : ''} prévu${t.testsPrevus.length > 1 ? 's' : ''} ${testsOuverts ? '▴' : '›'}` : 'Ajouter un test ›'}</p>
        </button>
      </div>
      {testsOuverts && (
        <Carte titre="Mes prochains tests" className="border-accent!">
          <p className="text-sm text-texte-2">Chaque test recale tes zones et les watts de tes séances à venir.</p>
          {t.testsPrevus.map((d) => (
            <div key={d} className="flex items-center justify-between py-1 text-sm">
              <span>
                <span className="inline-block first-letter:uppercase">{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="text-texte-3"> · {t.testsCourts.includes(d) ? "court (3' + 12')" : 'complet (12-7-3)'}</span>
              </span>
              <button type="button" className="min-h-11 px-2 text-texte-3" aria-label="Retirer ce test"
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
          <p className="mt-2 text-xs text-texte-3">Un test avant chaque nouveau cycle, frais (après une semaine allégée). Complet = {dureeTest(false)}, court = {dureeTest(true)}. Résultat à saisir dans <Link to="/entrainement/reglages" className="text-accent">Réglages → Vélo</Link>.</p>
        </Carte>
      )}

      <Carte titre="Évolution de mes tests">
        {t.tests.length === 0 ? (
          <p className="text-sm text-texte-3">Ton premier test donnera ton point de départ.</p>
        ) : (
          <>
            {t.tests.length >= 2 && (
              <GraphiqueLignes etiquettes={t.tests.map((x) => jj(x.date))} format={(n) => n.toFixed(2).replace('.', ',')}
                series={[{ nom: 'W/kg', couleur: SERIES[1], valeurs: t.tests.map((x) => x.wkg) }]} />
            )}
            {premierTest && dernierTest && t.tests.length >= 2 && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Ecart libelle="W/kg" a={premierTest.wkg} b={dernierTest.wkg} decimales={2} />
                <Ecart libelle="CP (W)" a={premierTest.w} b={dernierTest.w} />
                <Ecart libelle="Poids (kg)" a={premierTest.poidsKg} b={dernierTest.poidsKg} decimales={1} inverse />
              </div>
            )}
            <p className="mt-2 text-xs text-texte-3">Depuis le {depuisJour(t.tests[0].date).toLocaleDateString('fr-FR')} · {t.tests.length} test{t.tests.length > 1 ? 's' : ''}</p>
          </>
        )}
        {t.cpEstimee && (
          <p className="mt-2 text-sm text-texte-2">
            D'après tes meilleurs efforts des 6 dernières semaines : <b className="text-texte">~{t.cpEstimee} W</b>
            <Aide titre="Estimation entre deux tests" texte={AIDES.cpEstimee} />
            {t.cpW && t.cpEstimee >= t.cpW * HAUSSE_CP && <span className="block font-semibold text-nutrition">Tu sembles avoir progressé : avance ton prochain test.</span>}
          </p>
        )}
      </Carte>

      <CourbePuissance pied={t.effRecente ? (
        <p className="mt-2 flex items-center justify-between border-t border-bordure pt-2 text-xs text-texte-3">
          <span>Efficacité aérobie (sorties faciles)<Aide titre="Efficacité aérobie" texte={AIDES.efficacite} /></span>
          <b className="text-texte">{formatNombre(t.effRecente, 2)} W/bpm{signe(pct(t.effRecente, t.effAvant)) && <span className={sens(t.effRecente, t.effAvant) === undefined ? 'text-texte-3' : sens(t.effRecente, t.effAvant) ? 'text-bon' : 'text-mauvais'}> {signe(pct(t.effRecente, t.effAvant))}</span>}</b>
        </p>
      ) : undefined} />

      {familles && familles.length > 0 && (
        <Carte titre="Mes séances d'intensité">
          <ul className="space-y-2 text-sm">
            {familles.map((f) => (
              <li key={f.famille} className="flex items-center justify-between gap-2">
                <span>{NOMS_FAMILLES[f.famille]}{f.bonus !== 0 && <span className={`text-xs ${f.bonus > 0 ? 'text-nutrition' : 'text-mauvais'}`}> · {f.bonus > 0 ? '+' : ''}{formatNombre(f.bonus * 100, 1)} % W</span>}</span>
                <span className="flex gap-1" aria-label={`palier ${f.palier} sur 4`}>
                  {[1, 2, 3, 4].map((n) => <span key={n} className={`h-2 w-6 rounded-full ${n <= f.palier ? 'bg-accent' : 'bg-bordure'}`} />)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-texte-3">Un palier de plus à chaque séance tenue.<Aide titre="Progression" texte={AIDES.progression} /></p>
        </Carte>
      )}

      <Repliable titre="Répartition des zones" libelle="Voir" resume="Ton vélo des 4 dernières semaines, par intensité">
        <Repartition nu />
      </Repliable>

      <Repliable titre="Historique des séances" libelle="Voir" resume={nVictoires ? `Tes séances semaine par semaine · ${nVictoires} victoire${nVictoires > 1 ? 's' : ''} ce mois-ci` : 'Tes séances semaine par semaine, et tes petites victoires'}>
        <ListeVictoires />
        <PetitesVictoires t={t} nu />
        <div className="mt-3"><Historique /></div>
      </Repliable>
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
      <p className={`text-lg font-bold tabular-nums ${d === undefined ? '' : bien ? 'text-nutrition' : 'text-mauvais'}`}>
        {d === undefined ? '–' : `${d >= 0 ? '+' : ''}${formatNombre(d, decimales)}`}
      </p>
      {a !== undefined && b !== undefined && a !== 0 && <p className="text-[11px] text-texte-3">{signe(((b - a) / a) * 100)}</p>}
    </div>
  )
}

/** « +3 % » ; « = » quand l'écart est sous 0,5 % (pas un « +0 % » en vert) */
const signe = (n?: number) => (n === undefined ? undefined : Math.abs(n) < 0.5 ? '=' : `${n >= 0 ? '+' : ''}${Math.round(n)} %`)
const sens = (a?: number, b?: number) => (a === undefined || !b || Math.abs((a - b) / b) < 0.005 ? undefined : a >= b)

function Tuile({ libelle, valeur, aide, sous, evolution, hausse }: { libelle: string; valeur: string; aide?: string; sous?: string; evolution?: string; hausse?: boolean }) {
  return (
    <div className="entree rounded-[14px] bg-surface p-3">
      <p className="flex items-center text-[13px] font-semibold text-texte-2">{libelle}{aide && <Aide titre={libelle} texte={aide} />}</p>
      <p className="chiffre mt-0.5 text-2xl">{valeur}</p>
      {evolution && <p className={`text-xs font-semibold ${hausse ? 'text-bon' : 'text-mauvais'}`}>{hausse ? '▲' : '▼'} {evolution}</p>}
      {sous && <p className="text-xs text-texte-3">{sous}</p>}
    </div>
  )
}


type Donnees = NonNullable<Awaited<ReturnType<typeof donneesProgres>>>

/** Petites victoires : régularité, ta dernière Z2 et ta dernière séance d'intervalles comparées aux précédentes du même type. */
function PetitesVictoires({ t, nu = false }: { t: Donnees; nu?: boolean }) {
  const [z2a, z2b] = t.victoires.z2
  const [ia, ib] = t.victoires.intervalles
  if (!t.regularite && !(z2a && z2b) && !(ia && ib)) return nu ? <p className="text-sm text-texte-3">Rien à comparer pour l'instant : il faut au moins deux séances du même type.</p> : null
  const ecart = (b: number, a: number, unite: string, inverse = false) => {
    const d = b - a
    const bien = inverse ? d < 0 : d > 0
    return <b className={d === 0 ? 'text-texte' : bien ? 'text-nutrition' : 'text-mauvais'}>{d > 0 ? '+' : ''}{formatNombre(d, unite === '%' ? 1 : 0)} {unite}</b>
  }
  const contenu = (
    <>
      <ul className="space-y-2 text-sm text-texte-2">
        {t.regularite && (
          <li>Régularité (4 sem.) : <b className="text-texte">{t.regularite.faites}/{t.regularite.prevues}</b> séances prévues faites.</li>
        )}
        {z2a && z2b && (
          <li>
            Z2 du {jj(z2b.date)} ({duree(z2b.dureeMin)}) vs {jj(z2a.date)} : {ecart(z2b.w, z2a.w, 'W')} pour {ecart(z2b.fc, z2a.fc, 'bpm', true)}
            {z2a.decouplage !== undefined && z2b.decouplage !== undefined && <> · dérive {formatNombre(z2a.decouplage, 1)} → {formatNombre(z2b.decouplage, 1)} %</>}.
            <span className="block text-xs text-texte-3">Plus de watts ou moins de battements pour la même sortie : tu progresses.</span>
          </li>
        )}
        {ia && ib && (
          <li>
            {ib.titre ?? 'Intervalles'} du {jj(ib.date)} vs {jj(ia.date)} : blocs à {ib.w} W ({ecart(ib.w, ia.w, 'W')})
            {ia.fc && ib.fc ? <>, FC de fin de bloc {ecart(ib.fc, ia.fc, 'bpm', true)}</> : null}
            {ia.rpe !== undefined && ib.rpe !== undefined ? <>, RPE {ia.rpe} → {ib.rpe}</> : null}.
          </li>
        )}
      </ul>
      <Aide titre="Petites victoires" texte={AIDES.victoires} />
    </>
  )
  return nu ? contenu : <Carte titre="Petites victoires">{contenu}</Carte>
}

