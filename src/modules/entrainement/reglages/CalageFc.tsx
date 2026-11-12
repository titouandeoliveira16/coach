import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { Aide } from '../../../core/ui/Aide'
import { calageFc, type BornesZones } from '../../../metrics/fc'
import { AIDES } from '../aides'
import type { ZoneVelo } from '../types'

/** Proposition de bornes de FC calées sur tes sorties des 90 derniers jours (ceinture cardio uniquement). */
export function CalageFc({ zones, cpW, onModifier }: { zones: ZoneVelo[]; cpW?: number; onModifier: (z: ZoneVelo[]) => void }) {
  const p = useLiveQuery(async () => {
    const actuelles = [0, 1, 2, 3].map((i) => zones[i]?.fcMax)
    if (!cpW || actuelles.some((b) => b === undefined)) return null
    const seances = (await db.seances.where('date').above(decalerJour(aujourdhui(), -90)).toArray())
      .filter((s) => s.sport === 'velo' && !s.sansCeinture)
    const sorties = seances.flatMap((s) => (s.fcMoy && s.puissanceMoyW ? [{ fcMoy: s.fcMoy, puissanceMoyW: s.puissanceMoyW, dureeSec: s.dureeSec, decouplage: s.decouplage }] : []))
    const blocs = seances.flatMap((s) => (s.blocs?.fcFin ? s.blocs.w.map((w, i) => ({ w, fcFin: s.blocs!.fcFin![i], dureeSec: s.blocs!.dureeSec, seance: s.id })) : []))
    const c = calageFc({ cpW, bornes: actuelles as BornesZones, sorties, blocs })
    if (!c || c.bornes.every((b, i) => Math.abs(b - actuelles[i]!) <= 2)) return null
    return c
  }, [zones, cpW])
  if (!p) return null

  const appliquer = () => onModifier(zones.map((z, i) => ({
    ...z,
    ...(i <= 3 ? { fcMax: p.bornes[i] } : {}),
    ...(i >= 1 && i <= 4 ? { fcMin: p.bornes[i - 1] } : {}),
  })))
  return (
    <div className="mb-2 rounded-xl bg-surface-2 p-2.5 text-sm text-texte-2">
      D'après tes sorties ({p.nSorties} sorties faciles stables, {p.nBlocs} blocs au seuil) : 1er seuil vers <b className="text-texte">{p.fc1} bpm</b>,
      CP vers <b className="text-texte">{p.fcCp} bpm</b>. Bornes proposées : Z2 ≤ {p.bornes[1]}, Z3 ≤ {p.bornes[2]}, Z4 ≤ {p.bornes[3]}.
      <Aide titre="FC calées sur tes sorties" texte={AIDES.calageFc} />
      <button type="button" className="mt-1 block font-semibold text-accent" onClick={appliquer}>Recaler mes zones de FC</button>
    </div>
  )
}
