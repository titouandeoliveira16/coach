import { Carte } from '../../../core/ui/Carte'

/** Tableau de bord : volumes semaine / mois. Contenu à l'étape 6. */
export function Bord() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Carte titre="Semaine">
        <p className="text-3xl font-bold">0 h</p>
      </Carte>
      <Carte titre="Mois">
        <p className="text-3xl font-bold">0 h</p>
      </Carte>
      <div className="col-span-2">
        <Carte>
          <p className="text-sm text-texte-3">Le tableau de bord arrive à l'étape 6.</p>
        </Carte>
      </div>
    </div>
  )
}
