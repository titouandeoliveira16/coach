import { moisDuRevenu, soldeAu, type Donnees } from './calculs'

const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',')
const cellule = (t: string | undefined) => `"${(t ?? '').replace(/"/g, '""')}"`

/**
 * Export CSV (séparateur « ; », montants en euros avec virgule, lisible dans Numbers ou Excel) :
 * comptes et leur solde du jour, contrôles / relevés, puis tous les mouvements du plus ancien au plus récent.
 */
export function exporterCsv(d: Donnees, jour: string) {
  const compte = (id?: string) => d.comptes.find((c) => c.id === id)?.nom ?? ''
  const categorie = (id?: string) => {
    const c = d.categories.find((x) => x.id === id)
    const p = c?.parentId ? d.categories.find((x) => x.id === c.parentId) : undefined
    return c ? `${p ? `${p.nom} / ` : ''}${c.nom}` : ''
  }
  const lignes: string[] = ['COMPTES', 'compte;type;départ;solde au jour']
  for (const c of d.comptes) lignes.push([cellule(c.nom), c.type, c.dateDepart, euros(soldeAu(c, d.mouvements, d.releves, jour))].join(';'))
  lignes.push('', 'CONTRÔLES ET RELEVÉS', 'date;compte;valeur;écart;note')
  for (const r of [...d.releves].sort((a, b) => a.date.localeCompare(b.date)))
    lignes.push([r.date, cellule(compte(r.compteId)), euros(r.valeur), r.ecart !== undefined ? euros(r.ecart) : '', cellule(r.note)].join(';'))
  lignes.push('', 'MOUVEMENTS', 'date;type;montant;compte;vers;catégorie;note;compté pour le mois')
  for (const m of [...d.mouvements].sort((a, b) => a.date.localeCompare(b.date)))
    lignes.push([m.date, m.type, euros(m.montant), cellule(compte(m.compteId)), cellule(compte(m.versCompteId)), cellule(categorie(m.categorieId)), cellule(m.note),
      m.type === 'revenu' ? moisDuRevenu(m.date) : m.date.slice(0, 7)].join(';'))
  return `﻿${lignes.join('\n')}\n`
}
