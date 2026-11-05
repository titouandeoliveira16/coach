import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { enregistrer, supprimer } from '../../../core/stockage'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { analyser } from '../analyse/donnees'
import { adapterDuJour } from '../plan/adaptation'
import { JOURS_REPRISE, annulerReport, repriseApresMaladie, reporterIntensite } from '../plan/imprevus'
import { CP_DEFAUT, estIntensite } from '../plan/programme'
import { BoutonsEnvoi } from '../plan/BoutonsEnvoi'
import { Profil } from '../plan/Deroule'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { iconeSport } from '../sports'
import { basculerSansMontre, QUESTIONS, scoreRessenti } from './donnees'
import { SeancesFaites } from './SeancesFaites'
import type { Raison, Seance } from '../types'
import { nouvelId } from '../seances/donnees'

const TITRE = { vert: 'Feu vert', orange: 'Prudence', rouge: 'Récupère' }
const COULEUR = { vert: '#4ade80', orange: '#fb923c', rouge: '#f87171' }

/** Choix bien visible entre la version conseillée par le feu et la séance prévue. */
function ChoixSeance({ maintenue, conseil, prevu, couleur, onChoisir }: {
  maintenue: boolean; conseil: string; prevu: string; couleur: string; onChoisir: (maintenir: boolean) => void
}) {
  const bouton = (actif: boolean) =>
    `flex-1 rounded-xl border-2 px-2 py-1.5 text-sm font-semibold leading-tight ${actif ? 'text-fond' : 'border-bordure bg-surface text-texte-3'}`
  return (
    <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Séance à faire">
      <button type="button" role="radio" aria-checked={!maintenue} className={bouton(!maintenue)}
        style={!maintenue ? { background: couleur, borderColor: couleur } : undefined} onClick={() => onChoisir(false)}>
        {conseil}<span className="block text-xs font-normal">conseillé</span>
      </button>
      <button type="button" role="radio" aria-checked={maintenue} className={bouton(maintenue)}
        style={maintenue ? { background: '#4ade80', borderColor: '#4ade80' } : undefined} onClick={() => onChoisir(true)}>
        {prevu}<span className="block text-xs font-normal">je me sens bien</span>
      </button>
    </div>
  )
}

