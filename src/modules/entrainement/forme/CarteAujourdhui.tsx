import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { analyser } from '../analyse/donnees'
import { adapterDuJour } from '../plan/adaptation'
import { JOURS_REPRISE, annulerReport, repriseApresMaladie, reporterIntensite } from '../plan/imprevus'
import { estIntensite } from '../plan/programme'
import { BoutonsEnvoi } from '../plan/BoutonsEnvoi'
import { Deroule } from '../plan/Deroule'
import { NutritionSeance } from '../plan/NutritionSeance'
import { iconeSport } from '../sports'
import { basculerSansMontre } from './donnees'
import { SeancesFaites } from './SeancesFaites'
import type { Raison } from '../types'

const PASTILLE = { vert: '🟢', orange: '🟠', rouge: '🔴' }
const TITRE = { vert: 'Feu vert', orange: 'Prudence', rouge: 'Récupère' }
const COULEUR = { vert: '#4ade80', orange: '#fb923c', rouge: '#f87171' }

/** Choix bien visible entre la version conseillée par le feu et la séance prévue. */
function ChoixSeance({ maintenue, conseil, prevu, couleur, onChoisir }: {
  maintenue: boolean; conseil: string; prevu: string; couleur: string; onChoisir: (maintenir: boolean) => void
}) {
  const bouton = (actif: boolean) =>
    `flex-1 rounded-xl border-2 px-2 py-2.5 text-sm font-semibold leading-tight ${actif ? 'text-fond' : 'border-bordure bg-surface text-texte-3'}`
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
export function CarteAujourdhui() {
  const jour = aujourdhui()
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
  const regle = signal.couleur === 'orange'
    ? 'Règle : 1 signal en alerte = séance raccourcie, mêmes watts (une série ou un tiers des répétitions en moins). Si tu te sens très bien, tu peux garder la séance complète.'
    : 'Règle : 2 signaux en alerte ou plus (ou malade) = pas d’intensité aujourd’hui. Si tu te sens vraiment bien et que tu n’es pas malade, tu peux garder la séance prévue.'
  const choisir = (maintenir: boolean) => enregistrer(db.decisions, { date: jour, couleur: signal.couleur, force: maintenir })

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

      <ul className="mt-2 space-y-0.5 text-sm">
        {signal.details.map((x) => (
          <li key={x.texte} className={x.etat === 'alerte' ? 'text-[#fb923c]' : x.etat === 'info' ? 'text-texte-3' : 'text-texte-2'}>
            <span className="mr-1.5">{x.icone}</span>{x.texte}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => basculerSansMontre(jour)} className="mt-1.5 text-xs text-texte-3 underline">
        {mesure?.sansMontre ? '⌚ Annuler « nuit sans montre »' : '⌚ J’ai dormi sans ma montre (ou pas toute la nuit)'}
      </button>
      <Aide titre="Nuit sans montre" texte={AIDES.nuitSansMontre} />
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
            {adaptation?.modifiee && (
              <div className="mt-2 rounded-lg border p-2.5 text-sm" style={{ borderColor: `${COULEUR[signal.couleur]}66` }}>
                <p><b style={{ color: COULEUR[signal.couleur] }}>Pourquoi {signal.couleur === 'orange' ? 'une version raccourcie' : 'pas d’intensité'} ?</b> {pourquoi}</p>
                <p className="mt-1 text-xs text-texte-3">{regle}</p>
                <ChoixSeance maintenue={!!decision?.force} couleur={COULEUR[signal.couleur]} onChoisir={choisir}
                  conseil={signal.couleur === 'orange' ? 'Version raccourcie' : 'Très facile ou repos'}
                  prevu={signal.couleur === 'orange' ? 'Séance complète' : 'Séance prévue'} />
              </div>
            )}
            <p className="mt-2 font-semibold" style={{ color: decision?.force ? '#4ade80' : COULEUR[signal.couleur] }}>
              {decision?.force ? '✋ Séance complète maintenue : arrête-toi si les watts ne tiennent pas.' : adaptation!.texte}
            </p>
            {(decision?.force ? prevue.velo?.etapes : adaptation!.etapes) && <Deroule etapes={(decision?.force ? prevue.velo?.etapes : adaptation!.etapes)!} />}
            {prevue.sport === 'velo' && (decision?.force ? prevue.velo?.etapes : adaptation!.etapes) && <BoutonsEnvoi p={prevue} etapes={(decision?.force ? prevue.velo?.etapes : adaptation!.etapes)!} />}
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
          <div className="mt-2 text-sm">
            {pourquoi && <p><b style={{ color: COULEUR.rouge }}>Pourquoi ?</b> {pourquoi}</p>}
            <p className="mt-1 text-xs text-texte-3">{regle}</p>
            <ChoixSeance maintenue={false} couleur={COULEUR.rouge} onChoisir={choisir} conseil="Reporter la séance" prevu="La faire aujourd’hui" />
          </div>
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
