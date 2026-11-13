import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { aujourdhui } from '../../../core/dates'
import { db } from '../../../core/db'
import { useReglage } from '../../../core/reglages'
import { enregistrer } from '../../../core/stockage'
import { enregistrerSeance } from '../seances/donnees'
import { apresSeance, chargeProposee, EXOS, FORCE_DEFAUT, NOMS_PERIODES, type ExoForce, type ReglagesForce, type SeanceForce } from './force'
import { Picto } from './Picto'

/** Ce que tu as changé (le reste suit la proposition) : charge, répétitions et séries cochées. */
type Saisie = { charge?: number; reps: Record<number, number | undefined>; faites: Record<number, boolean> }
const VIDE: Saisie = { reps: {}, faites: {} }

/** La séance de muscu pas à pas (maquette M2 validée le 13/11/2026) : montre, charges proposées, séries cochées. */
export function PageMuscu() {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = useLiveQuery(() => (id ? db.prevues.get(id) : undefined), [id])
  const [force, modifierForce] = useReglage<ReglagesForce>('force', FORCE_DEFAUT)
  const [saisies, setSaisies] = useState<Record<string, Saisie>>({})
  const [ouvert, setOuvert] = useState<string>()
  const [rpe, setRpe] = useState<number>()
  const [debut] = useState(() => new Date().toISOString())
  const [fin, setFin] = useState(false)

  const decision = useLiveQuery(async () => (await db.decisions.get(aujourdhui())) ?? null)
  const brute: SeanceForce | undefined = p?.muscu
  // Feu orange (sans « je maintiens ») : une série de moins, mêmes charges
  const s: SeanceForce | undefined = brute && decision?.couleur === 'orange' && !decision.force && brute.series > 1 ? { ...brute, series: brute.series - 1 } : brute
  const exos = s ? EXOS[s.lieu] : []
  useEffect(() => { if (!ouvert && exos[0]) setOuvert(exos[0].id) }, [ouvert, exos])

  if (p === undefined) return null
  if (!p || !s) return <div className="pt-sur px-4"><button type="button" onClick={() => navigate(-1)} className="py-2 text-accent">‹ Retour</button><p className="mt-4 text-texte-2">Séance introuvable.</p></div>

  const cible = (e: ExoForce) => s.reps + (e.sansCharge ? force.exos[e.id]?.repsEnPlus ?? 0 : 0)
  const maj = (eid: string, f: (x: Saisie) => Saisie) => setSaisies((a) => ({ ...a, [eid]: f(a[eid] ?? VIDE) }))
  const series = Array.from({ length: s.series }, (_, i) => i)
  const charge = (e: ExoForce) => saisies[e.id]?.charge ?? chargeProposee(e, force.exos[e.id], s.reps)
  const fini = (e: ExoForce) => series.every((i) => saisies[e.id]?.faites[i])
  const nFaites = exos.filter(fini).length

  const terminer = async () => {
    const faite = exos.map((e) => {
      const x = saisies[e.id] ?? VIDE
      return { id: e.id, charge: charge(e), reps: series.filter((i) => x.faites[i]).map((i) => x.reps[i] ?? cible(e)) }
    })
    // Progression : chaque exercice fait avance (ou non) selon ses répétitions
    const etats = { ...force.exos }
    for (const e of exos) {
      const f = faite.find((x) => x.id === e.id)!
      if (!f.reps.length) continue
      etats[e.id] = apresSeance(e, force.exos[e.id], { charge: f.charge, reps: f.reps, cible: cible(e), series: s.series, legere: s.legere })
    }
    await modifierForce({ exos: etats })
    await enregistrer(db.prevues, { ...p, statut: 'faite', muscuFaite: faite })
    const dureeSec = Math.max(600, Math.round((Date.now() - Date.parse(debut)) / 1000))
    await enregistrerSeance({ id: crypto.randomUUID(), date: aujourdhui(), debut, sport: 'renfo', titre: p.titre, dureeSec, source: 'manuel', prevueId: p.id, ...(rpe !== undefined ? { rpe } : {}) })
    navigate('/entrainement/aujourdhui')
  }

  return (
    <div className="pt-sur px-3 pb-10">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="py-2 pr-2 text-2xl text-accent" aria-label="Retour">‹</button>
        <h1 className="text-xl font-extrabold">Muscu · {NOMS_PERIODES[s.periode]}</h1>
        <span className="ml-auto text-sm text-texte-3">{nFaites}/{exos.length}</span>
      </div>
      <p className="rounded-xl border border-attention/40 bg-attention/10 px-3 py-2 text-[13px] text-attention">⌚ Lance ta montre : activité <b>Musculation</b>. Sinon ta séance ne remonte pas dans ta charge.</p>
      <p className="mt-2 text-[13px] text-texte-2">
        {s.series} séries de {s.reps} répétitions{s.legere ? ' légères : on apprend le geste, garde 2 répétitions en réserve' : ' lourdes'} · descente lente (2-3 s), montée vive · repos 2-3 min entre les séries{s.soir ? ' · 3 h après le vélo au moins' : ''}.
      </p>

      <div className="mt-3 space-y-2">
        {exos.map((e) => {
          const x = saisies[e.id] ?? VIDE
          const ch = charge(e)
          const etat = force.exos[e.id]
          const ouvertE = ouvert === e.id
          return (
            <div key={e.id} className={`rounded-2xl border-[1.5px] bg-surface p-3 ${ouvertE ? 'border-muscu' : 'border-transparent'}`}>
              <button type="button" onClick={() => setOuvert(ouvertE ? undefined : e.id)} className="flex w-full items-center gap-3 text-left">
                <Picto type={e.picto} taille={ouvertE ? 48 : 38} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{fini(e) ? '✓ ' : ''}{e.nom}</b>
                  <span className="block text-xs text-texte-2">
                    {s.series} × {cible(e)}{e.unilateral ? ' par jambe' : ''}
                    {e.sansCharge ? ' · poids du corps' : ch ? <> à <b className="text-muscu">{ch} kg</b></> : ' · charge à trouver'}
                    {etat?.derniere && !e.sansCharge ? ` · la dernière fois ${etat.derniere} kg` : ''}
                  </span>
                </span>
                <span className="text-texte-3">{ouvertE ? '▴' : '›'}</span>
              </button>
              {ouvertE && (
                <div className="mt-2">
                  {!e.sansCharge && (
                    <label className="flex items-center justify-between gap-2 text-sm text-texte-2">
                      Charge {e.materiel.includes('haltère') ? '(par haltère)' : ''}
                      <span className="flex items-center gap-1">
                        <input type="number" inputMode="decimal" value={ch ?? ''} placeholder="?" onChange={(ev) => maj(e.id, (y) => ({ ...y, charge: ev.target.value ? Number(ev.target.value) : undefined }))}
                          className="h-10 w-20 rounded-lg border border-bordure bg-surface-2 px-2 text-right text-base text-texte" /> kg
                      </span>
                    </label>
                  )}
                  {!e.sansCharge && !ch && <p className="mt-1 text-xs text-texte-3">1re fois : trouve la charge que tu peux soulever {cible(e)} fois en gardant 2 répétitions en réserve.</p>}
                  {series.map((i) => (
                    <div key={i} className="mt-2 flex items-center gap-2">
                      <span className="w-14 text-[13px] text-texte-2">Série {i + 1}</span>
                      <input type="number" inputMode="numeric" value={x.reps[i] ?? ''} placeholder={String(cible(e))} onChange={(ev) => maj(e.id, (y) => ({ ...y, reps: { ...y.reps, [i]: ev.target.value ? Number(ev.target.value) : undefined } }))}
                        className="h-10 w-16 rounded-lg border border-bordure bg-surface-2 px-2 text-right text-base" />
                      <span className="text-[13px] text-texte-3">rép.</span>
                      <button type="button" aria-label={`Série ${i + 1} faite`} onClick={() => maj(e.id, (y) => ({ ...y, faites: { ...y.faites, [i]: !y.faites[i] } }))}
                        className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full text-base font-extrabold ${x.faites[i] ? 'bg-bon text-fond' : 'border-[1.5px] border-bordure text-texte-3'}`}>✓</button>
                    </div>
                  ))}
                  <details className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                    <summary className="cursor-pointer font-semibold text-muscu">Comment faire ?</summary>
                    <div className="mt-2 flex justify-center"><Picto type={e.picto} taille={96} /></div>
                    <ol className="mt-2 space-y-1.5">
                      {e.etapes.map((t, i) => <li key={i} className="flex gap-2 text-texte-2"><b className="text-muscu">{i + 1}</b><span>{t}</span></li>)}
                    </ol>
                    <p className="mt-2 text-xs text-texte-3">Matériel : {e.materiel}. {e.pourquoi}</p>
                  </details>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!fin ? (
        <button type="button" onClick={() => setFin(true)} className="mt-4 min-h-12 w-full rounded-xl bg-muscu text-base font-bold text-fond">Terminer la séance</button>
      ) : (
        <div className="mt-4 rounded-2xl bg-surface p-3">
          <p className="text-sm">Ton ressenti sur la séance (RPE) ?</p>
          <div className="mt-1 grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" onClick={() => setRpe(n)} className={`rounded-md py-2 text-sm font-semibold ${rpe === n ? 'bg-muscu text-fond' : 'bg-surface-2 text-texte-2'}`}>{n}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-texte-3">Il compte ta muscu dans ta fatigue (pas dans tes kJ).</p>
          <button type="button" onClick={terminer} className="mt-3 min-h-12 w-full rounded-xl bg-muscu text-base font-bold text-fond">Enregistrer</button>
        </div>
      )}
    </div>
  )
}
