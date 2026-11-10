import { IconeSport } from '../IconeSport'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { CiblesCols } from '../reglages/ListeCourses'
import { BarresSemaine } from '../forme/BarresSemaine'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { formatNombre } from '../../../core/format'
import { Repliable } from '../../../core/ui/Repliable'
import { Feuille } from '../../../core/ui/Feuille'
import { Puces } from '../../../core/ui/Puces'
import { AIDES } from '../aides'
import { CarteBilan, lundiDuBilan } from '../plan/CarteBilan'
import { CarteBilanNutrition } from '../forme/CarteBilanNutrition'
import { useNutritionEffort } from '../reglages/ProfilSportif'
import { BoutonsEnvoi } from '../plan/BoutonsEnvoi'
import { Deroule } from '../plan/Deroule'
import { FicheSeance } from '../plan/FicheSeance'
import { NutritionSeance } from '../plan/NutritionSeance'
import { joursPanneVelo } from '../plan/imprevus'
import { annulerSemaineChargee, lireSemaineChargee, passerSemaineChargee } from '../plan/semaineChargee'
import { FormulairePrevue } from '../plan/FormulairePrevue'
import { annulerPrevue, changerDeJour, chargesSemaine, joursDe, joursPourDeplacer, supprimerPrevue } from '../plan/donnees'
import { alertesCumul, estIntensite, genererSemaineVelo, lireMeta, noterResultat } from '../plan/programme'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { lundiDe, nouvelId } from '../seances/donnees'
import { RAISONS, type Raison, type Seance, type SeancePrevue } from '../types'

const VERT = '#4ade80'
const ORANGE = '#fb923c'
const ROUGE = '#f87171'
const JAUNE = '#facc15'

/**
 * Couleur d'une séance prévue :
 *  - vert : faite ;
 *  - orange : à valider (jour passé sans séance remontée, ou intensité faite sans « Tenue ? ») ;
 *  - rouge : pas faite (avec la raison) ;
 *  - neutre : à venir. L'orange n'apparaît que le lendemain : une séance du soir met du temps à remonter.
 */
