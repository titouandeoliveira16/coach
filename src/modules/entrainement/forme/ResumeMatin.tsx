import { Carte } from '../../../core/ui/Carte'
import { COULEURS_NOTE } from '../../../core/ui/ChoixNote'
import { formatNombre } from '../../../core/format'
import type { MesureMatin } from '../types'
import { QUESTIONS } from './donnees'

/** Résumé de la mesure du jour, une fois enregistrée. */
export function ResumeMatin({ mesure, onModifier }: { mesure: MesureMatin; onModifier: () => void }) {
  return (
    <Carte titre="Ton matin ✓">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Chiffre libelle="VFC" valeur={mesure.vfcMs} unite="ms" />
        <Chiffre libelle="FC repos" valeur={mesure.fcRepos} unite="bpm" />
        <Chiffre libelle="Sommeil" valeur={mesure.sommeilH} unite="h" decimales={1} />
      </div>
      <div className="mt-3 flex justify-between gap-1">
        {QUESTIONS.map((q) => {
          const n = mesure[q.cle]
          return (
            <div key={q.cle} className="flex-1 text-center">
              <div
                className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full font-bold text-fond"
                style={{ background: n ? COULEURS_NOTE[n - 1] : 'var(--color-surface-2)' }}
              >
                {n ?? '–'}
              </div>
              <p className="text-[11px] text-texte-3">{q.libelle}</p>
            </div>
          )
        })}
      </div>
      <button type="button" onClick={onModifier} className="mt-3 w-full py-2 text-sm font-semibold text-accent">
        Modifier
      </button>
    </Carte>
  )
}

function Chiffre({ libelle, valeur, unite, decimales = 0 }: { libelle: string; valeur?: number; unite: string; decimales?: number }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className="text-xs text-texte-3">{libelle}</p>
      <p className="text-2xl font-bold tabular-nums">
        {valeur !== undefined ? formatNombre(valeur, decimales) : '–'}
        <span className="ml-1 text-xs font-normal text-texte-3">{unite}</span>
      </p>
    </div>
  )
}
