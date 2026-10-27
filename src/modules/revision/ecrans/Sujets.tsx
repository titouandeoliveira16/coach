import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { formatNombre, lireNombre } from '../../../core/format'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { enregistrerSujet, supprimerSujet, useParametres, useRevision, type DonneesRevision } from '../donnees'
import { NOMS_THEMES } from '../programme'
import type { Epreuve, Sujet } from '../types'

const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'
const jjmm = (j: string) => depuisJour(j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Sujets (complets chronométrés, express) et mémoire de recherche. */
export function Sujets() {
  const d = useRevision()
  const [p, modifierP] = useParametres()
  const [ouvert, setOuvert] = useState<Partial<Sujet>>()
  if (!d) return null
  const dernier = d.sujets.find((s) => s.type === 'complet')
  const suivante: Epreuve = dernier?.epreuve === 'E1' ? 'E2' : 'E1'
  const notes = d.sujets.filter((s) => s.note !== undefined)
  const moyenne = (e: Epreuve) => {
    const l = notes.filter((s) => s.epreuve === e)
    return l.length ? l.reduce((a, s) => a + s.note!, 0) / l.length : undefined
  }

  return (
    <div className="space-y-3 pt-1 pb-4">
      <Carte titre="Prochain sujet complet">
        <p>Plutôt un sujet d'<b>{suivante === 'E1' ? 'écrit 1' : 'écrit 2'}</b> (on alterne), en variant {suivante === 'E1' ? 'T1, T2 et T3' : 'théorie et blocs'}.</p>
        <p className="mt-1 text-sm text-texte-3">Complet : 5 h chronométrées puis 1 h de correction et fiche d'erreurs. Express (mercredi) : plan + introduction en 1 h 30.</p>
        <Bouton className="mt-3" onClick={() => setOuvert({ epreuve: suivante, type: 'complet', dureeMin: 300 })}>+ Noter un sujet</Bouton>
        {notes.length > 0 && (
          <p className="mt-2 text-sm text-texte-2">Moyennes : écrit 1 {moyenne('E1') !== undefined ? `${formatNombre(moyenne('E1'), 1)}/20` : '–'} · écrit 2 {moyenne('E2') !== undefined ? `${formatNombre(moyenne('E2'), 1)}/20` : '–'}</p>
        )}
      </Carte>

      {d.sujets.length > 0 && (
        <Carte titre="Mes sujets">
          {d.sujets.map((s) => (
            <button key={s.id} type="button" onClick={() => setOuvert(s)} className="flex w-full items-center justify-between gap-3 py-2 text-left active:opacity-60">
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.type === 'express' ? '⚡' : '⏱️'} {s.intitule || (s.epreuve === 'E1' ? 'Écrit 1' : 'Écrit 2')}</span>
                <span className="block text-xs text-texte-3">{jjmm(s.date)} · {s.epreuve === 'E1' ? 'É1' : 'É2'}{s.notionsFaibles.length ? ` · ${s.notionsFaibles.length} notion(s) faible(s)` : ''}</span>
              </span>
              {s.note !== undefined && <b className="shrink-0">{formatNombre(s.note, 1)}/20</b>}
            </button>
          ))}
        </Carte>
      )}

      <Carte titre="📝 Mémoire de recherche">
        <p className="text-sm text-texte-2">Une demi-journée par semaine de vacances (le mercredi après-midi), seulement pendant les vacances.</p>
        {d.memoire.length > 0 && (
          <ul className="mt-2 text-sm">
            {[...d.memoire].sort((a, b) => b.id.localeCompare(a.id)).map((m) => (
              <li key={m.id} className="py-0.5">{m.fait ? '✅' : '○'} {jjmm(m.id)}{m.objectif ? ` · ${m.objectif}` : ''}</li>
            ))}
          </ul>
        )}
        <label className="mt-2 flex items-center gap-3">
          <input type="checkbox" checked={!!p.memoireEnvoye} onChange={(e) => modifierP({ memoireEnvoye: e.target.checked })} className="h-6 w-6 accent-[#60a5fa]" />
          <span>Document envoyé au tuteur <span className="text-texte-3">(visé le {depuisJour(p.memoireEnvoi).toLocaleDateString('fr-FR')})</span></span>
        </label>
      </Carte>

      {ouvert && <FicheSujet initial={ouvert} d={d} onFermer={() => setOuvert(undefined)} />}
    </div>
  )
}

