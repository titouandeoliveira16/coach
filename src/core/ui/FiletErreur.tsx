import { Component, type ReactNode } from 'react'
import { signalerErreur } from '../erreurs'

/**
 * Filet de sécurité (11/11/2026) : si un écran plante, on affiche un message et un bouton pour recharger au lieu d'un
 * écran noir, et l'erreur est envoyée au coach.
 */
export class FiletErreur extends Component<{ children: ReactNode }, { erreur?: Error }> {
  state: { erreur?: Error } = {}
  static getDerivedStateFromError(erreur: Error) {
    return { erreur }
  }
  componentDidCatch(erreur: Error) {
    signalerErreur(erreur, 'Écran')
  }
  render() {
    if (!this.state.erreur) return this.props.children
    return (
      <div className="pt-sur flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-xl font-bold">Oups, cet écran a planté</p>
        <p className="text-sm text-texte-2">Ce n'est pas de ta faute : l'erreur a été envoyée pour être corrigée. Tes données ne sont pas touchées.</p>
        <button type="button" className="presse mt-2 rounded-[14px] bg-accent px-6 py-3 font-bold text-fond" onClick={() => location.reload()}>Recharger l'appli</button>
        <button type="button" className="text-sm text-texte-3" onClick={() => { location.hash = '#/'; this.setState({ erreur: undefined }) }}>Revenir à l'accueil</button>
      </div>
    )
  }
}
