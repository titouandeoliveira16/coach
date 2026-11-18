import { decalerJour, depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { GraphiqueLignes } from '../../../core/ui/graphiques'
import type { PointForme } from '../../../metrics/charge'

const AIDE = 'Pour info, sans changer la couleur du feu (relecture du 17/11/2026) : aucun seuil de charge n’est validé pour décider d’une séance (Impellizzeri 2020), et ton plan prévoit lui-même des semaines chargées. Fond = ta charge moyenne des 6 dernières semaines ; fatigue = celle des 7 derniers jours ; fraîcheur = fond − fatigue (négative quand tu as plus roulé que d’habitude ces jours-ci). Comme sur Garmin ou Intervals.icu : un fond qui monte régulièrement, sans bond brutal, c’est le signe d’une progression bien dosée.'

/** Évolution du fond (CTL) sur 4 semaines, en % arrondi ; undefined sans assez d'historique. */
export function evolutionFond(forme: PointForme[]) {
  if (forme.length < 29) return undefined
  const maintenant = forme.at(-1)!.ctl, avant = forme.at(-29)!.ctl
  return avant > 1 ? Math.round(((maintenant - avant) / avant) * 100) : undefined
}

/** Case « Charge » ouverte (Aujourd'hui, 18/11/2026) : courbe fond / fatigue sur 6 semaines, fraîcheur, 7 derniers jours. */
export function ChargeOuverte({ forme, ratioPic }: { forme: PointForme[]; ratioPic?: number }) {
  const dernier = forme.at(-1)
  if (!dernier || forme.length < 14) return <p className="mt-2 text-sm text-texte-3">Encore quelques semaines de sorties pour voir ta courbe de charge.</p>
  const fond = evolutionFond(forme)
  const recents = forme.filter((p) => p.date > decalerJour(dernier.date, -42))
  const tsb = Math.round(dernier.tsb)
  return (
    <>
      <p className="mt-1 flex items-baseline gap-2.5">
        <span className="chiffre text-[30px]">{fond !== undefined ? `${fond > 0 ? '+' : fond < 0 ? '−' : ''}${Math.abs(fond)} %` : '—'}</span>
        <span className="text-[13px] text-texte-2">ton fond sur 4 semaines<Aide titre="Charge d’entraînement" texte={AIDE} /></span>
      </p>
      <p className="mt-2.5 text-xs text-texte-2">6 dernières semaines</p>
      <GraphiqueLignes
        etiquettes={recents.map((p) => depuisJour(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}
        series={[
          { nom: 'Fond (6 semaines)', couleur: 'var(--color-z2)', valeurs: recents.map((p) => Math.round(p.ctl)) },
          { nom: 'Fatigue (7 jours)', couleur: 'var(--color-attention)', valeurs: recents.map((p) => Math.round(p.atl)) },
        ]}
        zero
      />
      <div className="mt-2.5 flex gap-1.5">
        <span className="flex-1 rounded-[10px] bg-surface-2 px-2 py-2"><span className="block text-[11px] text-texte-3">Fraîcheur</span><b className="block text-[15px] leading-tight">{tsb > 0 ? '+' : ''}{tsb}</b></span>
        {ratioPic !== undefined && <span className="flex-1 rounded-[10px] bg-surface-2 px-2 py-2"><span className="block text-[11px] text-texte-3">7 derniers jours</span><b className="block text-[15px] leading-tight">{Math.round(ratioPic * 100)} % <span className="text-xs font-normal text-texte-3">de d’habitude</span></b></span>}
      </div>
      <p className="mt-2 text-xs text-texte-3">Pour info : ne change pas la couleur du feu. Un fond qui monte régulièrement, sans bond brutal, c’est une progression bien dosée.</p>
    </>
  )
}
