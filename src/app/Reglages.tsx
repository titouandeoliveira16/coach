import { Carte } from '../core/ui/Carte'
import { EnTete } from '../core/ui/EnTete'

/** Vrai si l'appli est lancée depuis l'écran d'accueil (et non dans Safari). */
function estInstallee() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Propriété spécifique à Safari sur iPhone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Réglages généraux. Le contenu (profil, sauvegarde…) arrive à l'étape 2. */
export function Reglages() {
  const installee = estInstallee()

  return (
    <>
      <EnTete titre="Réglages" />
      <div className="space-y-3 px-4">
        <Carte titre="État de l'appli">
          <Ligne libelle="Installée sur l'écran d'accueil" valeur={installee ? 'Oui ✓' : 'Non'} ok={installee} />
          <Ligne libelle="Version" valeur={__VERSION__} />
        </Carte>
        {!installee && (
          <Carte titre="Installer sur iPhone">
            <ol className="list-decimal space-y-1 pl-5 text-texte-2">
              <li>Ouvre cette page dans Safari</li>
              <li>Touche le bouton Partager (carré avec une flèche)</li>
              <li>Choisis « Sur l'écran d'accueil »</li>
            </ol>
          </Carte>
        )}
        <Carte titre="À venir (étape 2)">
          <p className="text-texte-2">Profil, VMA, FTP, zones et sauvegarde des données.</p>
        </Carte>
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
