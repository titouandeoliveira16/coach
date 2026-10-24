import { Link } from 'react-router-dom'
import { Carte } from '../../core/ui/Carte'
import { EnTete } from '../../core/ui/EnTete'

/** Module Argent : en préparation. */
export function EcranArgent() {
  return (
    <>
      <EnTete titre="Argent" />
      <div className="space-y-3 px-4">
        <Carte>
          <p className="text-lg font-semibold">🚧 Bientôt</p>
          <p className="mt-1 text-sm text-texte-2">Ce module est en préparation. On définira ensemble ce que tu veux y suivre.</p>
        </Carte>
        <Link to="/" className="block py-2 text-center text-sm text-accent">‹ Retour à l'accueil</Link>
      </div>
    </>
  )
}
