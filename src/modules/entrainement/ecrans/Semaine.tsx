import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { Puces } from '../../../core/ui/Puces'
import { AIDES } from '../aides'
import { Deroule } from '../plan/Deroule'
import { joursPanneVelo } from '../plan/imprevus'
import { FormulairePrevue } from '../plan/FormulairePrevue'
import { ImportCampus } from '../plan/ImportCampus'
import { chargesSemaine, declarerNonFaite, joursDe, supprimerPrevue } from '../plan/donnees'
import { alertesCumul, estIntensite, genererSemaineVelo, lireMeta, noterResultat } from '../plan/programme'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { lundiDe, nouvelId } from '../seances/donnees'
import { iconeSport } from '../sports'
import { RAISONS, type Raison, type Seance, type SeancePrevue } from '../types'

const VERT = '#4ade80'
const ORANGE = '#fb923c'
const ROUGE = '#f87171'

/**
 * Couleur d'une séance prévue :
 *  - vert : faite ;
 *  - orange : à valider (jour passé sans séance remontée, ou intensité faite sans « Tenue ? ») ;
 *  - rouge : pas faite (avec la raison) ;
 *  - neutre : à venir. L'orange n'apparaît que le lendemain : une séance du soir met du temps à remonter.
 */
function etatVisuel(p: SeancePrevue, jour: string): { libelle: string; couleur?: string } {
  if (p.statut === 'faite') return estIntensite(p) && !p.resultat ? { libelle: 'Tenue ?', couleur: ORANGE } : { libelle: 'Faite ✓', couleur: VERT }
  if (p.statut === 'non-faite' || p.statut === 'abandonnee') return { libelle: `Pas faite${p.raison ? ` · ${p.raison}` : ''}`, couleur: ROUGE }
  if (p.statut === 'reportee') return { libelle: 'À reporter', couleur: ORANGE }
  if (p.date < jour) return { libelle: 'À valider', couleur: ORANGE }
  return { libelle: '' }
}

