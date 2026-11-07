import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, depuisJour, ecartJours } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Repliable } from '../../../core/ui/Repliable'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { NOMS_PHASES, type SemaineSaison, type TypePhase } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { saison } from '../plan/programme'

/** Couleur de chaque phase (rampe validée sur fond sombre). */
const COULEURS: Record<TypePhase, string> = { reprise: '#86b6ef', vo2: '#3987e5', seuil: '#1c5cab', entretien: '#199e70', 'seuil-tirage': '#3987e5', 'seuil-maintien': '#1c5cab', 'fin-prepa': '#7c3aed', specifique: '#d97706', affutage: '#dc2626', recuperation: '#9ca3af' }
const jm = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const BADGES: Record<SemaineSaison['type'], { texte: string; classe: string } | undefined> = {
  normale: undefined,
  allegee: { texte: 'allégée', classe: 'bg-accent/20 text-accent' },
  competition: { texte: 'course', classe: 'bg-[#f87171]/20 text-[#f87171]' },
  test: { texte: 'test', classe: 'bg-[#4ade80]/20 text-[#4ade80]' },
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
  const tests = prog.testsCp.filter((d) => dansFrise(d) && d >= aujourdhui())

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
        <p className="text-xs uppercase tracking-wider text-texte-3">Où j'en suis</p>
        {s.demarrage ? (
          <>
            <p className="mt-1 text-xl font-bold">Semaine de reprise</p>
            <p className="text-texte-2">Le programme démarre le {jm(s.demarrage)} avec « {NOMS_PHASES[actuelle.phase]} ».<Aide titre="Les phases" texte={AIDES.phases} /></p>
          </>
        ) : (
          <>
            <p className="mt-1 text-xl font-bold" style={{ color: COULEURS[actuelle.phase] }}>{NOMS_PHASES[actuelle.phase]}</p>
            <p className="text-texte-2">
              Semaine {actuelle.numero}{actuelle.total ? ` sur ${actuelle.total}` : ''}
              {prochaine && ` · ${NOMS_PHASES[prochaine.type]} dans ${Math.ceil(ecartJours(aujourdhui(), prochaine.debut) / 7)} sem.`}
              <Aide titre="Les phases" texte={AIDES.phases} />
            </p>
          </>
        )}

        {/* Frise de la saison, avec toi (▲), tes courses (🏁) et tes tests (🧪) */}
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
          {courses.map((c) => <span key={c.date} className="absolute -translate-x-1/2" style={{ left: `${position(c.date)}%` }}>🏁</span>)}
          {tests.map((d) => <span key={d} className="absolute -translate-x-1/2 text-[10px]" style={{ left: `${position(d)}%` }}>🧪</span>)}
        </div>
        {(courses.length > 0 || tests.length > 0) && (
          <p className="text-xs text-texte-3">
            {courses.map((c) => `🏁 ${c.nom} le ${jm(c.date)}`).join(' · ')}
            {courses.length > 0 && tests.length > 0 ? ' · ' : ''}
            {tests.length > 0 && `🧪 tests CP ${tests.slice(0, 3).map(jm).join(', ')}`}
          </p>
        )}
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
