import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Carte } from '../../../core/ui/Carte'
import { modifierReglagesNutrition } from './besoins'
import { calibration } from './repas'

/** Ton maintien mesuré (repas notés + tendance du poids), proposé à la place de la formule. */
export function CarteCalibration() {
  const c = useLiveQuery(calibration)
  if (!c) return null
  return (
    <Carte titre="⚖️ Ton maintien mesuré">
      <p className="text-sm text-texte-2">
        Sur {c.jours} jours : tu as mangé <b className="text-texte">{formatNombre(c.kcalMoyen)} kcal/j</b> en moyenne et ton poids a évolué de{' '}
        <b className="text-texte">{c.tendance > 0 ? '+' : ''}{formatNombre(c.tendance, 2)} kg/sem.</b>
      </p>
      <p className="mt-1">
        Ton maintien réel ≈ <b>{formatNombre(c.mesure)} kcal</b> (la formule disait {formatNombre(c.formule)}).
        Ajuster tes besoins de <b>{c.ecart > 0 ? '+' : ''}{c.ecart} kcal/j</b> ?
      </p>
      <p className="mt-1 text-xs text-texte-3">
        {c.provisoire
          ? 'Estimation provisoire sur 2 semaines (écart limité à ±250), confirmée à 3 semaines.'
          : 'Plus fiable qu\'une formule, à condition d\'avoir noté presque tous tes repas. 1 kg ≈ 7 700 kcal ; écart limité à ±500.'}
        {' '}Avant d'ajuster : tes repas notés sont-ils complets (huile, sauces, grignotages) ?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => modifierReglagesNutrition({ correction: c.ecart, correctionLe: aujourdhui(), correctionProvisoire: c.provisoire })} className="rounded-xl bg-accent py-2.5 font-semibold text-fond">Ajuster</button>
        <button type="button" onClick={() => modifierReglagesNutrition({ calibrationPlusTard: decalerJour(aujourdhui(), 7) })} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Plus tard</button>
      </div>
    </Carte>
  )
}
