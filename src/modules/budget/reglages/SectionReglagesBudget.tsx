import { useState } from 'react'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { COULEURS } from '../categoriesDepart'
import { enregistrerCategorie, nouvelId, useBudget, useReglagesBudget } from '../donnees'
import type { Categorie } from '../types'
import { CarteImport } from './CarteImport'
import { CarteRemiseAZero } from './CarteRemiseAZero'

const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'
/** Heures proposées pour le rappel : tous les quarts d'heure de 6 h à 23 h 45 */
const HEURES = Array.from({ length: 72 }, (_, i) => `${String(6 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

/** Réglages du module Budget : rappel de saisie et catégories. */
export function SectionReglagesBudget() {
  const d = useBudget()
  const [r, modifier] = useReglagesBudget()
  const [ouverte, setOuverte] = useState<Categorie>()
  const [archivees, setArchivees] = useState(false)
  if (!d) return null

  const nouvelle = (genre: Categorie['genre'], parentId?: string): Categorie => ({
    id: nouvelId(), nom: '', emoji: genre === 'revenu' ? '💰' : '🏷️', couleur: COULEURS[d.categories.length % COULEURS.length],
    genre, parentId, ordre: d.categories.length,
  })
  const liste = (genre: Categorie['genre']) => d.categories.filter((c) => c.genre === genre && !c.parentId && !c.archive)

  return (
    <>
      <Carte titre="Rappel de saisie (Budget)">
        <label className="flex items-center justify-between py-1.5">
          <span className="text-texte-2">Rappel chaque jour</span>
          <input type="checkbox" checked={r.rappelActif} onChange={(e) => modifier({ rappelActif: e.target.checked })} className="h-6 w-6 accent-[#facc15]" />
        </label>
        {r.rappelActif && (
          <label className="flex items-center justify-between py-1.5">
            <span className="text-texte-2">À</span>
            <select value={r.rappelHeure} onChange={(e) => modifier({ rappelHeure: e.target.value })} className="rounded-lg border border-bordure bg-surface-2 px-3 py-2 font-semibold">
              {HEURES.map((h) => <option key={h} value={h}>{h.replace(':', ' h ')}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center justify-between py-1.5">
          <span className="text-texte-2">Relevés des placements le 5 du mois à 9 h</span>
          <input type="checkbox" checked={r.rappelReleves !== false} onChange={(e) => modifier({ rappelReleves: e.target.checked })} className="h-6 w-6 accent-[#facc15]" />
        </label>
        <label className="flex items-center justify-between py-1.5">
          <span className="text-texte-2">Contrôle du solde du compte courant le dimanche</span>
          <input type="checkbox" checked={r.rappelControle !== false} onChange={(e) => modifier({ rappelControle: e.target.checked })} className="h-6 w-6 shrink-0 accent-[#facc15]" />
        </label>
        <p className="text-xs text-texte-3">Pas de rappel si tu as déjà saisi quelque chose ce jour-là. Le 1er du mois, tu reçois aussi l'annonce de ton bilan. Les notifications doivent être activées une fois pour toute l'appli : Accueil → ⚙️.</p>
      </Carte>

      {(['depense', 'revenu'] as const).map((genre) => (
        <Carte key={genre} titre={genre === 'depense' ? 'Catégories de dépenses' : 'Catégories de revenus'}>
          {liste(genre).map((c) => {
            const sous = d.categories.filter((s) => s.parentId === c.id && !s.archive)
            return (
              <button key={c.id} type="button" onClick={() => setOuverte(c)} className="flex w-full items-center gap-3 py-2 text-left active:opacity-60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: `color-mix(in srgb, ${c.couleur} 25%, transparent)` }}>{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.nom}{c.nature && <span className="ml-1 text-xs text-texte-3">{c.nature}</span>}{c.fixe && <span className="ml-1 text-xs text-texte-3">fixe</span>}</span>
                  {sous.length > 0 && <span className="block truncate text-xs text-texte-3">{sous.map((s) => s.nom).join(', ')}</span>}
                </span>
                <span className="text-texte-3">›</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setOuverte(nouvelle(genre))} className="mt-1 w-full py-2 text-sm font-semibold text-accent">+ Ajouter une catégorie</button>
        </Carte>
      ))}

      {d.categories.some((c) => c.archive && !c.parentId) && (
        <>
          <button type="button" onClick={() => setArchivees(!archivees)} className="w-full py-2 text-left text-sm font-semibold text-texte-3">{archivees ? '▾' : '▸'} Catégories archivées</button>
          {archivees && (
            <Carte>
              {d.categories.filter((c) => c.archive && !c.parentId).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5">
                  <span className="text-texte-2">{c.emoji} {c.nom}</span>
                  <button type="button" onClick={() => enregistrerCategorie({ ...c, archive: false })} className="text-sm font-semibold text-accent">Réactiver</button>
                </div>
              ))}
            </Carte>
          )}
        </>
      )}

      <CarteImport />
      <CarteRemiseAZero />

      {ouverte && <FicheCategorie initiale={ouverte} toutes={d.categories} nouvelle={nouvelle} onFermer={() => setOuverte(undefined)} />}
    </>
  )
}

function FicheCategorie({ initiale, toutes, nouvelle, onFermer }: {
  initiale: Categorie; toutes: Categorie[]; nouvelle: (g: Categorie['genre'], parentId?: string) => Categorie; onFermer: () => void
}) {
  const existe = toutes.some((c) => c.id === initiale.id)
  const [c, setC] = useState(initiale)
  const [sousNom, setSousNom] = useState('')
  const sous = toutes.filter((s) => s.parentId === c.id && !s.archive)
  const enregistrerSiExiste = (nv: Categorie) => {
    setC(nv)
    if (existe && nv.nom.trim()) enregistrerCategorie(nv)
  }

  return (
    <Feuille titre={existe ? `${c.emoji} ${c.nom}` : 'Nouvelle catégorie'} onFermer={onFermer}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={c.emoji} onChange={(e) => setC({ ...c, emoji: e.target.value })} onBlur={() => enregistrerSiExiste(c)}
            aria-label="Emoji" className={`${champ} w-16 text-center text-2xl`} />
          <input value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} onBlur={() => enregistrerSiExiste(c)} placeholder="Nom" className={champ} />
        </div>
        <div className="flex flex-wrap gap-2">
          {COULEURS.map((k) => (
            <button key={k} type="button" aria-label={`Couleur ${k}`} onClick={() => enregistrerSiExiste({ ...c, couleur: k })}
              className={`h-9 w-9 rounded-full ${c.couleur === k ? 'ring-2 ring-texte ring-offset-2 ring-offset-surface' : ''}`} style={{ background: k }} />
          ))}
        </div>
        {c.genre === 'depense' && !c.parentId && (
          <div className="flex items-center justify-between">
            <span className="text-texte-2">Pour la règle 50/30/20</span>
            <div className="flex rounded-lg bg-surface-2 p-0.5">
              {(['besoin', 'loisir'] as const).map((n) => (
                <button key={n} type="button" onClick={() => enregistrerSiExiste({ ...c, nature: c.nature === n ? undefined : n })}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${c.nature === n ? 'bg-accent text-fond' : 'text-texte-2'}`}>{n === 'besoin' ? 'Besoin' : 'Loisir'}</button>
              ))}
            </div>
          </div>
        )}
        {c.genre === 'depense' && (
          <label className="flex items-center justify-between">
            <span className="text-texte-2">Charge fixe (loyer, abonnements…)</span>
            <input type="checkbox" checked={!!c.fixe} onChange={(e) => enregistrerSiExiste({ ...c, fixe: e.target.checked })} className="h-6 w-6 accent-[#facc15]" />
          </label>
        )}

        {!existe ? (
          <Bouton disabled={!c.nom.trim()} onClick={async () => { await enregistrerCategorie({ ...c, nom: c.nom.trim() }); onFermer() }}>Créer</Bouton>
        ) : (
          <>
            {c.genre === 'depense' && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-texte-3">Sous-catégories (facultatif)</p>
                {sous.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5">
                    <span>{s.nom}</span>
                    <button type="button" onClick={() => enregistrerCategorie({ ...s, archive: true })} className="text-sm text-texte-3">Retirer</button>
                  </div>
                ))}
                <div className="mt-1 flex gap-2">
                  <input value={sousNom} onChange={(e) => setSousNom(e.target.value)} placeholder="ex. Vélo" className={champ} />
                  <button type="button" disabled={!sousNom.trim()} className="rounded-lg bg-surface-2 px-4 font-semibold disabled:opacity-40"
                    onClick={async () => {
                      await enregistrerCategorie({ ...nouvelle('depense', c.id), nom: sousNom.trim(), emoji: c.emoji, couleur: c.couleur })
                      setSousNom('')
                    }}>Ajouter</button>
                </div>
              </div>
            )}
            <Bouton variante="secondaire" onClick={async () => { await enregistrerCategorie({ ...c, archive: true }); onFermer() }}>Archiver la catégorie</Bouton>
            <p className="text-xs text-texte-3">Archiver la retire de la saisie ; les anciens mouvements la gardent.</p>
          </>
        )}
      </div>
    </Feuille>
  )
}
