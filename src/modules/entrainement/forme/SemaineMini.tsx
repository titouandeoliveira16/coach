import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { chargesSemaine } from '../plan/donnees'
import { lundiDe } from '../seances/donnees'

/** Ta semaine en 7 barres (kJ prévus par jour ; en orange ce qui est fait), qui montent à l'ouverture (maquette V1). */
export function SemaineMini() {
  const navigate = useNavigate()
  const jour = aujourdhui()
  const lundi = lundiDe(jour)
  const d = useLiveQuery(async () => {
    const prevues = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()).filter((p) => p.sport === 'velo')
    const seances = (await db.seances.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()).filter((s) => s.sport === 'velo')
    const kj = await chargesSemaine(lundi)
    const jours = Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i)).map((dj) => {
      const fait = seances.filter((s) => s.date === dj).reduce((a, s) => a + (s.kj ?? 0), 0)
      const prevu = prevues.filter((p) => p.date === dj && p.statut !== 'non-faite' && p.statut !== 'abandonnee').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
      return { dj, fait, prevu }
    })
    return { jours, budget: Math.round(kj.kjPrevus), total: Math.round(kj.kjRealises) }
  }, [lundi])
  if (!d || !d.jours.some((x) => x.prevu || x.fait)) return null
  const max = Math.max(...d.jours.map((x) => Math.max(x.prevu, x.fait)), 1)
  return (
    <button type="button" onClick={() => navigate('/entrainement/semaine')} className="presse entree shrink-0 rounded-[14px] bg-surface p-3 text-left">
      <span className="flex items-baseline justify-between">
        <span className="etiquette">Semaine</span>
        <span className="text-xs text-texte-2"><b className="chiffre text-texte">{d.total.toLocaleString('fr-FR')}</b>{d.budget ? ` / ${d.budget.toLocaleString('fr-FR')} kJ` : ' kJ'}</span>
      </span>
      <span className="monte mt-2 flex h-10 items-end gap-1.5">
        {d.jours.map((x, i) => (
          <span key={x.dj} className="flex h-full flex-1 flex-col justify-end" style={{ animationDelay: `${i * 50}ms` }}>
            <span className="block w-full rounded" style={{
              height: `${Math.max(6, (Math.max(x.prevu, x.fait) / max) * 100)}%`,
              background: x.fait ? 'var(--color-accent)' : x.dj === jour ? 'var(--color-accent-doux)' : 'var(--color-surface-2)',
              outline: x.dj === jour ? '1px solid var(--color-accent)' : undefined,
            }} />
          </span>
        ))}
      </span>
      <span className="mt-1 flex gap-1.5 text-center text-[9.5px] text-texte-3">
        {'LMMJVSD'.split('').map((l, i) => <span key={i} className="flex-1">{l}</span>)}
      </span>
    </button>
  )
}