function etatVisuel(p: SeancePrevue, jour: string): { libelle: string; couleur?: string } {
  if (p.statut === 'faite' && p.realiseDifferent) return { libelle: '✓ différent', couleur: JAUNE }
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

  const auj = aujourdhui()
  const court = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'short' })

  return (
    <div className="space-y-2.5">
      {/* Bilan de la semaine qui finit : le dimanche, puis en rappel le lundi (bilan nutrition encore modifiable).
          Plus rien ensuite, ni sur les semaines passées */}
      {lundi === lundiDe(auj) && lundiDuBilan(auj) && (
        <>
          <CarteBilan lundi={lundiDuBilan(auj)!} deps={[prevues, seances]} />
          <CarteBilanNutrition lieu="semaine" />
        </>
      )}

      <CarteVelo lundi={lundi} deps={[prevues, seances]} onMessage={(m) => setMessage(m.length ? m : undefined)}
        onPrecedente={() => setLundi(decalerJour(lundi, -7))} onSuivante={() => setLundi(decalerJour(lundi, 7))} />

      {message && (
        <Carte>
          <ul className="space-y-1 text-sm">{message.map((m, i) => <li key={i}>{m}</li>)}</ul>
          <button type="button" onClick={() => setMessage(undefined)} className="mt-2 text-xs text-texte-3">OK</button>
        </Carte>
      )}

      <AVoir lundi={lundi} deps={[prevues, seances]} onMessage={setMessage} />

      {/* Une ligne par séance (version compacte validée le 7/11/2026) */}
      <div className="space-y-1.5">
        {jours.map((d) => {
          const duJour = prevues.filter((p) => p.date === d)
          const horsPlan = seances.filter((s) => s.date === d && !duJour.some((p) => p.id === s.prevueId))
          const panne = pannes?.has(d)
          if (!duJour.length && !horsPlan.length)
            return (
              <div key={d} className={`flex items-center gap-2.5 rounded-xl border-l-[3px] px-3 py-2 ${d === auj ? 'border-accent bg-accent/10' : 'border-transparent bg-surface'}`}>
                <span className="w-9 shrink-0 text-[13px] text-texte-3">{court(d)}</span>
                <span className="text-sm text-texte-3">Repos{panne ? ' · vélo en panne' : ''}</span>
              </div>
            )
          return (
            <div key={d} className="space-y-1.5">
              {duJour.map((p, k) => {
                const e = etatVisuel(p, auj)
                const aujourdhuiPrevue = d === auj && p.statut === 'prevue'
                const couleur = e.couleur ?? (aujourdhuiPrevue ? 'var(--color-accent)' : 'transparent')
                return (
                  <button key={p.id} type="button" onClick={() => setChoisie(p)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border-l-[3px] px-3 py-2.5 text-left ${aujourdhuiPrevue ? 'bg-accent/10' : 'bg-surface'}`}
                    style={{ borderLeftColor: couleur }}>
                    <span className="w-9 shrink-0 text-[13px] text-texte-3">{k === 0 ? court(d) : ''}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${e.couleur === ROUGE ? 'line-through opacity-60' : ''}`}><IconeSport sport={p.sport} />{p.realiseDifferent ? p.titreRealise ?? 'Séance faite' : p.titre}</span>
                      {p.realiseDifferent && <span className="block truncate text-xs text-texte-3"><s>Prévu : {p.titre}</s></span>}
                    </span>
                    <span className="shrink-0 text-xs font-semibold" style={{ color: e.couleur ?? (aujourdhuiPrevue ? 'var(--color-accent)' : undefined) }}>
                      {e.libelle || (aujourdhuiPrevue ? 'aujourd’hui' : <span className="font-normal text-texte-3">{p.dureeMin} min</span>)}
                    </span>
                  </button>
                )
              })}
              {horsPlan.map((x, k) => (
                <div key={x.id} className="flex items-center gap-2.5 rounded-xl border-l-[3px] bg-surface px-3 py-2.5" style={{ borderLeftColor: VERT }}>
                  <span className="w-9 shrink-0 text-[13px] text-texte-3">{k === 0 && !duJour.length ? court(d) : ''}</span>
                  <span className="min-w-0 flex-1 truncate text-sm"><IconeSport sport={x.sport} homeTrainer={x.homeTrainer} />{x.titre ?? x.type ?? 'Séance'}</span>
                  <span className="shrink-0 text-xs text-texte-3">hors plan ✓</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={() => setAjout(auj >= jours[0] && auj <= jours[6] ? auj : jours[0])} className="w-full py-2 text-sm font-semibold text-accent">+ Ajouter une séance</button>

      {ajout && (
        <Feuille titre="Ajouter une séance" onFermer={() => setAjout(null)}>
          <FormulairePrevue
            initiale={{ id: nouvelId(), date: ajout, sport: 'velo', titre: '', intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel' }}
            jours={jours}
            onTermine={() => setAjout(null)}
          />
        </Feuille>
      )}
      {choisie && <DetailSeance p={choisie} jours={jours} prevues={prevues} onFermer={() => setChoisie(null)} onMessage={setMessage} />}
    </div>
  )
}

/** Vélo de la semaine : une jauge de kJ (fait / prévu) et le bouton pour générer les séances. */
function CarteVelo({ lundi, deps, onMessage, onPrecedente, onSuivante }: { lundi: string; deps: unknown[]; onMessage: (m: string[]) => void; onPrecedente: () => void; onSuivante: () => void }) {
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

  const semaine = `Sem. du ${depuisJour(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  return (
    <Carte>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center text-sm text-texte-2">
          <button type="button" onClick={onPrecedente} className="pr-2 text-xl text-accent" aria-label="Semaine précédente">‹</button>
          {semaine}
          <button type="button" onClick={onSuivante} className="pl-2 text-xl text-accent" aria-label="Semaine suivante">›</button>
        </span>
        {(meta || kj.kjPrevus > 0) && (
          <span className="flex items-center gap-2 text-sm">
            <span><b className="text-lg">{formatNombre(Math.round(kj.kjRealises))}</b> / {formatNombre(Math.round(kj.kjPrevus))} kJ</span>
            {!passee && <button type="button" onClick={generer} disabled={occupe} className="px-1 text-lg text-accent disabled:opacity-40" aria-label="Recalculer le vélo de la semaine">{occupe ? '…' : '↻'}</button>}
          </span>
        )}
      </div>
      {meta || kj.kjPrevus > 0 ? (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, kj.kjPrevus ? (kj.kjRealises / kj.kjPrevus) * 100 : 0)}%` }} />
          </div>
          <BarresSemaine lundi={lundi} />
          {meta && <p className="mt-1.5 text-xs text-texte-3">{meta.phase}{meta.allegee ? ' · semaine allégée' : ''} · {meta.raison}<Aide titre="Budget kJ" texte={AIDES.budgetAuto} /></p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-texte-2">Ajoute tes séances de course et ton renfo, puis génère ton vélo : il se place autour, sans deux jours durs d'affilée.<Aide titre="Programme vélo" texte={AIDES.programme} /></p>
          {!passee && <Bouton className="mt-3" disabled={occupe} onClick={generer}>{occupe ? 'Calcul…' : 'Générer mon vélo de la semaine'}</Bouton>}
        </>
      )}
    </Carte>
  )
}

/** Un seul bandeau pour ce qui demande ton attention : alertes de la semaine et « semaine chargée ». */
function AVoir({ lundi, deps, onMessage }: { lundi: string; deps: unknown[]; onMessage: (m: string[]) => void }) {
  const alertes = useLiveQuery(() => alertesCumul(lundi), [lundi, ...deps])
  const chargee = useLiveQuery(async () => (await lireSemaineChargee(lundi)) ?? null, [lundi, ...deps])
  const aVenir = decalerJour(lundi, 6) >= aujourdhui()
  if (alertes === undefined || chargee === undefined) return null
  const n = alertes.length
  if (!n && !chargee && !aVenir) return null
  const resume = n ? `⚠️ ${n} point${n > 1 ? 's' : ''} à voir` : chargee ? 'Semaine chargée : le minimum' : 'Rien à signaler · semaine chargée ?'
  return (
    <Repliable titre="À voir cette semaine" resume={resume} libelle="Voir" className={n ? 'border-[#fb923c]/50' : ''}>
      {n > 0 && <ul className="space-y-1.5 text-sm">{alertes.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      {aVenir && (chargee ? (
        <div className="mt-2 text-sm">
          <b>Semaine chargée</b> : on garde le minimum, sans rattraper.<Aide titre="Semaine chargée" texte={AIDES.semaineChargee} />
          <button type="button" onClick={() => annulerSemaineChargee(lundi)} className="mt-1 block text-texte-3 underline">Annuler : remettre la semaine normale</button>
        </div>
      ) : (
        <button type="button" onClick={async () => onMessage(await passerSemaineChargee(lundi))}
          className="mt-2 w-full rounded-xl border border-dashed border-bordure py-2.5 text-sm font-semibold text-texte-2">
          Semaine chargée ? Garder le minimum
        </button>
      ))}
    </Repliable>
  )
}

/** Détail d'une séance prévue : consignes, faite, pas faite, modifier, supprimer. */
function DetailSeance({ p, jours, prevues, onFermer, onMessage }: {
  p: SeancePrevue; jours: string[]; prevues: SeancePrevue[]; onFermer: () => void; onMessage: (m: string[]) => void
}) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'actions' | 'annuler' | 'confirmer' | 'modifier' | 'jour'>('actions')
  const nutrition = useNutritionEffort()
  const [raison, setRaison] = useState<Raison>()
  const [supprimerOk, setSupprimerOk] = useState(false)
  const possibles = useLiveQuery(() => (mode === 'annuler' ? joursPourDeplacer(p) : Promise.resolve([])), [mode, p.id, p.date])
  const nomJour = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })

  if (mode === 'modifier')
    return (
      <Feuille titre="Modifier la séance" onFermer={onFermer}>
        <FormulairePrevue initiale={p} jours={jours} onTermine={onFermer} />
      </Feuille>
    )

  return (
    <Feuille titre={p.titre} onFermer={onFermer}>
      {p.realiseDifferent && (
        <div className="mb-3 rounded-xl border border-[#facc15]/40 bg-[#facc15]/10 p-3 text-sm">
          <p className="text-xs uppercase tracking-wider text-texte-3">Réalisé</p>
          <p><IconeSport sport={p.sport} />{p.titreRealise ?? 'Séance faite'}</p>
          <p className="mt-1.5 text-xs text-texte-2">Réalisé différent du prévu : ni réussie ni ratée pour ta progression. Tes kJ comptent ; si c'était plus dur, le reste de ta semaine a été recalculé.<Aide titre="Réalisé différent" texte={AIDES.realiseDifferent} /></p>
          <button type="button" className="mt-2 w-full rounded-lg bg-surface-2 py-2 text-xs font-semibold" onClick={async () => { await enregistrer(db.prevues, { ...p, realiseDifferent: false }); onFermer() }}>C'était bien la séance prévue</button>
          <p className="mt-2 text-xs uppercase tracking-wider text-texte-3">Prévu</p>
        </div>
      )}
      {p.statut === 'faite' && !p.realiseDifferent && p.sport === 'velo' && (
        <button type="button" className="mb-2 text-xs font-semibold text-texte-3 underline" onClick={async () => { await enregistrer(db.prevues, { ...p, realiseDifferent: true, titreRealise: p.titreRealise ?? 'Autre séance' }); onFermer() }}>J'ai fait autre chose que prévu</button>
      )}
      <p className={`text-sm text-texte-2 ${p.realiseDifferent ? 'line-through' : ''}`}>{p.dureeMin} min{p.kjPrevu ? ` · ${p.kjPrevu} kJ` : ''}</p>
      {p.detail && <p className="mt-2 text-sm">{p.detail}</p>}
      {p.velo?.etapes && <Deroule etapes={p.velo.etapes} />}
      {p.velo?.etapes && p.statut === 'prevue' && p.date >= aujourdhui() && <BoutonsEnvoi p={p} etapes={p.velo.etapes} />}
      {nutrition && <NutritionSeance p={p} />}
      {p.velo?.pourquoi && <p className="mt-2 text-xs text-texte-3">Pourquoi cette séance : {p.velo.pourquoi}</p>}
      {p.velo?.famille?.startsWith('vtt') && <p className="mt-1 text-xs text-texte-3">Sur le terrain : jugée sur ton effort perçu, pas sur la FC ni les watts.<Aide titre="Sortie VTT sur le terrain" texte={AIDES.vttTerrain} /></p>}
      {p.velo?.famille === 'sprints' && <p className="mt-1 text-xs text-texte-3">Sprints à fond : pas de watts à viser.<Aide titre="Sprints à fond" texte={AIDES.aFond} /></p>}
      {(p.velo?.famille === 'simulation-ligne' || p.velo?.famille === 'cyclo-montees' || p.velo?.famille === 'simulation-xco') && <p className="mt-1 text-xs text-texte-3">Séance de course : séance dure, 48 h sans autre intensité.<Aide titre="Simulation de course" texte={AIDES.simulationCourse} /></p>}
      {p.velo?.famille === 'z2-long' && <p className="mt-1 text-xs text-texte-3">Sortie longue : elle s'allonge de semaine en semaine vers la durée de ta course.<Aide titre="Sortie longue" texte={AIDES.sortieLongue} /></p>}
      {!!p.velo?.blocsSv1 && <p className="mt-1 text-xs text-texte-3">Blocs au 1er seuil : haut de ta Z2{p.velo.fcSv1 ? `, FC ${p.velo.fcSv1[0]}-${p.velo.fcSv1[1]}` : ''}, le cœur ne dérive pas.<Aide titre="1er seuil" texte={AIDES.blocsSv1} /></p>}
      {p.velo?.etapes?.some((e) => e.repetition?.etapes.some((x) => x.libelle === 'Sprint à fond')) && <p className="mt-1 text-xs text-texte-3">Sprints à fond, longue récupération.<Aide titre="Sprints" texte={AIDES.sprintsSemaine} /></p>}
      {p.velo?.famille === 'course' && <CiblesDeLaCourse date={p.date} />}
      <FicheSeance velo={p.velo} />
      {mode === 'actions' ? (
        <div className="mt-4 space-y-2">
          {p.statut === 'prevue' && (
            <Bouton onClick={() => {
              const seance: Seance = { id: nouvelId(), date: p.date <= aujourdhui() ? p.date : aujourdhui(), sport: p.sport, type: p.type, titre: p.titre, dureeSec: p.dureeMin * 60, source: 'manuel', prevueId: p.id, ...(p.velo?.famille?.startsWith('vtt') ? { terrainVtt: true } : {}) }
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
          {p.statut === 'prevue' && <Bouton variante="secondaire" onClick={() => setMode('jour')}>↔ Changer de jour</Bouton>}
          {p.statut === 'prevue' && <Bouton variante="secondaire" onClick={() => setMode('annuler')}>✗ Je ne peux pas la faire</Bouton>}
          <Bouton variante="secondaire" onClick={() => setMode('modifier')}>Modifier</Bouton>
          {supprimerOk ? (
            <div className="rounded-xl border border-[#f87171]/50 p-3 text-sm">
              <p>Supprimer la séance pour de bon (ex. ajoutée par erreur) ? Elle disparaît de ta semaine.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-lg border border-bordure py-2 font-semibold" onClick={() => setSupprimerOk(false)}>Non</button>
                <button type="button" className="rounded-lg bg-[#f87171] py-2 font-semibold text-fond" onClick={async () => { await supprimerPrevue(p.id); onFermer() }}>Oui, supprimer</button>
              </div>
            </div>
          ) : (
            <button type="button" className="w-full py-2 text-[#f87171]" onClick={() => setSupprimerOk(true)}>Supprimer</button>
          )}
        </div>
      ) : mode === 'jour' ? (
        <div className="mt-4 space-y-2">
          <p className="text-texte-2">Vers quel jour ? Si une séance y est déjà prévue, tu peux échanger les deux, ou les garder le même jour (ex. renfo le jour d'un footing).</p>
          {jours.map((d) => {
            const la = prevues.filter((x) => x.date === d && x.statut === 'prevue' && x.id !== p.id)
            const jour = <span className="font-semibold capitalize">{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</span>
            if (la.length && d !== p.date) {
              return (
                <div key={d} className="rounded-xl border border-bordure px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between">{jour}<span className="text-texte-2">{la.map((x) => x.titre).join(', ')}</span></div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" className="rounded-lg border border-bordure py-1.5 font-semibold" onClick={async () => { onMessage(await changerDeJour(p, d)); onFermer() }}>↔ Échanger</button>
                    <button type="button" className="rounded-lg border border-bordure py-1.5 font-semibold" onClick={async () => { onMessage(await changerDeJour(p, d, true)); onFermer() }}>＋ Les deux ce jour</button>
                  </div>
                </div>
              )
            }
            return (
              <button key={d} type="button" disabled={d === p.date}
                onClick={async () => { onMessage(await changerDeJour(p, d)); onFermer() }}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${d === p.date ? 'border-accent opacity-60' : 'border-bordure'}`}>
                {jour}
                <span className="text-texte-2">{d === p.date ? 'actuel' : 'libre'}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setMode('actions')} className="w-full py-2 text-sm text-texte-3">Annuler</button>
        </div>
      ) : mode === 'annuler' ? (
        <div className="mt-4 space-y-2">
          <p className="font-semibold">Plutôt la déplacer ?</p>
          {possibles === undefined ? null : possibles.length ? (
            <>
              <p className="text-sm text-texte-2">Jours libres cette semaine{p.intensite === 'haute' ? ' (conseillé : pas de séance dure la veille ni le lendemain)' : ''} :</p>
              {possibles.map((j) => (
                <button key={j.date} type="button" onClick={async () => { onMessage(await changerDeJour(p, j.date)); onFermer() }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${j.conseille ? 'border-accent' : 'border-bordure'}`}>
                  <span className="font-semibold capitalize">{nomJour(j.date)}</span>
                  <span className={j.conseille ? 'text-accent' : 'text-texte-3'}>{j.conseille ? (p.intensite === 'haute' ? 'conseillé' : 'libre') : j.note}</span>
                </button>
              ))}
              <p className="text-xs text-texte-3">Un jour déjà pris ? « ↔ Changer de jour » permet aussi d'échanger deux séances.</p>
            </>
          ) : (
            <p className="text-sm text-texte-2">Pas de jour libre d'ici dimanche pour la déplacer.</p>
          )}
          <button type="button" onClick={() => setMode('confirmer')} className="w-full rounded-xl border border-[#f87171]/50 py-2.5 text-sm font-semibold text-[#f87171]">Non, l'annuler</button>
          <button type="button" onClick={() => setMode('actions')} className="w-full py-2 text-sm text-texte-3">Retour</button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="font-semibold">Tu es sûr de l'annuler ?</p>
          <p className="text-sm text-texte-2">
            Elle ne sera pas rattrapée cette semaine{p.sport === 'velo' && p.kjPrevu ? ` : ${p.kjPrevu} kJ de moins sur ton budget, la semaine suivante reste stable au lieu d'augmenter si le budget n'est pas atteint` : ''}.
            {p.priorite === 'cle' ? ' C’est une séance clé : si tu peux, déplace-la plutôt.' : ''}
          </p>
          <p className="text-texte-2">Pourquoi ?</p>
          <Puces options={RAISONS} valeur={raison} onChoisir={setRaison} />
          <div className="grid grid-cols-2 gap-2">
            <Bouton variante="secondaire" onClick={() => setMode('annuler')}>Non, retour</Bouton>
            <Bouton disabled={!raison} onClick={async () => { onMessage(await annulerPrevue(p, raison!)); onFermer() }}>Oui, annuler</Bouton>
          </div>
        </div>
      )}
    </Feuille>
  )
}

/** Jour de course : watts cibles de chaque col (si les cols de la course sont notés). */
function CiblesDeLaCourse({ date }: { date: string }) {
  const [r] = useReglagesEntrainement()
  const prog = programmeDe(r.programme)
  const course = prog.competitions.find((c) => c.date === date)
  if (!course) return null
  const poidsKg = [...r.tests].reverse().find((t) => t.poidsKg)?.poidsKg
  return <CiblesCols course={course} contexte={{ discipline: prog.discipline ?? 'route', typeCourse: prog.typeCourse, dureeCourseMin: prog.dureeCourseMin, cpW: r.cpW, wPrimeKj: r.wPrimeKj, poidsKg }} />
}
