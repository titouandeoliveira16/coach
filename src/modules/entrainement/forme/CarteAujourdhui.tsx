import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import { Carte } from '../../../core/ui/Carte'
import { adapterSeance } from '../../../metrics/signal'
import { analyser } from '../analyse/donnees'
import { z2Actuel } from '../plan/programme'
import { iconeSport } from '../sports'
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
  const z2 = useLiveQuery(z2Actuel)

  // On garde une trace du signal du jour (sans écraser un forçage)
  const couleur = a?.signal.couleur
  useEffect(() => {
    if (!couleur || decision === undefined || decision?.force) return
    if (decision?.couleur !== couleur) enregistrer(db.decisions, { date: jour, couleur, force: false })
  }, [couleur, decision, jour])

  if (!a || !prevues) return null
  const { signal } = a
  const prevue = prevues.find((p) => p.statut === 'prevue' && p.intensite !== 'basse') ?? prevues.find((p) => p.statut === 'prevue')
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

      <div className="mt-3 rounded-xl bg-surface-2 p-3">
        <p className="text-xs uppercase tracking-wider text-texte-3">Séance du jour</p>
        {prevue ? (
          <>
            <p className="font-semibold">{iconeSport(prevue.sport)} {prevue.titre} · {prevue.dureeMin} min{prevue.kjPrevu ? ` · ${prevue.kjPrevu} kJ` : ''}</p>
            {prevue.detail && <p className="mt-1 text-xs text-texte-2">{prevue.detail}</p>}
          </>
        ) : (
          <p className="text-texte-2">Rien de prévu. <Link to="/entrainement/semaine" className="text-accent">Ma semaine ›</Link></p>
        )}
        <p className="mt-1 font-semibold" style={{ color: decision?.force ? undefined : COULEUR[signal.couleur] }}>
          {decision?.force ? '✋ Tu as choisi de maintenir ta séance.' : adapterSeance(prevue, signal, prevue?.sport === 'velo' ? z2?.w : undefined)}
        </p>
        {prevue && signal.couleur !== 'vert' && (
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
