import { useEffect, useState } from 'react'

/** 8,75 → [8, 45] */
const versHM = (h?: number) => (h === undefined ? ['', ''] : [String(Math.floor(h + 1e-9)), String(Math.round((h - Math.floor(h + 1e-9)) * 60))])

/**
 * Ligne « libellé ……… [ 8 ] h [ 45 ] » : une durée en heures et minutes, jamais en décimal (17/11/2026).
 * La valeur reste enregistrée en heures (8,75), enregistrée en quittant un des deux champs.
 */
export function ChampHeures({ libelle, valeur, onValider }: { libelle: string; valeur: number | undefined; onValider: (h: number | undefined) => void }) {
  const [[h, m], setHM] = useState(versHM(valeur))
  const [enSaisie, setEnSaisie] = useState(false)
  useEffect(() => { if (!enSaisie) setHM(versHM(valeur)) }, [valeur, enSaisie])
  const valider = () => {
    setEnSaisie(false)
    if (h.trim() === '' && m.trim() === '') return valeur !== undefined && onValider(undefined)
    const nh = Number(h || '0'), nm = Number(m || '0')
    if (!Number.isFinite(nh) || !Number.isFinite(nm) || nh < 0 || nh > 24 || nm < 0 || nm >= 60) return setHM(versHM(valeur))
    const v = nh + nm / 60
    if (v !== valeur) onValider(v)
  }
  const champ = 'w-14 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-right text-lg font-semibold outline-none focus:border-accent'
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-texte-2">{libelle}</span>
      <span className="flex items-center gap-1.5">
        <input inputMode="numeric" value={h} aria-label={`${libelle} : heures`} onFocus={() => setEnSaisie(true)} onChange={(e) => setHM([e.target.value, m])} onBlur={valider} className={champ} />
        <span className="text-sm text-texte-3">h</span>
        <input inputMode="numeric" value={m} aria-label={`${libelle} : minutes`} onFocus={() => setEnSaisie(true)} onChange={(e) => setHM([h, e.target.value])} onBlur={valider} className={champ} />
        <span className="w-6 text-sm text-texte-3">min</span>
      </span>
    </label>
  )
}
