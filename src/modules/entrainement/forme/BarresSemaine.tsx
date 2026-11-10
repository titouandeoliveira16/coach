import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'

/** Barres de la semaine (kJ prévus par jour ; en orange ce qui est fait), qui montent à l'ouverture : en haut de Semaine. */
export function BarresSemaine({ lundi }: { lundi: string }) {
  const jour = aujourdhui()
  const d = useLiveQuery(async () => {
    const prevues = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()).filter((p) => p.sport === 'velo')
    const seances = (await db.seances.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()).filter((s) => s.sport === 'velo')
    return Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i)).map((dj) => ({
      dj,
      fait: seances.filter((s) => s.date === dj).reduce((a, s) => a + (s.kj ?? 0), 0),
      prevu: prevues.filter((p) => p.date === dj && p.statut !== 'non-faite' && p.statut !== 'abandonnee').reduce((a, p) => a + (p.kjPrevu ?? 0), 0),
    }))
  }, [lundi])
  if (!d || !d.some((x) => x.prevu || x.fait)) return null
  const max = Math.max(...d.map((x) => Math.max(x.prevu, x.fait)), 1)
  return (
    <div className="mt-3">
      <div key={lundi} className="monte flex h-12 items-end gap-1.5">
        {d.map((x, i) => (
          <span key={x.dj} className="flex h-full flex-1 flex-col justify-end" style={{ animationDelay: `${i * 50}ms` }}>
            <span className="block w-full rounded" style={{
              height: `${Math.max(6, (Math.max(x.prevu, x.fait) / max) * 100)}%`,
              background: x.fait ? 'var(--color-accent)' : x.dj === jour ? 'var(--color-accent-doux)' : 'color-mix(in srgb, var(--color-texte-3) 35%, transparent)',
              outline: x.dj === jour ? '1px solid var(--color-accent)' : undefined,
            }} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[9.5px] text-texte-3">
        {'LMMJVSD'.split('').map((l, i) => <span key={i} className="flex-1">{l}</span>)}
      </div>
    </div>
  )
}
