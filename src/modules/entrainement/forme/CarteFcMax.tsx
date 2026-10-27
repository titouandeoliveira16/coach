import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db'
import { formatDate } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { enregistrer } from '../../../core/stockage'
import { Carte } from '../../../core/ui/Carte'
import { fcMaxObservee } from './fcMax'

/** Nouvelle FC max vue dans une séance (au-dessus de celle du profil) : la prendre ? */
export function CarteFcMax() {
  const [profil, modifierProfil] = useProfil()
  const vue = useLiveQuery(fcMaxObservee)
  const ignoree = useLiveQuery(async () => ((await db.reglages.get('fcMaxIgnoree'))?.valeur as number | undefined) ?? null)
  if (!vue || ignoree === undefined || !profil.fcMax || vue.fc <= profil.fcMax || ignoree === vue.fc) return null
  return (
    <Carte titre="❤️ Nouvelle FC max">
      <p className="text-sm text-texte-2">
        <b className="text-texte">{vue.fc} bpm</b> vu le {formatDate(vue.date).slice(0, 5)} ({vue.titre}), plus que ta FC max réglée ({profil.fcMax}).
        {vue.isolee && " C'est un pic isolé : si ta ceinture a pu décrocher, ignore-le."}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => modifierProfil({ fcMax: vue.fc })} className="rounded-xl bg-accent py-2.5 font-semibold text-fond">La prendre</button>
        <button type="button" onClick={() => enregistrer(db.reglages, { id: 'fcMaxIgnoree', valeur: vue.fc })} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Ignorer</button>
      </div>
    </Carte>
  )
}
