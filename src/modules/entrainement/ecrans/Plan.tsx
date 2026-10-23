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
import { hausseCharge } from '../../../metrics/planif'
import { AIDES } from '../aides'
import { allureDuType, tableauAllures } from '../allures'
import { FormulairePrevue } from '../plan/FormulairePrevue'
import { avancementObjectifKj, chargesSemaine, declarerIndispo, declarerNonFaite, joursDe, leverIndispo, supprimerPrevue } from '../plan/donnees'
import { alertesCumul, estIntensite, genererSemaineVelo, lireMeta, noterResultat } from '../plan/programme'
import { lundiDe, nouvelId } from '../seances/donnees'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { iconeSport } from '../sports'
import { RAISONS, type Raison, type Seance, type SeancePrevue } from '../types'

const STATUTS: Record<SeancePrevue['statut'], { libelle: string; couleur: string }> = {
  prevue: { libelle: 'Prévue', couleur: 'var(--color-texte-2)' },
  faite: { libelle: 'Faite ✓', couleur: '#4ade80' },
  'non-faite': { libelle: 'Non faite', couleur: '#f87171' },
  reportee: { libelle: 'À reporter', couleur: '#fb923c' },
  abandonnee: { libelle: 'Abandonnée', couleur: 'var(--color-texte-3)' },
}
const INTENSITE = { basse: '🟦 basse', moyenne: '🟨 moyenne', haute: '🟥 haute' }

