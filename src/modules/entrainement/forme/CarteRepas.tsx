import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { formatNombre, lireNombre } from '../../../core/format'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import type { JournalRepas } from '../../../core/db'
import { besoinsDe, lireReglagesNutrition, modifierReglagesNutrition } from './besoins'
import { ETALEMENT_MAX_JOUR } from '../../../metrics/nutrition'
import { enregistrerRepas, jourARemplir, kcalDesMacros } from './repas'

const CHAMPS = [
  { cle: 'kcal', nom: 'Calories', unite: 'kcal' },
  { cle: 'proteines', nom: 'Protéines', unite: 'g' },
  { cle: 'glucides', nom: 'Glucides', unite: 'g' },
  { cle: 'lipides', nom: 'Lipides', unite: 'g' },
] as const

/** Le soir (dès 18 h) : ce que tu as mangé aujourd'hui. Le lendemain matin, rattrapage de la veille si oubliée. */
export function CarteRepas() {
  const cible = useLiveQuery(() => jourARemplir())
  const besoins = useLiveQuery(async () => (cible ? besoinsDe(cible.jour) : undefined), [cible?.jour])
  const nutrition = useLiveQuery(lireReglagesNutrition)
  const [edition, setEdition] = useState(false)
  if (!cible) return null
  const titre = cible.jour === aujourdhui() ? '🍽️ Ton assiette du jour' : "🍽️ Ton assiette d'hier"

  if (cible.saisie && !edition) {
    const r = cible.saisie
    return (
      <Carte titre={titre}>
        {r.nonRenseigne ? (
          <p className="text-texte-2">Pas renseigné ce jour-là.</p>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums">
              {formatNombre(r.kcal)} kcal
              {besoins && r.kcal !== undefined && <span className="ml-2 text-base font-normal text-texte-2">besoin ≈ {formatNombre(besoins.kcal)} ({r.kcal >= besoins.kcal ? '+' : ''}{formatNombre(r.kcal - besoins.kcal)})</span>}
            </p>
            <p className="mt-1 text-sm text-texte-2">
              {[['P', r.proteines, besoins?.proteines], ['G', r.glucides, besoins?.glucides], ['L', r.lipides, besoins?.lipides]]
                .filter(([, v]) => v !== undefined).map(([n, v, c]) => `${n} ${formatNombre(v as number)} g${c ? ` / ${c}` : ''}`).join(' · ')}
            </p>
          </>
        )}
        {besoins && nutrition && !r.nonRenseigne && r.kcal !== undefined && r.kcal - besoins.kcal >= 500 &&
          !nutrition.etalements?.some((e) => e.date === cible.jour) && !nutrition.etalementsRefuses?.includes(cible.jour) && (
          <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
            <p>
              +{formatNombre(r.kcal - besoins.kcal)} kcal par rapport à ton besoin : rien de grave, c'est la moyenne de la semaine qui compte.
              Étaler {formatNombre(Math.min(r.kcal - besoins.kcal, 1000))} kcal sur tes prochains jours faciles (−{ETALEMENT_MAX_JOUR} max par jour, jamais un jour de séance dure) ?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-lg bg-accent py-2 font-semibold text-fond"
                onClick={() => modifierReglagesNutrition({ etalements: [...(nutrition.etalements ?? []), { date: cible.jour, kcal: Math.min(Math.round(r.kcal! - besoins.kcal), 1000) }] })}>Étaler</button>
              <button type="button" className="rounded-lg border border-bordure py-2 font-semibold text-texte-2"
                onClick={() => modifierReglagesNutrition({ etalementsRefuses: [...(nutrition.etalementsRefuses ?? []), cible.jour] })}>Non, ça arrive</button>
            </div>
          </div>
        )}
        {nutrition?.etalements?.some((e) => e.date === cible.jour) && <p className="mt-2 text-sm text-texte-2">↘ Excès étalé sur tes prochains jours faciles.</p>}
        <button type="button" onClick={() => setEdition(true)} className="mt-2 text-sm font-semibold text-accent">Modifier</button>
      </Carte>
    )
  }
  return <Formulaire key={cible.jour} jour={cible.jour} titre={titre} existante={cible.saisie} onFini={() => setEdition(false)} />
}

export function Formulaire({ jour, titre, existante, onFini }: { jour: string; titre: string; existante?: JournalRepas; onFini: () => void }) {
  const [textes, setTextes] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHAMPS.map((c) => [c.cle, existante?.[c.cle] !== undefined ? formatNombre(existante[c.cle]) : ''])))
  const valeurs = Object.fromEntries(CHAMPS.map((c) => [c.cle, lireNombre(textes[c.cle])])) as Omit<JournalRepas, 'date'>
  const kcalCalcule = kcalDesMacros(valeurs)
  const kcal = valeurs.kcal ?? kcalCalcule

  return (
    <Carte titre={titre}>
      <p className="mb-2 text-sm text-texte-2">Recopie le total de la journée (depuis ton appli de suivi). Les macros suffisent : les calories se calculent.</p>
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
      }}>Pas renseigné {jour === aujourdhui() ? "aujourd'hui" : 'hier'}</button>
    </Carte>
  )
}
