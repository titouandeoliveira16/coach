import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aujourdhui, depuisJour } from '../core/dates'
import { db } from '../core/db'
import { IconeReglages } from '../core/ui/icones'
import { MODULES } from './modules'
import { useReglage } from '../core/reglages'
import type { ReglageCompte } from '../core/inscription'
import { useParametres } from '../modules/revision/donnees'
import { joursAvant } from '../modules/revision/programme'
import { useBudget } from '../modules/budget/donnees'
import { resteAVivre } from '../modules/budget/calculs'
import { formatEuros, formatNombre } from '../core/format'
import { chargesSemaine } from '../modules/entrainement/plan/donnees'
import { lundiDe } from '../modules/entrainement/seances/donnees'

const SOUS_TITRES: Record<string, string> = { revision: 'Tes rappels et ta notion du jour', budget: 'Ton mois et ton reste à vivre' }

/** Révision : jours avant l'écrit et rappels à faire aujourd'hui. */
const resumeRevision = (j: number, rappels: number) =>
  `${j > 0 ? `J-${j}` : 'Concours'} · ${rappels ? `${rappels} rappel${rappels > 1 ? 's' : ''} aujourd’hui` : 'aucun rappel aujourd’hui'}`

function Jauge({ part, couleur, texte }: { part: number; couleur: string; texte: string }) {
  return (
    <span className="mt-2 block">
      <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, part * 100)}%`, background: couleur }} /></span>
      <span className="mt-1 block text-xs text-texte-2">{texte}</span>
    </span>
  )
}

/** Accueil (maquette V2) : la date, puis une carte par module avec son résumé et une jauge (kJ de la semaine, notions apprises). */
export function Accueil() {
  const heure = new Date().getHours()
  const salut = heure < 18 ? 'Bonjour' : 'Bonsoir'
  const jour = aujourdhui()
  // Compte créé avec un code : l'Entraînement seulement (Budget et CAPEPS sont propres à Titouan)
  const [compte] = useReglage<ReglageCompte>('compte', {})
  const [paramRevision] = useParametres()
  const budget = useBudget()
  // Budget : le reste à vivre du jour (une fois les comptes de départ saisis)
  const reste = budget?.comptes.length ? resteAVivre(budget, jour).reste : undefined
  const resumeBudget = reste !== undefined ? `Reste à vivre : ${formatEuros(reste)}` : undefined
  const resume = useLiveQuery(async () => {
    const rappels = (await db.revisions.toArray()).filter((r) => !r.fait && !r.annule && r.prevu <= jour).length
    const seance = (await db.prevues.where('date').equals(jour).toArray()).find((p) => p.sport === 'velo' && p.statut !== 'non-faite')
    // Semaine vélo : kJ faits sur kJ prévus
    const lundi = lundiDe(jour)
    const kj = await chargesSemaine(lundi).catch(() => undefined)
    const finies = (await db.notions.toArray()).filter((n) => n.statut === 'finie').length
    return { rappels, kjFaits: kj?.kjRealises ?? 0, kjPrevus: kj?.kjPrevus ?? 0, finies, seance: seance ? `${seance.statut === 'faite' ? 'Faite : ' : 'Aujourd’hui : '}${seance.titre}` : 'Pas de vélo aujourd’hui' }
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
      <div className="mt-6 flex flex-col gap-2.5">
        {MODULES.filter((m) => !m.masque && (!compte.invite || m.id === 'entrainement')).map(({ id, nom, bientot, chemin, couleur, Icone }, i) => (
          <Link key={id} to={chemin} style={{ animationDelay: `${i * 60}ms` }}
            className={`presse entree flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-[14px] bg-surface p-4 ${bientot ? 'opacity-60' : ''}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2" style={{ color: couleur }}>
              <Icone className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold">{nom}</span>
              <span className="block text-sm leading-snug text-texte-2">{id === 'entrainement' ? resume?.seance : id === 'revision' && resume ? resumeRevision(joursAvant(jour, paramRevision), resume.rappels) : id === 'budget' && resumeBudget ? resumeBudget : SOUS_TITRES[id] ?? ''}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-texte-3" strokeWidth={1.8} />
            {resume && <span className="basis-full pl-[62px]">{
              id === 'entrainement' ? resume.kjPrevus > 0 ? <Jauge part={resume.kjFaits / resume.kjPrevus} couleur={couleur} texte={`${formatNombre(Math.round(resume.kjFaits))} / ${formatNombre(Math.round(resume.kjPrevus))} kJ cette semaine`} /> : null
              : id === 'revision' ? <Jauge part={resume.finies / 41} couleur={couleur} texte={`${resume.finies} notion${resume.finies > 1 ? 's' : ''} sur 41 apprises`} />
              : null}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
