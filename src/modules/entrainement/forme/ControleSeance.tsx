import { useState } from 'react'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { Aide } from '../../../core/ui/Aide'
import { bilanControle, type Controle } from '../../../metrics/controle'
import { AIDES } from '../aides'
import type { Seance } from '../types'

const SYMBOLE = { ok: '✅', bas: '⬇️', haut: '⬆️' } as const

/** Chaque bloc de la séance contre sa plage, avec la FC de fin de bloc et le ressenti (à saisir en touchant le bloc). */
export function ControleSeance({ s, famille }: { s: Seance & { controle: Controle }; famille: string }) {
  const [ouvert, setOuvert] = useState<number>()
  const c = s.controle
  const noterRpe = async (i: number, rpe: number) => {
    const lignes = c.lignes.map((l, j) => (j === i ? { ...l, rpe } : l))
    await enregistrer(db.seances, { ...s, controle: { ...c, lignes } })
    setOuvert(undefined)
  }
  return (
    <div className="mt-2 rounded-xl bg-surface-2 p-2.5 text-sm">
      <p className="font-semibold">{bilanControle(c, famille)}<Aide titre="Contrôle de la séance" texte={AIDES.controleSeance} /></p>
      <ul className="mt-1.5 space-y-1">
        {c.lignes.map((l, i) => (
          <li key={i}>
            <button type="button" onClick={() => setOuvert(ouvert === i ? undefined : i)} className="flex w-full items-center justify-between gap-2 text-left">
              <span className="text-texte-2">{SYMBOLE[l.verdict]} {l.libelle}</span>
              <span className="shrink-0 tabular-nums">
                <b>{l.w} W</b> <span className="text-texte-3">({l.wMin}-{l.wMax})</span>
                {l.fc && <span className="text-texte-3"> · {l.fc} bpm</span>}
                <span className="text-texte-3"> · RPE {l.rpe ?? '–'}</span>
              </span>
            </button>
            {ouvert === i && (
              <div className="mt-1 grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, n) => (
                  <button key={n} type="button" onClick={() => noterRpe(i, n)}
                    className={`rounded-md py-1.5 text-xs font-semibold ${l.rpe === n ? 'bg-accent text-fond' : 'bg-surface text-texte-2'}`}>{n}</button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {c.auDessusSeuil1 !== undefined && <p className="mt-1 text-xs text-texte-3">Au-dessus du 1er seuil : {Math.round(c.auDessusSeuil1 / 60)} min (5 max pour une vraie Z2).</p>}
      <p className="mt-1 text-xs text-texte-3">
        {c.parTours ? 'Moyennes de tes tours (comme sur ta montre ou Zwift).' : c.blocsParTours ? 'Blocs : moyennes de tes circuits (comme sur ta montre) ; le reste calculé sur ton fichier.' : 'Moyennes calculées sur ton fichier, recalé sur la séance prévue.'}
        {c.arretSec ? ` ${c.arretSec >= 90 ? `${Math.round(c.arretSec / 60)} min` : `${c.arretSec} s`} d'arrêt (pause, roue libre)${c.parTours || c.blocsParTours ? ' pendant la séance' : ` exclue${c.arretSec >= 90 ? 's' : ''} des moyennes`}.` : ''} Touche un bloc pour noter ton ressenti.
      </p>
    </div>
  )
}
