import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { annulerFinie, commencerNotion, finirNotion, modifierNotion, useRevision, type DonneesRevision } from '../donnees'
import { NOMS_THEMES } from '../programme'
import type { Notion, Theme } from '../types'
import { libelleRappel } from '../ui'

const jjmm = (j: string) => depuisJour(j).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
const GROUPES: { titre: string; themes: Theme[]; epreuve: 'E1' | 'E2' }[] = [
  { titre: 'Écrit 1', themes: ['T1', 'T2', 'T3'], epreuve: 'E1' },
  { titre: 'Écrit 2', themes: ['Théorie', 'Blocs'], epreuve: 'E2' },
]
const COULEURS_NIVEAU = { 1: '#f87171', 2: '#fb923c', 3: '#4ade80' }

/** Suivi des 41 notions : statut, J0, niveau ; toucher une notion montre ses rappels. */
export function Notions() {
  const d = useRevision()
  const [ouverte, setOuverte] = useState<string>()
  if (!d) return null
  const finies = d.notions.filter((n) => n.statut === 'finie').length
  const notion = d.notions.find((n) => n.id === ouverte)

  return (
    <div className="space-y-3 pt-1 pb-4">
      <div>
        <div className="flex justify-between text-sm"><span className="text-texte-2">Apprises</span><b>{finies} / 41</b></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${(finies / 41) * 100}%` }} /></div>
      </div>
      {GROUPES.map((g) => (
        <section key={g.titre} className="space-y-2">
          <h2 className="pt-2 text-lg font-bold">{g.titre}</h2>
          {g.themes.map((t) => (
            <Carte key={t} titre={NOMS_THEMES[t]}>
              {d.notions.filter((n) => n.epreuve === g.epreuve && n.theme === t).map((n) => (
                <button key={n.id} type="button" onClick={() => setOuverte(n.id)} className="flex w-full items-center gap-3 py-1.5 text-left active:opacity-60">
                  <span className="w-5 text-center">{n.statut === 'finie' ? '✅' : n.statut === 'en-cours' ? '📖' : '○'}</span>
                  <span className={`min-w-0 flex-1 truncate ${n.statut === 'a-faire' ? 'text-texte-2' : ''}`}>{n.nom}</span>
                  {n.j0 && <span className="text-xs text-texte-3">{jjmm(n.j0)}</span>}
                  {n.niveau && n.statut === 'finie' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEURS_NIVEAU[n.niveau] }} />}
                </button>
              ))}
            </Carte>
          ))}
        </section>
      ))}
      <p className="text-center text-xs text-texte-3">Point de couleur : niveau d'après ton dernier rappel (vert solide, orange moyen, rouge fragile).</p>
      {notion && <FicheNotion n={notion} d={d} onFermer={() => setOuverte(undefined)} />}
    </div>
  )
}

function FicheNotion({ n, d, onFermer }: { n: Notion; d: DonneesRevision; onFermer: () => void }) {
  const [date, setDate] = useState(aujourdhui())
  const rappels = d.rappels.filter((r) => r.notionId === n.id && !r.annule).sort((a, b) => a.prevu.localeCompare(b.prevu))
  return (
    <Feuille titre={n.nom} onFermer={onFermer}>
      <p className="text-sm text-texte-3">{n.epreuve === 'E1' ? 'Écrit 1' : 'Écrit 2'} · {NOMS_THEMES[n.theme]} · notion {n.ordre}/41</p>
      {n.statut === 'finie' ? (
        <>
          <p className="mt-2">Finie le <b>{depuisJour(n.j0!).toLocaleDateString('fr-FR')}</b>{n.fixation ? ' · feuille blanche faite' : ''}</p>
          <ul className="mt-2 text-sm">
            {rappels.map((r) => (
              <li key={r.id} className="flex justify-between py-1">
                <span className="text-texte-2">{libelleRappel(r)} · {jjmm(r.prevu)}</span>
                <span>{r.fait ? `${r.resultat === 'su' ? '✅ su' : r.resultat === 'hesitant' ? '🟠 hésitant' : '🔁 raté'} le ${jjmm(r.fait)}` : <span className="text-texte-3">à venir</span>}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-texte-2">Niveau</span>
            <div className="flex gap-1">
              {([1, 2, 3] as const).map((v) => (
                <button key={v} type="button" onClick={() => modifierNotion({ ...n, niveau: v })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${n.niveau === v ? 'text-fond' : 'bg-surface-2 text-texte-2'}`}
                  style={n.niveau === v ? { background: COULEURS_NIVEAU[v] } : undefined}>{['Fragile', 'Moyen', 'Solide'][v - 1]}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={async () => { await annulerFinie(n); onFermer() }} className="mt-4 w-full py-2 text-sm text-texte-3">Pas finie en fait (annuler)</button>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          {n.statut === 'a-faire' && <Bouton variante="secondaire" onClick={async () => { await commencerNotion(n); onFermer() }}>L'apprendre maintenant</Bouton>}
          <div className="flex gap-2">
            <input type="date" value={date} max={aujourdhui()} onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-bordure bg-surface-2 px-3 py-2" />
            <Bouton onClick={async () => { await finirNotion(n, date); onFermer() }}>Finie ce jour-là</Bouton>
          </div>
          <p className="text-xs text-texte-3">Le jour où tu l'as finie devient son J0 : ses 6 rappels partent de là.</p>
        </div>
      )}
    </Feuille>
  )
}