/** Signal du jour, raison, séance prévue et recommandation. */
export function CarteAujourdhui({ onModifierMatin }: { onModifierMatin?: () => void } = {}) {
  const jour = aujourdhui()
  const [formeOuverte, setFormeOuverte] = useState(false)
  const navigate = useNavigate()
  // Jour de repos : on montre la séance de demain
  const demain = useLiveQuery(async () => (await db.prevues.where('date').equals(decalerJour(jour, 1)).toArray()).filter((p) => p.statut === 'prevue'), [jour])
  const [r] = useReglagesEntrainement()
  const cpW = r.cpW ?? CP_DEFAUT
  const a = useLiveQuery(() => analyser(jour), [jour])
  const prevues = useLiveQuery(() => db.prevues.where('date').equals(jour).toArray(), [jour])
  // null = pas encore de décision ; undefined = lecture en cours
  const decision = useLiveQuery(async () => (await db.decisions.get(jour)) ?? null, [jour])
  const indispo = useLiveQuery(() => db.indispos.get(jour), [jour])
  // Séance d'intensité reportée aujourd'hui à cause du feu rouge
  const reportee = useLiveQuery(async () => (await db.prevues.toArray()).find((p) => p.reporteeDu === jour) ?? null, [jour])
  const mesure = useLiveQuery(() => db.mesures.get(jour), [jour])
  const faites = useLiveQuery(async () => (await db.seances.where('date').equals(jour).count()) > 0, [jour])

  // On garde une trace du signal du jour (sans écraser un forçage)
  const couleur = a?.signal.couleur
  useEffect(() => {
    if (!couleur || decision === undefined || decision?.force) return
    if (decision?.couleur !== couleur) enregistrer(db.decisions, { date: jour, couleur, force: false })
  }, [couleur, decision, jour])

  // Feu rouge sans maladie : l'intensité vélo est reportée (pas supprimée) ; sinon elle revient
  const maladie = a?.signal.alertes.some((x) => x.code === 'malade')
  // Reprise après au moins 3 jours malade : pas d'intensité pendant 3 jours
  const reprise = useLiveQuery(() => repriseApresMaladie(jour), [jour])
  const rougeFatigue = ((a?.signal.couleur === 'rouge' && !maladie) || !!reprise) && !decision?.force
  const aReporter = prevues?.find((p) => p.statut === 'prevue' && p.sport === 'velo' && (estIntensite(p) || p.velo?.famille === 'test'))
  useEffect(() => {
    if (!a || !prevues || decision === undefined || reportee === undefined || reprise === undefined) return
    if (rougeFatigue && aReporter) reporterIntensite(aReporter)
    else if (!rougeFatigue && reportee) annulerReport(jour)
  }, [a, prevues, decision, reportee, rougeFatigue, aReporter, jour, reprise])

  if (!a || !prevues) return null
  const { signal } = a
  const prevue = prevues.find((p) => p.statut === 'prevue' && p.intensite !== 'basse') ?? prevues.find((p) => p.statut === 'prevue')
  const adaptation = prevue ? adapterDuJour(prevue, signal.couleur) : undefined
  const malade = indispo?.raison === 'Malade' || indispo?.raison === 'Douleur / blessure'
  const troisJours = [signal, ...a.signauxPrecedents].every((s) => s.couleur !== 'vert' && s.alertes.some((x) => x.code === 'malade'))

  // Pourquoi la séance est adaptée : les signaux en alerte ce matin, en clair
  const enAlerte = signal.alertes.filter((x) => x.compte || x.code === 'saturation')
  const pourquoi = enAlerte.length
    ? `${enAlerte.length === 1 ? '1 signal en alerte' : `${enAlerte.length} signaux en alerte`} ce matin : ${enAlerte.map((x) => x.texte.replace(/^./, (c) => c.toLowerCase())).join(' ; ')}.`
    : ''
  // Version courte pour la carte (le détail chiffré est dans le « ? »)
  const pourquoiCourt = enAlerte.map((x) => x.texte.replace(/\s*\(.*?\)/g, '').replace(/^./, (c) => c.toLowerCase())).join(', ')
  const regle = signal.couleur === 'orange'
    ? 'Règle : 1 signal en alerte = séance raccourcie, mêmes watts (une série ou un tiers des répétitions en moins). Si tu te sens très bien, tu peux garder la séance complète.'
    : 'Règle : 2 signaux en alerte ou plus (ou malade) = pas d’intensité aujourd’hui. Si tu te sens vraiment bien et que tu n’es pas malade, tu peux garder la séance prévue.'
  const choisir = (maintenir: boolean) => enregistrer(db.decisions, { date: jour, couleur: signal.couleur, force: maintenir })

  const signaler = async (raison: Raison) => {
    if (indispo?.raison === raison) await supprimer(db.indispos, jour)
    else await enregistrer(db.indispos, { date: jour, raison })
  }

  const etapesDuJour = prevue && (decision?.force ? prevue.velo?.etapes : adaptation!.etapes)
  const minutesAdaptees = adaptation?.etapes ? Math.round(adaptation.etapes.reduce((t, e) => t + e.dureeSec, 0) / 60) : undefined
  const cases = (['recuperation', 'pouls', 'sommeil', 'ressenti'] as const).map((cle) => ({ cle, d: signal.details.find((x) => x.cle === cle) }))
  const autres = signal.details.filter((x) => !x.cle || x.cle === 'charge')
  const NOMS_CASES = { recuperation: 'Récup.', pouls: 'Pouls', sommeil: 'Sommeil', ressenti: 'Ressenti' }
  // Chiffres du matin sous chaque case (ex-carte « Ton matin »)
  const enHeures = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
  const nuits7 = a.mesures.filter((m) => m.date > decalerJour(jour, -7) && m.sommeilH !== undefined).map((m) => m.sommeilH!)
  const ressenti = mesure ? scoreRessenti(mesure) : undefined
  const resumes: Record<(typeof cases)[number]['cle'], string | undefined> = {
    recuperation: mesure?.vfcMs !== undefined && !mesure.sansMontre ? `${mesure.vfcMs} ms` : undefined,
    pouls: mesure?.fcRepos !== undefined && !mesure.sansMontre ? `${mesure.fcRepos} bpm` : undefined,
    sommeil: mesure?.sommeilH !== undefined && !mesure.sansMontre ? enHeures(mesure.sommeilH) : undefined,
    ressenti: ressenti !== undefined ? `${formatNombre(ressenti, 1)} / 5` : undefined,
  }
  const chiffres: Record<(typeof cases)[number]['cle'], string | undefined> = {
    recuperation: mesure?.vfcMs !== undefined && !mesure.sansMontre ? `VFC ${mesure.vfcMs} ms` : undefined,
    pouls: mesure?.fcRepos !== undefined && !mesure.sansMontre ? `${mesure.fcRepos} bpm` : undefined,
    sommeil: [mesure?.sommeilH !== undefined && !mesure.sansMontre ? enHeures(mesure.sommeilH) : undefined, nuits7.length >= 3 ? `7 j : ${enHeures(nuits7.reduce((x, y) => x + y, 0) / nuits7.length)}` : undefined].filter(Boolean).join(' · ') || undefined,
    ressenti: ressenti !== undefined ? `${formatNombre(ressenti, 1)} / 5 en moyenne` : undefined,
  }
  const couleurEtat = (e?: 'ok' | 'alerte' | 'info') => (e === 'alerte' ? COULEUR[signal.couleur === 'vert' ? 'orange' : signal.couleur] : e === 'ok' ? COULEUR.vert : '#a3abb7')
  const petitBouton = (actif: boolean) => `min-h-11 flex-1 rounded-xl border px-1 text-[13px] font-semibold ${actif ? 'border-[#f87171] bg-[#f87171] text-fond' : 'border-bordure text-texte-2'}`

  return (
    <>
      {/* Ta forme : le feu et ses 4 indicateurs, détail à ouvrir */}
      <Carte className="flex shrink-0 flex-col gap-2.5 p-3!">
        <button type="button" onClick={() => setFormeOuverte(!formeOuverte)} className="flex items-center justify-between text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-texte-3">Ta forme</span>
          <span className="flex items-center gap-1.5 font-bold" style={{ color: COULEUR[signal.couleur] }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR[signal.couleur] }} />{TITRE[signal.couleur]}
            <span className="font-normal text-texte-3">{formeOuverte ? '▴' : '▾'}</span>
          </span>
        </button>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {cases.map(({ cle, d }) => (
            <button key={cle} type="button" onClick={() => setFormeOuverte(!formeOuverte)} className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-2 px-0.5 py-1.5"
              style={d?.etat === 'alerte' ? { boxShadow: `inset 0 0 0 1px ${couleurEtat('alerte')}` } : undefined}>
              <span className="text-[11px] text-texte-3">{NOMS_CASES[cle]}</span>
              <span className="text-sm font-semibold leading-tight" style={{ color: couleurEtat(d?.etat) }}>{d?.court ?? '—'}</span>
              {resumes[cle] && <span className="text-[11px] leading-tight text-texte-2">{resumes[cle]}</span>}
            </button>
          ))}
        </div>
        {formeOuverte && (
          <div className="space-y-2">
            {signal.calibrationVfc && <p className="text-xs text-texte-3">VFC en calibration ({a.vfc.nBase}/14 jours)</p>}
            {Object.values(chiffres).some(Boolean) && <p className="text-sm text-texte-2">{Object.values(chiffres).filter(Boolean).join(' · ')}</p>}
            {mesure && (
              <div className="flex flex-wrap items-center gap-1.5">
                {QUESTIONS.filter((q) => mesure[q.cle] !== undefined).map((q) => (
                  <span key={q.cle} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-texte-2">{q.libelle} {mesure[q.cle]}</span>
                ))}
                {onModifierMatin && <button type="button" onClick={onModifierMatin} className="px-1 py-1 text-xs font-semibold text-accent">Modifier</button>}
              </div>
            )}
            {signal.details.some((x) => x.etat === 'alerte' && x.cle && x.cle !== 'charge' && x.texte !== x.court) && (
              <p className="text-sm" style={{ color: couleurEtat('alerte') }}>
                {signal.details.filter((x) => x.etat === 'alerte' && x.cle && x.cle !== 'charge' && x.texte !== x.court).map((x) => x.texte).join(' · ')}
              </p>
            )}
            {autres.length > 0 && (
              <ul className="space-y-0.5 text-sm">
                {autres.map((x) => (
                  <li key={x.texte} style={{ color: x.etat === 'alerte' ? couleurEtat('alerte') : undefined }} className={x.etat === 'alerte' ? '' : 'text-texte-3'}>{x.texte}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => basculerSansMontre(jour)} className={`${petitBouton(false)} ${mesure?.sansMontre ? 'border-accent text-accent' : ''}`}>
                {mesure?.sansMontre ? '✓ Sans montre' : 'Nuit sans montre'}
              </button>
              {(['Malade', 'Douleur / blessure'] as Raison[]).map((r) => (
                <button key={r} type="button" onClick={() => signaler(r)} className={petitBouton(indispo?.raison === r)}>
                  {r === 'Malade' ? 'Malade' : 'Douleur'}
                </button>
              ))}
              <span className="shrink-0 self-center"><Aide titre="Nuit sans montre" texte={AIDES.nuitSansMontre} /></span>
            </div>
          </div>
        )}
        {malade && <p className="text-xs text-texte-3">Noté pour aujourd'hui : la journée est marquée indisponible.</p>}
        {troisJours && (
          <p className="rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 p-3 text-sm">
            3 jours de suite en alerte avec une maladie ou une douleur : prends l'avis d'un médecin avant de reprendre.
          </p>
        )}
      </Carte>

      {/* Séance du jour : la carte qui prend toute la place restante (elle défile seule si besoin) */}
      <Carte className={`flex flex-col p-3! ${faites ? 'shrink-0' : 'min-h-0 flex-1 overflow-hidden'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-3">Séance du jour</p>
          {prevue && <span className="text-xs text-texte-2">{prevue.sport === 'velo' ? 'vélo' : prevue.sport}</span>}
        </div>
        {reprise ? (
          <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
            💪 <b>Reprise après maladie (jour {reprise}/{JOURS_REPRISE})</b> : pas d'intensité, sorties très faciles de 45 min au plus. L'intensité revient ensuite, si le feu est vert.
          </p>
        ) : null}
        {faites ? <SeancesFaites jour={jour} /> : null}
        {faites && prevue && <p className="mt-3 text-xs uppercase tracking-wider text-texte-3">Encore prévu</p>}
        {prevue ? (
          <>
            <p className="mt-0.5 text-[22px] font-bold leading-tight">{prevue.titre}{prevue.sport === 'velo' && !/\d+ ?(min|h)/.test(prevue.titre) ? ` · ${prevue.dureeMin} min` : ''}</p>
            {prevue.kjPrevu ? <p className="text-xs text-texte-3">{prevue.kjPrevu} kJ</p> : null}
            {adaptation?.modifiee ? (
              <>
                <p className="mt-1 text-sm"><b style={{ color: COULEUR[signal.couleur] }}>Pourquoi {signal.couleur === 'orange' ? 'raccourcie' : 'pas d’intensité'} ?</b> {pourquoiCourt}<Aide titre="Règle du feu" texte={`${pourquoi} ${regle}`} /></p>
                <ChoixSeance maintenue={!!decision?.force} couleur={COULEUR[signal.couleur]} onChoisir={choisir}
                  conseil={signal.couleur === 'orange' ? `Raccourcie${minutesAdaptees ? ` · ${minutesAdaptees} min` : ''}` : 'Très facile ou repos'}
                  prevu={signal.couleur === 'orange' ? `Complète · ${prevue.dureeMin} min` : 'Séance prévue'} />
                {decision?.force && <p className="mt-1.5 text-sm font-semibold" style={{ color: COULEUR.vert }}>Séance complète maintenue : arrête-toi si les watts ne tiennent pas.</p>}
                {!decision?.force && !etapesDuJour && <p className="mt-1.5 text-[13px] leading-snug" style={{ color: COULEUR[signal.couleur] }}>{adaptation.texte.replace(/^Feu \w+ : /, '').replace(/^./, (c) => c.toUpperCase())}</p>}
              </>
            ) : (
              <p className="mt-1 text-sm" style={{ color: signal.couleur === 'vert' ? COULEUR.vert : COULEUR[signal.couleur] }}>
                {signal.couleur === 'vert' ? 'Feu vert : séance prévue maintenue.' : adaptation!.texte}
              </p>
            )}
            {etapesDuJour ? (
              <>
                <Profil etapes={etapesDuJour} cpW={cpW} extensible />
                {prevue.detail && !adaptation?.modifiee && <p className="mt-2 text-[13px] text-texte-2">{prevue.detail}</p>}
                {prevue.sport === 'velo' && <BoutonsEnvoi p={prevue} etapes={etapesDuJour} />}
              </>
            ) : (
              // Renfo, course, séance sans déroulé : le détail est visible directement
              <div className="mt-2 min-h-0 flex-1 overflow-hidden whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm text-texte-2">
                {prevue.detail || `${prevue.dureeMin} min`}
              </div>
            )}
            {prevue.sport !== 'velo' && (
              <button type="button" className="mt-2 min-h-11 w-full shrink-0 rounded-xl bg-accent text-sm font-bold text-fond" onClick={() => {
                const seance: Seance = { id: nouvelId(), date: jour, sport: prevue.sport, type: prevue.type, titre: prevue.titre, dureeSec: prevue.dureeMin * 60, source: 'manuel', prevueId: prevue.id }
                navigate('/entrainement/seance/nouvelle', { state: { seance } })
              }}>Faite</button>
            )}
          </>
        ) : faites ? null : reportee ? (
          <div className="mt-1 text-sm">
            <p className="font-semibold" style={{ color: COULEUR.rouge }}>
              Feu rouge : {reportee.titre} {reportee.statut === 'reportee' ? 'est à reporter (plus de jour possible cette semaine)' : `reportée au ${depuisJour(reportee.date).toLocaleDateString('fr-FR', { weekday: 'long' })}`}.
            </p>
            {pourquoi && <p className="mt-1"><b style={{ color: COULEUR.rouge }}>Pourquoi ?</b> {pourquoi}</p>}
            <ChoixSeance maintenue={false} couleur={COULEUR.rouge} onChoisir={choisir} conseil="Reporter la séance" prevu="La faire aujourd’hui" />
            <p className="mt-1 text-xs text-texte-3">{regle}</p>
          </div>
        ) : (
          // Repos : la place sert à montrer demain
          <>
            <p className="mt-1 text-[22px] font-bold">{signal.couleur === 'rouge' ? 'Très facile ou repos' : 'Repos'}</p>
            <p className="mt-1 text-sm text-texte-2">
              {signal.couleur === 'rouge' ? '30 à 45 min très facile au plus, ou repos complet.' : 'Rien de prévu : c’est aussi là que tu progresses. Marche, étirements, bien dormir.'}
            </p>
            <div className="flex-1" />
            {demain && demain.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-texte-3">Demain</p>
                {demain.map((d) => (
                  <div key={d.id} className="mt-1.5 rounded-xl bg-surface-2 p-3">
                    <p className="flex justify-between gap-2 font-semibold"><span>{iconeSport(d.sport)} {d.titre}</span><span className="font-normal text-texte-2">{d.dureeMin} min</span></p>
                    {d.velo?.etapes && <Profil etapes={d.velo.etapes} cpW={cpW} />}
                    {d.intensite !== 'basse' && <p className="mt-1.5 text-[13px] text-texte-2">Séance dure demain : recharge bien en glucides ce soir.</p>}
                  </div>
                ))}
              </>
            )}
            <Link to="/entrainement/semaine" className="mt-2 py-1.5 text-sm font-semibold text-accent">Voir ma semaine ›</Link>
          </>
        )}
      </Carte>
    </>
  )
}
