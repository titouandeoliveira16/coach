import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { GraphiqueLignes } from '../../../core/ui/graphiques'
import { AIDES_MUSCU } from '../aides'
import type { EtatMuscu } from '../donnees'

const kg = (n: number) => `${formatNombre(n, 1)} kg`

/** Progrès : max estimé séance après séance, et chaque cycle (référence, reps à 95 %). */
export function Progres({ e }: { e: EtatMuscu }) {
  const avecMax = e.seances.filter((s) => s.maxEstime)
  const cycles = [...new Set(e.seances.map((s) => s.cycle))].reverse()
  if (!e.seances.length) return <Carte><p className="text-texte-2">Tes progrès apparaîtront après ta première séance.</p></Carte>

  return (
    <div className="space-y-3">
      {avecMax.length >= 2 && (
        <Carte titre="Max estimé">
          <GraphiqueLignes etiquettes={avecMax.map((s) => s.date.slice(8, 10) + '/' + s.date.slice(5, 7))}
            series={[{ nom: 'Max estimé', couleur: '#a78bfa', valeurs: avecMax.map((s) => s.maxEstime) }]} format={kg} />
          <p className="mt-1 text-xs text-texte-3">D'après ta série « + » de chaque séance.<Aide titre="Max estimé" texte={AIDES_MUSCU.maxEstime} /></p>
        </Carte>
      )}
      <Carte titre="Cycles">
        <ul className="space-y-2 text-sm">
          {cycles.map((c) => {
            const l = e.seances.filter((s) => s.cycle === c)
            const s3 = l.find((s) => s.semaine === 3)?.plus
            const meilleur = Math.max(0, ...l.map((s) => s.maxEstime ?? 0))
            return (
              <li key={c} className="flex justify-between gap-2">
                <span>Cycle {c} <span className="text-texte-3">· {l.length}/4 séances</span></span>
                <span className="text-right text-texte-2">
                  réf. <b className="text-texte">{kg(l[0].reference)}</b>
                  {s3 && <> · {s3.reps} rep{s3.reps > 1 ? 's' : ''} à 95 %</>}
                  {meilleur > 0 && <> · max ≈ {kg(meilleur)}</>}
                </span>
              </li>
            )
          })}
        </ul>
      </Carte>
    </div>
  )
}
