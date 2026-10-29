import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { formatEuros, lireNombre } from '../../../core/format'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { enregistrerAbonnement, nouvelId, supprimerAbonnement } from '../donnees'
import type { Donnees } from '../calculs'
import type { Abonnement } from '../types'

const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'

/** Abonnements qui reviennent chaque mois : comptés d'avance, confirmés à la main le jour où ils passent. */
export function CarteAbonnements({ d }: { d: Donnees }) {
  const [ouvert, setOuvert] = useState<Abonnement>()
  const liste = [...(d.abonnements ?? [])].sort((a, b) => a.jour - b.jour)
  const nouveau = (): Abonnement => ({
    id: nouvelId(), nom: '', montant: 0, jour: Number(aujourdhui().slice(8)), actif: true, depuis: aujourdhui(),
    categorieId: d.categories.find((c) => c.genre === 'depense' && /abonnement/i.test(c.nom) && !c.parentId)?.id ?? '',
    compteId: d.comptes.find((c) => c.type === 'courant' && !c.archive)?.id ?? '',
  })
  return (
    <Carte titre="Abonnements">
      <p className="text-xs text-texte-3">Comptés d'avance dans ton reste à vivre et ta prévision. Le jour du prélèvement, l'appli te demande s'il est bien passé.</p>
      {liste.map((a) => (
        <button key={a.id} type="button" onClick={() => setOuvert(a)} className="flex w-full items-center justify-between py-2 text-left active:opacity-60">
          <span className={a.actif ? '' : 'text-texte-3 line-through'}>{a.nom}</span>
          <span className="text-sm text-texte-2">{formatEuros(a.montant)} · le {a.jour}</span>
        </button>
      ))}
      <button type="button" onClick={() => setOuvert(nouveau())} className="mt-1 w-full py-2 text-sm font-semibold text-accent">+ Ajouter un abonnement</button>
      {ouvert && <FicheAbonnement initial={ouvert} d={d} existe={liste.some((a) => a.id === ouvert.id)} onFermer={() => setOuvert(undefined)} />}
    </Carte>
  )
}

function FicheAbonnement({ initial, d, existe, onFermer }: { initial: Abonnement; d: Donnees; existe: boolean; onFermer: () => void }) {
  const [a, setA] = useState(initial)
  const [montant, setMontant] = useState(initial.montant ? String(initial.montant / 100).replace('.', ',') : '')
  const m = lireNombre(montant)
  const categories = d.categories.filter((c) => c.genre === 'depense' && !c.archive)
  const nomCat = (id: string) => {
    const c = d.categories.find((x) => x.id === id)
    const parent = c?.parentId ? d.categories.find((x) => x.id === c.parentId) : undefined
    return c ? `${c.emoji} ${parent ? `${parent.nom} · ` : ''}${c.nom}` : ''
  }
  const valide = a.nom.trim() && m && m > 0 && a.categorieId && a.compteId && a.jour >= 1 && a.jour <= 31
  return (
    <Feuille titre={existe ? a.nom : 'Nouvel abonnement'} onFermer={onFermer}>
      <div className="space-y-3">
        <input value={a.nom} onChange={(e) => setA({ ...a, nom: e.target.value })} placeholder="Nom (ex. Spotify)" className={champ} />
        <label className="flex items-center justify-between gap-3"><span className="text-texte-2">Montant (€)</span>
          <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" className={`${champ} w-28 text-right`} /></label>
        <label className="flex items-center justify-between gap-3"><span className="text-texte-2">Jour du prélèvement</span>
          <input value={a.jour} onChange={(e) => setA({ ...a, jour: Math.round(lireNombre(e.target.value) ?? 0) })} inputMode="numeric" className={`${champ} w-20 text-right`} /></label>
        <label className="block text-sm text-texte-2">Catégorie
          <select value={a.categorieId} onChange={(e) => setA({ ...a, categorieId: e.target.value })} className={champ}>
            <option value="">Choisir…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{nomCat(c.id)}</option>)}
          </select></label>
        <label className="block text-sm text-texte-2">Payé avec
          <select value={a.compteId} onChange={(e) => setA({ ...a, compteId: e.target.value })} className={champ}>
            {d.comptes.filter((c) => !c.archive).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select></label>
        <label className="flex items-center justify-between"><span className="text-texte-2">Actif</span>
          <input type="checkbox" checked={a.actif} onChange={(e) => setA({ ...a, actif: e.target.checked })} className="h-6 w-6 accent-[#facc15]" /></label>
        <Bouton disabled={!valide} onClick={async () => { await enregistrerAbonnement({ ...a, nom: a.nom.trim(), montant: Math.round(m! * 100) }); onFermer() }}>Enregistrer</Bouton>
        {existe && (
          <button type="button" className="w-full py-2 text-sm text-[#f87171]" onClick={async () => { await supprimerAbonnement(a.id); onFermer() }}>
            Supprimer (résilié) : les paiements déjà notés restent
          </button>
        )}
      </div>
    </Feuille>
  )
}
