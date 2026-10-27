import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import { Carte } from '../../../core/ui/Carte'
import { analyser } from '../analyse/donnees'
import { adapterDuJour } from '../plan/adaptation'
import { JOURS_REPRISE, annulerReport, repriseApresMaladie, reporterIntensite } from '../plan/imprevus'
import { estIntensite } from '../plan/programme'
import { Deroule } from '../plan/Deroule'
import { NutritionSeance } from '../plan/NutritionSeance'
import { iconeSport } from '../sports'
import { SeancesFaites } from './SeancesFaites'
import type { Raison } from '../types'

const PASTILLE = { vert: '🟢', orange: '🟠', rouge: '🔴' }
const TITRE = { vert: 'Feu vert', orange: 'Prudence', rouge: 'Récupère' }
const COULEUR = { vert: '#4ade80', orange: '#fb923c', rouge: '#f87171' }

/** Signal du jour, raison, séance prévue et recommandation. */
export function CarteAujourdhui() {
  const jour = aujourdhui()
  const a = useLiveQuery(() => analyser(jour), [jour])
  const prevues = useLiveQuery(() => db.prevues.where('date').equals(jour).toArray(), [jour])
  // null = pas encore de décision ; undefined = lecture en cours
  const decision = useLiveQuery(async () => (await db.decisions.get(jour)) ?? null, [jour])
  const indispo = useLiveQuery(() => db.indispos.get(jour), [jour])
  // Séance d'intensité reportée aujourd'hui à cause du feu rouge
  const reportee = useLiveQuery(async () => (await db.prevues.toArray()).find((p) => p.reporteeDu === jour) ?? null, [jour])
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

  const signaler = async (raison: Raison) => {
    if (indispo?.raison === raison) await supprimer(db.indispos, jour)
    else await enregistrer(db.indispos, { date: jour, raison })
  }

  return (
    <Carte>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{PASTILLE[signal.couleur]}</span>
        <div className="flex-1">
          <p className="text-xl font-bold" style={{ color: COULEUR[signal.couleur] }}>{TITRE[signal.couleur]}</p>
          {signal.calibrationVfc && <p className="text-xs text-texte-3">VFC en calibration ({a.vfc.nBase}/14 jours)</p>}
        </div>
      </div>

      <p className="mt-2 text-sm text-texte-2">{signal.raison}</p>
      {reprise ? (
        <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
          💪 <b>Reprise après maladie (jour {reprise}/{JOURS_REPRISE})</b> : pas d'intensité, sorties très faciles de 45 min au plus. L'intensité revient ensuite, si le feu est vert.
        </p>
      ) : null}

      <div className="mt-3 rounded-xl bg-surface-2 p-3">
        <p className="text-xs uppercase tracking-wider text-texte-3">Séance du jour</p>
        {faites ? <SeancesFaites jour={jour} /> : null}
        {faites && prevue && <p className="mt-3 text-xs uppercase tracking-wider text-texte-3">Encore prévu</p>}
        {prevue ? (
          <>
            <p className="font-semibold">{iconeSport(prevue.sport)} {prevue.titre} · {prevue.dureeMin} min{prevue.kjPrevu ? ` · ${prevue.kjPrevu} kJ` : ''}</p>
            {prevue.detail && <p className="mt-1 text-xs text-texte-2">{prevue.detail}</p>}
            <p className="mt-2 font-semibold" style={{ color: decision?.force ? undefined : COULEUR[signal.couleur] }}>
              {decision?.force ? '✋ Tu as choisi de maintenir ta séance.' : adaptation!.texte}
            </p>
            {(decision?.force ? prevue.velo?.etapes : adaptation!.etapes) && <Deroule etapes={(decision?.force ? prevue.velo?.etapes : adaptation!.etapes)!} />}
            {!(adaptation?.modifiee && !decision?.force && signal.couleur === 'rouge') && <NutritionSeance p={prevue} />}
          </>
        ) : faites ? null : (
          <p className="text-texte-2">
            {reportee && (
              <span className="mb-1 block font-semibold" style={{ color: COULEUR.rouge }}>
                Feu rouge : {reportee.titre} {reportee.statut === 'reportee' ? 'est à reporter (plus de jour possible cette semaine)' : `reportée au ${depuisJour(reportee.date).toLocaleDateString('fr-FR', { weekday: 'long' })}`}.
              </span>
            )}
            {signal.couleur === 'rouge' ? 'Aujourd’hui : 30 à 45 min très facile, ou repos. ' : 'Rien de prévu. '}
            <Link to="/entrainement/semaine" className="text-accent">Ma semaine ›</Link>
          </p>
        )}
        {reportee && !prevue && (
          <button type="button" className="mt-2 text-sm text-texte-3 underline"
            onClick={() => enregistrer(db.decisions, { date: jour, couleur: signal.couleur, force: true })}>
            Je maintiens quand même ma séance aujourd'hui
          </button>
        )}
        {adaptation?.modifiee && (
          <button type="button" className="mt-2 text-sm text-texte-3 underline"
            onClick={() => enregistrer(db.decisions, { date: jour, couleur: signal.couleur, force: !decision?.force })}>
            {decision?.force ? 'Annuler : suivre la recommandation' : 'Je maintiens quand même ma séance'}
          </button>
        )}
      </div>

      {troisJours && (
        <p className="mt-3 rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 p-3 text-sm">
          3 jours de suite en alerte avec une maladie ou une douleur : prends l'avis d'un médecin avant de reprendre.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {(['Malade', 'Douleur / blessure'] as Raison[]).map((r) => (
          <button key={r} type="button" onClick={() => signaler(r)}
            className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${indispo?.raison === r ? 'border-[#f87171] bg-[#f87171] text-fond' : 'border-bordure text-texte-2'}`}>
            {r === 'Malade' ? '🤒 Malade' : '🤕 Douleur'}
          </button>
        ))}
      </div>
      {malade && <p className="mt-2 text-xs text-texte-3">Noté pour aujourd'hui : la journée est marquée indisponible.</p>}
    </Carte>
  )
}
