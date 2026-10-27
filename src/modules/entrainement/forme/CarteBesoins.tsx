import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { formatDate } from '../../../core/format'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { besoinsDe } from './besoins'
import { Formulaire } from './CarteRepas'
import { importerIntervals } from '../import/intervals'

/** Besoins du jour (estimation) : à lire, puis à adapter de son côté. */
export function CarteBesoins() {
  const jour = aujourdhui()
  const b = useLiveQuery(() => besoinsDe(jour), [jour])
  const hier = decalerJour(jour, -1)
  const assietteHier = useLiveQuery(async () => (await db.repas.get(hier)) ?? null, [hier])
  const [modifierHier, setModifierHier] = useState(false)
  if (!b) return null
  return (
    <Carte titre="🍽️ Besoins du jour">
      <p className="text-2xl font-bold tabular-nums">≈ {formatNombre(b.kcal)} kcal<Aide titre="Besoins du jour" texte={AIDES.besoins} /></p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Macro nom="Glucides" g={b.glucides} sous={`${b.glucidesParKg} g/kg`} />
        <Macro nom="Protéines" g={b.proteines} sous={`${formatNombre(b.proteinesParKg, 1)} g/kg`} />
        <Macro nom="Lipides" g={b.lipides} sous={`${Math.round(((b.lipides * 9) / b.kcal) * 100)} % de l'énergie`} />
      </div>
      {b.objectif === 'perte' && (
        <p className="mt-2 text-sm text-texte-2">
          🎯 Perte de gras légère : <b className="text-texte">−{b.deficit} kcal</b> aujourd'hui
          ({b.kcalGlucides ? `séances : ~${formatNombre(b.kcalGlucides)} kcal de glucides brûlées : plus tes séances en brûlent, plus le déficit est petit` : 'pas de séance'})
          {b.plancher && ' · limité pour ne pas manger trop peu'}
        </p>
      )}
      {b.tendance !== undefined && (() => {
        const vise = -0.005 * b.kg
        const tropVite = b.tendance < -0.01 * b.kg
        return (
          <p className={`mt-1 text-sm ${tropVite ? 'text-[#fb923c]' : 'text-texte-2'}`}>
            ⚖️ Poids : <b>{b.tendance > 0 ? '+' : ''}{formatNombre(b.tendance, 1)} kg/sem.</b>
            {b.objectif === 'perte' && ` (visé ≈ ${formatNombre(vise, 1)})`}
            {tropVite && ' · trop rapide : mange un peu plus pour garder tes muscles et tes performances'}
          </p>
        )
      })()}
      <details className="mt-2 text-sm text-texte-2">
        <summary className="cursor-pointer text-xs text-texte-3">D'où vient ce chiffre ?</summary>
        <ul className="mt-1 space-y-0.5">
          <li>🏠 Vie quotidienne : <b className="text-texte">{formatNombre(b.quotidien - b.marche)} kcal</b></li>
          <li>🚶 Marche : <b className="text-texte">{formatNombre(b.marche)} kcal</b>{' '}
            <span className="text-texte-3">{b.pas
              ? `(${b.pas.aVenir ? `${formatNombre(b.pas.dejaFaits)} pas faits hors course + ~${formatNombre(b.pas.aVenir)} d'ici ce soir` : `${formatNombre(b.pas.valeur)} pas hors course`}${!b.pas.moyenne ? ''
                : b.pas.enRetard ? `, ta moyenne de la semaine : le total de ta montre (${formatNombre(b.pas.montre)}) n'est pas encore à jour depuis ta course`
                : ", ta moyenne de la semaine : rien reçu de ta montre aujourd'hui"})`
              : '(pas encore reçus de la montre)'}</span></li>
          {b.detailSeances.map((x, i) => (
            <li key={i}>{x.faite ? '✅' : '🗓️'} {x.titre} : <b className="text-texte">{formatNombre(x.kcal)} kcal</b>{' '}
              <span className="text-texte-3">{x.faite ? '(faite)' : '(prévue : comptée d’avance pour que tu manges de quoi la faire ; si tu ne la fais pas, le chiffre baisse)'}</span></li>
          ))}
          <li className="border-t border-bordure pt-0.5">= Maintien ≈ <b className="text-texte">{formatNombre(b.maintien)} kcal</b>{b.objectif === 'perte' && b.deficit ? <> − perte de gras {formatNombre(b.deficit)} kcal</> : null}{b.reduction ? <> − étalement {b.reduction} kcal</> : null}</li>
        </ul>
        <p className="mt-1 text-xs text-texte-3">Poids pris en compte : {formatNombre(b.kg, 1)} kg.</p>
        <p className="mt-1 text-xs text-texte-3">
          Tes pas suivent le chemin montre → Garmin Connect → Intervals.icu → l'appli : ils peuvent avoir du retard sur ta montre.{' '}
          <button type="button" className="underline" onClick={async (e) => {
            const b = e.currentTarget
            b.textContent = 'Actualisation…'
            const ok = await importerIntervals().then(() => true, () => false)
            b.textContent = ok ? 'Actualisé ✓' : 'Échec : réessaie dans un moment'
          }}>Actualiser maintenant</button>
        </p>
      </details>
      {b.reduction > 0 && (
        <p className="mt-1 text-sm text-texte-2">↘ −{b.reduction} kcal aujourd'hui : étalement de ton excès{b.etalementDu ? ` du ${new Date(`${b.etalementDu}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}` : ''}.</p>
      )}
      {b.correction ? <p className="mt-1 text-xs text-texte-3">Réglé sur ton maintien mesuré ({b.correction > 0 ? '+' : ''}{b.correction} kcal/j par rapport à la formule).</p> : null}
      {assietteHier && !modifierHier && (
        <button type="button" onClick={() => setModifierHier(true)} className="mt-2 text-sm font-semibold text-accent">
          ✏️ Modifier mon assiette d'hier ({assietteHier.nonRenseigne ? 'pas renseignée' : `${assietteHier.kcal} kcal`})
        </button>
      )}
      {modifierHier && assietteHier && (
        <div className="mt-3">
          <Formulaire jour={hier} titre={`🍽️ Ton assiette du ${formatDate(hier).slice(0, 5)}`} existante={assietteHier} onFini={() => setModifierHier(false)} />
        </div>
      )}
      {b.demain && <p className="mt-1 text-xs text-texte-2">Demain : {b.demain}. Recharge bien en glucides ce soir.</p>}
    </Carte>
  )
}

function Macro({ nom, g, sous }: { nom: string; g: number; sous: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className="text-xs text-texte-3">{nom}</p>
      <p className="text-lg font-bold tabular-nums">{g} g</p>
      <p className="text-[11px] text-texte-3">{sous}</p>
    </div>
  )
}
