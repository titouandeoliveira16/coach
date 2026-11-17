import { decalerJour, depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { GraphiqueLignes } from '../../../core/ui/graphiques'
import type { PointForme } from '../../../metrics/charge'

/** Repère d'affichage (pas une règle du feu) : sous −20, beaucoup roulé ces jours-ci */
const FRAICHEUR_BASSE = -20
/** Repère d'affichage : 7 derniers jours au-delà de 130 % de ta moyenne */
const PIC = 1.3

const AIDE = 'Pour info, sans changer la couleur du feu (relecture du 17/11/2026) : aucun seuil de charge n’est validé pour décider d’une séance (Impellizzeri 2020), et ton plan prévoit lui-même des semaines chargées. Fond = ta charge moyenne des 6 dernières semaines ; fatigue = celle des 7 derniers jours ; fraîcheur = fond − fatigue (négative quand tu as plus roulé que d’habitude ces jours-ci). Comme sur Garmin ou Intervals.icu : un fond qui monte régulièrement, sans bond brutal, c’est le signe d’une progression bien dosée.'

/**
 * « Ton entraînement · pour info » sous la forme du jour : fraîcheur et charge des 7 derniers jours, et (dans le détail)
 * la courbe fond / fatigue des 6 dernières semaines. Ne compte pas dans le feu.
 */
export function ChargeInfo({ forme, ratioPic, ouvert }: { forme: PointForme[]; ratioPic?: number; ouvert: boolean }) {
  const dernier = forme.at(-1)
  if (!dernier || forme.length < 14) return null
  const tsb = Math.round(dernier.tsb)
  const pastille = (texte: string, alerte: boolean) => (
    <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: alerte ? 'color-mix(in srgb, var(--color-attention) 14%, transparent)' : 'var(--color-surface-2)', color: alerte ? 'var(--color-attention)' : 'var(--color-texte-2)' }}>{texte}</span>
  )
  const recents = forme.filter((p) => p.date > decalerJour(dernier.date, -42))
  return (
    <div className="mt-3 border-t border-bordure pt-2.5">
      <p className="text-[13px] font-semibold text-texte-2">Ton entraînement · pour info<Aide titre="Charge d’entraînement" texte={AIDE} /></p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {pastille(`Fraîcheur ${tsb > 0 ? '+' : ''}${tsb}`, tsb < FRAICHEUR_BASSE)}
        {ratioPic !== undefined && pastille(`7 derniers jours : ${Math.round(ratioPic * 100)} % de d’habitude`, ratioPic > PIC)}
      </div>
      {ouvert && (
        <div className="mt-2">
          <GraphiqueLignes
            etiquettes={recents.map((p) => depuisJour(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}
            series={[
              { nom: 'Fond (6 semaines)', couleur: 'var(--color-z2)', valeurs: recents.map((p) => Math.round(p.ctl)) },
              { nom: 'Fatigue (7 jours)', couleur: 'var(--color-attention)', valeurs: recents.map((p) => Math.round(p.atl)) },
            ]}
            zero
          />
        </div>
      )}
    </div>
  )
}
