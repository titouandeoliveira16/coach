import { useLiveQuery } from 'dexie-react-hooks'
import { HeartPulse } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui, depuisJour } from '../../../core/dates'
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
import { Deroule, Profil } from '../plan/Deroule'
import { NutritionSeance } from '../plan/NutritionSeance'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { useNutritionEffort } from '../reglages/ProfilSportif'
import { basculerSansMontre, QUESTIONS, scoreRessenti } from './donnees'
import { SeancesFaites } from './SeancesFaites'
import type { Raison, Seance } from '../types'
import { plagesForme, positionPct, type Plage } from '../../../metrics/plages'
import { analyserSommeil, enHeures } from '../../../metrics/signal'
import { nouvelId } from '../seances/donnees'

const COULEUR = { vert: 'var(--color-bon)', orange: 'var(--color-attention)', rouge: 'var(--color-mauvais)' }

/** Une plage : ta normale (zone grise), ta valeur (le point, de la couleur de son état). */
function LignePlage({ p, etat, couleur }: { p: Plage; etat?: 'ok' | 'alerte' | 'info'; couleur: (e?: 'ok' | 'alerte' | 'info') => string }) {
  const texte = p.valeur === undefined ? '—'
    : p.cle === 'recuperation' ? `${Math.round(p.valeur)} ms` : p.cle === 'pouls' ? `${Math.round(p.valeur)} bpm` : enHeures(p.valeur)
  const c = p.valeur === undefined ? 'var(--color-texte-3)' : couleur(etat)
  return (
    <span className="mt-2.5 block">
      <span className="flex justify-between text-xs"><span className="text-texte-2">{p.libelle}</span><b style={{ color: c }}>{p.bas === undefined && p.valeur !== undefined ? `${texte} · calibrage` : texte}</b></span>
      <span className="relative mt-1.5 block h-2 rounded-full bg-surface-2">
        {p.bas !== undefined && p.haut !== undefined && (
          <span className="absolute inset-y-0 rounded-full bg-[#2c2c2e]" style={{ left: `${positionPct(p, p.bas)}%`, width: `${positionPct(p, p.haut) - positionPct(p, p.bas)}%` }} />
        )}
        {p.valeur !== undefined && p.bas !== undefined && (
          <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${positionPct(p, p.valeur)}%`, background: c }} />
        )}
      </span>
    </span>
  )
}

/** Choix bien visible entre la version conseillée par le feu et la séance prévue. */
function ChoixSeance({ maintenue, conseil, prevu, couleur, onChoisir }: {
  maintenue: boolean; conseil: string; prevu: string; couleur: string; onChoisir: (maintenir: boolean) => void
}) {
  const bouton = (actif: boolean) =>
    `flex-1 rounded-xl border-2 px-2 py-1 text-sm font-semibold leading-tight ${actif ? 'text-fond' : 'border-bordure bg-surface text-texte-3'}`
  return (
    <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Séance à faire">
      <button type="button" role="radio" aria-checked={!maintenue} className={bouton(!maintenue)}
        style={!maintenue ? { background: couleur, borderColor: couleur } : undefined} onClick={() => onChoisir(false)}>
        {conseil}<span className="block text-[11px] font-normal leading-tight">conseillé</span>
      </button>
      <button type="button" role="radio" aria-checked={maintenue} className={bouton(maintenue)}
        style={maintenue ? { background: 'var(--color-bon)', borderColor: 'var(--color-bon)' } : undefined} onClick={() => onChoisir(true)}>
        {prevu}<span className="block text-[11px] font-normal leading-tight">je me sens bien</span>
      </button>
    </div>
  )
}

/** Signal du jour, raison, séance prévue et recommandation. */
export function CarteAujourdhui({ onModifierMatin, apresForme }: {
  /** Glissé entre « Ta forme » et la séance (tuiles Nuit et Poids) */
  apresForme?: ReactNode
  onModifierMatin?: () => void
  /** Un autre encart (Nutrition du jour) est déplié : la séance garde sa taille et descend */
  autreOuvert?: boolean
} = {}) {
  const jour = aujourdhui()
  const [formeOuverte, setFormeOuverte] = useState(false)
  const [detailOuvert, setDetailOuvert] = useState(false)
  // La séance garde toute sa hauteur (boutons d'envoi et détail toujours visibles) : la page défile
  const seanceRef = useRef<HTMLElement>(null)
  const basculerForme = () => setFormeOuverte(!formeOuverte)
  const navigate = useNavigate()
  const [r] = useReglagesEntrainement()
  // Repères de glucides de la séance : nutrition à l'effort
  const nutrition = useNutritionEffort()
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
  const autres = signal.details.filter((x) => !x.cle || x.cle === 'charge')
  const ressenti = mesure ? scoreRessenti(mesure) : undefined
  const plages = plagesForme(a.vfc, analyserSommeil(a.mesures.map((m) => ({ date: m.date, h: m.sommeilH })), jour))
  const couleurEtat = (e?: 'ok' | 'alerte' | 'info') => (e === 'alerte' ? COULEUR[signal.couleur === 'vert' ? 'orange' : signal.couleur] : e === 'ok' ? COULEUR.vert : 'var(--color-texte-2)')
  const petitBouton = (actif: boolean) => `min-h-11 flex-1 rounded-xl border px-1 text-[13px] font-semibold ${actif ? 'border-mauvais bg-mauvais text-fond' : 'border-bordure text-texte-2'}`

  return (
    <>
      {/* Ta forme (maquette P, 12/11/2026) : le feu en un mot, puis tes 3 plages (ta normale en gris, ce matin = le point) */}
      <Carte visite="forme" className={`flex shrink-0 flex-col p-3.5! ${formeOuverte ? 'border-accent!' : ''}`}>
        <button type="button" onClick={basculerForme} className="flex items-center gap-2.5 text-left">
          <HeartPulse className="h-7 w-7 shrink-0" style={{ color: COULEUR[signal.couleur] }} strokeWidth={2} />
          <span className="min-w-0 flex-1">
            <span className="chiffre block text-[26px] leading-none" style={{ color: COULEUR[signal.couleur] }}>{signal.couleur[0].toUpperCase() + signal.couleur.slice(1)}</span>
            <span className="mt-1 block text-[13px] leading-snug text-texte-2">
              {enAlerte.length === 0 ? 'Tes signaux sont dans ta normale'
                : `${enAlerte.length === 1 ? '1 signal hors de ta normale' : `${enAlerte.length} signaux hors de ta normale`} · ${signal.couleur === 'rouge' ? 'pas d’intensité' : 'séance adaptée'}`}
            </span>
          </span>
          <span className={`shrink-0 self-start text-[13px] ${formeOuverte ? 'font-semibold text-accent' : 'text-texte-3'}`}>{formeOuverte ? 'Réduire ▴' : 'Détail ▾'}</span>
        </button>
        <button type="button" onClick={basculerForme} className="mt-1 text-left">
          {plages.map((p) => <LignePlage key={p.cle} p={p} etat={signal.details.find((x) => x.cle === p.cle)?.etat} couleur={couleurEtat} />)}
        </button>
        {formeOuverte && (
          <div className="mt-3.5 space-y-3 border-t border-bordure pt-3">
            {enAlerte.length > 0 && (
              <p className="rounded-xl px-3 py-2.5 text-[13px] leading-snug" style={{ background: `color-mix(in srgb, ${COULEUR[signal.couleur]} 12%, transparent)` }}>
                <b style={{ color: COULEUR[signal.couleur] }}>Pourquoi {signal.couleur} ?</b> {pourquoiCourt.replace(/^./, (c) => c.toUpperCase())}. {signal.couleur === 'orange' ? 'Une seule alerte : séance dure raccourcie, mêmes watts.' : 'Deux alertes ou plus : pas d’intensité aujourd’hui.'}<Aide titre="Règle du feu" texte={`${pourquoi} ${regle}`} />
              </p>
            )}
            {signal.calibrationVfc && <p className="text-xs text-texte-3">Récupération en calibration ({a.vfc.nBase}/14 jours de mesures)</p>}
            {mesure && (
              <div>
                <p className="text-xs text-texte-2">Tes notes du matin{ressenti !== undefined ? ` · ressenti ${formatNombre(ressenti, 1)} / 5` : ''}</p>
                <div className="mt-1.5 grid grid-cols-5 gap-1 text-center">
                  {QUESTIONS.map((q) => (
                    <span key={q.cle} className="rounded-[10px] bg-surface-2 py-1.5">
                      <span className="block text-[10px] text-texte-3">{q.libelle}</span>
                      <b className="text-base" style={{ color: (mesure[q.cle] ?? 5) <= 2 ? COULEUR.orange : undefined }}>{mesure[q.cle] ?? '–'}</b>
                    </span>
                  ))}
                </div>
                {onModifierMatin && <button type="button" onClick={onModifierMatin} className="mt-2 text-[13px] font-semibold text-accent">Modifier mes notes</button>}
              </div>
            )}
            {autres.length > 0 && (
              <ul className="space-y-0.5 text-[13px]">
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
        {malade && <p className="mt-2 text-xs text-texte-3">Noté pour aujourd'hui : la journée est marquée indisponible.</p>}
        {troisJours && (
          <p className="mt-2 rounded-xl border border-mauvais/40 bg-mauvais/10 p-3 text-sm">
            3 jours de suite en alerte avec une maladie ou une douleur : prends l'avis d'un médecin avant de reprendre.
          </p>
        )}
      </Carte>

      {apresForme}

      {/* Séance du jour : la carte qui prend toute la place restante (elle défile seule si besoin) */}
      <Carte ref={seanceRef} visite="seance" className={`flex flex-col p-3! ${detailOuvert ? 'border-accent!' : ''} shrink-0`}
>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold text-texte-2">Séance du jour</p>
          {prevue && <span className="text-xs text-texte-2">{prevue.sport === 'velo' ? 'vélo' : prevue.sport}{prevue.kjPrevu ? ` · ${prevue.kjPrevu} kJ` : ''}</span>}
        </div>
        {reprise ? (
          <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
            <b>Reprise après maladie (jour {reprise}/{JOURS_REPRISE})</b> : pas d'intensité, sorties très faciles de 45 min au plus. L'intensité revient ensuite, si le feu est vert.
          </p>
        ) : null}
        {faites ? <SeancesFaites jour={jour} /> : null}
        {faites && prevue && <p className="mt-3 text-[13px] font-semibold text-texte-2">Encore prévu</p>}
        {prevue ? (
          <>
            <p className="mt-0.5 text-[22px] font-bold leading-tight">{prevue.titre}{prevue.sport === 'velo' && !/\d+ ?(min|h)/.test(prevue.titre) ? ` · ${prevue.dureeMin} min` : ''}</p>
            {adaptation?.modifiee ? (
              <>
                <p className="mt-1 text-sm"><b style={{ color: COULEUR[signal.couleur] }}>Pourquoi {signal.couleur === 'orange' ? 'raccourcie' : 'pas d’intensité'} ?</b> {pourquoiCourt}<Aide titre="Règle du feu" texte={`${pourquoi} ${regle}`} /></p>
                <ChoixSeance maintenue={!!decision?.force} couleur={COULEUR[signal.couleur]} onChoisir={choisir}
                  conseil={signal.couleur === 'orange' ? `Raccourcie${minutesAdaptees ? ` · ${minutesAdaptees} min` : ''}` : 'Très facile ou repos'}
                  prevu={signal.couleur === 'orange' ? `Complète · ${prevue.dureeMin} min` : 'Séance prévue'} />
                {decision?.force && <p className="mt-1.5 text-sm font-semibold" style={{ color: COULEUR.vert }}>Séance complète maintenue : arrête-toi si les watts ne tiennent pas.</p>}
                {!decision?.force && !etapesDuJour && <p className="mt-1 line-clamp-2 text-[13px] leading-snug" style={{ color: COULEUR[signal.couleur] }}>{adaptation.texte.replace(/^Feu \w+ : /, '').replace(/^./, (c) => c.toUpperCase())}</p>}
              </>
            ) : signal.couleur === 'vert' && !etapesDuJour ? null : (
              <p className="mt-0.5 truncate text-[13px]" style={{ color: signal.couleur === 'vert' ? COULEUR.vert : COULEUR[signal.couleur] }}>
                {signal.couleur === 'vert' ? 'Feu vert : séance prévue maintenue.' : adaptation!.texte}
              </p>
            )}
            {etapesDuJour ? (
              <>
                <Profil etapes={etapesDuJour} cpW={cpW} extensible />
                {prevue.detail && !adaptation?.modifiee && <p className="mt-1.5 line-clamp-2 shrink-0 text-[13px] leading-snug text-texte-2">{prevue.detail}</p>}
                {prevue.sport === 'velo' && <div className="shrink-0"><BoutonsEnvoi p={prevue} etapes={etapesDuJour} /></div>}
              </>
            ) : (
              // Renfo, course, séance sans déroulé : le détail est visible directement
              <div className="mt-1.5 min-h-0 overflow-hidden whitespace-pre-line rounded-xl bg-surface-2 px-3 py-1.5 text-[13px] leading-[18px] text-texte-2">
                {prevue.detail || `${prevue.dureeMin} min`}
              </div>
            )}
            {prevue.sport !== 'velo' ? (
              <div className="mt-2 flex shrink-0 gap-2">
                <button type="button" className="min-h-10 flex-[1.4] rounded-xl bg-accent text-sm font-bold text-fond" onClick={() => {
                  const seance: Seance = { id: nouvelId(), date: jour, sport: prevue.sport, type: prevue.type, titre: prevue.titre, dureeSec: prevue.dureeMin * 60, source: 'manuel', prevueId: prevue.id }
                  navigate('/entrainement/seance/nouvelle', { state: { seance } })
                }}>Faite</button>
                {nutrition && <button type="button" onClick={() => setDetailOuvert(!detailOuvert)}
                  className={`min-h-10 flex-1 rounded-xl border text-sm font-semibold ${detailOuvert ? 'border-accent text-accent' : 'border-bordure bg-surface-2 text-texte-2'}`}>
                  {detailOuvert ? 'Réduire ▴' : 'Nutrition ▾'}
                </button>}
              </div>
            ) : (
              <button type="button" onClick={() => setDetailOuvert(!detailOuvert)}
                className={`mt-2 flex min-h-9 w-full shrink-0 items-center justify-between border-t border-bordure pt-2 text-sm font-semibold ${detailOuvert ? 'text-accent' : 'text-texte-2'}`}>
                <span>{nutrition ? 'Détail et nutrition' : 'Détail'}</span><span>{detailOuvert ? 'Réduire ▴' : '▾'}</span>
              </button>
            )}
            {detailOuvert && (
              <div className="shrink-0 space-y-2 pb-1">
                {etapesDuJour && <Deroule etapes={etapesDuJour} sansProfil />}
                {nutrition && !(adaptation?.modifiee && !decision?.force && signal.couleur === 'rouge') && <NutritionSeance p={prevue} />}
              </div>
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
          // Repos (la séance de demain n'est pas montrée ici : elle est dans Semaine, demande de Titouan du 12/11/2026)
          <>
            <p className="mt-1 text-[22px] font-bold">{signal.couleur === 'rouge' ? 'Très facile ou repos' : 'Repos'}</p>
            <p className="mt-1 text-sm text-texte-2">
              {signal.couleur === 'rouge' ? 'Repos complet, ou au plus une sortie très facile.' : 'Marche, étirements, bien dormir : c’est aussi là que tu progresses.'}
            </p>
            {/* Si tu as envie de rouler (12/11/2026) : 20 à 30 min en zone 1, à peine plus que tourner les jambes */}
            <div className="mt-3 rounded-xl bg-surface-2 p-3">
              <p className="flex items-baseline justify-between text-sm"><span className="font-semibold">Si tu veux rouler</span><span className="text-texte-2">20 à 30 min · Z1</span></p>
              <Profil etapes={[{ debutSec: 0, dureeSec: 1800, libelle: 'Très facile (Z1)', w: Math.round(cpW * 0.5), wMin: Math.round(cpW * 0.45), wMax: Math.round(cpW * 0.55) }]} cpW={cpW} />
              <p className="mt-1 text-xs text-texte-3">Vers {Math.round(cpW * 0.45)}-{Math.round(cpW * 0.55)} W, en parlant facilement. Pas plus : le repos fait progresser.</p>
            </div>
          </>
        )}
      </Carte>
    </>
  )
}
