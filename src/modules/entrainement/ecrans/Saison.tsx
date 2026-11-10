import { Flag } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour, ecartJours } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Repliable } from '../../../core/ui/Repliable'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { NOMS_PHASES, niveauxCourses, type SemaineSaison, type TypePhase } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { saison } from '../plan/programme'

/** Couleur de chaque phase (rampe validée sur fond sombre). */
const COULEURS: Record<TypePhase, string> = { reprise: '#7c7b74', base: '#3b9eff', vo2: '#46a758', seuil: '#12a594', entretien: '#6f6d66', 'seuil-tirage': '#46a758', 'seuil-maintien': '#12a594', 'fin-prepa': '#ffc53d', specifique: '#f76b15', affutage: '#e5484d', recuperation: '#9ca3af' }
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

/**
 * Courbe du budget kJ prévu, semaine par semaine, jusqu'à la course (une seule série : le titre la nomme). Phases en
 * bandes de couleur, tests (○) et courses (pastille A / B / C) en repères. Toucher une semaine affiche son détail.
 */
function CourbeKj({ semaines, niveaux, tests }: { semaines: SemaineSaison[]; niveaux: Map<string, string>; tests: string[] }) {
  const [choisie, setChoisie] = useState<number>()
  if (semaines.length < 2) return null
  const W = 340, H = 170, G = 30, D = 6, Hh = 14, B = 24
  const max = Math.max(...semaines.map((x) => x.budget)) * 1.1
  const x = (i: number) => G + (i * (W - G - D)) / (semaines.length - 1)
  const y = (v: number) => H - B - (v / max) * (H - B - Hh)
  const pas = max > 4000 ? 2000 : 1000
  const graduations = Array.from({ length: Math.floor(max / pas) }, (_, i) => (i + 1) * pas)
  const points = semaines.map((s, i) => `${x(i).toFixed(1)},${y(s.budget).toFixed(1)}`).join(' ')
  const larg = (W - G - D) / (semaines.length - 1)
  const dansSemaine = (d: string, l: string) => d >= l && d <= decalerJour(l, 6)
  const c = choisie !== undefined ? semaines[choisie] : undefined
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Budget kJ prévu par semaine jusqu'à ta course">
        {graduations.map((v) => (
          <g key={v}>
            <line x1={G} x2={W - D} y1={y(v)} y2={y(v)} stroke="var(--color-bordure)" strokeWidth="1" />
            <text x={G - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--color-texte-3)">{(v).toLocaleString('fr-FR')}</text>
          </g>
        ))}
        {semaines.map((s, i) => (
          <rect key={s.lundi} x={x(i) - larg / 2} y={Hh} width={larg} height={H - B - Hh} fill={COULEURS[s.phase]} opacity="0.3" />
        ))}
        <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
        <line x1={x(0)} x2={x(0)} y1={Hh} y2={H - B} stroke="var(--color-texte-2)" strokeDasharray="3 3" />
        <text x={x(0) + 3} y={Hh - 3} fontSize="9" fill="var(--color-texte-3)">aujourd’hui</text>
        {semaines.map((s, i) => {
          const course = [...niveaux.keys()].find((d) => dansSemaine(d, s.lundi))
          const test = tests.find((d) => dansSemaine(d, s.lundi))
          return (
            <g key={s.lundi}>
              {course && (
                <g>
                  <rect x={x(i) - 7} y={H - B + 4} width="14" height="14" rx="3" fill={niveaux.get(course) === 'A' ? 'var(--color-accent)' : niveaux.get(course) === 'B' ? '#facc15' : '#60a5fa'} />
                  <text x={x(i)} y={H - B + 14.5} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--color-fond)">{niveaux.get(course)}</text>
                </g>
              )}
              {!course && test && <circle cx={x(i)} cy={H - B + 10} r="3.5" fill="none" stroke="var(--color-texte-2)" strokeWidth="1.5" />}
              {choisie === i && <circle cx={x(i)} cy={y(s.budget)} r="4" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />}
              <rect x={x(i) - larg / 2} y={0} width={larg} height={H} fill="transparent" onClick={() => setChoisie(choisie === i ? undefined : i)} />
            </g>
          )
        })}
      </svg>
      <p className="min-h-5 text-xs text-texte-2">
        {c ? <>Sem. du {jm(c.lundi)} · {NOMS_PHASES[c.phase]} · <b className="text-texte">≈ {c.budget.toLocaleString('fr-FR')} kJ</b>{c.competition ? ` · course : ${c.competition}` : ''}{c.type === 'allegee' ? ' · allégée' : ''}</> : 'Touche une semaine pour voir son budget.'}
      </p>
      <p className="text-xs text-texte-3">Les creux : semaines allégées (1 sur 4), course B, affûtage. La courbe suit tes jours de vélo et tes durées : change-les dans Réglages, elle bouge.</p>
    </div>
  )
}

/** Saison : où j'en suis (frise avec courses et tests), les 3 prochaines semaines, puis les phases repliées (validé le 7/11/2026). */
export function Saison() {
  const s = useLiveQuery(saison)
  const [r] = useReglagesEntrainement()
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
        <CourbeKj semaines={s.semaines.filter((x) => x.lundi <= (courseA ?? s.fin))} niveaux={niveauxFuturs} tests={tests} />
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
