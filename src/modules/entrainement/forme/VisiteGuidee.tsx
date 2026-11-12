import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb, X } from 'lucide-react'
import { aujourdhui, ecartJours } from '../../../core/dates'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db'
import { useReglage } from '../../../core/reglages'

/** Réglage « visite » : visite guidée faite (ou passée) et date de début des astuces des premiers jours. */
export interface ReglageVisite {
  faite?: boolean
  debut?: string
  /** Jours où l'astuce a été fermée */
  astucesFermees?: string[]
}
export const useVisite = () => useReglage<ReglageVisite>('visite', {})

const ETAPES: { cible: string; titre: string; texte: string }[] = [
  { cible: 'forme', titre: 'Ta forme du jour', texte: 'Chaque matin, 5 notes en 30 secondes (et ta montre pour la récupération et la nuit) : l’appli allume un feu vert, orange ou rouge. Touche « Détail » pour voir pourquoi.' },
  { cible: 'seance', titre: 'Ta séance', texte: 'Elle s’adapte à ton feu : complète au vert, raccourcie à l’orange, très facile au rouge. Envoie-la à Zwift ou à ta montre, et ouvre « Détail » pour le déroulé minute par minute.' },
  { cible: 'imprevu', titre: 'Un imprévu ?', texte: 'Vélo en panne, malade : dis-le ici, l’appli réorganise ta semaine sans que tu aies à tout recalculer.' },
  { cible: 'onglets', titre: 'Les 4 onglets', texte: 'Semaine : tes séances des 7 jours. Saison : tes phases jusqu’à ta course. Progrès : tes tests et records. Touche un onglet, ou glisse ton doigt vers la gauche ou la droite.' },
  { cible: 'barre-reglages', titre: 'Tes réglages', texte: 'Ta semaine type (jours de vélo), tes courses, ta CP. Change-les quand ta vie change : la suite de ta saison se recalcule toute seule.' },
]

/** Astuce de chaque jour de la première semaine (carte en haut d'Aujourd'hui). */
const ASTUCES = [
  'Demain matin, remplis tes 5 notes dès le réveil (avant le café) : c’est ce qui allume ton feu du jour.',
  'Touche « Détail » sous ta séance : tu verras chaque bloc, ses watts et ce qu’il faut manger.',
  'Envoie ta séance à Zwift ou à ta montre avec le bouton orange : plus besoin de la recopier.',
  'Après une séance d’intensité, réponds à « Tenue ? » : c’est ce qui fait progresser la suivante.',
  'Glisse ton doigt vers la gauche : l’onglet Semaine montre tes 7 jours et tes kJ faits sur prévus.',
  'Les petits « ? » expliquent chaque chiffre, avec les études qui l’appuient.',
  'Le dimanche, ouvre Semaine : le bilan te dit si tout s’est bien passé, et la semaine suivante est prête.',
]

/** Carte « Astuce du jour » pendant les 7 premiers jours (après la visite), fermable. */
export function AstuceDuJour() {
  const [v, modifier] = useVisite()
  const jour = aujourdhui()
  if (!v.faite || !v.debut) return null
  const n = ecartJours(v.debut, jour)
  if (n < 0 || n >= ASTUCES.length || v.astucesFermees?.includes(jour)) return null
  return (
    <div className="entree flex shrink-0 items-start gap-2.5 rounded-[14px] border border-accent/40 bg-accent/10 p-3">
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
      <p className="flex-1 text-sm"><b>Astuce du jour {n + 1}/7.</b> {ASTUCES[n]}</p>
      <button type="button" aria-label="Fermer l’astuce" className="-m-1 p-1 text-texte-3" onClick={() => modifier({ astucesFermees: [...(v.astucesFermees ?? []), jour] })}>
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Visite guidée (11/11/2026) : au premier passage sur Aujourd'hui, 5 bulles montrent chaque zone de l'écran.
 * « Passer » à tout moment ; elle se relance depuis Accueil → ⚙️.
 */
export function VisiteGuidee() {
  const [v, modifier] = useVisite()
  const [etape, setEtape] = useState(0)
  const [rect, setRect] = useState<DOMRect>()
  // null = jamais enregistré (nouvel utilisateur) ; undefined = lecture en cours (rien n'apparaît en attendant)
  const ligne = useLiveQuery(async () => (await db.reglages.get('visite')) ?? null)
  const active = ligne !== undefined && (ligne === null || v.faite === false)
  const e = ETAPES[etape]

  useLayoutEffect(() => {
    if (!active) return
    const mesurer = () => {
      const el = document.querySelector(`[data-visite="${e.cible}"]`) as HTMLElement | null
      if (!el) return setRect(undefined)
      el.scrollIntoView({ block: 'nearest' })
      setRect(el.getBoundingClientRect())
    }
    // L'écran se met en place (cartes qui arrivent, onglets posés en bas) : mesure un peu après
    const t = setTimeout(mesurer, 500)
    window.addEventListener('resize', mesurer)
    return () => { clearTimeout(t); window.removeEventListener('resize', mesurer) }
  }, [active, e?.cible])
  useEffect(() => { if (!active) setEtape(0) }, [active])

  if (!active || !e) return null
  const finir = () => modifier({ faite: true, debut: v.debut ?? aujourdhui() })
  const marge = 6
  const enHaut = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Visite guidée">
      {/* Zone montrée : tout le reste est assombri */}
      {rect ? (
        <div className="pointer-events-none absolute rounded-[16px] border-2 border-accent transition-all duration-300"
          style={{ left: rect.left - marge, top: rect.top - marge, width: rect.width + 2 * marge, height: rect.height + 2 * marge, boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)' }} />
      ) : <div className="absolute inset-0 bg-black/70" />}
      <div className="feuille absolute inset-x-4 mx-auto max-w-md rounded-2xl border border-bordure bg-surface p-4 shadow-xl"
        style={rect ? (enHaut ? { bottom: window.innerHeight - rect.top + marge + 10 } : { top: rect.bottom + marge + 10 }) : { top: '30%' }}>
        <p className="text-xs font-semibold text-accent">{etape + 1} / {ETAPES.length}</p>
        <p className="mt-0.5 text-lg font-bold">{e.titre}</p>
        <p className="mt-1 text-sm text-texte-2">{e.texte}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" className="py-2 text-sm text-texte-3" onClick={finir}>Passer</button>
          <button type="button" className="presse rounded-[12px] bg-accent px-5 py-2.5 font-bold text-fond"
            onClick={() => (etape + 1 < ETAPES.length ? setEtape(etape + 1) : finir())}>
            {etape + 1 < ETAPES.length ? 'Suivant' : 'C’est parti'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
