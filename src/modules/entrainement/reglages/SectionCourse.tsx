import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { formatMinSec, formatNombre, lireNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { alluresDepuisCourse } from '../../../metrics/course'
import { AIDES } from '../aides'
import { tableauAllures, texteAllure } from '../allures'
import { useReglagesEntrainement } from '../reglagesEntrainement'

const champ = 'w-20 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-center font-semibold outline-none focus:border-accent'

/** Lit "5'12", "5:12" ou "5 12" (minutes, secondes) → secondes. */
function lireTemps(texte: string) {
  const [m, s = '0'] = texte.trim().split(/[':\s]+/)
  const mm = lireNombre(m)
  const ss = lireNombre(s)
  return mm === undefined || ss === undefined ? undefined : mm * 60 + ss
}

/** Réglages course : course de référence (ex. test 1500 m) → allures Campus Coach. */
export function SectionCourse() {
  const [r, modifier] = useReglagesEntrainement()
  const [distance, setDistance] = useState('1500')
  const [temps, setTemps] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const lignes = tableauAllures(r.courseRef, r.vmaKmh, r.seuilCoursePct)
  const tempsSec = lireTemps(temps)
  const distanceM = lireNombre(distance)

  const enregistrer = () => {
    if (!tempsSec || !distanceM) return
    const a = alluresDepuisCourse(distanceM, tempsSec)
    const vma = Math.round(a.vmaKmh * 10) / 10
    modifier({
      courseRef: { date, distanceM, tempsSec },
      vmaKmh: vma,
      seuilCoursePct: (a.seuil60Kmh / a.vmaKmh) * 100,
      tests: [...r.tests, { date, type: 'vma', valeur: vma }],
    })
    setTemps('')
  }

  return (
    <Carte titre="Course à pied">
      {r.courseRef ? (
        <p className="text-sm text-texte-2">
          Référence : <span className="font-semibold text-texte">{formatNombre(r.courseRef.distanceM)} m en {formatMinSec(r.courseRef.tempsSec)}</span> le{' '}
          {depuisJour(r.courseRef.date).toLocaleDateString('fr-FR')}
        </p>
      ) : (
        <ChampNombre libelle="VMA (sans test)" unite="km/h" valeur={r.vmaKmh} onValider={(v) => modifier({ vmaKmh: v })} />
      )}

      <div className="mt-2 rounded-xl bg-surface-2 p-3">
        <p className="mb-2 text-sm font-semibold">Nouvelle course de référence (test 1500 m, 5 km…)</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input inputMode="numeric" aria-label="Distance (m)" value={distance} onChange={(e) => setDistance(e.target.value)} className={champ} />
          <span className="text-texte-3">m en</span>
          <input inputMode="decimal" aria-label="Temps (min'sec)" placeholder="5'10" value={temps} onChange={(e) => setTemps(e.target.value)} className={champ} />
          <input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-bordure bg-surface px-2 py-2" />
        </div>
        <Bouton className="mt-2" disabled={!tempsSec || !distanceM} onClick={enregistrer}>Calculer mes allures</Bouton>
      </div>

      {lignes && (
        <table className="mt-3 w-full text-right tabular-nums">
          <thead className="text-xs text-texte-3">
            <tr>
              <th className="py-1 text-left font-medium">Allure<Aide titre="Allures" texte={AIDES.allures} /></th>
              <th className="font-medium">km/h</th>
              <th className="font-medium">min/km</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.nom} className={`border-t border-bordure ${l.nom === 'Seuil 60' ? 'font-bold text-accent' : ''}`}>
                <td className="py-1.5 text-left">{l.nom}</td>
                <td>{l.kmh.filter((x): x is number => x !== undefined).map((x) => formatNombre(x, 1)).join('-')}</td>
                <td>{texteAllure(l).replace('/km', '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Carte>
  )
}
