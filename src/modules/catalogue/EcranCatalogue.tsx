import { useState } from 'react'
import { EnTete } from '../../core/ui/EnTete'
import { CATALOGUE, NOMS_FAMILLES, NOMS_SPORTS, PREUVES, sansAccents, type SeanceCatalogue } from './donnees'
import { Fiche } from './Fiche'

type Sport = SeanceCatalogue['sport']
const SPORTS = Object.keys(NOMS_SPORTS) as Sport[]

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${actif ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface text-texte-2'}`}>
      {children}
    </button>
  )
}

/** Catalogue scientifique de séances : filtres par sport, qualité et niveau de preuve, recherche. */
export function EcranCatalogue() {
  const [sport, setSport] = useState<Sport | undefined>()
  const [famille, setFamille] = useState<string>()
  const [preuve, setPreuve] = useState<string>()
  const [texte, setTexte] = useState('')
  const S = CATALOGUE.seances
  const familles = [...new Set(S.filter((s) => !sport || s.sport === sport).map((s) => s.famille))]
  const t = sansAccents(texte.trim())
  const liste = S.filter((s) => (!sport || s.sport === sport) && (!famille || s.famille === famille) && (!preuve || s.preuve.niveau === preuve)
    && (!t || sansAccents([s.nom, s.resume, s.objectif, ...s.preuve.references.map((r) => r.auteurs)].join(' ')).includes(t)))

  return (
    <>
      <EnTete titre="Catalogue">
        <p className="mt-1 text-sm text-texte-2">{S.length} séances appuyées sur la science · {liste.length} affichée{liste.length > 1 ? 's' : ''}</p>
      </EnTete>
      <div className="space-y-3 px-4 pb-6">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <Puce actif={!sport} onClick={() => { setSport(undefined); setFamille(undefined) }}>Tout</Puce>
          {SPORTS.map((sp) => <Puce key={sp} actif={sport === sp} onClick={() => { setSport(sp); setFamille(undefined) }}>{NOMS_SPORTS[sp]}</Puce>)}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <Puce actif={!famille} onClick={() => setFamille(undefined)}>Toutes qualités</Puce>
          {familles.map((f) => <Puce key={f} actif={famille === f} onClick={() => setFamille(f)}>{NOMS_FAMILLES[f] ?? f}</Puce>)}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <Puce actif={!preuve} onClick={() => setPreuve(undefined)}>Toute preuve</Puce>
          {PREUVES.map((p) => <Puce key={p} actif={preuve === p} onClick={() => setPreuve(p)}>{p}</Puce>)}
        </div>
        <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Rechercher : 30/15, Rønnestad, côte, genoux…"
          className="w-full rounded-xl border border-bordure bg-surface px-3 py-2.5 outline-none focus:border-accent" />
        {SPORTS.filter((sp) => liste.some((s) => s.sport === sp)).map((sp) => (
          <section key={sp} className="space-y-2">
            <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-texte-3">{NOMS_SPORTS[sp]}</h2>
            {liste.filter((s) => s.sport === sp).map((s) => <Fiche key={s.id} s={s} />)}
          </section>
        ))}
        {!liste.length && <p className="py-8 text-center text-texte-3">Aucune séance pour ces filtres.</p>}
        <p className="pt-2 text-xs text-texte-3">
          Vélo en % de la CP (≈ FTP), course en % de la VMA. Prouvé : essai contrôlé ou méta-analyse · plausible : données partielles ·
          mitigé : études contradictoires · pratique : méthode d'entraîneur sans essai dédié.
        </p>
      </div>
    </>
  )
}
