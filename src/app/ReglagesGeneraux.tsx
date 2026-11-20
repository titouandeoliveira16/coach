import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { Carte } from '../core/ui/Carte'
import { EnTete } from '../core/ui/EnTete'
import { SectionCodes } from './SectionCodes'
import { SectionCompte } from './SectionCompte'
import { SectionImport } from './SectionImport'
import { SectionRappels } from './SectionRappels'
import { SectionErreurs } from './SectionErreurs'
import { useNavigate } from 'react-router-dom'
import { useVisite } from '../modules/entrainement/forme/VisiteGuidee'
import { useReglage } from '../core/reglages'
import type { ReglageCompte } from '../core/inscription'
import { resumeVitesse, type MesureVitesse } from '../core/vitesse'

/** Vrai si l'appli est lancée depuis l'écran d'accueil (et non dans Safari). */
function estInstallee() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Propriété spécifique à Safari sur iPhone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Réglages communs à toute l'appli (depuis l'accueil) : compte, notifications, état. */
export function ReglagesGeneraux() {
  const installee = estInstallee()
  const [compte] = useReglage<ReglageCompte>('compte', {})
  const [mesures] = useReglage<MesureVitesse[]>('vitesse', [])
  const vitesse = resumeVitesse(mesures)
  const [, modifierVisite] = useVisite()
  const naviguer = useNavigate()
  return (
    <>
      {/* Retour en haut (16/11/2026) : avant, seulement tout en bas de la page */}
      <EnTete titre="Réglages" aDroite={<Link to="/" className="inline-block py-2 pl-4 text-base text-texte">‹ Accueil</Link>} />
      {/* Boutons principaux en orange, comme dans l'Entraînement (l'accueil a un accent blanc) */}
      <div className="space-y-3 px-4" style={{ '--color-accent': '#ff6a13' } as CSSProperties}>
        <SectionCompte />
        <SectionCodes />
        {!compte.invite && <SectionErreurs />}
        <SectionRappels />
        {/* Import de fichiers préparés : propre au compte de Titouan */}
        {!compte.invite && <SectionImport />}
        <Carte titre="État de l'appli">
          <Ligne libelle="Installée sur l'écran d'accueil" valeur={installee ? 'Oui ✓' : 'Non'} ok={installee} />
          <Ligne libelle="Version" valeur={__VERSION__.replace(/\.0$/, '')} />
          {vitesse && <Ligne libelle={`Ouverture (${vitesse.n} dernières)`} valeur={`${(vitesse.mediane / 1000).toFixed(1).replace('.', ',')} s · la plus lente ${(vitesse.pire / 1000).toFixed(1).replace('.', ',')} s`} />}
          {!installee && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-texte-2">
              <li>Ouvre cette page dans Safari</li>
              <li>Touche le bouton Partager (carré avec une flèche)</li>
              <li>Choisis « Sur l'écran d'accueil »</li>
            </ol>
          )}
        </Carte>
        <button type="button" className="presse w-full rounded-[14px] bg-surface p-4 text-left font-semibold"
          onClick={async () => { await modifierVisite({ faite: false }); naviguer('/entrainement/aujourdhui') }}>
          Revoir la visite guidée
        </button>
        <p className="text-center text-sm text-texte-3">Les réglages propres à chaque module sont dans son onglet Réglages.</p>
      </div>
    </>
  )
}

function Ligne({ libelle, valeur, ok }: { libelle: string; valeur: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-texte-2">{libelle}</span>
      <span className={ok ? 'font-semibold text-nutrition' : 'font-semibold'}>{valeur}</span>
    </div>
  )
}
