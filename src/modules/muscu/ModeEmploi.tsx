import type { ReactNode } from 'react'
import { EnTete } from '../../core/ui/EnTete'

const B = ({ children }: { children: ReactNode }) => <b className="text-texte">{children}</b>

/** Mode d'emploi du module Muscu. */
export function ModeEmploiMuscu() {
  return (
    <>
      <EnTete titre="Mode d'emploi" />
      <div className="space-y-3 px-4 text-[15px] leading-relaxed text-texte-2">
        <p><B>Le principe.</B> Un cycle de 4 semaines, une séance de développé couché par semaine. Tout est calculé à partir d'une <B>référence</B> : 85 % de ton max en perte de gras, 90 % en maintien. Tu ne touches jamais ton vrai max.</p>
        <p><B>Les semaines.</B> 1 : 5/5/5+ à 65-75-85 %. 2 : 3/3/3+ à 70-80-90 %. 3 : 5/3/1+ à 75-85-95 %. 4 : allègement à 40-50-60 %. Les semaines 1 à 3, un 5×5 à la charge de la 1re série complète la séance.</p>
        <p><B>La série « + ».</B> Le plus de reps possible, en gardant 1 rep en réserve (10 au plus). Note-la d'un toucher : c'est elle qui mesure ta progression.</p>
        <p><B>La progression.</B> À 95 % (semaine 3) : 3 reps ou plus → +2,5 kg au prochain cycle ; 1 ou 2 → même référence ; 0, ou 1 deux cycles de suite → −10 %.</p>
        <p><B>Repos et sécurité.</B> 3 min entre les séries lourdes, 2 min pour le 5×5 (minuteur dans la séance). Barres de sécurité ou pareur pour la série « + ».</p>
        <p><B>Une erreur ?</B> « Annuler la dernière séance notée ». Nouveau max : Réglages du module.</p>
      </div>
    </>
  )
}
