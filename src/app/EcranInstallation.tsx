import { Share, SquarePlus } from 'lucide-react'
import { RoueCycle } from './RoueCycle'

/**
 * Sur iPhone, Cycle s'utilise depuis l'écran d'accueil (12/11/2026) : c'est la seule façon d'avoir les notifications,
 * et Safari ne partage pas sa mémoire avec l'appli installée (une connexion faite dans Safari serait à refaire).
 * Cet écran remplace donc tout le reste tant que l'appli est ouverte dans Safari.
 */
export function EcranInstallation() {
  const etape = (n: number, contenu: React.ReactNode) => (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">{n}</span>
      <span className="pt-0.5 text-[15px] leading-snug text-texte-2">{contenu}</span>
    </li>
  )
  return (
    <div className="pt-sur flex min-h-[100dvh] flex-col bg-fond px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3 pt-[8vh]">
        <RoueCycle taille={96} />
        <h1 className="text-[30px] font-extrabold tracking-[.06em] [font-stretch:125%]">CYCLE</h1>
      </div>
      <div className="mt-auto space-y-5 pt-10">
        <div>
          <h2 className="text-xl font-bold">Installe Cycle sur ton écran d’accueil</h2>
          <p className="mt-1 text-sm text-texte-2">C’est là que l’appli s’utilise : en plein écran, avec les notifications du matin et de tes séances.</p>
        </div>
        <ol className="space-y-3.5">
          {etape(1, <>En bas de Safari, touche <b className="inline-flex items-center gap-1 text-texte">Partager <Share className="inline size-4" strokeWidth={2.2} /></b>.</>)}
          {etape(2, <>Fais défiler, puis touche <b className="inline-flex items-center gap-1 text-texte">Sur l’écran d’accueil <SquarePlus className="inline size-4" strokeWidth={2.2} /></b>, puis <b className="text-texte">Ajouter</b>.</>)}
          {etape(3, <>Ferme Safari et ouvre <b className="text-texte">Cycle</b> depuis sa nouvelle icône.</>)}
        </ol>
        <p className="text-xs text-texte-3">Tu te connecteras ensuite dans l’appli installée.</p>
      </div>
    </div>
  )
}
