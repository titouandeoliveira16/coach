import { Link, useSearchParams } from 'react-router-dom'
import { aujourdhui } from '../../../core/dates'
import { formatEuros } from '../../../core/format'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { EnTete } from '../../../core/ui/EnTete'
import { moisDe, nomMois, plafondDe } from '../calculs'
import { enregistrerCategorie, fixerPlafond, useBudget } from '../donnees'
import type { Categorie } from '../types'
import { NavMois } from '../ui'

/** Plafonds mensuels par catégorie, séparés en charges fixes et dépenses variables. */
export function Plafonds() {
  const d = useBudget()
  const [params, setParams] = useSearchParams()
  const actuel = moisDe(aujourdhui())
  const mois = params.get('mois') ?? actuel
  if (!d) return null
  const principales = d.categories.filter((c) => c.genre === 'depense' && !c.parentId && !c.archive)
  const total = (liste: Categorie[]) => liste.reduce((s, c) => s + (plafondDe(c.id, mois, d.plafonds) ?? 0), 0)
  const groupes = [
    { titre: 'Charges fixes', liste: principales.filter((c) => c.fixe) },
    { titre: 'Dépenses variables', liste: principales.filter((c) => !c.fixe) },
  ]

  return (
    <>
      <EnTete titre="Plafonds" />
      <div className="space-y-3 px-4">
        <NavMois mois={mois} onChanger={(m) => setParams({ mois: m }, { replace: true })} />
        <p className="text-sm text-texte-2">
          Un changement vaut pour <b className="text-texte">{nomMois(mois)}</b> et les mois suivants ; les mois d'avant gardent leurs plafonds.
          Chaque nouveau mois reprend ceux du mois précédent.
        </p>
        {groupes.map((g) => (
          <Carte key={g.titre} titre={`${g.titre} · ${formatEuros(total(g.liste), { ronds: true })}`}>
            {g.liste.length === 0 && <p className="text-sm text-texte-3">Aucune.</p>}
            {g.liste.map((c) => (
              <div key={c.id}>
                <ChampNombre libelle={`${c.emoji} ${c.nom}`} unite="€" decimales={2}
                  valeur={(plafondDe(c.id, mois, d.plafonds) ?? 0) / 100 || undefined}
                  onValider={(v) => fixerPlafond(c.id, mois, v ? Math.round(v * 100) : null)} />
                <button type="button" onClick={() => enregistrerCategorie({ ...c, fixe: !c.fixe })} className="-mt-1 mb-1 text-xs text-texte-3">
                  {c.fixe ? '→ passer en dépense variable' : '→ passer en charge fixe'}
                </button>
              </div>
            ))}
          </Carte>
        ))}
        <p className="text-center text-sm text-texte-2">Total des plafonds : <b className="text-texte">{formatEuros(total(principales), { ronds: true })}</b></p>
        <Link to="/budget/mois" className="block py-2 text-center text-sm text-accent">‹ Retour</Link>
      </div>
    </>
  )
}
