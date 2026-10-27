import type { Etape } from '../../../metrics/programme'

const horloge = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}'${s ? String(s).padStart(2, '0') : '00'}`
}
const duree = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}'${sec % 60 ? String(sec % 60).padStart(2, '0') : ''}` : `${sec}"`)

/** Déroulé minute par minute d'une séance vélo (à suivre sur le compteur). */
export function Deroule({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="mt-2 divide-y divide-bordure rounded-xl bg-surface-2 text-sm">
      {etapes.map((e, i) => (
        <li key={i} className="flex gap-2 px-2.5 py-2">
          <span className="w-11 shrink-0 tabular-nums text-texte-3">{horloge(e.debutSec)}</span>
          <span className="min-w-0 flex-1">
            {e.libelle}
            {e.dureeSec > 0 && <span className="text-texte-3"> · {duree(e.dureeSec)}</span>}
          </span>
          {e.dureeSec > 0 && <span className="shrink-0 font-semibold tabular-nums">{e.w ? `${e.w} W` : 'à fond'}</span>}
        </li>
      ))}
    </ol>
  )
}
