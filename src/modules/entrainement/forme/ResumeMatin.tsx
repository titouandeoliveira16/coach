import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { analyserSommeil, enHeures, SEUILS_DEFAUT } from '../../../metrics/signal'
import { AIDES } from '../aides'
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
      <LigneSommeil date={mesure.date} />
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

/** Sommeil : moyenne 7 jours, comparée au repère (8 h, ou ta moyenne habituelle si elle est plus haute). */
function LigneSommeil({ date }: { date: string }) {
  const s = useLiveQuery(async () => {
    const m = await db.mesures.where('date').between(decalerJour(date, -40), date, true, true).toArray()
    return analyserSommeil(m.map((x) => ({ date: x.date, h: x.sommeilH })), date)
  }, [date])
  if (!s?.moyenne7) return null
  const repere = Math.max(8, s.moyenne30 ?? 0)
  const bas = s.moyenne7 < SEUILS_DEFAUT.moyenne7MinH || (s.moyenne30 !== undefined && s.moyenne7 < s.moyenne30 - SEUILS_DEFAUT.ecartPersoH)
  return (
    <p className="mt-2 text-center text-sm text-texte-2">
      Sommeil sur 7 j : <b className={bas ? 'text-[#fb923c]' : 'text-texte'}>{enHeures(s.moyenne7)}</b> · repère {enHeures(repere)}
      <Aide titre="Sommeil" texte={AIDES.sommeil} />
    </p>
  )
}
