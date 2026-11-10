import { useLiveQuery } from 'dexie-react-hooks'
import { Moon, Scale, type LucideIcon } from 'lucide-react'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { formatNombre } from '../../../core/format'
import { lireSansPesee, peseesValides } from './pesees'

/** Mini-courbe des 14 derniers jours (une seule série : la tuile la nomme), qui se dessine à l'ouverture. */
function MiniCourbe({ valeurs, couleur }: { valeurs: number[]; couleur: string }) {
  if (valeurs.length < 2) return <div className="h-7" />
  const min = Math.min(...valeurs), max = Math.max(...valeurs)
  const y = (v: number) => (max === min ? 14 : 26 - ((v - min) / (max - min)) * 22)
  const pts = valeurs.map((v, i) => `${((i / (valeurs.length - 1)) * 100).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="trace mt-1 h-7 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={couleur} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function Tuile({ Icone, couleurIcone, libelle, valeur, couleurValeur, onClick, children }: {
  Icone: LucideIcon; couleurIcone: string; libelle: string; valeur: string; couleurValeur?: string; onClick?: () => void; children?: React.ReactNode
}) {
  const Balise = onClick ? 'button' : 'div'
  return (
    <Balise {...(onClick ? { type: 'button' as const, onClick } : {})} className={`entree rounded-[14px] bg-surface p-2.5 text-left ${onClick ? 'presse' : ''}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-texte-2"><Icone className="h-3.5 w-3.5" style={{ color: couleurIcone }} strokeWidth={2} />{libelle}</p>
      <p className="chiffre mt-0.5 text-lg" style={{ color: couleurValeur }}>{valeur}</p>
      {children}
    </Balise>
  )
}

/** Sous « Ta forme » (maquette F2) : nuit et poids, chacun avec sa tendance sur 14 jours (la forme n'est que dans « Ta forme »). */
export function TuilesMatin({ onPoids }: { onPoids?: () => void } = {}) {
  const jour = aujourdhui()
  const d = useLiveQuery(async () => {
    const mesures = (await db.mesures.where('date').between(decalerJour(jour, -13), jour, true, true).toArray()).filter((m) => !m.sansMontre)
    const pesees = (await peseesValides()).filter((p) => p.date >= decalerJour(jour, -27)).reverse()
    const sansPesee = (await lireSansPesee()).includes(jour)
    return { mesures, pesees, sansPesee }
  }, [jour])
  if (!d) return null
  const nuits = d.mesures.filter((m) => m.sommeilH).map((m) => m.sommeilH!)
  const nuit = d.mesures.find((m) => m.date === jour)?.sommeilH
  const poids = d.pesees.at(-1)
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2">
      <Tuile Icone={Moon} couleurIcone="var(--color-sommeil)" libelle="Nuit" valeur={nuit ? `${Math.floor(nuit)} h ${String(Math.round((nuit % 1) * 60)).padStart(2, '0')}` : '—'}>
        <MiniCourbe valeurs={nuits} couleur="var(--color-sommeil)" />
      </Tuile>
      <Tuile Icone={Scale} couleurIcone="var(--color-texte-3)" libelle="Poids" onClick={onPoids} valeur={poids ? `${formatNombre(poids.poidsKg, 1)} kg` : '—'}>
        {poids && poids.date === jour ? <MiniCourbe valeurs={d.pesees.map((p) => p.poidsKg)} couleur="var(--color-texte-2)" /> : <p className={`mt-2 text-[11px] ${d.sansPesee ? 'text-texte-3' : 'text-accent'}`}>{d.sansPesee ? 'pas de pesée' : 'à peser'}</p>}
      </Tuile>
    </div>
  )
}
