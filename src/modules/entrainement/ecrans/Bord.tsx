import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { BarreRepartition, GraphiqueBarres, GraphiqueLignes, INTENSITES, SERIES } from '../../../core/ui/graphiques'
import { Puces } from '../../../core/ui/Puces'
import { AIDES } from '../aides'
import { JOURS_AMORCAGE, type FiltreSport } from '../analyse/donnees'
import { CIBLES, tableauDeBord, volume } from '../analyse/tableau'
import { CarteAujourdhui } from '../forme/CarteAujourdhui'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { lundiDe } from '../seances/donnees'

const SECTIONS = ['Aujourd’hui', 'Charge', 'Physio', 'Volume', 'Intensité', 'Progrès', 'Calendrier'] as const
type Section = (typeof SECTIONS)[number]
const FILTRES = ['total', 'velo', 'course'] as const
const LIB_FILTRE = { total: 'Total', velo: 'Vélo', course: 'Course' }

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })
const f1 = (n: number) => formatNombre(n, 1)

/** Tableau de bord : une section à la fois, graphiques légers lisibles sur iPhone. */
export function Bord() {
  const [section, setSection] = useState<Section>('Aujourd’hui')
  const [filtre, setFiltre] = useState<FiltreSport>('total')
  const t = useLiveQuery(() => tableauDeBord(filtre), [filtre])
  const [reglages] = useReglagesEntrainement()

  return (
    <div className="space-y-3">
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="w-max"><Puces options={SECTIONS} valeur={section} effacable={false} onChoisir={(s) => s && setSection(s)} /></div>
      </div>
      {!t ? null : section === 'Aujourd’hui' ? (
        <>
          <CarteAujourdhui />
          {t.bilan && (
            <Carte titre={`Bilan de la semaine du ${jj(t.bilan.lundi)}`}>
              <ul className="space-y-1.5 text-sm text-texte-2">{t.bilan.lignes.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </Carte>
          )}
        </>
      ) : section === 'Charge' ? (
        <Charge t={t} filtre={filtre} setFiltre={setFiltre} />
      ) : section === 'Physio' ? (
        <Physio t={t} />
      ) : section === 'Volume' ? (
        <Volume t={t} />
      ) : section === 'Intensité' ? (
        <Intensite t={t} modele={reglages.modeleCible} />
      ) : section === 'Progrès' ? (
        <Progres t={t} tests={reglages.tests} />
      ) : (
        <Calendrier />
      )}
    </div>
  )
}

type Tableau = Awaited<ReturnType<typeof tableauDeBord>>

function Tuile({ libelle, valeur, aide, sous }: { libelle: string; valeur: string; aide?: string; sous?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="text-xs text-texte-3">{libelle}{aide && <Aide titre={libelle} texte={aide} />}</p>
      <p className="text-xl font-bold tabular-nums">{valeur}</p>
      {sous && <p className="text-[11px] text-texte-3">{sous}</p>}
    </div>
  )
}

function Charge({ t, filtre, setFiltre }: { t: Tableau; filtre: FiltreSport; setFiltre: (f: FiltreSport) => void }) {
  const dernier = t.forme[t.forme.length - 1]
  const unite = t.a.contexte.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE'
  return (
    <>
      <Puces options={FILTRES} valeur={filtre} effacable={false} libelle={(f) => LIB_FILTRE[f]} onChoisir={(f) => f && setFiltre(f)} />
      {t.a.amorcage && (
        <Carte>
          <p className="text-sm">🧭 Calibration en cours : <span className="font-semibold">{t.a.joursHistorique}/{JOURS_AMORCAGE} jours</span> d'historique.</p>
          <p className="mt-1 text-xs text-texte-3">
            La fitness (CTL) se construit sur 42 jours : avant 4 semaines, les chiffres sont trompeurs. Pour démarrer
            avec une valeur réaliste, importe tes 3 derniers mois depuis Intervals.icu (<Link to="/reglages" className="text-accent">Réglages</Link>).
          </p>
        </Carte>
      )}
      {dernier && !t.a.amorcage && (
        <div className="grid grid-cols-3 gap-2">
          <Tuile libelle="Fitness" valeur={String(Math.round(dernier.ctl))} aide={AIDES.ctl} sous="CTL 42 j" />
          <Tuile libelle="Fatigue" valeur={String(Math.round(dernier.atl))} aide={AIDES.atl} sous="ATL 7 j" />
          <Tuile libelle="Fraîcheur" valeur={String(Math.round(dernier.tsb))} aide={AIDES.tsb} sous="TSB" />
          <Tuile libelle="Ratio" valeur={dernier.ctl > 0 ? f1(dernier.atl / dernier.ctl) : '–'} aide={AIDES.ratio} sous="indicatif" />
          <Tuile libelle="Monotonie" valeur={t.a.monotonie !== undefined ? f1(t.a.monotonie) : '–'} aide={AIDES.monotonie} sous="7 j" />
          <Tuile libelle="Pic" valeur={t.a.ratioPic !== undefined ? `${Math.round(t.a.ratioPic * 100)} %` : '–'} aide={AIDES.pic} sous="vs 4 sem." />
        </div>
      )}
      <Carte titre={`Forme et fatigue · 90 jours · ${LIB_FILTRE[filtre]}`}>
        <GraphiqueLignes zero etiquettes={t.forme.map((p) => jj(p.date))}
          series={[
            { nom: 'Fitness (CTL)', couleur: SERIES[0], valeurs: t.forme.map((p) => p.ctl) },
            { nom: 'Fatigue (ATL)', couleur: SERIES[1], valeurs: t.forme.map((p) => p.atl) },
            { nom: 'Fraîcheur (TSB)', couleur: SERIES[2], valeurs: t.forme.map((p) => p.tsb) },
          ]} />
      </Carte>
      <Carte titre={`Charge par semaine (${unite})`}>
        <GraphiqueBarres etiquettes={t.semaines.map(jj)}
          series={[{ nom: 'Vélo', couleur: SERIES[0], valeurs: t.chargeVelo }, { nom: 'Course', couleur: SERIES[1], valeurs: t.chargeCourse }]}
          repere={{ nom: 'Prévue', valeurs: t.semaines.map((_, i) => (i === t.semaines.length - 1 ? t.prevueSemaine : undefined)) }} />
      </Carte>
    </>
  )
}

function Physio({ t }: { t: Tableau }) {
  const et = t.physio.map((p) => jj(p.date))
  return (
    <>
      <Carte titre="VFC · ln(RMSSD)">
        <p className="mb-1 text-xs text-texte-3">Jour, moyenne 7 jours et zone normale<Aide titre="Zone normale" texte={`${AIDES.vfc7} ${AIDES.zoneVfc}`} /></p>
        <GraphiqueLignes etiquettes={et} format={(n) => n.toFixed(1).replace('.', ',')}
          bande={{ nom: 'Zone normale', bas: t.physio.map((p) => p.bas), haut: t.physio.map((p) => p.haut) }}
          series={[
            { nom: 'Jour', couleur: SERIES[2], valeurs: t.physio.map((p) => p.ln), pointille: true },
            { nom: 'Moyenne 7 j', couleur: SERIES[0], valeurs: t.physio.map((p) => p.ln7) },
          ]} />
        {t.a.vfc.cv7 !== undefined && <p className="mt-1 text-xs text-texte-3">CV 7 j : {f1(t.a.vfc.cv7)} %<Aide titre="Coefficient de variation" texte={AIDES.cv} /></p>}
      </Carte>
      <Carte titre="FC de repos (bpm)">
        <GraphiqueLignes etiquettes={et} series={[{ nom: 'FC repos', couleur: SERIES[1], valeurs: t.physio.map((p) => p.fcRepos) }]} />
      </Carte>
      <Carte titre="Sommeil (h)">
        <GraphiqueBarres etiquettes={et.slice(-30)} format={(n) => f1(n)} series={[{ nom: 'Sommeil', couleur: SERIES[0], valeurs: t.physio.slice(-30).map((p) => p.sommeil ?? 0) }]} />
      </Carte>
      <Carte titre="Poids (pesées du lundi)">
        <GraphiqueLignes etiquettes={t.pesees.map((p) => jj(p.date))} format={(n) => f1(n)} series={[{ nom: 'Poids', couleur: SERIES[2], valeurs: t.pesees.map((p) => p.poidsKg) }]} />
      </Carte>
    </>
  )
}

function Volume({ t }: { t: Tableau }) {
  const lignes = [
    { nom: 'Semaine', s: t.volume.semaine },
    { nom: 'Mois', s: t.volume.mois },
    { nom: 'Année', s: t.volume.annee },
  ]
  return (
    <>
      {(['velo', 'course'] as const).map((sport) => (
        <Carte key={sport} titre={sport === 'velo' ? '🚴 Vélo' : '🏃 Course'}>
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="text-xs text-texte-3"><tr><th className="text-left font-medium" /><th className="font-medium">Heures</th><th className="font-medium">km</th><th className="font-medium">D+</th>{sport === 'velo' && <th className="font-medium">kJ</th>}</tr></thead>
            <tbody>
              {lignes.map(({ nom, s }) => {
                const v = volume(s, sport)
                return (
                  <tr key={nom} className="border-t border-bordure">
                    <td className="py-1.5 text-left text-texte-2">{nom}</td><td>{f1(v.heures)}</td><td>{Math.round(v.km)}</td><td>{Math.round(v.denivele)}</td>
                    {sport === 'velo' && <td>{formatNombre(v.kj)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Carte>
      ))}
      <Carte titre="Heures par semaine">
        <GraphiqueBarres etiquettes={t.semaines.map(jj)} format={(n) => f1(n)}
          series={[{ nom: 'Vélo', couleur: SERIES[0], valeurs: t.volume.heuresVelo }, { nom: 'Course', couleur: SERIES[1], valeurs: t.volume.heuresCourse }]} />
      </Carte>
    </>
  )
}

function Intensite({ t, modele }: { t: Tableau; modele: 'polarise' | 'pyramidal' }) {
  const parts = (d: { basse: number; moyenne: number; haute: number }) => [
    { nom: 'Basse', couleur: INTENSITES[0], valeur: d.basse },
    { nom: 'Moyenne', couleur: INTENSITES[1], valeur: d.moyenne },
    { nom: 'Haute', couleur: INTENSITES[2], valeur: d.haute },
  ]
  const cible = CIBLES[modele]
  return (
    <>
      <Carte titre="Distribution de l'intensité (temps)">
        <p className="mb-2 text-xs text-texte-3">7 derniers jours<Aide titre="Domaines" texte={AIDES.domaines} /></p>
        <BarreRepartition parts={parts(t.intensite.sept)} />
        <p className="mt-4 mb-2 text-xs text-texte-3">4 dernières semaines</p>
        <BarreRepartition parts={parts(t.intensite.vingtHuit)} />
        <p className="mt-3 text-xs text-texte-3">
          Cible {modele === 'polarise' ? 'polarisée' : 'pyramidale'} : basse {cible.basse * 100} %, moyenne {cible.moyenne * 100} %, haute {cible.haute * 100} %.
        </p>
      </Carte>
      <Carte titre="kJ faciles et stress (règle du PDF)">
        <p className="mb-2 text-xs text-texte-3">Part du temps des séances notées<Aide titre="Règle RPE" texte={AIDES.rpeRegle} /></p>
        {[{ nom: '7 jours', p: t.intensite.rpeSept }, { nom: '4 semaines', p: t.intensite.rpe28 }].map(({ nom, p }) => (
          <div key={nom} className="flex items-center justify-between border-t border-bordure py-2 text-sm">
            <span className="text-texte-2">{nom}</span>
            {p ? (
              <span>Faciles <b>{Math.round(p.faciles * 100)} %</b>{p.kjFaciles > 0 && ` (${formatNombre(p.kjFaciles)} kJ)`} · Stress <b>{Math.round(p.stress * 100)} %</b></span>
            ) : <span className="text-texte-3">Aucune séance notée</span>}
          </div>
        ))}
      </Carte>
    </>
  )
}

function Progres({ t, tests }: { t: Tableau; tests: { date: string; type: 'vma' | 'cp'; valeur: number }[] }) {
  const { efficienceCourse: ec, efficienceVelo: ev, decouplages } = t.progression
  return (
    <>
      <Carte titre="Efficience en endurance">
        <p className="mb-1 text-xs text-texte-3">Séances faciles de plus de 20 min<Aide titre="Efficience" texte={AIDES.efficience} /></p>
        <p className="mt-2 text-sm text-texte-2">🏃 Course : km/h pour 100 bpm</p>
        <GraphiqueLignes etiquettes={ec.map((p) => jj(p.date))} format={(n) => f1(n)} series={[{ nom: 'Course', couleur: SERIES[1], valeurs: ec.map((p) => p.valeur) }]} />
        <p className="mt-3 text-sm text-texte-2">🚴 Vélo : watts par bpm</p>
        <GraphiqueLignes etiquettes={ev.map((p) => jj(p.date))} format={(n) => n.toFixed(2).replace('.', ',')} series={[{ nom: 'Vélo', couleur: SERIES[0], valeurs: ev.map((p) => p.valeur) }]} />
      </Carte>
      <Carte titre="Découplage cardiaque (séances ≥ 45 min)">
        <p className="mb-1 text-xs text-texte-3">Sous 5 % : bonne endurance<Aide titre="Découplage" texte={AIDES.decouplage} /></p>
        {decouplages.length === 0 ? <p className="text-sm text-texte-3">Importe un .FIT ou relie Intervals.icu pour le calculer.</p> : (
          <ul className="text-sm">
            {[...decouplages].reverse().map((s) => (
              <li key={s.id} className="flex justify-between border-t border-bordure py-1.5">
                <span className="text-texte-2">{jj(s.date)} · {s.sport === 'velo' ? '🚴' : '🏃'} {Math.round(s.dureeSec / 60)} min</span>
                <span className={`font-semibold ${s.decouplage! < 5 ? 'text-nutrition' : 'text-argent'}`}>{f1(s.decouplage!)} %</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
      <Carte titre="Historique VMA / CP">
        {tests.length === 0 ? <p className="text-sm text-texte-3">Aucun test enregistré.</p> : (
          <ul className="text-sm">
            {[...tests].sort((a, b) => b.date.localeCompare(a.date)).map((x, i) => (
              <li key={i} className="flex justify-between border-t border-bordure py-1.5">
                <span className="text-texte-2">{depuisJour(x.date).toLocaleDateString('fr-FR')}</span>
                <span className="font-semibold">{x.type === 'vma' ? `VMA ${f1(x.valeur)} km/h` : `CP ${x.valeur} W`}</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </>
  )
}

/** Calendrier du mois : prévu contre réalisé, indisponibilités. */
function Calendrier() {
  const [mois, setMois] = useState(aujourdhui().slice(0, 7))
  const premier = `${mois}-01`
  const debut = lundiDe(premier)
  const jours = Array.from({ length: 42 }, (_, i) => decalerJour(debut, i))
  const donnees = useLiveQuery(async () => ({
    seances: await db.seances.where('date').between(jours[0], jours[41], true, true).toArray(),
    prevues: await db.prevues.where('date').between(jours[0], jours[41], true, true).toArray(),
    indispos: await db.indispos.where('date').between(jours[0], jours[41], true, true).toArray(),
  }), [mois])
  const changerMois = (n: number) => {
    const d = new Date(`${premier}T12:00:00`)
    d.setMonth(d.getMonth() + n)
    setMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  if (!donnees) return null
  return (
    <Carte>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => changerMois(-1)} className="px-3 text-2xl text-accent" aria-label="Mois précédent">‹</button>
        <p className="font-semibold capitalize">{depuisJour(premier).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={() => changerMois(1)} className="px-3 text-2xl text-accent" aria-label="Mois suivant">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-texte-3">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => <span key={i}>{j}</span>)}
        {jours.map((d) => {
          const indispo = donnees.indispos.find((i) => i.date === d)
          const faites = donnees.seances.filter((s) => s.date === d)
          const prevues = donnees.prevues.filter((p) => p.date === d && p.statut !== 'faite')
          return (
            <div key={d} className={`min-h-12 rounded-lg p-1 ${d.slice(0, 7) !== mois ? 'opacity-30' : ''} ${indispo ? 'bg-[#f87171]/15' : 'bg-surface-2'} ${d === aujourdhui() ? 'ring-1 ring-accent' : ''}`}>
              <span className="block text-texte-2">{Number(d.slice(8))}</span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {faites.map((s) => <span key={s.id} title="Réalisée" className="text-[10px]">{s.sport === 'velo' ? '🚴' : '🏃'}</span>)}
                {prevues.map((p) => (
                  <span key={p.id} title={p.statut} className="h-2 w-2 rounded-full"
                    style={{ background: p.statut === 'prevue' ? 'var(--color-texte-3)' : p.statut === 'reportee' ? '#fb923c' : '#f87171' }} />
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-texte-3">
        🚴🏃 réalisée · <span className="text-texte-3">●</span> prévue · <span className="text-[#fb923c]">●</span> à reporter ·{' '}
        <span className="text-[#f87171]">●</span> non faite / abandonnée · <span className="rounded bg-[#f87171]/15 px-1">fond rouge</span> indisponible
      </p>
    </Carte>
  )
}
