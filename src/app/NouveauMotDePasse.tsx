import { useState } from 'react'
import { Bouton } from '../core/ui/Bouton'
import { Feuille } from '../core/ui/Feuille'
import { changerMotDePasse } from '../core/motDePasse'

/** Après le lien « mot de passe oublié » : choisir le nouveau mot de passe. */
export function NouveauMotDePasse() {
  const [mdp, setMdp] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  const [fait, setFait] = useState(false)
  if (fait) return null
  return (
    <Feuille titre="Nouveau mot de passe" onFermer={() => setFait(true)}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault()
        setOccupe(true)
        setMessage(undefined)
        try {
          await changerMotDePasse(mdp)
          setFait(true)
          alert('Mot de passe changé. Si ton appli est sur l’écran d’accueil, connecte-toi dedans avec ce nouveau mot de passe.')
        } catch (err) {
          setMessage((err as Error).message)
        } finally {
          setOccupe(false)
        }
      }}>
        <input type="password" autoComplete="new-password" placeholder="Nouveau mot de passe (6 caractères min.)" value={mdp} onChange={(e) => setMdp(e.target.value)}
          className="w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent" />
        <Bouton type="submit" disabled={mdp.length < 6 || occupe}>{occupe ? 'Un instant…' : 'Enregistrer'}</Bouton>
        {message && <p className="text-sm text-mauvais">{message}</p>}
      </form>
    </Feuille>
  )
}
