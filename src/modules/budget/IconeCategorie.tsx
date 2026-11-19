/**
 * Icônes au trait des catégories (audit visuel du 18/11/2026 : plus d'emoji, rendu inégal selon l'iPhone).
 * Le champ `emoji` des catégories reste la clé enregistrée (pas de migration des données synchronisées) : il est
 * traduit ici en icône Lucide ; une clé inconnue (emoji tapé à la main avant) devient une étiquette.
 */
import {
  ArrowLeftRight, Banknote, Bike, Briefcase, Car, ChefHat, Coffee, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap,
  Handshake, House, IdCard, Landmark, Music, Package, PawPrint, PiggyBank, Pill, Plane, Plus, Shirt, ShoppingCart,
  Smartphone, Tag, TrendingUp, Undo2, Utensils, Wallet, Book, Baby, Scissors, Ticket, type LucideIcon,
} from 'lucide-react'

/** Clé enregistrée → icône. Les clés sont les emoji des catégories toutes faites (données existantes). */
export const ICONES_CATEGORIE: [string, LucideIcon, string][] = [
  ['🛒', ShoppingCart, 'Courses'], ['🚗', Car, 'Voiture'], ['⛽', Fuel, 'Carburant'], ['🏠', House, 'Maison'],
  ['📱', Smartphone, 'Téléphone'], ['💊', Pill, 'Santé'], ['✂️', Scissors, 'Soins'], ['🏦', Landmark, 'Banque'],
  ['🐾', PawPrint, 'Animaux'], ['🍽️', Utensils, 'Restaurant'], ['☕', Coffee, 'Café'], ['🎬', Film, 'Cinéma'],
  ['🎟️', Ticket, 'Sortie'], ['🎵', Music, 'Musique'], ['🎮', Gamepad2, 'Jeux'], ['👕', Shirt, 'Vêtements'],
  ['📚', Book, 'Livres'], ['🚴', Bike, 'Vélo'], ['🏋️', Dumbbell, 'Sport'], ['✈️', Plane, 'Voyage'], ['🎁', Gift, 'Cadeau'],
  ['👶', Baby, 'Enfant'], ['📦', Package, 'Divers'], ['💼', Briefcase, 'Salaire'], ['🎓', GraduationCap, 'Bourse'],
  ['🧑‍💼', IdCard, 'Stage'], ['🧑‍🍳', ChefHat, 'Job'], ['↩️', Undo2, 'Remboursement'], ['🤝', Handshake, 'Proche'],
  ['➕', Plus, 'Autre'], ['💰', Banknote, 'Revenu'], ['🐷', PiggyBank, 'Épargne'], ['🏷️', Tag, 'Étiquette'],
]
const PAR_CLE = new Map(ICONES_CATEGORIE.map(([k, I]) => [k, I]))
/** Icônes des mouvements sans catégorie (virement, investissement, dépense ou revenu sans catégorie). */
export const ICONES_MOUVEMENT = { depense: Wallet, revenu: Banknote, virement: ArrowLeftRight, investissement: TrendingUp }

export function iconeDe(cle?: string): LucideIcon {
  return (cle && PAR_CLE.get(cle)) || Tag
}

export function IconeCategorie({ cle, icone, className = 'h-5 w-5' }: { cle?: string; icone?: LucideIcon; className?: string }) {
  const I = icone ?? iconeDe(cle)
  return <I className={className} strokeWidth={1.8} aria-hidden />
}
