import { useLiveQuery } from 'dexie-react-hooks'
import { Trophy } from 'lucide-react'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { db } from '../../../core/db'

const DUREES: [number, string][] = [[5, '5 s'], [60, '1 min'], [300, '5 min'], [1200, '20 min']]

/** Tes records de puissance (5 s, 1 min, 5 min, 20 min) en 4 tuiles (maquette V5). */
export function Records() {
  const records = useLiveQuery(async () => {
    const seances = await db.seances.filter((s) => s.sport === 'velo' && !!s.meilleurs).toArray()
    const importes = ((await db.reglages.get('recordsPuissance'))?.valeur as Record<string, { w: number; date: string }> | undefined) ?? {}
    return DUREES.map(([d, nom]) => {
      let best = importes[d] ? { w: importes[d].w, date: importes[d].date } : undefined
      for (const s of seances) {
        const w = s.meilleurs?.[d]
        if (w && (!best || w > best.w)) best = { w, date: s.date }
      }
      return { nom, best }
    })
  })
  if (!records?.some((r) => r.best)) return null
  return (
    <section className="entree rounded-[14px] bg-surface p-4">
      <h2 className="etiquette mb-2 flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5 text-accent" strokeWidth={2} />Mes records</h2>
      <div className="grid grid-cols-4 gap-1.5">
        {records.map((r) => (
          <div key={r.nom} className="rounded-[10px] bg-surface-2 p-2">
            <p className="text-[11px] text-texte-3">{r.nom}</p>
            <p className="chiffre text-base">{r.best ? `${r.best.w}` : '–'}<span className="text-[11px] font-normal text-texte-3"> W</span></p>
            {r.best && <p className="text-[10px] text-texte-3">{depuisJour(r.best.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

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
