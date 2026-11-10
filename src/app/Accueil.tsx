import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, HeartPulse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aujourdhui, depuisJour } from '../core/dates'
import { db } from '../core/db'
import { IconeReglages } from '../core/ui/icones'
import { MODULES } from './modules'
import { useReglage } from '../core/reglages'
import type { ReglageCompte } from '../core/inscription'

const FEUX = { vert: ['var(--color-bon)', 'Forme : vert'], orange: ['var(--color-attention)', 'Forme : orange'], rouge: ['var(--color-mauvais)', 'Forme : rouge'] } as const
const SOUS_TITRES: Record<string, string> = { revision: 'Tes rappels et ta notion du jour', budget: 'Ton mois et ton reste à vivre' }

/** Accueil (maquette V2) : la date, ta forme du jour, puis une carte par module avec une ligne de résumé. */
export function Accueil() {
  const heure = new Date().getHours()
  const salut = heure < 18 ? 'Bonjour' : 'Bonsoir'
  const jour = aujourdhui()
  // Compte créé avec un code : l'Entraînement seulement (Budget et CAPEPS sont propres à Titouan)
  const [compte] = useReglage<ReglageCompte>('compte', {})
  const resume = useLiveQuery(async () => {
    const decision = await db.decisions.get(jour)
    const seance = (await db.prevues.where('date').equals(jour).toArray()).find((p) => p.sport === 'velo' && p.statut !== 'non-faite')
    return { couleur: decision?.couleur, seance: seance ? `${seance.statut === 'faite' ? 'Faite : ' : 'Aujourd’hui : '}${seance.titre}` : 'Pas de vélo aujourd’hui' }
  }, [jour])
  const date = depuisJour(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="pt-sur fixed inset-0 flex flex-col overflow-y-auto overscroll-none px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between pt-6">
        <div>
          <p className="text-sm text-texte-2">{salut}</p>
          <h1 className="titre-ecran text-[28px]">{date}</h1>
        </div>
        <Link to="/reglages" aria-label="Réglages" className="presse p-1 text-texte-3"><IconeReglages className="h-6 w-6" /></Link>
      </div>
      {resume?.couleur && (
        <div className="entree mt-5 flex items-center gap-3 rounded-[14px] bg-surface p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${FEUX[resume.couleur][0]} 15%, transparent)` }}>
            <HeartPulse className="h-6 w-6" style={{ color: FEUX[resume.couleur][0] }} strokeWidth={1.8} />
          </span>
          <span className="font-semibold">{FEUX[resume.couleur][1]}</span>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2.5">
        {MODULES.filter((m) => !m.masque && (!compte.invite || m.id === 'entrainement')).map(({ id, nom, bientot, chemin, couleur, Icone }, i) => (
          <Link key={id} to={chemin} style={{ animationDelay: `${i * 60}ms` }}
            className={`presse entree flex items-center gap-3.5 rounded-[14px] bg-surface p-4 ${bientot ? 'opacity-60' : ''}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2" style={{ color: couleur }}>
              <Icone className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="titre-ecran block text-lg">{nom}</span>
              <span className="block text-sm leading-snug text-texte-2">{id === 'entrainement' ? resume?.seance : SOUS_TITRES[id] ?? ''}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-texte-3" strokeWidth={1.8} />
          </Link>
        ))}
      </div>
    </div>
  )
}
