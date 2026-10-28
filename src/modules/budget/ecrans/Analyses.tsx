import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { formatEuros } from '../../../core/format'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { GraphiqueBarres, GraphiqueLignes } from '../../../core/ui/graphiques'
import { Puces } from '../../../core/ui/Puces'
import { Bilan } from '../Bilan'
import { debutSuivi, depensesParCategorie, derniersMois, moisCourt, moisDe, nomMois, patrimoineParMois, resumeMois } from '../calculs'
import { useBudget } from '../donnees'

const PERIODES = ['6 mois', '12 mois'] as const
/** Montants courts pour les axes : "850 €", "1,2 k€", "13 k€" */
const euros = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(n) >= 10000 ? 0 : 1 })} k€` : `${Math.round(n)} €`
/** Valeurs touchées : au centime près */
const eurosExacts = (n: number) => formatEuros(Math.round(n * 100))

/** Graphiques sur 6 ou 12 mois et bilans des mois passés. */
export function Analyses() {
  const d = useBudget()
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]>('6 mois')
  const [bilan, setBilan] = useState<string>()
  if (!d) return null
  const jour = aujourdhui()
  const actuel = moisDe(jour)
  const debut = moisDe(debutSuivi(d.comptes) ?? jour)
  // On ne montre pas les mois d'avant le début du suivi
  const mois = derniersMois(actuel, periode === '6 mois' ? 6 : 12).filter((m) => m >= debut)
  const courbes = mois.length >= 2
  const attente = <p className="py-6 text-center text-sm text-texte-3">La courbe apparaîtra le mois prochain (il faut au moins 2 mois).</p>
  const etiquettes = mois.map(moisCourt)
  const resumes = mois.map((m) => resumeMois(d, m))

  // Dépenses par catégorie : les 5 plus grosses sur la période, le reste dans « Autres »
  const parMois = mois.map((m) => depensesParCategorie(d.mouvements, d.categories, m))
  const totaux = new Map<string, number>()
  for (const pm of parMois) for (const [id, v] of pm) totaux.set(id, (totaux.get(id) ?? 0) + v)
  const top = [...totaux.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)
  const seriesCat = [
    ...top.map((id) => {
      const c = d.categories.find((x) => x.id === id)
      return { nom: c ? `${c.emoji} ${c.nom}` : 'Sans catégorie', couleur: c?.couleur ?? '#94a3b8', valeurs: parMois.map((pm) => (pm.get(id) ?? 0) / 100) }
    }),
    ...(totaux.size > 5 ? [{ nom: 'Autres', couleur: '#6b7380', valeurs: parMois.map((pm) => [...pm].filter(([id]) => !top.includes(id)).reduce((s, [, v]) => s + v, 0) / 100) }] : []),
  ]
  const passes = derniersMois(actuel, 12).filter((m) => m < actuel && m >= debut).reverse()

  return (
    <div className="space-y-3 pt-2">
      <Puces options={PERIODES} valeur={periode} onChoisir={(p) => p && setPeriode(p)} effacable={false} />

      <Carte titre="Revenus et dépenses">
        {courbes ? (
          <GraphiqueLignes etiquettes={etiquettes} zero format={eurosExacts} formatAxe={euros} series={[
            { nom: 'Revenus', couleur: '#199e70', valeurs: resumes.map((r) => r.revenus / 100) },
            { nom: 'Dépenses', couleur: '#d95926', valeurs: resumes.map((r) => r.depenses / 100) },
          ]} />
        ) : (
          attente
        )}
      </Carte>

      <Carte titre="Dépenses par catégorie">
        <GraphiqueBarres etiquettes={etiquettes} series={seriesCat} format={eurosExacts} formatAxe={euros} />
      </Carte>

      <Carte titre="Patrimoine">
        {!courbes ? attente : <GraphiqueLignes etiquettes={etiquettes} format={eurosExacts} formatAxe={euros}
          series={[{ nom: 'Patrimoine', couleur: '#facc15', valeurs: patrimoineParMois(d, mois, jour).map((v) => (v === undefined ? undefined : v / 100)) }]} />}
      </Carte>

      <Carte titre="Investi chaque mois">
        <GraphiqueBarres etiquettes={etiquettes} format={eurosExacts} formatAxe={euros} series={[{ nom: 'Investi', couleur: '#3987e5', valeurs: resumes.map((r) => r.investi / 100) }]} />
      </Carte>

      <Carte titre="Bilans mensuels">
        {passes.length === 0 && <p className="text-sm text-texte-3">Le premier bilan arrivera le 1er du mois prochain.</p>}
        {passes.map((m) => {
          const r = resumeMois(d, m)
          return (
            <button key={m} type="button" onClick={() => setBilan(m)} className="flex w-full items-center justify-between py-2 text-left active:opacity-60">
              <span className="capitalize">{nomMois(m)}</span>
              <span className="text-sm text-texte-2">{formatEuros(r.revenus - r.depenses, { signe: true })} ›</span>
            </button>
          )
        })}
      </Carte>

      {bilan && (
        <Feuille titre={`Bilan de ${nomMois(bilan)}`} onFermer={() => setBilan(undefined)}>
          <Bilan d={d} mois={bilan} />
        </Feuille>
      )}
    </div>
  )
}
