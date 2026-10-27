import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { formatNombre } from '../../../core/format'
import { Carte } from '../../../core/ui/Carte'
import { GraphiqueLignes, SERIES } from '../../../core/ui/graphiques'
import { DUREES_COURBE } from '../../../metrics/puissance'

const NOMS = ['1 s', '2 s', '5 s', '10 s', '20 s', '30 s', '1 min', '2 min', '5 min', '10 min', '20 min', '30 min', '1 h', '2 h']
/** Durées clés affichées en chiffres sous la courbe */
const CLES = [1, 5, 60, 300, 1200, 3600]
const date = (j: string) => depuisJour(j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })

interface Effort {
  w: number
  date: string
}

/**
 * Courbe de puissance : meilleure moyenne tenue sur chaque durée (record, et 6 dernières semaines).
 * Les records viennent des séances de l'appli, et des records importés une fois (ex. Garmin), gardés dans tes données.
 */
/** Records importés (durée en s → watts et date), réglage synchronisé « recordsPuissance ». */
export type RecordsImportes = Record<string, { w: number; date: string }>
export function CourbePuissance() {
  const seances = useLiveQuery(() => db.seances.filter((s) => s.sport === 'velo' && !!s.meilleurs).toArray())
  const importes = useLiveQuery(async () => ((await db.reglages.get('recordsPuissance'))?.valeur as RecordsImportes | undefined) ?? {})
  if (!seances || !importes) return null
  const depuis = decalerJour(aujourdhui(), -42)
  const meilleur = (d: number, recent: boolean): Effort | undefined => {
    const efforts: Effort[] = seances
      .filter((s) => !recent || s.date > depuis)
      .flatMap((s) => (s.meilleurs?.[d] ? [{ w: s.meilleurs[d], date: s.date }] : []))
    const garmin = importes[d]
    if (garmin && (!recent || garmin.date > depuis)) efforts.push(garmin)
    return efforts.reduce<Effort | undefined>((m, e) => (!m || e.w > m.w ? e : m), undefined)
  }
  const record = DUREES_COURBE.map((d) => meilleur(d, false))
  const recent = DUREES_COURBE.map((d) => meilleur(d, true))
  if (!record.some(Boolean)) return null

  return (
    <Carte titre="Courbe de puissance">
      <GraphiqueLignes etiquettes={NOMS} format={(n) => `${Math.round(n)}`} series={[
        { nom: 'Record', couleur: SERIES[1], valeurs: record.map((e) => e?.w) },
        { nom: '6 dernières semaines', couleur: SERIES[0], valeurs: recent.map((e) => e?.w), pointille: true },
      ]} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {CLES.map((d) => {
          const i = DUREES_COURBE.indexOf(d as (typeof DUREES_COURBE)[number])
          return (
            <div key={d} className="rounded-xl bg-surface-2 py-2">
              <p className="text-xs text-texte-3">{NOMS[i]}</p>
              <p className="text-lg font-bold tabular-nums">{record[i] ? `${formatNombre(record[i]!.w)} W` : '–'}</p>
              <p className="text-[11px] text-texte-3">{record[i] ? date(record[i]!.date) : ' '}</p>
              <p className="text-[11px] text-texte-3">{recent[i] ? `6 sem. : ${formatNombre(recent[i]!.w)}` : '6 sem. : –'}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-texte-3">Record : meilleure puissance moyenne tenue sur chaque durée (séances de l'appli et records importés). Touche la courbe pour les autres durées.</p>
    </Carte>
  )
}
