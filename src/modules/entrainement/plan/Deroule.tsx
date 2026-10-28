import { couleurPctCP } from '../../../core/zones'
import type { Etape } from '../../../metrics/programme'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CP_DEFAUT } from './programme'

const horloge = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}'${s ? String(s).padStart(2, '0') : '00'}`
}
const duree = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}'${sec % 60 ? String(sec % 60).padStart(2, '0') : ''}` : `${sec}"`)

/** Profil de la séance comme sur Zwift : une barre par étape, hauteur = watts, couleur = zone (en % de la CP). */
function Profil({ etapes, cpW }: { etapes: Etape[]; cpW?: number }) {
  const blocs = etapes.filter((e) => e.dureeSec > 0)
  const total = blocs.reduce((t, e) => t + e.dureeSec, 0)
  if (!total) return null
  const wMax = Math.max(...blocs.map((e) => e.w ?? 0), cpW ? cpW * 1.3 : 0) || 1
  const largeurs = blocs.map((e) => (e.dureeSec / total) * 1000)
  const departs = largeurs.map((_, i) => largeurs.slice(0, i).reduce((a, w) => a + w, 0))
  return (
    <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="mt-2 block h-14 w-full rounded-lg bg-surface-2" aria-hidden>
      {blocs.map((e, i) => {
        const h = e.w ? Math.max(0.12, e.w / wMax) * 56 : 56
        return <rect key={i} x={departs[i]} y={60 - h} width={Math.max(largeurs[i] - 1, 1)} height={h} fill={couleur(e, cpW)} />
      })}
    </svg>
  )
}

const couleur = (e: Etape, cpW?: number) => (e.w && cpW ? couleurPctCP((e.w / cpW) * 100) : e.w ? '#8b949e' : couleurPctCP(undefined))

/** Déroulé minute par minute d'une séance vélo (à suivre sur le compteur), en couleurs de zones comme sur Zwift. */
export function Deroule({ etapes }: { etapes: Etape[] }) {
  const [r] = useReglagesEntrainement()
  // Même CP que celle qui a servi à calculer les watts (CP provisoire tant qu'aucun test n'est saisi)
  const cpW = r.cpW ?? CP_DEFAUT
  return (
    <>
      <Profil etapes={etapes} cpW={cpW} />
      <ol className="mt-2 divide-y divide-bordure overflow-hidden rounded-xl bg-surface-2 text-sm">
        {etapes.map((e, i) => (
          <li key={i} className="flex gap-2 border-l-4 px-2.5 py-2" style={{ borderLeftColor: e.dureeSec > 0 ? couleur(e, cpW) : 'transparent' }}>
            <span className="w-11 shrink-0 tabular-nums text-texte-3">{horloge(e.debutSec)}</span>
            <span className="min-w-0 flex-1">
              {e.libelle}
              {e.dureeSec > 0 && <span className="text-texte-3"> · {duree(e.dureeSec)}</span>}
            </span>
            {e.dureeSec > 0 && <span className="shrink-0 font-semibold tabular-nums" style={{ color: couleur(e, cpW) }}>{e.w ? `${e.w} W` : 'à fond'}</span>}
          </li>
        ))}
      </ol>
    </>
  )
}