/** Semaine : la course saisie depuis Campus Coach, le vélo généré autour, une jauge de kJ. */
export function Semaine() {
  const [lundi, setLundi] = useState(lundiDe(aujourdhui()))
  const jours = joursDe(lundi)
  const prevues = useLiveQuery(() => db.prevues.where('date').between(jours[0], jours[6], true, true).toArray(), [lundi])
  const seances = useLiveQuery(() => db.seances.where('date').between(jours[0], jours[6], true, true).toArray(), [lundi])
  const pannes = useLiveQuery(joursPanneVelo)
  const [ajout, setAjout] = useState<string | null>(null)
  const [choisie, setChoisie] = useState<SeancePrevue | null>(null)
  const [message, setMessage] = useState<string[]>()

  if (!prevues || !seances) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setLundi(decalerJour(lundi, -7))} className="px-3 py-2 text-2xl text-accent" aria-label="Semaine précédente">‹</button>
        <p className="font-semibold">Semaine du {depuisJour(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
        <button type="button" onClick={() => setLundi(decalerJour(lundi, 7))} className="px-3 py-2 text-2xl text-accent" aria-label="Semaine suivante">›</button>
      </div>

      <CarteVelo lundi={lundi} deps={[prevues, seances]} onMessage={(m) => setMessage(m.length ? m : undefined)} />

      {message && (
        <Carte>
          <ul className="space-y-1 text-sm">{message.map((m, i) => <li key={i}>{m}</li>)}</ul>
          <button type="button" onClick={() => setMessage(undefined)} className="mt-2 text-xs text-texte-3">OK</button>
        </Carte>
      )}

      <Alertes lundi={lundi} deps={[prevues, seances]} />

      {jours.map((d) => {
        const duJour = prevues.filter((p) => p.date === d)
        const horsPlan = seances.filter((s) => s.date === d && !duJour.some((p) => p.id === s.prevueId))
        return (
          <section key={d} className={`rounded-2xl border bg-surface p-3 ${d === aujourdhui() ? 'border-accent' : 'border-bordure'}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold capitalize">
                {depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
                {pannes?.has(d) && <span className="ml-2 text-xs font-normal normal-case text-[#fb923c]">🔧 vélo en panne</span>}
              </p>
              <button type="button" onClick={() => setAjout(d)} aria-label="Ajouter une séance" className="px-2 text-xl text-accent">+</button>
            </div>
            {duJour.map((p) => {
              const e = etatVisuel(p, aujourdhui())
              return (
              <button key={p.id} type="button" onClick={() => setChoisie(p)}
                className="mt-2 block w-full rounded-xl border-l-4 bg-surface-2 p-2.5 text-left"
                style={{ borderLeftColor: e.couleur ?? 'transparent', background: e.couleur ? `color-mix(in srgb, ${e.couleur} 12%, var(--color-surface-2))` : undefined }}>
                <span className="flex items-center justify-between gap-2">
                  <span className={`font-semibold ${e.couleur === ROUGE ? 'line-through opacity-70' : ''}`}>{iconeSport(p.sport)} {p.titre}</span>
                  <span className="shrink-0 text-xs font-semibold" style={{ color: e.couleur }}>{e.libelle}</span>
                </span>
                <span className="block text-sm text-texte-2">
                  {p.dureeMin} min{p.kjPrevu ? ` · ${p.kjPrevu} kJ` : ''}
                </span>
              </button>
              )
            })}
            {horsPlan.map((s) => (
              <p key={s.id} className="mt-2 rounded-xl border border-dashed p-2 text-sm text-texte-2" style={{ borderColor: VERT }}>
                <span style={{ color: VERT }}>✓</span> {iconeSport(s.sport, s.homeTrainer)} {s.titre ?? s.type ?? 'Séance'} · {Math.round(s.dureeSec / 60)} min · hors plan
              </p>
            ))}
            {!duJour.length && !horsPlan.length && <p className="mt-1 text-sm text-texte-3">Repos</p>}
          </section>
        )
      })}

      <ImportCampus jours={jours} />

      {ajout && (
        <Feuille titre="Ajouter une séance" onFermer={() => setAjout(null)}>
          <FormulairePrevue
            initiale={{ id: nouvelId(), date: ajout, sport: 'course', titre: '', intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel' }}
            jours={jours}
            onTermine={() => setAjout(null)}
          />
        </Feuille>
      )}
      {choisie && <DetailSeance p={choisie} jours={jours} onFermer={() => setChoisie(null)} onMessage={setMessage} />}
    </div>
  )
}

/** Vélo de la semaine : une jauge de kJ (fait / prévu) et le bouton pour générer les séances. */
function CarteVelo({ lundi, deps, onMessage }: { lundi: string; deps: unknown[]; onMessage: (m: string[]) => void }) {
  const [r] = useReglagesEntrainement()
  const meta = useLiveQuery(async () => (await lireMeta(lundi)) ?? null, [lundi, ...deps])
  const kj = useLiveQuery(() => chargesSemaine(lundi), [lundi, ...deps])
  const [occupe, setOccupe] = useState(false)
  if (meta === undefined || !kj) return null
  // Le programme démarre avec la première phase : avant, les séances sont fixées à la main
  const debutProgramme = [...programmeDe(r.programme).phases].map((p) => p.debut).sort()[0]
  const passee = decalerJour(lundi, 6) < aujourdhui() || lundi < debutProgramme

  const generer = async () => {
    setOccupe(true)
    try {
      await genererSemaineVelo(lundi)
      onMessage([])
    } catch (e) {
      onMessage([(e as Error).message])
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Carte>
      {meta || kj.kjPrevus > 0 ? (
        <>
          <p className="flex items-baseline justify-between">
            <span className="text-texte-2">🚴 Vélo<Aide titre="Budget kJ" texte={AIDES.budgetAuto} /></span>
            <span><b className="text-xl">{Math.round(kj.kjRealises)}</b> / {Math.round(kj.kjPrevus)} kJ</span>
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, kj.kjPrevus ? (kj.kjRealises / kj.kjPrevus) * 100 : 0)}%` }} />
          </div>
          {meta && <p className="mt-2 text-xs text-texte-3">{meta.phase}{meta.allegee ? ' · semaine allégée' : ''} · {meta.raison}</p>}
        </>
      ) : (
        <p className="text-sm text-texte-2">
          1. Ajoute tes séances Campus Coach et ton renfo avec le + de chaque jour.<br />
          2. Génère ton vélo : il se place autour, sans deux jours durs d'affilée.<Aide titre="Programme vélo" texte={AIDES.programme} />
        </p>
      )}
      {!passee && (
        <Bouton variante={meta ? 'secondaire' : 'principal'} className="mt-3" disabled={occupe} onClick={generer}>
          {occupe ? 'Calcul…' : meta ? '↻ Recalculer le vélo' : 'Générer mon vélo de la semaine'}
        </Bouton>
      )}
    </Carte>
  )
}

/** Uniquement si quelque chose coince (vélo + course). */
function Alertes({ lundi, deps }: { lundi: string; deps: unknown[] }) {
  const alertes = useLiveQuery(() => alertesCumul(lundi), [lundi, ...deps])
  if (!alertes?.length) return null
  return (
    <Carte>
      <ul className="space-y-1.5 text-sm">{alertes.map((a, i) => <li key={i}>⚠️ {a}</li>)}</ul>
    </Carte>
  )
}

/** Détail d'une séance prévue : consignes, faite, pas faite, modifier, supprimer. */
function DetailSeance({ p, jours, onFermer, onMessage }: { p: SeancePrevue; jours: string[]; onFermer: () => void; onMessage: (m: string[]) => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'actions' | 'non-faite' | 'modifier'>('actions')
  const [raison, setRaison] = useState<Raison>()

  if (mode === 'modifier')
    return (
      <Feuille titre="Modifier la séance" onFermer={onFermer}>
        <FormulairePrevue initiale={p} jours={jours} onTermine={onFermer} />
      </Feuille>
    )

  return (
    <Feuille titre={p.titre} onFermer={onFermer}>
      <p className="text-sm text-texte-2">{p.dureeMin} min{p.kjPrevu ? ` · ${p.kjPrevu} kJ` : ''}</p>
      {p.detail && <p className="mt-2 text-sm">{p.detail}</p>}
      {p.velo?.etapes && <Deroule etapes={p.velo.etapes} />}
      {p.velo?.pourquoi && <p className="mt-2 text-xs text-texte-3">Pourquoi cette séance : {p.velo.pourquoi}</p>}
      {mode === 'actions' ? (
        <div className="mt-4 space-y-2">
          {p.statut === 'prevue' && (
            <Bouton onClick={() => {
              const seance: Seance = { id: nouvelId(), date: p.date <= aujourdhui() ? p.date : aujourdhui(), sport: p.sport, type: p.type, titre: p.titre, dureeSec: p.dureeMin * 60, source: 'manuel', prevueId: p.id }
              navigate('/entrainement/seance/nouvelle', { state: { seance } })
            }}>✓ Faite : saisir</Bouton>
          )}
          {p.statut === 'faite' && estIntensite(p) && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-2 text-sm text-texte-2">Tenue ?<Aide titre="Progression" texte={AIDES.progression} /></p>
              <div className="grid grid-cols-2 gap-2">
                {(['reussie', 'ratee'] as const).map((x) => (
                  <button key={x} type="button" onClick={async () => { await noterResultat(p, p.resultat === x ? undefined : x); onFermer() }}
                    className={`rounded-xl border py-2.5 text-sm font-semibold ${p.resultat === x ? 'border-accent bg-accent text-fond' : 'border-bordure text-texte-2'}`}>
                    {x === 'reussie' ? '✓ Oui' : '✗ Pas tout'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {p.statut === 'prevue' && <Bouton variante="secondaire" onClick={() => setMode('non-faite')}>✗ Pas faite</Bouton>}
          <Bouton variante="secondaire" onClick={() => setMode('modifier')}>Modifier</Bouton>
          <button type="button" className="w-full py-2 text-[#f87171]" onClick={async () => { await supprimerPrevue(p.id); onFermer() }}>Supprimer</button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-texte-2">Pourquoi ?</p>
          <Puces options={RAISONS} valeur={raison} onChoisir={setRaison} />
          <Bouton disabled={!raison} onClick={async () => {
            onMessage(await declarerNonFaite(p, raison!))
            onFermer()
          }}>Valider (la séance est replacée si possible)</Bouton>
        </div>
      )}
    </Feuille>
  )
}
