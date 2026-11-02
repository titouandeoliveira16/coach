import { useState } from 'react'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { montee, monteeAFond } from '../../../metrics/col'
import { conseilsSeance } from '../../../metrics/nutritionSeance'
import { AIDES } from '../aides'

const duree = (sec: number) => {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`
}

/** Calculateurs : temps et watts sur un col (CP + W′ + physique), glucides pendant une sortie. */
export function Calculateurs({ cpW, wPrimeKj, poidsKg }: { cpW?: number; wPrimeKj?: number; poidsKg?: number }) {
  const [outil, setOutil] = useState<'col' | 'glucides'>()
  const [km, setKm] = useState<number | undefined>(10)
  const [dPlus, setDPlus] = useState<number | undefined>(700)
  const [velo, setVelo] = useState<number | undefined>(8)
  const [watts, setWatts] = useState<number>()
  const [minutes, setMinutes] = useState<number | undefined>(180)
  const [dure, setDure] = useState(false)
  const [dehors, setDehors] = useState(false)

  const masse = (poidsKg ?? 70) + (velo ?? 8)
  const okCol = km && dPlus && km > 0 && dPlus > 0
  const aFond = okCol && cpW && wPrimeKj ? monteeAFond(km, dPlus, masse, cpW, wPrimeKj) : undefined
  const choisi = okCol && watts ? montee(km, dPlus, masse, watts) : undefined
  const g = minutes ? conseilsSeance({ sport: 'velo', dureeMin: minutes, intensite: dure ? 'haute' : 'basse', homeTrainer: !dehors }) : undefined

  const bouton = (o: 'col' | 'glucides', nom: string) => (
    <button type="button" onClick={() => setOutil(outil === o ? undefined : o)} aria-pressed={outil === o}
      className={`rounded-xl border py-2 text-sm font-semibold ${outil === o ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface-2 text-texte-2'}`}>{nom}</button>
  )
  return (
    <Carte titre="🧮 Calculateurs">
      <div className="grid grid-cols-2 gap-2">
        {bouton('col', '⛰️ Col')}
        {bouton('glucides', '🍌 Glucides')}
      </div>
      {outil === 'col' && (
        <div className="mt-3 space-y-1">
          <ChampNombre libelle="Longueur" unite="km" valeur={km} onValider={setKm} />
          <ChampNombre libelle="Dénivelé" unite="m" valeur={dPlus} decimales={0} onValider={setDPlus} />
          <ChampNombre libelle="Poids du vélo et du bidon" unite="kg" valeur={velo} onValider={setVelo} />
          {okCol && <p className="text-xs text-texte-3">Pente moyenne {formatNombre((dPlus / (km * 1000)) * 100, 1)} % · toi + vélo {formatNombre(masse, 1)} kg</p>}
          {aFond ? (
            <p className="text-sm text-texte-2">
              Bien dosé, à fond : <b className="text-texte">{aFond.puissanceW} W</b> pendant <b className="text-texte">{duree(aFond.tempsSec)}</b> ({formatNombre(aFond.kmh, 1)} km/h).
              <span className="block text-xs text-texte-3">C'est ton maximum théorique sur cette durée, frais : en cyclosportive, après des heures de selle, vise plutôt 85-90 % de ça.</span>
            </p>
          ) : <p className="text-sm text-texte-3">Fais un test CP pour avoir ta puissance tenable.</p>}
          <ChampNombre libelle="Et si je monte à…" unite="W" valeur={watts} decimales={0} onValider={setWatts} />
          {choisi && <p className="text-sm text-texte-2">À {watts} W : <b className="text-texte">{duree(choisi.tempsSec)}</b> ({formatNombre(choisi.kmh, 1)} km/h).</p>}
        </div>
      )}
      {outil === 'glucides' && (
        <div className="mt-3 space-y-2">
          <ChampNombre libelle="Durée de la sortie" unite="min" valeur={minutes} decimales={0} onValider={setMinutes} />
          <label className="flex items-center gap-2 text-sm text-texte-2">
            <input type="checkbox" checked={dure} onChange={(e) => setDure(e.target.checked)} /> Avec de l'intensité ou une course
          </label>
          <label className="flex items-center gap-2 text-sm text-texte-2">
            <input type="checkbox" checked={dehors} onChange={(e) => setDehors(e.target.checked)} /> Dehors (sinon home trainer)
          </label>
          {g && (
            <p className="text-sm text-texte-2">
              {g.glucides && <b className="block text-texte">{g.glucides[0]}-{g.glucides[1]} g de glucides au total</b>}{g.pendant}
              <span className="mt-1 block">{g.hydratation}</span>
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-texte-3">Estimations.<Aide titre="Calculateurs" texte={AIDES.calculateurs} /></p>
    </Carte>
  )
}
