import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { formatEuros } from '../../../core/format'
import { Puces } from '../../../core/ui/Puces'
import { moisDe, racine } from '../calculs'
import { DetailMouvement } from '../DetailMouvement'
import { useBudget } from '../donnees'
import type { Mouvement, TypeMouvement } from '../types'
import { LigneMouvement, NavMois, decrireMouvement } from '../ui'

const TYPES = ['Dépenses', 'Revenus', 'Virements', 'Investissements'] as const
const TYPE_DE: Record<(typeof TYPES)[number], TypeMouvement> = { Dépenses: 'depense', Revenus: 'revenu', Virements: 'virement', Investissements: 'investissement' }
const select = 'min-w-0 flex-1 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm outline-none'

const sansAccents = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Liste des mouvements, mois par mois (ou tout), avec filtres et recherche. */
export function Mouvements() {
  const d = useBudget()
  const actuel = moisDe(aujourdhui())
  const [mois, setMois] = useState<string | undefined>(actuel)
  const [type, setType] = useState<(typeof TYPES)[number]>()
  const [categorie, setCategorie] = useState('')
  const [compte, setCompte] = useState('')
  const [recherche, setRecherche] = useState('')
  const [detail, setDetail] = useState<Mouvement>()
  if (!d) return null

  const mots = sansAccents(recherche.trim())
  const liste = d.mouvements.filter((m) => {
    if (mois && moisDe(m.date) !== mois) return false
    if (type && m.type !== TYPE_DE[type]) return false
    if (categorie && m.categorieId !== categorie && racine(m.categorieId, d.categories) !== categorie) return false
    if (compte && m.compteId !== compte && m.versCompteId !== compte) return false
    if (mots) {
      const texte = sansAccents(`${decrireMouvement(m, d.categories, d.comptes).titre} ${m.note ?? ''} ${(m.montant / 100).toFixed(2).replace('.', ',')}`)
      if (!texte.includes(mots)) return false
    }
    return true
  })
  const total = (t: TypeMouvement) => liste.filter((m) => m.type === t).reduce((s, m) => s + m.montant, 0)
  const parJour = new Map<string, Mouvement[]>()
  for (const m of liste) parJour.set(m.date, [...(parJour.get(m.date) ?? []), m])

  return (
    <div className="space-y-3">
      {mois ? <NavMois mois={mois} onChanger={setMois} max={actuel} /> : <p className="py-3 text-center font-semibold">Toute la période</p>}
      <div className="flex gap-2">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Rechercher (note, catégorie, montant)"
          className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface-2 px-3 py-2 outline-none focus:border-accent" />
        <button type="button" onClick={() => setMois(mois ? undefined : actuel)}
          className={`shrink-0 rounded-lg border px-3 text-sm font-semibold ${mois ? 'border-bordure bg-surface-2 text-texte-2' : 'border-accent bg-accent text-fond'}`}>Tout</button>
      </div>
      <Puces options={TYPES} valeur={type} onChoisir={setType} />
      <div className="flex gap-2">
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={select}>
          <option value="">Toutes catégories</option>
          {d.categories.filter((c) => !c.parentId).map((c) => (
            <optgroup key={c.id} label={`${c.emoji} ${c.nom}`}>
              <option value={c.id}>{c.emoji} {c.nom}{c.genre === 'revenu' ? ' (revenu)' : ''}</option>
              {d.categories.filter((s) => s.parentId === c.id).map((s) => <option key={s.id} value={s.id}>  └ {s.nom}</option>)}
            </optgroup>
          ))}
        </select>
        <select value={compte} onChange={(e) => setCompte(e.target.value)} className={select}>
          <option value="">Tous comptes</option>
          {d.comptes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <div className="flex justify-between rounded-xl bg-surface px-4 py-2.5 text-sm">
        <span className="text-texte-2">Dépenses <b className="text-texte">{formatEuros(total('depense'))}</b></span>
        <span className="text-texte-2">Revenus <b className="text-[#4ade80]">{formatEuros(total('revenu'))}</b></span>
      </div>

      {liste.length === 0 && <p className="py-8 text-center text-texte-3">Aucun mouvement.</p>}
      {[...parJour.entries()].map(([jour, ms]) => (
        <section key={jour}>
          <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-texte-3">
            {new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          {ms.map((m) => <LigneMouvement key={m.id} m={m} categories={d.categories} comptes={d.comptes} onToucher={() => setDetail(m)} />)}
        </section>
      ))}
      {detail && <DetailMouvement m={detail} onFermer={() => setDetail(undefined)} />}
    </div>
  )
}