/** Plan de la semaine : séances prévues, indisponibilités, replanification, charge prévue. */
export function Plan() {
  const [lundi, setLundi] = useState(lundiDe(aujourdhui()))
  const jours = joursDe(lundi)
  const prevues = useLiveQuery(() => db.prevues.where('date').between(jours[0], jours[6], true, true).toArray(), [lundi])
  const seances = useLiveQuery(() => db.seances.where('date').between(jours[0], jours[6], true, true).toArray(), [lundi])
  const indispos = useLiveQuery(() => db.indispos.where('date').between(jours[0], jours[6], true, true).toArray(), [lundi])
  const charges = useLiveQuery(() => chargesSemaine(lundi), [lundi, prevues, seances])

  const [ajout, setAjout] = useState<{ date: string } | null>(null)
  const [edition, setEdition] = useState<SeancePrevue | null>(null)
  const [jourIndispo, setJourIndispo] = useState<string | null>(null)
  const [message, setMessage] = useState<string[]>()
  const [r] = useReglagesEntrainement()
  const allures = tableauAllures(r.courseRef, r.vmaKmh, r.seuilCoursePct)

  if (!prevues || !seances || !indispos) return null
  const hausse = charges ? hausseCharge(charges.prevue, [charges.moyenne4]) : undefined

  return (
    <div className="space-y-3">
      {/* Navigation entre semaines */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setLundi(decalerJour(lundi, -7))} className="px-3 py-2 text-2xl text-accent" aria-label="Semaine précédente">‹</button>
        <p className="font-semibold">
          Semaine du {depuisJour(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </p>
        <button type="button" onClick={() => setLundi(decalerJour(lundi, 7))} className="px-3 py-2 text-2xl text-accent" aria-label="Semaine suivante">›</button>
      </div>

      {message && (
        <Carte>
          <ul className="space-y-1 text-sm">{message.map((m, i) => <li key={i}>↻ {m}</li>)}</ul>
          <button type="button" onClick={() => setMessage(undefined)} className="mt-2 text-xs text-texte-3">OK</button>
        </Carte>
      )}

      {/* Charge prévue */}
      {charges && (
        <Carte titre="Charge de la semaine">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Chiffre libelle="Prévue" valeur={charges.prevue} aide={AIDES.chargePrevue} />
            <Chiffre libelle="Sem. passée" valeur={charges.precedente} />
            <Chiffre libelle="Moy. 4 sem." valeur={charges.moyenne4} />
          </div>
          <p className="mt-2 text-xs text-texte-3">En {charges.unite} · réalisée à ce jour : {Math.round(charges.realisee)}</p>
          {charges.kjPrevus > 0 && (
            <div className="mt-3">
              <p className="flex justify-between text-sm">
                <span className="text-texte-2">Budget kJ vélo<Aide titre="Budget kJ" texte={AIDES.budgetKj} /></span>
                <span><b>{Math.round(charges.kjRealises)}</b> / {Math.round(charges.kjPrevus)} kJ</span>
              </p>
              <Jauge part={charges.kjRealises / charges.kjPrevus} />
            </div>
          )}
          {hausse !== undefined && hausse > 10 && (
            <p className={`mt-2 text-sm font-semibold ${hausse > 15 ? 'text-[#f87171]' : 'text-argent'}`}>
              ⚠️ +{Math.round(hausse)} % par rapport à ta moyenne des 4 dernières semaines{hausse > 15 ? ' : hausse marquée, allège si possible.' : '.'}
            </p>
          )}
        </Carte>
      )}

      <CarteProgramme lundi={lundi} onMessage={setMessage} />
      <CarteAlertes lundi={lundi} deps={[prevues, seances]} />
      <CarteObjectifKj />

      {/* Jours */}
      {jours.map((d) => {
        const indispo = indispos.find((i) => i.date === d)
        const duJour = prevues.filter((p) => p.date === d)
        const faitesLibres = seances.filter((s) => s.date === d && !duJour.some((p) => p.id === s.prevueId))
        const estAujourdhui = d === aujourdhui()
        return (
          <section key={d} className={`rounded-2xl border bg-surface p-3 ${estAujourdhui ? 'border-accent' : 'border-bordure'}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold capitalize">{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => (indispo ? leverIndispo(d) : setJourIndispo(d))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${indispo ? 'bg-[#f87171]/20 text-[#f87171]' : 'text-texte-3'}`}>
                  {indispo ? `Indispo · ${indispo.raison}${indispo.creneau ? ` (${indispo.creneau})` : ''} ×` : 'Pas dispo ?'}
                </button>
                <button type="button" onClick={() => setAjout({ date: d })} aria-label="Ajouter une séance prévue" className="px-2 text-xl text-accent">+</button>
              </div>
            </div>
            {duJour.map((p) => (
              <button key={p.id} type="button" onClick={() => setEdition(p)} className="mt-2 block w-full rounded-xl bg-surface-2 p-2.5 text-left">
                <span className="flex items-center justify-between">
                  <span className={`font-semibold ${p.statut === 'abandonnee' ? 'line-through opacity-50' : ''}`}>
                    {iconeSport(p.sport)} {p.titre} · {p.dureeMin} min {p.priorite === 'cle' && '⭐'}{p.origine === 'auto' && <span className="ml-1 text-xs text-texte-3">auto</span>}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: STATUTS[p.statut].couleur }}>{STATUTS[p.statut].libelle}</span>
                </span>
                <span className="block text-xs text-texte-3">
                  {INTENSITE[p.intensite]}{p.kjPrevu ? ` · ${p.kjPrevu} kJ` : ''}{p.minutesCle ? ` · ${p.minutesCle} min à l'allure clé` : ''}{p.raison && ` · ${p.raison}`}
                  {p.resultat && (p.resultat === 'reussie' ? ' · blocs tenus ✓' : ' · pas tout tenu')}
                </span>
                {p.sport === 'course' && allureDuType(p.typeCourse, allures) && <span className="block text-xs text-texte-2">Allure : {allureDuType(p.typeCourse, allures)}</span>}
                {p.detail && <span className="mt-1 block text-xs text-texte-2">{p.detail}</span>}
                {p.velo?.pourquoi && <span className="mt-1 block text-[11px] text-texte-3">↳ {p.velo.pourquoi}</span>}
              </button>
            ))}
            {faitesLibres.map((s) => (
              <p key={s.id} className="mt-2 rounded-xl border border-dashed border-bordure p-2 text-sm text-texte-2">
                ✓ {iconeSport(s.sport, s.homeTrainer)} {s.titre ?? s.type ?? 'Séance'} · {Math.round(s.dureeSec / 60)} min (hors plan)
              </p>
            ))}
          </section>
        )
      })}

      {ajout && (
        <Feuille titre="Séance prévue" onFermer={() => setAjout(null)}>
          <FormulairePrevue
            initiale={{ id: nouvelId(), date: ajout.date, sport: 'course', titre: '', intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel' }}
            jours={jours}
            onTermine={() => setAjout(null)}
          />
        </Feuille>
      )}
      {edition && <ActionsPrevue p={edition} jours={jours} onFermer={() => setEdition(null)} onMessage={setMessage} />}
      {jourIndispo && (
        <FeuilleIndispo date={jourIndispo} onFermer={() => setJourIndispo(null)}
          onValider={async (raison, creneau) => {
            const phrases = await declarerIndispo({ date: jourIndispo, raison, creneau })
            setJourIndispo(null)
            if (phrases.length) setMessage(phrases)
          }} />
      )}
    </div>
  )
}

/** Programme vélo : phase, budget kJ de la semaine et génération des séances. */
function CarteProgramme({ lundi, onMessage }: { lundi: string; onMessage: (m: string[]) => void }) {
  const meta = useLiveQuery(async () => (await lireMeta(lundi)) ?? null, [lundi])
  const [occupe, setOccupe] = useState(false)
  if (meta === undefined) return null
  const passee = decalerJour(lundi, 6) < aujourdhui()
  const generer = async () => {
    setOccupe(true)
    try {
      onMessage(await genererSemaineVelo(lundi))
    } catch (e) {
      onMessage([(e as Error).message])
    } finally {
      setOccupe(false)
    }
  }
  return (
    <Carte titre="Programme vélo">
      {meta ? (
        <>
          <p className="text-sm">
            <span className="font-semibold">{meta.phase}</span> · semaine {meta.semaineDansPhase}
            {meta.allegee && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">allégée</span>}
          </p>
          <p className="mt-1 text-sm text-texte-2">
            Budget <b className="text-texte">{meta.budget} kJ</b><Aide titre="Budget kJ automatique" texte={AIDES.budgetAuto} /> · Z2 à {meta.z2W} W<Aide titre="Puissance Z2" texte={AIDES.z2Auto} />
          </p>
          <p className="mt-1 text-xs text-texte-3">{meta.raison}</p>
        </>
      ) : (
        <p className="text-sm text-texte-2">
          Saisis d'abord tes séances Campus Coach et ton renfo (bouton + de chaque jour), puis génère ton vélo : l'appli place tes séances
          autour, sans enchaîner deux jours durs.<Aide titre="Programme vélo" texte={AIDES.programme} />
        </p>
      )}
      {!passee && (
        <Bouton variante={meta ? 'secondaire' : 'principal'} className="mt-3" disabled={occupe} onClick={generer}>
          {occupe ? 'Calcul…' : meta ? '↻ Regénérer le vélo (garde ce qui est fait)' : '⚙️ Générer ma semaine vélo'}
        </Bouton>
      )}
    </Carte>
  )
}

/** Alertes de cumul vélo + course. */
function CarteAlertes({ lundi, deps }: { lundi: string; deps: unknown[] }) {
  const alertes = useLiveQuery(() => alertesCumul(lundi), [lundi, ...deps])
  if (!alertes?.length) return null
  return (
    <Carte titre="Vélo + course">
      <ul className="space-y-1.5 text-sm">{alertes.map((a, i) => <li key={i}>⚠️ {a}</li>)}</ul>
    </Carte>
  )
}

/** Barre de progression simple (0 à 1). */
function Jauge({ part }: { part: number }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, part * 100))}%` }} />
    </div>
  )
}

/** Objectif de kJ sur 90 jours (système kJ) : cumul réalisé, comparé au rythme attendu à ce jour. */
function CarteObjectifKj() {
  const [r] = useReglagesEntrainement()
  const o = r.objectifKj
  const a = useLiveQuery(() => (o ? avancementObjectifKj(o) : undefined), [o?.debut, o?.fin, o?.kj])
  if (!o || !a) return null
  const enAvance = a.realises >= a.attendu
  return (
    <Carte titre="Objectif 90 jours">
      <p className="flex justify-between text-sm">
        <span className="text-texte-2">Du {depuisJour(o.debut).toLocaleDateString('fr-FR')} au {depuisJour(o.fin).toLocaleDateString('fr-FR')}<Aide titre="Objectif kJ" texte={AIDES.objectifKj} /></span>
        <span><b>{Math.round(a.realises)}</b> / {o.kj} kJ</span>
      </p>
      <Jauge part={a.realises / o.kj} />
      <p className={`mt-2 text-xs ${enAvance ? 'text-nutrition' : 'text-texte-3'}`}>
        Prévu par le plan à ce jour : {Math.round(a.attendu)} kJ · {enAvance ? 'dans les temps ✓' : `${Math.round(a.attendu - a.realises)} kJ de retard`} · {a.joursRestants} jours restants
      </p>
    </Carte>
  )
}

function Chiffre({ libelle, valeur, aide }: { libelle: string; valeur: number; aide?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className="text-xs text-texte-3">{libelle}{aide && <Aide titre={libelle} texte={aide} />}</p>
      <p className="text-xl font-bold tabular-nums">{Math.round(valeur)}</p>
    </div>
  )
}

/** Actions sur une séance prévue : faite, non faite (raison), modifier, supprimer. */
function ActionsPrevue({ p, jours, onFermer, onMessage }: { p: SeancePrevue; jours: string[]; onFermer: () => void; onMessage: (m: string[]) => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'actions' | 'non-faite' | 'modifier'>('actions')
  const [raison, setRaison] = useState<Raison>()

  if (mode === 'modifier')
    return (
      <Feuille titre="Modifier la séance prévue" onFermer={onFermer}>
        <FormulairePrevue initiale={p} jours={jours} onTermine={onFermer} />
      </Feuille>
    )

  return (
    <Feuille titre={p.titre} onFermer={onFermer}>
      {p.detail && <p className="mb-3 text-sm text-texte-2">{p.detail}</p>}
      {mode === 'actions' ? (
        <div className="space-y-2">
          {p.statut === 'prevue' && (
            <Bouton onClick={() => {
              const seance: Seance = { id: nouvelId(), date: p.date <= aujourdhui() ? p.date : aujourdhui(), sport: p.sport, type: p.type, titre: p.titre, dureeSec: p.dureeMin * 60, source: 'manuel', prevueId: p.id }
              navigate('/entrainement/seance/nouvelle', { state: { seance } })
            }}>✓ Je l'ai faite : saisir</Bouton>
          )}
          {p.statut === 'prevue' && <Bouton variante="secondaire" onClick={() => setMode('non-faite')}>✗ Pas faite</Bouton>}
          {p.statut === 'faite' && estIntensite(p) && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="mb-2 text-sm text-texte-2">Tous les blocs tenus aux watts prévus ?<Aide titre="Progression" texte={AIDES.progression} /></p>
              <div className="grid grid-cols-2 gap-2">
                {(['reussie', 'ratee'] as const).map((x) => (
                  <button key={x} type="button" onClick={async () => { await noterResultat(p, p.resultat === x ? undefined : x); onFermer() }}
                    className={`rounded-xl border py-2.5 text-sm font-semibold ${p.resultat === x ? 'border-accent bg-accent text-fond' : 'border-bordure text-texte-2'}`}>
                    {x === 'reussie' ? '✓ Oui, tout tenu' : '✗ Pas tout'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Bouton variante="secondaire" onClick={() => setMode('modifier')}>Modifier</Bouton>
          <button type="button" className="w-full py-2 text-[#f87171]" onClick={async () => { await supprimerPrevue(p.id); onFermer() }}>Supprimer</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-texte-2">Pourquoi ?</p>
          <Puces options={RAISONS} valeur={raison} onChoisir={setRaison} />
          <Bouton disabled={!raison} onClick={async () => {
            const phrases = await declarerNonFaite(p, raison!)
            onMessage(phrases)
            onFermer()
          }}>Valider et replanifier</Bouton>
        </div>
      )}
    </Feuille>
  )
}

function FeuilleIndispo({ date, onFermer, onValider }: { date: string; onFermer: () => void; onValider: (r: Raison, creneau?: string) => void }) {
  const [raison, setRaison] = useState<Raison>()
  const [creneau, setCreneau] = useState('')
  return (
    <Feuille titre={`Pas dispo ${depuisJour(date).toLocaleDateString('fr-FR', { weekday: 'long' })}`} onFermer={onFermer}>
      <div className="space-y-3">
        <Puces options={RAISONS} valeur={raison} onChoisir={setRaison} />
        <input placeholder="Créneau (facultatif), ex. 8 h-18 h" value={creneau} onChange={(e) => setCreneau(e.target.value)}
          className="w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 outline-none focus:border-accent" />
        <Bouton disabled={!raison} onClick={() => onValider(raison!, creneau || undefined)}>Enregistrer et replacer mes séances</Bouton>
      </div>
    </Feuille>
  )
}
