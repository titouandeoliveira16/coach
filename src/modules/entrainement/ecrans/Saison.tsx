import { Flag } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour, ecartJours } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Repliable } from '../../../core/ui/Repliable'
import { programmeAu, programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { useReglage } from '../../../core/reglages'
import type { ProfilSportif } from '../reglages/ProfilSportif'
import type { ReglagesProgramme } from '../types'
import { appliquerChangement, trancheAuDessus, type Changement } from '../plan/pistes'
import { NOMS_PHASES, niveauxCourses, type SemaineSaison, type TypePhase } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { recalculerSemainesAVenir, saison } from '../plan/programme'

/** Couleur de chaque phase (rampe validée sur fond sombre). */
/** Couleur de chaque phase = la zone qu'elle travaille, comme Zwift (Z1 gris → Z6 rouge), 12/11/2026 */
const COULEURS: Record<TypePhase, string> = { reprise: '#7c7b74', base: '#3b9eff', entretien: '#46a758', seuil: '#ffc53d', 'seuil-tirage': '#ffc53d', 'seuil-maintien': '#ffc53d', vo2: '#f76b15', 'fin-prepa': '#f76b15', specifique: '#e5484d', affutage: '#b4474a', recuperation: '#5d5c57' }
const jm = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const BADGES: Record<SemaineSaison['type'], { texte: string; classe: string } | undefined> = {
  normale: undefined,
  allegee: { texte: 'allégée', classe: 'bg-accent/20 text-accent' },
  competition: { texte: 'course', classe: 'bg-mauvais/20 text-mauvais' },
  test: { texte: 'test', classe: 'bg-bon/20 text-bon' },
}

/** Une semaine de la saison : date, séance d'intensité, budget, badge. */
function LigneSemaine({ x, actuelle }: { x: SemaineSaison; actuelle?: boolean }) {
  const badge = BADGES[x.type]
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${actuelle ? 'bg-accent/10' : ''}`}>
      <span className="w-14 shrink-0 text-sm text-texte-2">{jm(x.lundi)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{x.type === 'competition' ? `${x.competition} · pas d'intensité avant` : x.intensite}</span>
        <span className="block text-xs text-texte-3">~{formatNombre(x.budget)} kJ</span>
      </span>
      {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.classe}`}>{badge.texte}</span>}
    </div>
  )
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/**
 * Histogramme de la saison (maquette du 10/11/2026) : une barre par semaine (kJ prévus, couleur de la phase, pâle quand
 * le volume baisse : allégée, affûtage, récup), les courses au-dessus, les tests dessous, et la bande des phases.
 */
function HistogrammeKj({ semaines, niveaux, tests }: { semaines: SemaineSaison[]; niveaux: Map<string, string>; tests: string[] }) {
  const [choisie, setChoisie] = useState<number>()
  if (semaines.length < 2) return null
  const W = 340, G = 30, D = 2, Hh = 22, Hb = 150
  const n = semaines.length
  const max = Math.max(...semaines.map((x) => x.budget)) * 1.08
  const pasX = (W - G - D) / n
  const larg = Math.max(2, pasX - 2)
  const x = (i: number) => G + i * pasX + 1
  const y = (v: number) => Hb - (v / max) * (Hb - Hh)
  const pas = max > 6000 ? 2000 : 1000
  const graduations = Array.from({ length: Math.floor(max / pas) }, (_, i) => (i + 1) * pas)
  const dansSemaine = (d: string, l: string) => d >= l && d <= decalerJour(l, 6)
  const basse = (s: SemaineSaison) => s.type === 'allegee' || s.phase === 'affutage' || s.phase === 'recuperation'
  // Bande des phases : segments consécutifs de même couleur
  const segments: { phase: TypePhase; de: number; a: number }[] = []
  semaines.forEach((s, i) => {
    const der = segments.at(-1)
    if (der && COULEURS[der.phase] === COULEURS[s.phase]) der.a = i
    else segments.push({ phase: s.phase, de: i, a: i })
  })
  const c = choisie !== undefined ? semaines[choisie] : undefined
  const courseDe = (s: SemaineSaison) => [...niveaux.keys()].find((d) => dansSemaine(d, s.lundi))
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${Hb + 34}`} className="w-full" role="img" aria-label="kJ prévus par semaine jusqu'à ta course, avec les phases">
        {graduations.map((v) => (
          <g key={v}>
            <line x1={G} x2={W - D} y1={y(v)} y2={y(v)} stroke="var(--color-bordure)" strokeWidth="1" />
            <text x={G - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--color-texte-3)">{v.toLocaleString('fr-FR')}</text>
          </g>
        ))}
        <g className="monte-svg">
          {semaines.map((s, i) => {
            const h = Hb - y(s.budget)
            const r = Math.min(3, larg / 2, h)
            return (
              <path key={s.lundi} style={{ animationDelay: `${i * 18}ms` }}
                d={`M${x(i)},${Hb} V${y(s.budget) + r} Q${x(i)},${y(s.budget)} ${x(i) + r},${y(s.budget)} H${x(i) + larg - r} Q${x(i) + larg},${y(s.budget)} ${x(i) + larg},${y(s.budget) + r} V${Hb} Z`}
                fill={COULEURS[s.phase]} fillOpacity={basse(s) ? 0.45 : 1}
                stroke={choisie === i ? 'var(--color-texte)' : 'none'} strokeWidth="1.5" />
            )
          })}
        </g>
        <line x1={G} x2={W - D} y1={Hb} y2={Hb} stroke="var(--color-texte-3)" strokeWidth="0.75" />
        {semaines.map((s, i) => {
          const course = courseDe(s)
          const test = tests.find((d) => dansSemaine(d, s.lundi))
          const debutMois = i === 0 || s.lundi.slice(5, 7) !== semaines[i - 1].lundi.slice(5, 7)
          const cx = x(i) + larg / 2
          const yc = Math.max(2, y(s.budget) - 17)
          return (
            <g key={s.lundi}>
              {course && (
                <g>
                  <rect x={cx - 6} y={yc} width="12" height="12" rx="3" fill={niveaux.get(course) === 'A' ? 'var(--color-accent)' : 'var(--color-texte-2)'} />
                  <text x={cx} y={yc + 9.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--color-fond)">{niveaux.get(course)}</text>
                </g>
              )}
              {test && <circle cx={cx} cy={Hb + 5} r="2.5" fill="none" stroke="var(--color-texte-2)" strokeWidth="1.2" />}
              {debutMois && <text x={x(i)} y={Hb + 16} fontSize="9" fill="var(--color-texte-3)">{MOIS[Number(s.lundi.slice(5, 7)) - 1]}</text>}
              <rect x={x(i) - 1} y={0} width={pasX} height={Hb + 20} fill="transparent" onClick={() => setChoisie(choisie === i ? undefined : i)} />
            </g>
          )
        })}
        {segments.map((sg) => (
          <rect key={sg.de} x={x(sg.de)} y={Hb + 23} width={x(sg.a) + larg - x(sg.de)} height="5" rx="2.5" fill={COULEURS[sg.phase]} />
        ))}
      </svg>
      <p className="mt-1 min-h-5 text-xs text-texte-2">
        {c ? <>Sem. du {jm(c.lundi)} · {NOMS_PHASES[c.phase]} · <b className="text-texte">≈ {c.budget.toLocaleString('fr-FR')} kJ</b>{c.competition ? ` · course : ${c.competition}` : ''}{c.type === 'allegee' ? ' · allégée' : ''}{c.intensite ? ` · ${c.intensite}` : ''}</> : 'Touche une barre pour voir sa semaine.'}
      </p>
      <p className="text-xs text-texte-3">Barres pâles : semaines plus légères (allégée, affûtage, récup).<Aide titre="Ta charge prévue" texte={AIDES.budgetAuto} /></p>
    </div>
  )
}

