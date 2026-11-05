import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { aujourdhui, decalerJour, jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { ETALEMENT_MAX_JOUR, SEUIL_EXCES } from '../../../metrics/nutrition'
import { AIDES } from '../aides'
import { importerIntervals } from '../import/intervals'
import { besoinsDe, lireReglagesNutrition, modifierReglagesNutrition } from './besoins'
import { Formulaire } from './CarteRepas'
import { jourARemplir } from './repas'

/**
 * Nutrition du jour, en une carte : besoin estimé, ce que tu as mangé (noté le soir) et l'écart, ligne par ligne.
 * Le matin, rattrapage de l'assiette d'hier si elle n'a pas été notée. Le détail du calcul s'ouvre à la demande.
 */
export function CarteNutrition({ ouverte: ouverteParent, onBasculer }: {
  /** Dépliée ou non (géré par l'écran Aujourd'hui, pour que les autres encarts descendent sans se déformer) */
  ouverte?: boolean
  onBasculer?: (ouverte: boolean) => void
} = {}) {
  const jour = aujourdhui()
  const hier = decalerJour(jour, -1)
  const b = useLiveQuery(() => besoinsDe(jour), [jour])
  const mange = useLiveQuery(async () => (await db.repas.get(jour)) ?? null, [jour])
  const assietteHier = useLiveQuery(async () => (await db.repas.get(hier)) ?? null, [hier])
  const besoinsHier = useLiveQuery(() => besoinsDe(hier), [hier])
  const cible = useLiveQuery(() => jourARemplir())
  const nutrition = useLiveQuery(lireReglagesNutrition)
  const [saisie, setSaisie] = useState<'jour' | 'hier'>()
  const [detail, setDetail] = useState(false)
  const [ouverteLocale, setOuverteLocale] = useState(false)
  const ouverte = ouverteParent ?? ouverteLocale
  const setOuverte = (v: boolean) => (onBasculer ? onBasculer(v) : setOuverteLocale(v))
  if (!b || mange === undefined) return null

  // Rattrapage de la veille : l'assiette d'hier pas encore notée (un bouton dans la carte)
  const hierAFaire = cible?.jour === hier && !cible.saisie
  if (saisie) {
    const j = saisie === 'jour' ? jour : hier
    return (
      <Formulaire key={j} jour={j} titre={j === jour ? '🍽️ Ton assiette du jour' : "🍽️ Ton assiette d'hier"}
        existante={(j === jour ? mange : assietteHier) ?? undefined} onFini={() => setSaisie(undefined)} />
    )
  }

  const m = mange && !mange.nonRenseigne ? mange : undefined
  const lignes: [string, number, number | undefined, string][] = [
    ['Calories', b.kcal, m?.kcal, ''],
    ['Glucides', b.glucides, m?.glucides, ' g'],
    ['Protéines', b.proteines, m?.proteines, ' g'],
    ['Lipides', b.lipides, m?.lipides, ' g'],
  ]
  /** Écart : en vert ou neutre dans ±10 %, en orange au-delà. */
  const couleurEcart = (besoin: number, v: number) => (Math.abs(v - besoin) <= besoin * 0.1 ? 'text-texte-2' : 'text-[#fb923c]')

  // Excès d'hier (ou d'aujourd'hui une fois noté) à étaler sur les jours faciles
  const exces = [[jour, m?.kcal, b.kcal], [hier, assietteHier && !assietteHier.nonRenseigne ? assietteHier.kcal : undefined, besoinsHier?.kcal]] as const
  const aEtaler = nutrition && exces.find(([d, kcal, besoin]) => kcal !== undefined && besoin !== undefined && kcal - besoin >= SEUIL_EXCES
    && !nutrition.etalements?.some((e) => e.date === d) && !nutrition.etalementsRefuses?.includes(d))

  return (
    <Carte className="flex shrink-0 flex-col gap-2 p-3!">
      <button type="button" onClick={() => setOuverte(!ouverte)} className="flex items-center justify-between text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-texte-3">Nutrition du jour</span>
        <span className="text-sm">
          {m?.kcal !== undefined ? <b>{formatNombre(m.kcal)}</b> : <span className="text-texte-3">—</span>}
          <span className="text-texte-2"> / {formatNombre(b.kcal)} kcal</span> <span className="text-texte-3">{ouverte ? '▴' : '▾'}</span>
        </span>
      </button>
      {!ouverte && !hierAFaire && (
        <button type="button" onClick={() => setOuverte(true)} className="grid min-h-10 grid-cols-3 gap-1.5 text-center text-[13px] text-texte-2">
          {([['G', b.glucides, m?.glucides], ['P', b.proteines, m?.proteines], ['L', b.lipides, m?.lipides]] as const).map(([n, besoin, v]) => (
            <span key={n} className="flex items-center justify-center rounded-xl bg-surface-2">{n} {v !== undefined ? `${formatNombre(v)} / ` : ''}{formatNombre(besoin)} g</span>
          ))}
        </button>
      )}
      {hierAFaire && (
        <button type="button" onClick={() => setSaisie('hier')} className="min-h-11 rounded-xl border border-accent text-sm font-semibold text-accent">
          Noter mon assiette d'hier
        </button>
      )}
      {ouverte && <>
      <p className="text-right"><Aide titre="Besoins du jour" texte={AIDES.besoins} /></p>
      <div className="grid grid-cols-4 text-sm">
        <span />
        <span className="py-1 text-right text-texte-3">Besoin</span>
        <span className="py-1 text-right text-texte-3">Mangé</span>
        <span className="py-1 text-right text-texte-3">Écart</span>
        {lignes.map(([nom, besoin, v, u], i) => (
          <div key={nom} className={`contents ${i === 0 ? 'font-bold' : ''}`}>
            <span className="border-t border-bordure py-2">{nom}</span>
            <span className="border-t border-bordure py-2 text-right tabular-nums">{formatNombre(besoin)}{u}</span>
            <span className="border-t border-bordure py-2 text-right tabular-nums">{v !== undefined ? `${formatNombre(v)}${u}` : '—'}</span>
            <span className={`border-t border-bordure py-2 text-right tabular-nums ${v !== undefined ? couleurEcart(besoin, v) : 'text-texte-3'}`}>
              {v !== undefined ? `${v - besoin > 0 ? '+' : v - besoin < 0 ? '−' : ''}${formatNombre(Math.abs(v - besoin))}` : ''}
            </span>
          </div>
        ))}
      </div>
      {mange?.nonRenseigne && <p className="mt-1 text-sm text-texte-3">Assiette du jour : pas renseignée.</p>}

      {b.pauseJusquau ? (
        <p className="mt-2 text-sm text-texte-2">Pause au maintien jusqu'au {jourCourt(b.pauseJusquau)} (bilan du dimanche) : pas de déficit.</p>
      ) : b.objectif === 'perte' ? (
        <p className="mt-2 text-sm text-texte-2">Objectif : <b className="text-texte">−{b.deficit} kcal</b> aujourd'hui (perte de gras légère){b.plancher ? ', limité pour ne pas manger trop peu' : ''}.</p>
      ) : null}
      {b.reduction > 0 && <p className="mt-1 text-sm text-texte-2">−{b.reduction} kcal : étalement de ton excès{b.etalementDu ? ` du ${new Date(`${b.etalementDu}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}` : ''}.</p>}
      {b.tendance !== undefined && (() => {
        const tropVite = b.tendance < -0.01 * b.kg
        return (
          <p className={`mt-1 text-sm ${tropVite ? 'text-[#fb923c]' : 'text-texte-2'}`}>
            Poids : <b>{b.tendance > 0 ? '+' : ''}{formatNombre(b.tendance, 1)} kg/sem.</b>
            {b.objectif === 'perte' && ` (visé ≈ ${formatNombre(-0.005 * b.kg, 1)})`}
            {tropVite && ' · trop rapide : mange un peu plus pour garder tes muscles et tes performances'}
          </p>
        )
      })()}
      {b.demain && <p className="mt-1 text-sm text-texte-2">Demain : {b.demain}. Recharge bien en glucides ce soir.</p>}

      {aEtaler && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
          <p>
            {aEtaler[0] === jour ? "Aujourd'hui" : 'Hier'} : +{formatNombre(aEtaler[1]! - aEtaler[2]!)} kcal par rapport à ton besoin. Rien de grave, c'est la moyenne de la semaine qui compte.
            Étaler {formatNombre(Math.min(aEtaler[1]! - aEtaler[2]!, 1000))} kcal sur tes prochains jours faciles (−{ETALEMENT_MAX_JOUR} max par jour, jamais un jour de séance dure) ?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="min-h-11 rounded-lg bg-accent font-semibold text-fond"
              onClick={() => modifierReglagesNutrition({ etalements: [...(nutrition!.etalements ?? []), { date: aEtaler[0], kcal: Math.min(Math.round(aEtaler[1]! - aEtaler[2]!), 1000) }] })}>Étaler</button>
            <button type="button" className="min-h-11 rounded-lg border border-bordure font-semibold text-texte-2"
              onClick={() => modifierReglagesNutrition({ etalementsRefuses: [...(nutrition!.etalementsRefuses ?? []), aEtaler[0]] })}>Non, ça arrive</button>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSaisie('jour')} className="min-h-12 rounded-xl bg-accent text-sm font-bold text-fond">
          {mange ? 'Modifier mon assiette' : 'Noter mon assiette'}
        </button>
        <button type="button" onClick={() => setDetail(!detail)} className={`min-h-12 rounded-xl border text-sm font-semibold ${detail ? 'border-accent text-accent' : 'border-bordure bg-surface-2'}`}>
          {detail ? 'Masquer le calcul' : 'Détail du calcul'}
        </button>
      </div>

      {detail && (
        <div className="mt-3 space-y-1 text-sm text-texte-2">
          <p>Vie quotidienne, marche comprise : <b className="text-texte">{formatNombre(b.quotidien)} kcal</b> <span className="text-texte-3">(métabolisme × 1,4)</span></p>
          {b.detailSeances.map((x, i) => (
            <p key={i}>{x.faite ? '✅' : '🗓️'} {x.titre} : <b className="text-texte">{formatNombre(x.kcal)} kcal</b>{' '}
              <span className="text-texte-3">{x.faite ? '(faite)' : '(prévue : comptée d’avance ; si tu ne la fais pas, le chiffre baisse)'}</span></p>
          ))}
          <p className="border-t border-bordure pt-1">= Maintien ≈ <b className="text-texte">{formatNombre(b.maintien)} kcal</b>{b.objectif === 'perte' && b.deficit ? <> − perte de gras {formatNombre(b.deficit)} kcal</> : null}{b.reduction ? <> − étalement {b.reduction} kcal</> : null}</p>
          <p className="text-xs text-texte-3">
            Glucides {b.glucidesParKg} g/kg · protéines {formatNombre(b.proteinesParKg, 1)} g/kg · lipides {Math.round(((b.lipides * 9) / b.kcal) * 100)} % de l'énergie · poids pris en compte {formatNombre(b.kg, 1)} kg.
          </p>
          {b.kcalGlucides ? <p className="text-xs text-texte-3">Séances : ~{formatNombre(b.kcalGlucides)} kcal de glucides brûlées : plus tes séances en brûlent, plus le déficit est petit.</p> : null}
          {b.correction ? <p className="text-xs text-texte-3">Réglé sur ton maintien mesuré ({b.correction > 0 ? '+' : ''}{b.correction} kcal/j par rapport à la formule).</p> : null}
          <p className="text-xs text-texte-3">
            Séance pas encore arrivée ?{' '}
            <button type="button" className="underline" onClick={async (e) => {
              const bouton = e.currentTarget
              bouton.textContent = 'Actualisation…'
              const ok = await importerIntervals().then(() => true, () => false)
              bouton.textContent = ok ? 'Actualisé ✓' : 'Échec : réessaie dans un moment'
            }}>Actualiser maintenant</button>
          </p>
          {assietteHier && (
            <button type="button" onClick={() => setSaisie('hier')} className="pt-1 text-sm font-semibold text-accent">
              Modifier mon assiette d'hier ({assietteHier.nonRenseigne ? 'pas renseignée' : `${assietteHier.kcal} kcal`})
            </button>
          )}
        </div>
      )}
      </>}
    </Carte>
  )
}
