import { useState } from 'react'
import { lireNombre } from '../../../core/format'
import type { ZoneVelo } from '../types'

interface Props {
  zones: ZoneVelo[]
  cpW?: number
  onModifier: (zones: ZoneVelo[]) => void
}

/** Tableau des zones vélo (watts, % CP, bpm), modifiable. */
export function ZonesVelo({ zones, cpW, onModifier }: Props) {
  const [edition, setEdition] = useState(false)

  const changer = (i: number, champ: keyof ZoneVelo, texte: string) => {
    const valeur = champ === 'nom' ? texte : lireNombre(texte)
    onModifier(zones.map((z, j) => (j === i ? { ...z, [champ]: valeur } : z)))
  }

  const pctCp = (w?: number) => (cpW && w !== undefined ? Math.round((w / cpW) * 100) : undefined)

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold">Zones</p>
        <button type="button" onClick={() => setEdition(!edition)} className="px-2 py-1 text-sm font-semibold text-accent">
          {edition ? 'Terminé' : 'Modifier'}
        </button>
      </div>

      {edition ? (
        <div className="space-y-2">
          {zones.map((z, i) => (
            <div key={i} className="rounded-xl bg-surface-2 p-2">
              <p className="mb-1 font-semibold">{z.nom}</p>
              <LignePlage libelle="Watts" min={z.wMin} max={z.wMax}
                onMin={(t) => changer(i, 'wMin', t)} onMax={(t) => changer(i, 'wMax', t)} />
              <LignePlage libelle="bpm" min={z.fcMin} max={z.fcMax}
                onMin={(t) => changer(i, 'fcMin', t)} onMax={(t) => changer(i, 'fcMax', t)} />
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-right tabular-nums">
          <thead className="text-xs text-texte-3">
            <tr>
              <th className="py-1 text-left font-medium">Zone</th>
              <th className="font-medium">Watts</th>
              {cpW && <th className="font-medium">% CP</th>}
              <th className="font-medium">bpm</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => (
              <tr key={i} className="border-t border-bordure">
                <td className="py-1.5 text-left font-semibold">{z.nom}</td>
                <td>{plage(z.wMin, z.wMax)}</td>
                {cpW && <td className="text-texte-2">{plage(pctCp(z.wMin), pctCp(z.wMax))}</td>}
                <td className="text-texte-2">{plage(z.fcMin, z.fcMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** "148–202", "> 674" ou "–" */
function plage(min?: number, max?: number) {
  if (min === undefined && max === undefined) return '–'
  if (max === undefined) return `> ${min}`
  return `${min ?? ''}–${max}`
}

function LignePlage(props: {
  libelle: string
  min?: number
  max?: number
  onMin: (t: string) => void
  onMax: (t: string) => void
}) {
  const champ = 'w-20 rounded-lg border border-bordure bg-surface px-2 py-1.5 text-right font-semibold outline-none focus:border-accent'
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-texte-2">{props.libelle}</span>
      <span className="flex items-center gap-2">
        <input inputMode="numeric" defaultValue={props.min ?? ''} onBlur={(e) => props.onMin(e.target.value)} className={champ} />
        <span className="text-texte-3">à</span>
        <input inputMode="numeric" defaultValue={props.max ?? ''} onBlur={(e) => props.onMax(e.target.value)} className={champ} />
      </span>
    </div>
  )
}
