import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { remiseFaite, repartirDeZero } from '../plan/remiseAZero'

/** Carte unique : repartir de zéro en gardant cette semaine (disparaît une fois faite). */
export function CarteRemise() {
  const faite = useLiveQuery(remiseFaite)
  const [occupe, setOccupe] = useState(false)
  if (faite !== false || aujourdhui() > '2026-10-25') return null
  return (
    <Carte titre="Repartir de zéro">
      <ul className="space-y-1 text-sm text-texte-2">
        <li>✓ Gardé : tes séances de cette semaine, tes mesures du matin, tes pesées, tes réglages.</li>
        <li>✗ Supprimé : l'historique d'avant le 19/10, toutes les séances prévues.</li>
        <li>＋ Ajouté : vendredi HT Z2 1 h, samedi footing 45', dimanche HT Z2 longue 2 h.</li>
      </ul>
      <p className="mt-2 text-xs text-texte-3">À faire une seule fois, sur l'appareil où tout est à jour : ça s'applique aussi au serveur et à tes autres appareils.</p>
      <Bouton className="mt-3" disabled={occupe} onClick={async () => {
        if (!confirm('Repartir de zéro ? L’historique d’avant le 19/10 sera supprimé partout.')) return
        setOccupe(true)
        await repartirDeZero()
        setOccupe(false)
      }}>{occupe ? 'Remise à zéro…' : 'Repartir de zéro'}</Bouton>
    </Carte>
  )
}
