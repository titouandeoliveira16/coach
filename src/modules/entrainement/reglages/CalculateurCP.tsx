import { useState } from 'react'
import { Bouton } from '../../../core/ui/Bouton'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatNombre } from '../../../core/format'
import { calculerCP } from '../calculs'

/** Durées du test 12-7-3 (minutes) */
const DUREES_MIN = [12, 7, 3]

/**
 * Calculateur du test CP 12-7-3 : on saisit la puissance moyenne
 * de chaque effort, on obtient CP et W′, puis on les enregistre.
 */
export function CalculateurCP({ onUtiliser }: { onUtiliser: (cpW: number, wPrimeKj: number) => void }) {
  const [puissances, setPuissances] = useState<(number | undefined)[]>([undefined, undefined, undefined])

  const efforts = DUREES_MIN.flatMap((min, i) => {
    const p = puissances[i]
    return p ? [{ dureeSec: min * 60, puissanceW: p }] : []
  })
  const resultat = calculerCP(efforts)

  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="mb-1 text-sm font-semibold">Test CP 12-7-3</p>
      <p className="mb-2 text-xs text-texte-3">Puissance moyenne de chaque effort maximal.</p>
      {DUREES_MIN.map((min, i) => (
        <ChampNombre
          key={min}
          libelle={`Effort ${min} min`}
          unite="W"
          decimales={0}
          valeur={puissances[i]}
          onValider={(v) => setPuissances((p) => p.map((x, j) => (j === i ? v : x)))}
        />
      ))}

      {resultat && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Resultat libelle="CP" valeur={`${formatNombre(resultat.cpW)} W`} />
            <Resultat libelle="W′" valeur={`${formatNombre(resultat.wPrimeKj, 1)} kJ`} />
            <Resultat libelle="R²" valeur={formatNombre(resultat.r2, 3)} />
          </div>
          {efforts.length === 3 && resultat.r2 < 0.99 && (
            <p className="text-xs text-argent">
              R² un peu bas : un des efforts n'était peut-être pas tout à fait maximal.
            </p>
          )}
          <Bouton onClick={() => onUtiliser(Math.round(resultat.cpW), Math.round(resultat.wPrimeKj * 10) / 10)}>
            Utiliser ces valeurs
          </Bouton>
        </div>
      )}
    </div>
  )
}

function Resultat({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-lg bg-surface p-2">
      <p className="text-xs text-texte-3">{libelle}</p>
      <p className="font-bold">{valeur}</p>
    </div>
  )
}
