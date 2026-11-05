import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { IconeReglages } from '../core/ui/icones'
import { MODULES } from './modules'
import { useReglage } from '../core/reglages'
import type { ReglageCompte } from '../core/inscription'

/** Accueil : un gros bouton par module affiché, qui se partagent tout l'écran. */
export function Accueil() {
  const heure = new Date().getHours()
  const salut = heure < 18 ? 'Bonjour' : 'Bonsoir'
  // Compte créé avec un code : l'Entraînement seulement (Budget et CAPEPS sont propres à Titouan)
  const [compte] = useReglage<ReglageCompte>('compte', {})
  return (
    <div className="pt-sur fixed inset-0 flex flex-col overflow-hidden overscroll-none px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between pt-6">
        <h1 className="text-3xl font-bold tracking-tight">{salut} 👋</h1>
        <Link to="/reglages" aria-label="Réglages" className="p-1 text-texte-3"><IconeReglages className="h-7 w-7" /></Link>
      </div>
      <div className="mt-5 flex flex-1 flex-col gap-3">
        {MODULES.filter((m) => !m.masque && (!compte.invite || m.id === 'entrainement')).map(({ id, nom, bientot, chemin, couleur, Icone }) => (
          <Link key={id} to={chemin} style={{ '--c': couleur, borderColor: `color-mix(in srgb, ${couleur} 35%, transparent)` } as CSSProperties}
            className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-2 bg-surface p-4 text-center active:scale-[0.98] ${bientot ? 'opacity-60' : ''}`}>
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: `color-mix(in srgb, ${couleur} 18%, transparent)`, color: couleur }}>
              <Icone className="h-12 w-12" />
            </span>
            <span className="text-2xl font-bold">{nom}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
