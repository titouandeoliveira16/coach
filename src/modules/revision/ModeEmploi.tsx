import type { ReactNode } from 'react'
import { EnTete } from '../../core/ui/EnTete'

function Rubrique({ titre, children, ouverte = false }: { titre: string; children: ReactNode; ouverte?: boolean }) {
  return (
    <details open={ouverte} className="group rounded-2xl border border-bordure bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 font-semibold">
        {titre}
        <span className="text-texte-3 transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2 px-4 pb-4 text-[15px] leading-relaxed text-texte-2">{children}</div>
    </details>
  )
}
const B = ({ children }: { children: ReactNode }) => <b className="text-texte">{children}</b>

/** Mode d'emploi du module Révision CAPEPS. */
export function ModeEmploiRevision() {
  return (
    <>
      <EnTete titre="Mode d'emploi" />
      <div className="space-y-3 px-4">
        <Rubrique titre="L'idée en 30 secondes" ouverte>
          <p>Tu ouvres <B>Aujourd'hui</B> : « Maintenant » te dit quoi faire, puis la notion du jour et tes rappels.</p>
          <p>Tu n'as que deux gestes : <B>« Notion finie »</B> quand tu as fini une notion, et <B>su / hésitant / raté</B> après chaque rappel. Tout le reste se recalcule seul à partir de tes vraies dates.</p>
        </Rubrique>
        <Rubrique titre="📖 Une nouvelle notion">
          <p>Le <B>matin</B>, en blocs de 50 min (minuteur ⏱️) avec un objectif chacun, et une mini feuille blanche à la fin de chaque bloc. Téléphone loin.</p>
          <p>Notion finie → touche <B>« Notion finie »</B> : ce jour devient son J0, ses rappels sont créés (J+1, J+4, J+10, J+21, J+45, J+90) et la notion suivante passe en cours.</p>
          <p>L'après-midi : <B>feuille blanche de fixation</B> (45 min à 1 h), puis coche-la.</p>
        </Rubrique>
        <Rubrique titre="🔁 Les rappels">
          <p>En feuille blanche, l'après-midi : cache la fiche, écris tout ce que tu sais, corrige avec la fiche.</p>
          <p><B>Su</B> : la série continue. <B>Hésitant</B> : un rappel de plus demain. <B>Raté</B> : la notion repart de zéro (J+1, J+4…).</p>
          <p>Chaque jour a un temps de rappels maximum. Les plus urgents passent d'abord (J+1, puis J+4…) ; le reste glisse au lendemain. Tu ne règles jamais un rappel à la main.</p>
        </Rubrique>
        <Rubrique titre="⏳ Retard">
          <p>Un retard est juste une donnée : la notion suivante commence quand tu as fini la précédente, et la <B>date de fin projetée</B> (onglet Aujourd'hui) se décale. La marge se rattrape à Noël, pas sur les rappels.</p>
        </Rubrique>
        <Rubrique titre="⏱️ Les sujets (à partir du 22/12)">
          <p>Onglet <B>Sujets</B> : note chaque sujet (écrit, type, durée, note) et coche les notions faibles : elles reviennent en rappel ciblé le lendemain.</p>
        </Rubrique>
        <Rubrique titre="⚙️ Réglages">
          <p>Dates (vacances, concours, phases), temps de rappels par jour, et après le 22 janvier : tes nouveaux après-midis de stage. Le lundi, « Pas de stage cet après-midi » (dans Aujourd'hui) libère l'après-midi pour des rappels.</p>
        </Rubrique>
      </div>
    </>
  )
}
