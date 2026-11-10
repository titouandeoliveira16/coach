/**
 * Icônes de l'appli : Lucide (DESIGN.md), trait fin, couleur du texte courant. Fonctionnent hors ligne (dans le paquet).
 */
import { Bike, BookOpen, Dumbbell, House, CircleHelp, Library, Plus, SlidersHorizontal, Wallet, type LucideIcon } from 'lucide-react'

type Props = { className?: string }
const icone = (I: LucideIcon) => ({ className }: Props) => <I className={className} strokeWidth={1.8} aria-hidden />

/** Vélo : module Entraînement */
export const IconeEntrainement = icone(Bike)
export const IconeReglages = icone(SlidersHorizontal)
export const IconePlus = icone(Plus)
export const IconeAide = icone(CircleHelp)
export const IconeArgent = icone(Wallet)
export const IconeAccueil = icone(House)
export const IconeRevision = icone(BookOpen)
export const IconeMuscu = icone(Dumbbell)
export const IconeCatalogue = icone(Library)