/** Quand tes choix (temps par semaine, jours, durées) empêchent ta charge de monter : à partir de quand, et quoi changer. */
type Piste = { levier: 'semaine' | 'longue' | 'jour'; gain: number; avant: number; apres: number; jour?: number; couvre?: boolean; minutes?: number }
type BlocageSaison = { lundi: string; jusquA?: string; par: 'heures' | 'jours'; heures?: string; besoin?: number; pistes: Piste[] }
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const jourMois = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const duree = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`
const kj = (g: number) => formatNombre(Math.round(g / 10) * 10)

/**
 * Conseil quand la charge plafonne (13/11/2026) : les 3 pistes d'un coup, chacune dimensionnée pour couvrir la hausse
 * voulue (avec ses kJ) ; la meilleure en premier (un jour de plus, puis les sorties de semaine, puis la sortie longue),
 * chacune s'applique en un geste (une semaine type « Plus tard » à cette date) ; Annuler après coup.
 */
function Blocage({ b, onFait }: { b: BlocageSaison; onFait: (avant: ReglagesProgramme, texte: string) => void }) {
  const [r, modifier] = useReglagesEntrainement()
  const [ps] = useReglage<ProfilSportif>('profil-sportif', { sports: [], materiel: [] })
  const [jourChoisi, setJourChoisi] = useState<number>()
  const [occupe, setOccupe] = useState(false)
  const prog = programmeDe(r.programme)
  const semaineType = programmeAu(prog, b.lundi).semaineType
  const quand = b.jusquA ? `Du ${jourMois(b.lundi)} au ${jourMois(b.jusquA)}` : `À partir du ${jourMois(b.lundi)}`
  const dates = ` dès le ${jourMois(b.lundi)}`
  const tranche = trancheAuDessus(b.heures)
  const appliquer = async (c: Changement, texte: string) => {
    setOccupe(true)
    await modifier({ programme: appliquerChangement(prog, ps.heuresSemaine, b.lundi, c) })
    onFait(prog, texte)
    await recalculerSemainesAVenir()
    setOccupe(false)
  }
  const jours = semaineType.map((x, j) => [x, j] as const).filter(([x]) => !x.startsWith('velo')).map(([, j]) => j)

  const options = b.par === 'heures'
    ? (tranche ? [{ cle: 'heures', titre: `Plus de temps par semaine : ${tranche.toLowerCase()}`, detail: `c’est ton temps par semaine (${b.heures?.toLowerCase() ?? 'profil'}) qui bloque`, bouton: `Oui, ${tranche.toLowerCase()}${dates}`, c: { levier: 'heures' } as Changement, texte: `${tranche} par semaine à partir du ${jourMois(b.lundi)}.`, piste: undefined as Piste | undefined }] : [])
    : b.pistes.map((p) => {
      if (p.levier === 'jour') {
        const j = jourChoisi !== undefined && jours.includes(jourChoisi) ? jourChoisi : p.jour ?? jours[0]
        const n = semaineType.filter((x) => x.startsWith('velo')).length + 1
        return { cle: 'jour', titre: `Un ${n}e jour de vélo (${duree(p.minutes ?? 0)})`, detail: '', bouton: `Ajouter le ${JOURS_LONGS[j]}${dates}`, c: { levier: 'jour', jour: j } as Changement, texte: `${n} jours de vélo à partir du ${jourMois(b.lundi)} (le ${JOURS_LONGS[j]} en plus).`, piste: p }
      }
      if (p.levier === 'semaine') return { cle: 'semaine', titre: `Sorties de semaine plus longues : ${p.avant} → ${p.apres} min`, detail: '', bouton: `Oui, ${p.apres} min${dates}`, c: { levier: 'semaine', minutes: p.apres } as Changement, texte: `Sorties de semaine jusqu’à ${p.apres} min à partir du ${jourMois(b.lundi)}.`, piste: p }
      return { cle: 'longue', titre: `Sortie longue plus longue : ${duree(p.avant)} → ${duree(p.apres)}`, detail: '', bouton: `Oui, ${duree(p.apres)}${dates}`, c: { levier: 'longue', minutes: p.apres } as Changement, texte: `Sortie longue jusqu’à ${duree(p.apres)} à partir du ${jourMois(b.lundi)}.`, piste: p }
    })

  return (
    <div className="mt-3 rounded-xl border-[1.5px] border-attention/40 bg-surface-2 px-3 py-3 text-sm">
      <p className="font-semibold text-attention">{quand}, ta charge ne peut plus monter.</p>
      {b.besoin ? <p className="mt-0.5 text-xs text-texte-3">Pour continuer à monter sur les 4 prochaines semaines : environ +{kj(b.besoin)} kJ par semaine.</p> : null}
      {!options.length && <p className="mt-1 text-texte-2">Tu es déjà au maximum des réglages : ta charge restera à ce niveau, c’est très bien aussi.</p>}
      <div className="mt-2 space-y-2">
        {options.map((o, i) => (
          <div key={o.cle} className={`rounded-xl p-2.5 ${i === 0 ? 'bg-surface' : 'border border-bordure'}`}>
            <p className="text-xs font-semibold text-texte-3">{i === 0 ? 'Le plus efficace' : `Option ${i + 1}`}</p>
            <p className="mt-0.5 font-semibold">{o.titre}</p>
            <p className="text-xs text-texte-2">
              {o.piste ? <>≈ +{kj(o.piste.gain)} kJ par semaine · {o.piste.couvre ? <span className="text-bon">couvre la hausse</span> : <span className="text-attention">en partie</span>}</> : o.detail}
            </p>
            {o.cle === 'jour' && jours.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {jours.map((j) => {
                  const actif = j === (o.c as { jour: number }).jour
                  return <button key={j} type="button" onClick={() => setJourChoisi(j)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${actif ? 'bg-accent text-fond' : 'border border-bordure text-texte-2'}`}>{JOURS_COURTS[j]}</button>
                })}
              </div>
            )}
            <button type="button" disabled={occupe} onClick={() => appliquer(o.c, o.texte)}
              className={`mt-2 w-full rounded-xl py-2.5 text-[14px] font-bold disabled:opacity-60 ${i === 0 ? 'bg-accent text-fond' : 'border border-accent text-accent'}`}>{o.bouton}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Conseil appliqué : ce qui a changé, et Annuler (la semaine type d'avant revient). */
function ConseilFait({ texte, onAnnuler, onFermer }: { texte: string; onAnnuler: () => void; onFermer: () => void }) {
  return (
    <div className="mt-3 rounded-xl border-[1.5px] border-bon/40 bg-surface-2 px-3 py-3 text-sm">
      <p className="font-semibold text-bon">✓ C’est fait</p>
      <p className="mt-1 text-texte-2">{texte} Ta saison est recalculée : ta charge peut continuer à monter.</p>
      <div className="mt-2 flex justify-between text-[13px]">
        <button type="button" onClick={onAnnuler} className="py-1 font-semibold text-accent">Annuler</button>
        <button type="button" onClick={onFermer} className="py-1 text-texte-3">OK</button>
      </div>
    </div>
  )
}

/** Saison : où j'en suis (frise avec courses et tests), les 3 prochaines semaines, puis les phases repliées (validé le 7/11/2026). */
export function Saison() {
  const s = useLiveQuery(saison)
  const [r, modifier] = useReglagesEntrainement()
  const [fait, setFait] = useState<{ avant: ReglagesProgramme; texte: string }>()
  if (!s?.semaines.length) return null
  const prog = programmeDe(r.programme)
  const actuelle = s.semaines[0]
  const debut = s.phases[0].debut
  const totalJours = Math.max(1, ecartJours(debut, s.fin))
  const position = (d: string) => Math.min(100, Math.max(0, (ecartJours(debut, d) / totalJours) * 100))
  const pos = position(aujourdhui())
  const prochaine = s.phases.find((p) => p.debut > aujourdhui())
  const dansFrise = (d: string) => d >= debut && d <= s.fin
  const courses = prog.competitions.filter((c) => dansFrise(c.date) && c.date >= aujourdhui())
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  const tests = prog.testsCp.filter((d) => dansFrise(d) && d >= aujourdhui())
  // La courbe va jusqu'à la semaine après la dernière course A
  const courseA = [...niveaux].filter(([d, n]) => n === 'A' && d >= aujourdhui()).map(([d]) => decalerJour(d, 7)).sort().pop()
  const niveauxFuturs = new Map([...niveaux].filter(([d]) => d >= aujourdhui()))

  // Semaines regroupées par phase
  const groupes: { phase: TypePhase; semaines: SemaineSaison[] }[] = []
  for (const x of s.semaines) {
    const g = groupes[groupes.length - 1]
    if (g?.phase === x.phase) g.semaines.push(x)
    else groupes.push({ phase: x.phase, semaines: [x] })
  }

  return (
    <div className="space-y-3">
      <Carte>
        <p className="text-[13px] font-semibold text-texte-2">Où j'en suis</p>
        {s.demarrage ? (
          <>
            <p className="mt-1 text-xl font-bold">Semaine de reprise</p>
            <p className="text-texte-2">Le programme démarre le {jm(s.demarrage)} avec « {NOMS_PHASES[actuelle.phase]} ».<Aide titre="Les phases" texte={AIDES.phases} /></p>
          </>
        ) : (
          <>
            <p className="mt-1 flex items-center gap-2 text-xl font-bold"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COULEURS[actuelle.phase] }} />{NOMS_PHASES[actuelle.phase]}</p>
            <p className="text-sm text-texte-2 min-[390px]:text-[15px]">
              Semaine {actuelle.numero}{actuelle.total ? ` sur ${actuelle.total}` : ''}
              {prochaine && ` · puis ${NOMS_PHASES[prochaine.type].replace(/^Dominante /, '')} dans ${Math.ceil(ecartJours(aujourdhui(), prochaine.debut) / 7)} sem.`}
              <Aide titre="Les phases" texte={AIDES.phases} />
            </p>
          </>
        )}

        {/* Frise de la saison, avec toi (▲), tes courses (drapeau) et tes tests (○) */}
        <div className="relative mt-4 h-3 overflow-hidden rounded-full">
          <div className="flex h-full">
            {s.phases.map((p, i) => {
              const fin = s.phases[i + 1]?.debut ?? s.fin
              return <div key={p.type + p.debut} style={{ width: `${(ecartJours(p.debut, fin) / totalJours) * 100}%`, background: COULEURS[p.type] }} />
            })}
          </div>
        </div>
        <div className="relative h-5 text-xs">
          <span className="absolute -translate-x-1/2" style={{ left: `${pos}%` }}>▲</span>
          {courses.map((c) => <span key={c.date} className="absolute -translate-x-1/2" style={{ left: `${position(c.date)}%` }}><Flag className="h-3.5 w-3.5 text-accent" strokeWidth={2} /></span>)}
          {tests.map((d) => <span key={d} className="absolute top-1 h-2 w-2 -translate-x-1/2 rounded-full border-[1.5px] border-texte-2" style={{ left: `${position(d)}%` }} />)}
        </div>
        {/* Légende des couleurs (mêmes couleurs dans la courbe de charge) */}
        <div className="mt-1 mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {[...new Set(s.phases.map((p) => p.type))].map((t) => (
            <span key={t} className={`flex items-center gap-1.5 text-xs ${t === actuelle.phase ? 'font-semibold text-texte' : 'text-texte-2'}`}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COULEURS[t] }} />{NOMS_PHASES[t]}
            </span>
          ))}
        </div>
        {(courses.length > 0 || tests.length > 0) && (
          <p className="text-xs text-texte-3">
            {courses.map((c) => `${c.nom} (${niveaux.get(c.date) ?? 'B'}) le ${jm(c.date)}`).join(' · ')}
            {courses.length > 0 && tests.length > 0 ? ' · ' : ''}
            {tests.length > 0 && `tests CP (○) ${tests.slice(0, 3).map(jm).join(', ')}`}
          </p>
        )}
      </Carte>

      <Carte titre="Ta charge prévue (kJ par semaine)">
        <HistogrammeKj semaines={s.semaines.filter((x) => x.lundi <= (courseA ?? s.fin))} niveaux={niveauxFuturs} tests={tests} />
        {fait && <ConseilFait texte={fait.texte} onFermer={() => setFait(undefined)} onAnnuler={async () => {
          await modifier({ programme: fait.avant })
          setFait(undefined)
          await recalculerSemainesAVenir()
        }} />}
        {s.blocages.filter((b) => b.lundi <= (courseA ?? s.fin)).map((b) => <Blocage key={b.lundi} b={b} onFait={(avant, texte) => setFait({ avant, texte })} />)}
      </Carte>

      <Carte titre="Cette semaine et les 2 suivantes">
        <div className="-mx-4 divide-y divide-bordure">
          {s.semaines.slice(0, 3).map((x, i) => <LigneSemaine key={x.lundi} x={x} actuelle={i === 0 && !s.demarrage} />)}
        </div>
      </Carte>

      {groupes.map((g) => {
        const fin = g.semaines[g.semaines.length - 1].lundi
        return (
          <Repliable key={g.phase + g.semaines[0].lundi} libelle="Voir"
            titre={NOMS_PHASES[g.phase]}
            resume={<span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COULEURS[g.phase] }} />{jm(g.semaines[0].lundi)} → {jm(fin)} · {g.semaines.length} sem.</span>}>
            <div className="-mx-3.5 divide-y divide-bordure">
              {g.semaines.map((x) => <LigneSemaine key={x.lundi} x={x} actuelle={x === actuelle && !s.demarrage} />)}
            </div>
          </Repliable>
        )
      })}
      <p className="px-1 text-xs text-texte-3">Budgets estimés : ils sont recalculés chaque semaine selon ce que tu as fait et tes signaux du matin.</p>
    </div>
  )
}
