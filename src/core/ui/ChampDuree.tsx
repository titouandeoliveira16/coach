import { useEffect, useState } from 'react'

const champ = 'w-16 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-center text-lg font-semibold outline-none focus:border-accent'

/** Durée en heures + minutes (pavé numérique). Valeur en secondes. */
export function ChampDuree({ libelle, valeurSec, onChanger }: { libelle: string; valeurSec?: number; onChanger: (sec: number) => void }) {
  const [h, setH] = useState('')
  const [m, setM] = useState('')

  useEffect(() => {
    if (valeurSec === undefined) return
    setH(String(Math.floor(valeurSec / 3600)))
    setM(String(Math.round((valeurSec % 3600) / 60)))
  }, [valeurSec])

  const valider = (hh: string, mm: string) => onChanger((Number(hh) || 0) * 3600 + (Number(mm) || 0) * 60)

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-texte-2">{libelle}</span>
      <span className="flex items-center gap-1.5">
        <input inputMode="numeric" aria-label="Heures" value={h} placeholder="0" className={champ}
          onChange={(e) => setH(e.target.value.replace(/\D/g, ''))} onBlur={() => valider(h, m)} />
        <span className="text-texte-3">h</span>
        <input inputMode="numeric" aria-label="Minutes" value={m} placeholder="00" className={champ}
          onChange={(e) => setM(e.target.value.replace(/\D/g, ''))} onBlur={() => valider(h, m)} />
        <span className="text-texte-3">min</span>
      </span>
    </div>
  )
}
