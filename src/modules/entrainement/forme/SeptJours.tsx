import { Carte } from '../../../core/ui/Carte'
import { COULEURS_NOTE } from '../../../core/ui/ChoixNote'
import { jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import type { MesureMatin } from '../types'
import { moyenne, scoreRessenti } from './donnees'

/** Les 7 derniers jours : VFC, FC de repos et ressenti, avec les moyennes. */
export function SeptJours({ mesures }: { mesures: MesureMatin[] }) {
  if (mesures.length === 0) return null
  const vfc = moyenne(mesures, 'vfcMs')
  const fc = moyenne(mesures, 'fcRepos')

  return (
    <Carte titre="7 derniers jours">
      <table className="w-full text-right tabular-nums">
        <thead className="text-xs text-texte-3">
          <tr>
            <th className="py-1 text-left font-medium">Jour</th>
            <th className="font-medium">VFC</th>
            <th className="font-medium">FC repos</th>
            <th className="font-medium">Ressenti</th>
          </tr>
        </thead>
        <tbody>
          {mesures.map((m) => {
            const score = scoreRessenti(m)
            return (
              <tr key={m.date} className="border-t border-bordure">
                <td className="py-1.5 text-left capitalize text-texte-2">{jourCourt(m.date)}</td>
                <td>{m.vfcMs ?? '–'}</td>
                <td>{m.fcRepos ?? '–'}</td>
                <td>
                  {score !== undefined ? (
                    <span className="font-semibold" style={{ color: COULEURS_NOTE[Math.round(score) - 1] }}>
                      {formatNombre(score, 1)}
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-bordure font-bold">
            <td className="py-1.5 text-left">Moyenne</td>
            <td>{vfc ? formatNombre(vfc.valeur) : '–'}</td>
            <td>{fc ? formatNombre(fc.valeur) : '–'}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </Carte>
  )
}
