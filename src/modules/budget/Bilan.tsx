import { Link } from 'react-router-dom'
import { formatEuros } from '../../core/format'
import { bilanMois, decalerMois, nomMois, repartition503020, type Donnees } from './calculs'

/** Bilan d'un mois : totaux, écarts avec le mois précédent, plafonds dépassés, patrimoine, et les petites tâches du mois. */
export function Bilan({ d, mois, rituel = false }: { d: Donnees; mois: string; rituel?: boolean }) {
  const b = bilanMois(d, mois)
  const cat = (id: string) => d.categories.find((c) => c.id === id)
  const nom = (id: string) => (cat(id) ? `${cat(id)!.emoji} ${cat(id)!.nom}` : 'Sans catégorie')
  const ligne = (libelle: string, valeur: number, opts?: { signe?: boolean }) => (
    <div className="flex justify-between py-0.5"><span className="text-texte-2">{libelle}</span><span className="font-semibold tabular-nums">{formatEuros(valeur, opts)}</span></div>
  )
  const rep = repartition503020(d, mois)
  const pct = (v: number) => `${Math.round((v / rep.revenus) * 100)} %`
  const evolution = b.patrimoineDebut !== undefined ? b.patrimoineFin - b.patrimoineDebut : undefined

  return (
    <div className="space-y-3 text-sm">
      <div>
        {ligne('Revenus', b.resume.revenus)}
        {ligne('Dépenses', b.resume.depenses)}
        {ligne('Revenus − dépenses', b.solde, { signe: true })}
        {ligne('Épargné (livrets)', b.resume.epargne)}
        {ligne('Investi', b.resume.investi)}
      </div>

      {rep.revenus > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-texte-3">Règle 50/30/20 (part des revenus)</p>
          <p className="flex justify-between"><span className="text-texte-2">Besoins <span className="text-texte-3">(repère 50 %)</span></span><span className="font-semibold">{pct(rep.besoins)}</span></p>
          <p className="flex justify-between"><span className="text-texte-2">Loisirs <span className="text-texte-3">(repère 30 %)</span></span><span className="font-semibold">{pct(rep.loisirs)}</span></p>
          <p className="flex justify-between"><span className="text-texte-2">Épargne et investissement <span className="text-texte-3">(repère 20 %)</span></span><span className="font-semibold">{pct(rep.epargne)}</span></p>
          {rep.autres > 0 && <p className="flex justify-between"><span className="text-texte-2">À catégoriser</span><span className="font-semibold">{pct(rep.autres)}</span></p>}
        </div>
      )}

      {(b.hausses.length > 0 || b.baisses.length > 0) && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-texte-3">Par rapport à {nomMois(decalerMois(mois, -1))}</p>
          {b.hausses.map((h) => <p key={h.categorieId} className="flex justify-between"><span>↗ {nom(h.categorieId)}</span><span className="text-[#fb923c]">{formatEuros(h.ecart, { signe: true })}</span></p>)}
          {b.baisses.map((h) => <p key={h.categorieId} className="flex justify-between"><span>↘ {nom(h.categorieId)}</span><span className="text-[#4ade80]">{formatEuros(h.ecart)}</span></p>)}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-texte-3">Plafonds</p>
        {b.depassees.length === 0 ? <p className="text-texte-2">✅ Aucun plafond dépassé.</p> : b.depassees.map((x) => (
          <p key={x.categorieId} className="flex justify-between"><span>🔴 {nom(x.categorieId)}</span><span>{formatEuros(x.depense)} / {formatEuros(x.plafond)}</span></p>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-texte-3">Patrimoine</p>
        <p className="flex justify-between"><span className="text-texte-2">Fin du mois</span><span className="font-semibold">{formatEuros(b.patrimoineFin)}</span></p>
        {evolution !== undefined && <p className="flex justify-between"><span className="text-texte-2">Sur le mois</span><span className="font-semibold" style={{ color: evolution >= 0 ? '#4ade80' : '#f87171' }}>{formatEuros(evolution, { signe: true })}</span></p>}
      </div>

      {rituel && (
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="font-semibold">Pour bien démarrer le mois :</p>
          <Link to="/budget/patrimoine" className="mt-1 block text-accent">📈 Le 5 : relevés de tes placements (PEA, CTO, Bricks) ›</Link>
          <Link to="/budget/plafonds" className="mt-1 block text-accent">🎯 Ajuste tes plafonds si besoin ›</Link>
        </div>
      )}
    </div>
  )
}

