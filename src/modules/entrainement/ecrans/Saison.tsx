import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, depuisJour, ecartJours } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { NOMS_PHASES, type SemaineSaison, type TypePhase } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { saison } from '../plan/programme'

/** Couleur de chaque phase (rampe validée sur fond sombre). */
const COULEURS: Record<TypePhase, string> = { reprise: '#86b6ef', vo2: '#3987e5', seuil: '#1c5cab', entretien: '#199e70' }
const jm = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const BADGES: Record<SemaineSaison['type'], { texte: string; classe: string } | undefined> = {
  normale: undefined,
  allegee: { texte: 'allégée', classe: 'bg-accent/20 text-accent' },
  competition: { texte: 'course', classe: 'bg-[#f87171]/20 text-[#f87171]' },
  test: { texte: 'test', classe: 'bg-[#4ade80]/20 text-[#4ade80]' },
}

/** Saison : où j'en suis dans mes phases, et les semaines vélo à venir. */
export function Saison() {
  const s = useLiveQuery(saison)
  if (!s?.semaines.length) return null
  const actuelle = s.semaines[0]
  const debut = s.phases[0].debut
  const totalJours = Math.max(1, ecartJours(debut, s.fin))
  const pos = Math.min(100, Math.max(0, (ecartJours(debut, aujourdhui()) / totalJours) * 100))
  const prochaine = s.phases.find((p) => p.debut > aujourdhui())

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

        {/* Frise de la saison */}
        <div className="relative mt-4 h-3 overflow-hidden rounded-full">
          <div className="flex h-full">
            {s.phases.map((p, i) => {
              const fin = s.phases[i + 1]?.debut ?? s.fin
              return <div key={p.type} style={{ width: `${(ecartJours(p.debut, fin) / totalJours) * 100}%`, background: COULEURS[p.type] }} />
            })}
          </div>
        </div>
        <div className="relative h-4">
          <span className="absolute -top-1 -translate-x-1/2 text-xs" style={{ left: `${pos}%` }}>▲</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-texte-3">
          {s.phases.map((p) => (
            <span key={p.type} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COULEURS[p.type] }} />{NOMS_PHASES[p.type]} · {jm(p.debut)}
            </span>
          ))}
        </div>
      </Carte>

      {groupes.map((g) => (
        <section key={g.phase + g.semaines[0].lundi}>
          <h2 className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEURS[g.phase] }} />{NOMS_PHASES[g.phase]}
          </h2>
          <div className="divide-y divide-bordure rounded-2xl border border-bordure bg-surface">
            {g.semaines.map((x, i) => {
              const badge = BADGES[x.type]
              return (
                <div key={x.lundi} className={`flex items-center gap-3 px-3 py-2.5 ${i === 0 && x === actuelle && !s.demarrage ? 'bg-accent/10' : ''}`}>
                  <span className="w-14 shrink-0 text-sm text-texte-2">{jm(x.lundi)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{x.type === 'competition' ? `${x.competition} · pas d'intensité avant` : x.intensite}</span>
                    <span className="block text-xs text-texte-3">Sem. {x.numero}{x.total ? `/${x.total}` : ''} · ~{formatNombre(x.budget)} kJ</span>
                  </span>
                  {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.classe}`}>{badge.texte}</span>}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <p className="px-1 text-xs text-texte-3">Budgets estimés : ils sont recalculés chaque semaine selon ce que tu as fait et tes signaux du matin.</p>
    </div>
  )
}
