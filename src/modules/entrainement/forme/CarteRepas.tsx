import { useState } from 'react'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { formatNombre, lireNombre } from '../../../core/format'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import type { JournalRepas } from '../../../core/db'
import { enregistrerRepas, kcalDesMacros } from './repas'

const CHAMPS = [
  { cle: 'kcal', nom: 'Calories', unite: 'kcal' },
  { cle: 'proteines', nom: 'Protéines', unite: 'g' },
  { cle: 'glucides', nom: 'Glucides', unite: 'g' },
  { cle: 'lipides', nom: 'Lipides', unite: 'g' },
] as const

export function Formulaire({ jour, titre, existante, onFini }: { jour: string; titre: string; existante?: JournalRepas; onFini: () => void }) {
  const [textes, setTextes] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHAMPS.map((c) => [c.cle, existante?.[c.cle] !== undefined ? formatNombre(existante[c.cle]) : ''])))
  const valeurs = Object.fromEntries(CHAMPS.map((c) => [c.cle, lireNombre(textes[c.cle])])) as Omit<JournalRepas, 'date'>
  const kcalCalcule = kcalDesMacros(valeurs)
  const kcal = valeurs.kcal ?? kcalCalcule

  return (
    <Carte titre={titre}>
      <p className="mb-2 text-sm text-texte-2">Recopie le total de la journée (depuis ton appli de suivi), gels et boissons d’effort compris. Les macros suffisent : les calories se calculent.</p>
      <div className="grid grid-cols-2 gap-2">
        {CHAMPS.map((c) => (
          <label key={c.cle} className="rounded-xl bg-surface-2 px-3 py-2">
            <span className="block text-xs text-texte-3">{c.nom} ({c.unite})</span>
            <input inputMode="decimal" value={textes[c.cle]} onChange={(e) => setTextes({ ...textes, [c.cle]: e.target.value })}
              placeholder={c.cle === 'kcal' && kcalCalcule ? String(kcalCalcule) : '–'}
              className="w-full bg-transparent text-xl font-bold outline-none" />
          </label>
        ))}
      </div>
      <Bouton className="mt-3" disabled={kcal === undefined} onClick={async () => {
        await enregistrerRepas({ date: jour, ...valeurs, kcal })
        onFini()
      }}>Enregistrer</Bouton>
      <button type="button" className="mt-1 w-full py-2 text-sm text-texte-3" onClick={async () => {
        await enregistrerRepas({ date: jour, nonRenseigne: true })
        onFini()
      }}>Pas renseigné {jour === aujourdhui() ? "aujourd'hui" : jour === decalerJour(aujourdhui(), -1) ? 'hier' : jour === decalerJour(aujourdhui(), -2) ? 'avant-hier' : 'ce jour-là'}</button>
    </Carte>
  )
}