function FicheSujet({ initial, d, onFermer }: { initial: Partial<Sujet>; d: DonneesRevision; onFermer: () => void }) {
  const [s, setS] = useState<Sujet>({ id: crypto.randomUUID(), date: aujourdhui(), epreuve: 'E1', type: 'complet', notionsFaibles: [], ...initial })
  const [note, setNote] = useState(initial.note !== undefined ? formatNombre(initial.note, 1) : '')
  const [duree, setDuree] = useState(initial.dureeMin ? String(initial.dureeMin) : '')
  const existe = d.sujets.some((x) => x.id === s.id)
  const vues = d.notions.filter((n) => n.statut === 'finie' && n.epreuve === s.epreuve)
  const basculer = (id: string) => setS({ ...s, notionsFaibles: s.notionsFaibles.includes(id) ? s.notionsFaibles.filter((x) => x !== id) : [...s.notionsFaibles, id] })

  return (
    <Feuille titre={existe ? 'Sujet' : 'Nouveau sujet'} onFermer={onFermer}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['E1', 'E2'] as const).map((e) => (
            <button key={e} type="button" onClick={() => setS({ ...s, epreuve: e, notionsFaibles: [] })}
              className={`flex-1 rounded-lg py-2 font-semibold ${s.epreuve === e ? 'bg-accent text-fond' : 'bg-surface-2 text-texte-2'}`}>{e === 'E1' ? 'Écrit 1' : 'Écrit 2'}</button>
          ))}
          {(['complet', 'express'] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setS({ ...s, type: t }); setDuree(t === 'express' ? '90' : '300') }}
              className={`flex-1 rounded-lg py-2 font-semibold ${s.type === t ? 'bg-accent text-fond' : 'bg-surface-2 text-texte-2'}`}>{t === 'complet' ? 'Complet' : 'Express'}</button>
          ))}
        </div>
        <input value={s.intitule ?? ''} onChange={(e) => setS({ ...s, intitule: e.target.value })} placeholder="Sujet ou thème (ex. « L'élève et l'effort »)" className={champ} />
        <div className="flex gap-2">
          <input type="date" value={s.date} onChange={(e) => e.target.value && setS({ ...s, date: e.target.value })} className={`${champ} w-auto`} />
          <input value={duree} inputMode="numeric" onChange={(e) => setDuree(e.target.value)} placeholder="Durée (min)" className={champ} />
          <input value={note} inputMode="decimal" onChange={(e) => setNote(e.target.value)} placeholder="Note /20" className={champ} />
        </div>
        <div>
          <p className="text-sm text-texte-2">Notions faibles dans ce sujet <span className="text-texte-3">(rappel ciblé demain)</span></p>
          {vues.length === 0 ? <p className="text-sm text-texte-3">Aucune notion de cet écrit apprise pour l'instant.</p> : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {vues.map((n) => (
                <button key={n.id} type="button" onClick={() => basculer(n.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${s.notionsFaibles.includes(n.id) ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface-2 text-texte-2'}`}>{n.nom}</button>
              ))}
            </div>
          )}
        </div>
        <textarea value={s.remarques ?? ''} onChange={(e) => setS({ ...s, remarques: e.target.value })} placeholder="Points faibles, remarques (fiche d'erreurs)" rows={3} className={champ} />
        <Bouton onClick={async () => {
          const n = lireNombre(note)
          const dm = lireNombre(duree)
          await enregistrerSujet({ ...s, ...(n !== undefined ? { note: n } : {}), ...(dm !== undefined ? { dureeMin: dm } : {}) })
          onFermer()
        }}>Enregistrer</Bouton>
        {existe && <button type="button" onClick={async () => { await supprimerSujet(s.id); onFermer() }} className="w-full py-2 text-sm text-[#f87171]">Supprimer</button>}
        <p className="text-xs text-texte-3">{NOMS_THEMES.T1.split(' · ')[0]}–T3 pour l'écrit 1, théorie et blocs pour l'écrit 2 : varie les thèmes d'un sujet à l'autre.</p>
      </div>
    </Feuille>
  )
}
