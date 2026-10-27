import { useLiveQuery } from 'dexie-react-hooks'
import { depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Carte } from '../../../core/ui/Carte'
import { GraphiqueLignes, SERIES } from '../../../core/ui/graphiques'
import { suiviRepas } from './repas'

const jj = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })
const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : undefined)

/** Progrès : ce que j'ai mangé (journal du soir) face au besoin estimé, sur 4 semaines. */
export function SuiviRepas() {
  const lignes = useLiveQuery(() => suiviRepas(28))
  if (!lignes?.length) return null
  const remplis = lignes.filter((l) => l.repas?.kcal !== undefined)
  const sept = lignes.slice(-7).filter((l) => l.repas?.kcal !== undefined)
  const ecart = moyenne(sept.map((l) => l.repas!.kcal! - l.besoin))
  const prot = moyenne(remplis.filter((l) => l.repas?.proteines !== undefined).slice(-7).map((l) => l.repas!.proteines! / l.kg))

  return (
    <Carte titre="Ce que je mange">
      <p className="text-sm text-texte-2">
        {remplis.length} jour{remplis.length > 1 ? 's' : ''} renseigné{remplis.length > 1 ? 's' : ''} sur {lignes.length}
        {ecart !== undefined && <> · 7 derniers jours : <b className="text-texte">{ecart >= 0 ? '+' : ''}{formatNombre(ecart)} kcal/j</b> par rapport au besoin</>}
        {prot !== undefined && <> · protéines <b className="text-texte">{formatNombre(prot, 1)} g/kg</b></>}
      </p>
      {remplis.length >= 2 && (
        <div className="mt-2">
          <GraphiqueLignes etiquettes={lignes.map((l) => jj(l.jour))} series={[
            { nom: 'Mangé', couleur: SERIES[1], valeurs: lignes.map((l) => l.repas?.kcal) },
            { nom: 'Besoin estimé', couleur: SERIES[0], valeurs: lignes.map((l) => l.besoin), pointille: true },
          ]} />
        </div>
      )}
    </Carte>
  )
}
