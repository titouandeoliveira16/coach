import { Component, type ReactNode } from 'react'
import { rechargerPourNouvelleVersion, signalerErreur } from '../erreurs'

/** Morceau d'appli introuvable : l'appli ouverte date d'avant la dernière publication. */
export const estVersionPerimee = (e: unknown) =>
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i.test(String((e as Error)?.message ?? e))

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
    // Nouvelle version publiée pendant que l'appli était ouverte (16/11/2026) : un morceau de l'ancienne version
    // n'existe plus sur le serveur. On recharge une fois pour prendre la nouvelle, sans signaler d'erreur.
    if (estVersionPerimee(erreur)) {
      let deja = false
      try { deja = sessionStorage.getItem('coach-recharge-version') === '1'; sessionStorage.setItem('coach-recharge-version', '1') } catch { /* stockage indisponible */ }
      if (!deja) return rechargerPourNouvelleVersion()
      // Déjà rechargé il y a moins de 10 s (audit du 18/11/2026) : pas un bug, la nouvelle version finit d'arriver
      return
    }
    signalerErreur(erreur, 'Écran')
  }
  render() {
    if (!this.state.erreur) return this.props.children
    if (estVersionPerimee(this.state.erreur)) return (
      <div className="pt-sur flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-xl font-bold">Nouvelle version</p>
        <p className="text-sm text-texte-2">Une mise à jour de l'appli vient d'arriver. Recharge pour l'utiliser : tes données ne sont pas touchées.</p>
        <button type="button" className="presse mt-2 rounded-[14px] bg-accent px-6 py-3 font-bold text-fond" onClick={() => location.reload()}>Recharger</button>
      </div>
    )
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
