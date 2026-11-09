import { Aide } from '../../../core/ui/Aide'
import { bilanControle, type Controle } from '../../../metrics/controle'
import { AIDES } from '../aides'
import type { Seance } from '../types'

const SYMBOLE = { ok: '✅', bas: '⬇️', haut: '⬆️' } as const

/** Chaque bloc de la séance contre sa plage, avec sa FC (le ressenti se note une fois pour toute la séance). */
export function ControleSeance({ s, famille }: { s: Seance & { controle: Controle }; famille: string }) {
  const c = s.controle
  return (
    <div className="mt-2 rounded-xl bg-surface-2 p-2.5 text-sm">
      <p className="font-semibold">{bilanControle(c, famille)}<Aide titre="Contrôle de la séance" texte={AIDES.controleSeance} /></p>
      <ul className="mt-1.5 space-y-1">
        {c.lignes.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="text-texte-2">{SYMBOLE[l.verdict]} {l.libelle}</span>
            <span className="shrink-0 tabular-nums">
              <b>{l.w} W</b> <span className="text-texte-3">({l.wMin}-{l.wMax})</span>
              {l.fc && <span className="text-texte-3"> · {l.fc} bpm</span>}
            </span>
          </li>
        ))}
      </ul>
      {c.auDessusSeuil1 !== undefined && <p className="mt-1 text-xs text-texte-3">Au-dessus du 1er seuil : {Math.round(c.auDessusSeuil1 / 60)} min (5 max pour une vraie Z2).</p>}
      <p className="mt-1 text-xs text-texte-3">
        {c.parTours ? 'Moyennes de tes tours (comme sur ta montre ou Zwift).' : c.blocsParTours ? 'Blocs : moyennes de tes circuits (comme sur ta montre) ; le reste calculé sur ton fichier.' : 'Moyennes calculées sur ton fichier, recalé sur la séance prévue.'}
        {c.arretSec ? ` ${c.arretSec >= 90 ? `${Math.round(c.arretSec / 60)} min` : `${c.arretSec} s`} d'arrêt (pause, roue libre)${c.parTours || c.blocsParTours ? ' pendant la séance' : ` exclue${c.arretSec >= 90 ? 's' : ''} des moyennes`}.` : ''}
      </p>
    </div>
  )
}
