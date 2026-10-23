import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatMinSec, formatNombre } from '../../../core/format'
import { POURCENTAGES_VMA, allureSecParKm, tempsSec } from '../calculs'
import { useReglagesEntrainement } from '../reglagesEntrainement'

/** Réglages course : VMA et tableau d'allures qui en découle. */
export function SectionCourse() {
  const [reglages, modifier] = useReglagesEntrainement()
  const vma = reglages.vmaKmh

  return (
    <Carte titre="Course à pied">
      <ChampNombre libelle="VMA" unite="km/h" valeur={vma} onValider={(v) => modifier({ vmaKmh: v })} />

      {vma && (
        <table className="mt-3 w-full text-right tabular-nums">
          <thead className="text-xs text-texte-3">
            <tr>
              <th className="py-1 text-left font-medium">% VMA</th>
              <th className="font-medium">km/h</th>
              <th className="font-medium">Allure</th>
              <th className="font-medium">400 m</th>
            </tr>
          </thead>
          <tbody>
            {POURCENTAGES_VMA.map((pct) => {
              const kmh = (vma * pct) / 100
              return (
                <tr key={pct} className={`border-t border-bordure ${pct === 100 ? 'font-bold text-accent' : ''}`}>
                  <td className="py-1.5 text-left">{pct} %</td>
                  <td>{formatNombre(kmh, 1)}</td>
                  <td>{formatMinSec(allureSecParKm(kmh))}/km</td>
                  <td>{formatMinSec(tempsSec(400, kmh))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Carte>
  )
}
