import { Link } from 'react-router-dom'
import { Carte } from '../core/ui/Carte'
import { EnTete } from '../core/ui/EnTete'
import { SectionCompte } from './SectionCompte'
import { SectionImport } from './SectionImport'
import { SectionRappels } from './SectionRappels'

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
  return (
    <>
      <EnTete titre="Réglages" />
      <div className="space-y-3 px-4">
        <SectionCompte />
        <SectionRappels />
        <SectionImport />
        <Carte titre="État de l'appli">
          <Ligne libelle="Installée sur l'écran d'accueil" valeur={installee ? 'Oui ✓' : 'Non'} ok={installee} />
          <Ligne libelle="Version" valeur={__VERSION__} />
          {!installee && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-texte-2">
              <li>Ouvre cette page dans Safari</li>
              <li>Touche le bouton Partager (carré avec une flèche)</li>
              <li>Choisis « Sur l'écran d'accueil »</li>
            </ol>
          )}
        </Carte>
        <p className="text-center text-sm text-texte-3">Les réglages propres à chaque module sont dans son onglet Réglages.</p>
        <Link to="/" className="block py-2 text-center text-sm text-texte-2">‹ Retour à l'accueil</Link>
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
