import { conseilsSeance, palierVentre, SEMAINES_VENTRE } from '../../../metrics/nutritionSeance'
import { dureeDeCourse, epreuveDe, niveauxCourses } from '../../../metrics/programme'
import { decalerJour, ecartJours } from '../../../core/dates'
import { useReglage } from '../../../core/reglages'
import { Aide } from '../../../core/ui/Aide'
import { AIDES } from '../aides'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { lundiDe } from '../seances/donnees'
import type { SeancePrevue } from '../types'

/** Notes du ventre (0 à 10) après les sorties longues où tu habitues ton ventre, par date. */
export const useNotesVentre = () => useReglage<Record<string, number>>('ventre', {})

/**
 * Habituer ton ventre : la sortie longue de cette date est-elle dans les 6 semaines avant une course A de plus de
 * 2 h 30 ? Si oui, son palier (g/h) et le numéro de semaine.
 */
function fenetreVentre(date: string, prog: ReturnType<typeof programmeDe>, notes: Record<string, number>, cpW?: number) {
  const niveaux = niveauxCourses(prog.competitions, prog.phases)
  const a = prog.competitions.filter((c) => c.date >= date && niveaux.get(c.date) === 'A').sort((x, y) => x.date.localeCompare(y.date))[0]
  if (!a) return undefined
  const duree = dureeDeCourse(a, { discipline: prog.discipline ?? 'route', typeCourse: prog.typeCourse, dureeCourseMin: prog.dureeCourseMin, cpW })
  if (duree <= 150) return undefined
  const debut = decalerJour(lundiDe(a.date), -7 * SEMAINES_VENTRE)
  if (date < debut) return undefined
  const semaine = Math.min(SEMAINES_VENTRE - 1, Math.floor(ecartJours(debut, date) / 7))
  const parSemaine: (number | undefined)[] = Array.from({ length: SEMAINES_VENTRE }, () => undefined)
  for (const [d, n] of Object.entries(notes)) {
    if (d < debut || d >= date) continue
    const i = Math.floor(ecartJours(debut, d) / 7)
    if (i >= 0 && i < SEMAINES_VENTRE) parSemaine[i] = n
  }
  return { semaine, palier: palierVentre({ semaine, notes: parSemaine, dureeCourseMin: duree }) }
}

/** Repères de nutrition d'une séance : avant, pendant (selon la discipline de la course), boire, après ; ventre à noter. */
export function NutritionSeance({ p }: { p: SeancePrevue }) {
  const [r] = useReglagesEntrainement()
  const [notes, modifierNotes] = useNotesVentre()
  const prog = programmeDe(r.programme)
  const course = prog.competitions.find((c) => c.date === p.date)
  const epreuve = p.velo?.famille === 'course' || p.velo?.famille === 'simulation-xco'
    ? course?.epreuve ?? epreuveDe(prog.discipline ?? 'route', prog.typeCourse)
    : undefined
  const longue = p.velo?.famille === 'z2-long' || p.velo?.famille === 'cyclo-montees'
  const ventre = longue ? fenetreVentre(p.date, prog, notes, r.cpW) : undefined
  const c = conseilsSeance({ sport: p.sport, dureeMin: p.dureeMin, intensite: p.intensite, test: p.velo?.famille === 'test', epreuve, palierVentre: ventre?.palier })
  const lignes = [
    ...(c.avant ? [['Avant', c.avant]] : []),
    ['Pendant', c.pendant],
    ...(c.melange ? [['Mélange', c.melange]] : []),
    ['Boire', c.hydratation],
    ['Après', c.apres],
  ]
  const note = notes[p.date]
  return (
    <div className="mt-2 rounded-[10px] bg-surface-2 p-2.5 text-sm">
      <p className="etiquette mb-1">Nutrition<Aide titre="Nutrition de la séance" texte={AIDES.nutritionSeance} /></p>
      <ul className="space-y-1">
        {lignes.map(([titre, texte]) => (
          <li key={titre}><b>{titre} :</b> <span className="text-texte-2">{texte}</span></li>
        ))}
      </ul>
      {ventre && (
        <div className="mt-2 border-t border-bordure pt-2">
          <p className="text-xs text-texte-2">Habituer ton ventre · semaine {ventre.semaine + 1}/{SEMAINES_VENTRE} · {ventre.palier} g/h<Aide titre="Habituer ton ventre" texte={AIDES.ventre} /></p>
          {p.statut === 'faite' && (
            <>
              <p className="mt-1.5 text-xs text-texte-3">Ton ventre pendant la sortie : 0 = parfait, 10 = très mal (nausée, ballonnements, crampes, toilettes)</p>
              <div className="mt-1 grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, n) => (
                  <button key={n} type="button" onClick={() => modifierNotes({ [p.date]: n })}
                    className={`presse min-h-11 rounded-lg text-sm font-semibold ${note === n ? 'bg-accent text-fond' : 'bg-surface text-texte-2'}`}>{n}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
