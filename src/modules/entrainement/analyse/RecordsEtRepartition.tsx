import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'

/** Temps passé sous le 1er seuil, entre le 1er seuil et la CP, au-dessus de la CP, sur 4 semaines (vélo avec capteur). */
export function Repartition() {
  const parts = useLiveQuery(async () => {
    const debut = decalerJour(aujourdhui(), -27)
    const s = (await db.seances.where('date').aboveOrEqual(debut).toArray()).filter((x) => x.sport === 'velo' && x.tempsPuissance)
    const t = [0, 0, 0]
    for (const x of s) x.tempsPuissance!.forEach((v, i) => (t[i] += v))
    return t
  })
  const total = parts?.reduce((a, b) => a + b, 0)
  if (!parts || !total) return null
  const noms = ['Endurance (sous le 1er seuil)', 'Tempo / seuil (jusqu’à la CP)', 'Au-dessus de la CP']
  const couleurs = ['var(--color-z2)', 'var(--color-z4)', 'var(--color-z6, #e5484d)']
  return (
    <section className="entree rounded-[14px] bg-surface p-4">
      <h2 className="etiquette mb-2">Répartition de ton vélo (4 semaines)</h2>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-md">
        {parts.map((p, i) => p > 0 && <div key={i} style={{ flex: p, background: couleurs[i] }} />)}
      </div>
      <div className="mt-2 space-y-0.5">
        {parts.map((p, i) => (
          <p key={i} className="flex items-center justify-between text-xs text-texte-2">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: couleurs[i] }} />{noms[i]}</span>
            <span className="chiffre text-texte">{Math.round((p / total) * 100)} %</span>
          </p>
        ))}
      </div>
    </section>
  )
}
