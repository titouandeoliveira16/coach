import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Flag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aujourdhui, decalerJour, depuisJour, ecartJours } from '../core/dates'
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
import { programmeDe, useReglagesEntrainement } from '../modules/entrainement/reglagesEntrainement'
import { niveauxCourses } from '../metrics/programme'
import { dernierJour, moisDe } from '../modules/budget/calculs'

const SOUS_TITRES: Record<string, string> = { revision: 'Tes rappels et ta notion du jour', budget: 'Ton mois et ton reste à vivre' }

/** Révision : jours avant l'écrit et rappels à faire aujourd'hui. */
const resumeRevision = (j: number, rappels: number) =>
  `${j > 0 ? `J-${j}` : 'Concours'} · ${rappels ? `${rappels} rappel${rappels > 1 ? 's' : ''} aujourd’hui` : 'aucun rappel aujourd’hui'}`

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** La semaine vélo en 7 points (plein = fait, cerclé = prévu) et la barre des kJ. */
function SemaineVelo({ jours, jour, kjFaits, kjPrevus, couleur }: { jours: { d: string; etat: string }[]; jour: string; kjFaits: number; kjPrevus: number; couleur: string }) {
  return (
    <span className="block">
      <span className="flex justify-between">
        {jours.map((j, i) => (
          <span key={j.d} className="flex flex-col items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2" style={{
              borderColor: j.etat === 'rien' ? 'var(--color-bordure)' : j.etat === 'ratee' ? 'var(--color-texte-3)' : couleur,
              background: j.etat === 'faite' ? couleur : 'transparent',
            }} />
            <span className={`text-[11px] ${j.d === jour ? 'font-bold text-texte' : 'text-texte-3'}`}>{LETTRES[i]}</span>
          </span>
        ))}
      </span>
      {kjPrevus > 0 && <Jauge part={kjFaits / kjPrevus} couleur={couleur} texte={`${formatNombre(Math.round(kjFaits))} / ${formatNombre(Math.round(kjPrevus))} kJ cette semaine`} />}
    </span>
  )
}

function Jauge({ part, couleur, texte }: { part: number; couleur: string; texte: string }) {
  return (
    <span className="mt-2 block">
      <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, part * 100)}%`, background: couleur }} /></span>
      <span className="mt-1 block text-xs text-texte-2">{texte}</span>
    </span>
  )
}

/** Accueil (maquette V2) : la date, puis une carte par module avec son résumé et un petit visuel (semaine vélo, notions, budget du jour). */
export function Accueil() {
  const heure = new Date().getHours()
  const salut = heure < 18 ? 'Bonjour' : 'Bonsoir'
  const jour = aujourdhui()
  // Compte créé avec un code : l'Entraînement seulement (Budget et CAPEPS sont propres à Titouan)
  const [compte] = useReglage<ReglageCompte>('compte', {})
  const [paramRevision] = useParametres()
  const budget = useBudget()
  // Prochaine course (la plus proche, en priorité une course A) : compte à rebours en bas de l'accueil
  const [reglagesEntr] = useReglagesEntrainement()
  const prog = programmeDe(reglagesEntr.programme)
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  const aVenir = prog.competitions.filter((c) => c.date >= jour).sort((a, b) => a.date.localeCompare(b.date))
  const course = aVenir.find((c) => niveaux.get(c.date) === 'A') ?? aVenir[0]
  // Budget : le reste à vivre du jour (une fois les comptes de départ saisis)
  const reste = budget?.comptes.length ? resteAVivre(budget, jour).reste : undefined
  const resumeBudget = reste !== undefined ? `Reste à vivre : ${formatEuros(reste)}` : undefined
  const joursRestants = Number(dernierJour(moisDe(jour)).slice(8)) - Number(jour.slice(8)) + 1
  const resume = useLiveQuery(async () => {
    const rappels = (await db.revisions.toArray()).filter((r) => !r.fait && !r.annule && r.prevu <= jour).length
    const seance = (await db.prevues.where('date').equals(jour).toArray()).find((p) => p.sport === 'velo' && p.statut !== 'non-faite')
    // Semaine vélo : un point par jour (fait, prévu, rien) et les kJ faits sur les kJ prévus
    const lundi = lundiDe(jour)
    const prevues = await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()
    const jours = Array.from({ length: 7 }, (_, i) => {
      const d = decalerJour(lundi, i)
      const v = prevues.filter((p) => p.date === d && p.sport === 'velo')
      return { d, etat: v.some((p) => p.statut === 'faite') ? 'faite' : v.some((p) => p.statut === 'prevue') ? 'prevue' : v.length ? 'ratee' : 'rien' }
    })
    const kj = await chargesSemaine(lundi).catch(() => undefined)
    const finies = (await db.notions.toArray()).filter((n) => n.statut === 'finie').length
    return { rappels, jours, kjFaits: kj?.kjRealises ?? 0, kjPrevus: kj?.kjPrevus ?? 0, finies, seance: seance ? `${seance.statut === 'faite' ? 'Faite : ' : 'Aujourd’hui : '}${seance.titre}` : 'Pas de vélo aujourd’hui' }
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
              id === 'entrainement' ? <SemaineVelo jours={resume.jours} jour={jour} kjFaits={resume.kjFaits} kjPrevus={resume.kjPrevus} couleur={couleur} />
              : id === 'revision' ? <Jauge part={resume.finies / 41} couleur={couleur} texte={`${resume.finies} notion${resume.finies > 1 ? 's' : ''} sur 41 apprises`} />
              : id === 'budget' && reste !== undefined ? <span className="block text-[13px] text-texte-2">soit <b className="text-texte">{formatEuros(Math.max(0, Math.floor(reste / joursRestants / 100) * 100))}</b> par jour d'ici la fin du mois</span>
              : null}</span>}
          </Link>
        ))}
        {course && (
          <Link to="/entrainement/saison" className="presse entree flex items-center gap-3.5 rounded-[14px] border border-bordure p-4" style={{ animationDelay: '200ms' }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-doux text-entrainement"><Flag className="h-6 w-6" strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-texte-2">{niveaux.get(course.date) === 'A' ? 'Objectif principal' : 'Prochaine course'}</span>
              <span className="block truncate text-lg font-bold">{course.nom}</span>
              <span className="block text-sm text-texte-2">{depuisJour(course.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="chiffre block text-[28px] leading-none text-entrainement">J-{ecartJours(jour, course.date)}</span>
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}
