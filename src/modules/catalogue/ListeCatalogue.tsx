import { useState } from 'react'
import { CATALOGUE, NOMS_FAMILLES, NOMS_SPORTS, sansAccents, type SeanceCatalogue } from './donnees'
import { Fiche } from './Fiche'

type Sport = SeanceCatalogue['sport']

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${actif ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface-2 text-texte-2'}`}>
      {children}
    </button>
  )
}

/**
 * Catalogue scientifique, limité aux sports pratiqués (profil sportif) : à ouvrir dans les Réglages, sans changer de page.
 * Filtres : sport (s'il y en a plusieurs), qualité travaillée, recherche.
 */
export function ListeCatalogue({ sports }: { sports: Sport[] }) {
  const [sport, setSport] = useState<Sport>()
  const [famille, setFamille] = useState<string>()
  const [texte, setTexte] = useState('')
  // Enduro et descente mis de côté : on cache les séances qui ne servent qu'à eux
  const autorises = CATALOGUE.seances.filter((s) => sports.includes(s.sport) && !(s.disciplines?.length && s.disciplines.every((d) => d === 'enduro' || d === 'dh')))
  const choisis = autorises.filter((s) => !sport || s.sport === sport)
  const familles = [...new Set(choisis.map((s) => s.famille))]
  const t = sansAccents(texte.trim())
  const liste = choisis.filter((s) => (!famille || s.famille === famille)
    && (!t || sansAccents([s.nom, s.resume, s.objectif, ...s.preuve.references.map((r) => r.auteurs)].join(' ')).includes(t)))

  return (
    <div className="space-y-2.5">
      {sports.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          <Puce actif={!sport} onClick={() => { setSport(undefined); setFamille(undefined) }}>Tous</Puce>
          {sports.map((sp) => <Puce key={sp} actif={sport === sp} onClick={() => { setSport(sp); setFamille(undefined) }}>{NOMS_SPORTS[sp]}</Puce>)}
        </div>
      )}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        <Puce actif={!famille} onClick={() => setFamille(undefined)}>Toutes qualités</Puce>
        {familles.map((f) => <Puce key={f} actif={famille === f} onClick={() => setFamille(f)}>{NOMS_FAMILLES[f] ?? f}</Puce>)}
      </div>
      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Rechercher : 30/15, Rønnestad, genoux…"
        className="w-full rounded-xl border border-bordure bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent" />
      <p className="text-xs text-texte-3">{liste.length} séance{liste.length > 1 ? 's' : ''} appuyée{liste.length > 1 ? 's' : ''} sur la science. Touche une séance pour voir son détail.</p>
      {liste.map((s) => <Fiche key={s.id} s={s} />)}
      {!liste.length && <p className="py-4 text-center text-sm text-texte-3">Aucune séance pour ces filtres.</p>}
    </div>
  )
}
