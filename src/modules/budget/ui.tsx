import { formatEuros, formatDate } from '../../core/format'
import { decalerMois, nomMois, type CouleurJauge } from './calculs'
import type { Categorie, Compte, Mouvement } from './types'
import { ICONES_MOUVEMENT, IconeCategorie, iconeDe } from './IconeCategorie'

/** Couleurs d'état (jauges, alertes) : les mêmes que le feu du jour. */
export const ETAT: Record<CouleurJauge, string> = { vert: 'var(--color-bon)', orange: 'var(--color-attention)', rouge: 'var(--color-mauvais)' }

/** « ‹ octobre 2026 › » */
export function NavMois({ mois, onChanger, max }: { mois: string; onChanger: (m: string) => void; max?: string }) {
  const suivant = decalerMois(mois, 1)
  return (
    <div className="flex items-center justify-between py-1">
      <button type="button" onClick={() => onChanger(decalerMois(mois, -1))} className="px-4 py-2 text-2xl text-texte-2" aria-label="Mois précédent">‹</button>
      <p className="font-semibold capitalize">{nomMois(mois)}</p>
      <button type="button" disabled={!!max && suivant > max} onClick={() => onChanger(suivant)} className="px-4 py-2 text-2xl text-texte-2 disabled:opacity-20" aria-label="Mois suivant">›</button>
    </div>
  )
}

/** Libellé, icône et montant signé d'un mouvement. */
export function decrireMouvement(m: Mouvement, categories: Categorie[], comptes: Compte[]) {
  const cat = categories.find((c) => c.id === m.categorieId)
  const parent = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : undefined
  const nomCompte = (id?: string) => comptes.find((c) => c.id === id)?.nom ?? '?'
  switch (m.type) {
    case 'depense':
      return { icone: cat ? iconeDe(cat.emoji) : ICONES_MOUVEMENT.depense, titre: parent ? `${parent.nom} · ${cat!.nom}` : cat?.nom ?? 'Dépense', montant: formatEuros(-m.montant), couleur: 'var(--color-texte)' }
    case 'revenu': {
      const pour = m.rembourse ? categories.find((c) => c.id === m.rembourse) : undefined
      return { icone: cat ? iconeDe(cat.emoji) : ICONES_MOUVEMENT.revenu, titre: pour ? `Remboursement · ${pour.nom}` : cat?.nom ?? 'Revenu', montant: formatEuros(m.montant, { signe: true }), couleur: ETAT.vert }
    }
    case 'virement':
      return { icone: ICONES_MOUVEMENT.virement, titre: `${nomCompte(m.compteId)} → ${nomCompte(m.versCompteId)}`, montant: formatEuros(m.montant), couleur: 'var(--color-texte-3)' }
    case 'investissement':
      return { icone: ICONES_MOUVEMENT.investissement, titre: `Investi · ${nomCompte(m.versCompteId)}`, montant: formatEuros(m.montant), couleur: '#60a5fa' }
  }
}

/** Une ligne de la liste des mouvements. */
export function LigneMouvement({ m, categories, comptes, onToucher, avecDate }: {
  m: Mouvement; categories: Categorie[]; comptes: Compte[]; onToucher: () => void; avecDate?: boolean
}) {
  const d = decrireMouvement(m, categories, comptes)
  const compte = comptes.find((c) => c.id === m.compteId)
  const sousTitre = [avecDate && formatDate(m.date), m.note, (m.type === 'depense' || m.type === 'revenu') && compte?.type !== 'courant' && compte?.nom]
    .filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={onToucher} className="flex w-full items-center gap-3 py-2 text-left active:opacity-60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-texte-2"><IconeCategorie icone={d.icone} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{d.titre}</span>
        {sousTitre && <span className="block truncate text-sm text-texte-3">{sousTitre}</span>}
      </span>
      <span className="shrink-0 font-semibold tabular-nums" style={{ color: d.couleur }}>{d.montant}</span>
    </button>
  )
}

/**
 * Petite jauge horizontale. `repere` (0-1) : où tu devrais en être aujourd'hui si tu dépensais au même rythme
 * tout le mois (ex. 0,5 le 15 d'un mois de 30 jours), un trait fin.
 */
export function Jauge({ part, couleur, repere }: { part: number; couleur: string; repere?: number }) {
  return (
    <div className="relative h-2 rounded-full bg-surface-2">
      <div className="h-full rounded-full" style={{ width: `${Math.min(part, 1) * 100}%`, background: couleur }} />
      {repere !== undefined && repere > 0 && repere < 1 && (
        <div aria-hidden className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-texte-2" style={{ left: `calc(${repere * 100}% - 1px)` }} />
      )}
    </div>
  )
}
