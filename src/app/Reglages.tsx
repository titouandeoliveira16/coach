import type { CSSProperties } from 'react'
import { Carte } from '../core/ui/Carte'
import { ChampNombre } from '../core/ui/ChampNombre'
import { EnTete } from '../core/ui/EnTete'
import { useProfil } from '../core/profil'
import { MODULES } from './modules'
import { SectionCompte } from './SectionCompte'

/** Vrai si l'appli est lancée depuis l'écran d'accueil (et non dans Safari). */
function estInstallee() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Propriété spécifique à Safari sur iPhone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Réglages : compte, profil, réglages de chaque module et état de l'appli. Tout se sauvegarde sur le serveur. */
export function Reglages() {
  const [profil, modifierProfil] = useProfil()
  const installee = estInstallee()

  return (
    <>
      <EnTete titre="Réglages" />
      <div className="space-y-3 px-4">
        <SectionCompte />

        <Carte titre="Profil">
          <ChampNombre libelle="FC max" unite="bpm" decimales={0} valeur={profil.fcMax} onValider={(v) => modifierProfil({ fcMax: v })} />
          <p className="text-xs text-texte-3">Sert à calculer la charge de chaque séance depuis ta fréquence cardiaque (TRIMP).</p>
        </Carte>

        {/* Chaque module affiche ses réglages avec sa propre couleur d'accent */}
        {MODULES.filter((m) => m.SectionReglages).map((m) => (
          <div key={m.id} style={{ '--accent': m.couleur } as CSSProperties} className="space-y-3">
            {m.SectionReglages && <m.SectionReglages />}
          </div>
        ))}

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
