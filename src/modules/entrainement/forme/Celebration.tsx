import { useLiveQuery } from 'dexie-react-hooks'
import { Carte } from '../../../core/ui/Carte'
import { celebrationDuJour, marquerVue, victoiresRecentes } from './victoires'

const COULEURS = ['#ff8a3d', '#4ade80', '#60a5fa', '#facc15']

/** Séance tenue : un petit moment plein écran (confettis), une fois. */
export function BravoSeance() {
  const v = useLiveQuery(celebrationDuJour)
  if (!v || v.type !== 'seance') return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => marquerVue(v)}>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} className="confetti absolute top-1/4 h-3 w-2 rounded-sm"
          style={{ left: `${8 + i * 5}%`, background: COULEURS[i % 4], animationDelay: `${(i % 6) * 0.08}s` }} />
      ))}
      <div className="apparition w-full max-w-sm rounded-2xl border border-accent bg-surface p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl">✅</div>
        <p className="mt-2 text-2xl font-extrabold">Séance tenue !</p>
        <p className="mt-1 text-sm text-texte-2">{v.texte}</p>
        {v.palier !== undefined && (
          <>
            <div className="mt-3 flex justify-center gap-1.5">
              {[1, 2, 3, 4].map((n) => <span key={n} className={`h-2.5 w-8 rounded-full ${n <= v.palier! ? 'bg-accent' : 'bg-bordure'}`} />)}
            </div>
            <p className="mt-2 text-sm"><b className="text-accent">Palier {v.palier}/4</b>{v.famille ? ` pour tes ${v.famille.toLowerCase()}` : ''}</p>
          </>
        )}
        <button type="button" onClick={() => marquerVue(v)} className="mt-4 rounded-xl bg-accent px-8 py-2.5 font-bold text-fond">Super</button>
      </div>
    </div>
  )
}

/** Record, test en hausse, série : une carte dans le bandeau « à voir » du jour. */
export function CarteVictoire() {
  const v = useLiveQuery(celebrationDuJour)
  if (!v || v.type === 'seance') return null
  return (
    <Carte className="apparition border-[#facc15]!">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{v.icone}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{v.titre}</p>
          <p className="text-sm text-texte-2">{v.texte}</p>
        </div>
      </div>
      <button type="button" onClick={() => marquerVue(v)} className="mt-2 w-full rounded-xl bg-accent py-2 font-semibold text-fond">Bien joué</button>
    </Carte>
  )
}

/** Progrès → Petites victoires : les victoires du mois (séances tenues, records, tests, séries). */
export function ListeVictoires() {
  const liste = useLiveQuery(() => victoiresRecentes(30))
  if (!liste?.length) return null
  const jm = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return (
    <ul className="mb-3 space-y-2">
      {liste.slice(0, 8).map((v) => (
        <li key={v.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
          <span className="text-2xl">{v.icone}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{v.titre}</span>
            <span className="block truncate text-xs text-texte-3">{v.texte}</span>
          </span>
          <span className="shrink-0 text-xs text-texte-3">{jm(v.date)}</span>
        </li>
      ))}
    </ul>
  )
}
