import { useLiveQuery } from 'dexie-react-hooks'
import { jourCourt } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { intensiteANoter, noterResultat } from '../plan/programme'
import { db } from '../../../core/db'
import { Blocs } from './SeancesFaites'

/** Après une séance d'intensité du programme : blocs tenus ou non (fait avancer la progression). */
export function CarteResultat() {
  const p = useLiveQuery(intensiteANoter)
  const blocs = useLiveQuery(async () => (p ? (await db.seances.toArray()).find((s) => s.prevueId === p.id)?.blocs ?? null : null), [p?.id])
  if (!p) return null
  return (
    <Carte>
      <p className="text-sm text-texte-2">
        {jourCourt(p.date)} · <span className="font-semibold text-texte">{p.titre}</span>
      </p>
      {blocs && <Blocs b={blocs} />}
      <p className="mt-1">Tous les blocs tenus aux watts prévus ?<Aide titre="Progression" texte={AIDES.progression} /></p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => noterResultat(p, 'reussie')} className="rounded-xl border border-bordure py-2.5 font-semibold">✓ Oui, tout tenu</button>
        <button type="button" onClick={() => noterResultat(p, 'ratee')} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">✗ Pas tout</button>
      </div>
    </Carte>
  )
}
