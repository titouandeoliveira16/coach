import type { ReactNode } from 'react'
import { EnTete } from '../core/ui/EnTete'

/** Une rubrique repliable. */
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

const Etape = ({ n, children }: { n: number; children: ReactNode }) => (
  <p className="flex gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-sm font-bold text-fond">{n}</span>
    <span>{children}</span>
  </p>
)

/** Mode d'emploi : comment se servir de l'appli, en quelques gestes. */
export function ModeEmploi() {
  return (
    <>
      <EnTete titre="Mode d'emploi" />
      <div className="space-y-3 px-4">
        <Rubrique titre="L'idée en 30 secondes" ouverte>
          <p>Tu fais ta course avec <b className="text-texte">Campus Coach</b>. L'appli s'occupe de ton <b className="text-texte">vélo</b> : elle le place autour de ta course, et l'adapte chaque matin à ta forme.</p>
          <p>Ton travail : <b className="text-texte">1 minute le matin</b>, <b className="text-texte">5 minutes le dimanche</b>. Le reste se fait tout seul.</p>
          <p>À l'ouverture, l'<b className="text-texte">Accueil</b> te propose les modules : Entraînement (et bientôt Argent). Le bouton 🏠 en bas y ramène.</p>
        </Rubrique>

        <Rubrique titre="☀️ Chaque matin : Aujourd'hui">
          <Etape n={1}>Remplis <b className="text-texte">Ton matin</b> : les chiffres de ta montre arrivent seuls, tu ajoutes juste tes 5 notes (sommeil, énergie, jambes, motivation, sérénité).</Etape>
          <Etape n={2}>Regarde ton <b className="text-texte">feu</b> et ta <b className="text-texte">séance du jour</b>.</Etape>
          <p>🟢 Fais la séance prévue.</p>
          <p>🟠 Fais la <b className="text-texte">version raccourcie</b> affichée (mêmes watts, moins de répétitions).</p>
          <p>🔴 Pas d'intensité aujourd'hui : 30 à 45 min très facile, ou repos. Ton intensité vélo est <b className="text-texte">reportée</b> au prochain jour possible de la semaine (sauf si tu es malade).</p>
          <p>Tu peux toujours appuyer sur « Je maintiens quand même ma séance ».</p>
          <p>Malade ou une douleur ? Appuie sur 🤒 ou 🤕.</p>
          <p>⚖️ <b className="text-texte">Poids</b> : touche la ligne quand tu veux te peser.</p>
        </Rubrique>

        <Rubrique titre="📅 Chaque dimanche : Semaine">
          <Etape n={1}>Va sur la semaine suivante (flèche ›).</Etape>
          <Etape n={2}>Avec le <b className="text-texte">+</b> de chaque jour, ajoute tes séances <b className="text-texte">Campus Coach</b> (type, durée) et ton renfo.</Etape>
          <Etape n={3}>Appuie sur <b className="text-texte">Générer mon vélo de la semaine</b>.</Etape>
          <p>Si ta course change en cours de semaine : modifie-la, puis « Recalculer le vélo ». Ce qui est déjà fait est gardé.</p>
          <p>Le dimanche (et le lundi), le <b className="text-texte">bilan</b> s'affiche dans Aujourd'hui : ce qui a été fait, ce qui change la semaine suivante, et pourquoi.</p>
          <p className="pt-1 font-semibold text-texte">Les couleurs</p>
          <p>🟢 faite · 🟠 à valider (rien n'est remonté, ou « Tenue ? » sans réponse) · 🔴 pas faite · sans couleur : à venir.</p>
          <p>Touche une séance pour voir son <b className="text-texte">déroulé minute par minute</b>, la marquer faite ou pas faite, la modifier, ou <b className="text-texte">↔ changer de jour</b> (si le jour choisi est pris, les deux séances échangent).</p>
        </Rubrique>

        <Rubrique titre="🚴 Pendant une séance vélo">
          <p>Suis le <b className="text-texte">déroulé</b> : chaque ligne donne l'heure de départ, ce qu'il faut faire et les watts.</p>
          <p>Enregistre la séance sur ta <b className="text-texte">Garmin 965</b> (associée au capteur de puissance du home trainer) : elle remonte seule dans l'appli, avec tes kJ.</p>
          <p>Après une séance d'intensité, réponds à <b className="text-texte">« Tenue ? »</b> : Oui = la prochaine sera un peu plus longue ou plus forte. Pas tout = un peu plus facile.</p>
        </Rubrique>

        <Rubrique titre="🔧 Un imprévu (vélo en panne)">
          <p>Dans <b className="text-texte">Aujourd'hui</b>, touche « Un imprévu ? Vélo en panne » et dis jusqu'à quand.</p>
          <p>L'appli annule le vélo de ces jours-là, déplace l'intensité après la réparation si possible, et rallonge un peu ton prochain footing facile (15 min au plus).</p>
          <p>Vélo réparé plus tôt ? Touche « Il remarche ».</p>
        </Rubrique>

        <Rubrique titre="🎯 Les tests CP">
          <p>Ils sont déjà dans ton programme (dates dans <b className="text-texte">Progrès → Mes prochains tests</b>).</p>
          <p>Complet = 3 efforts à fond (1 h 50, le dimanche). Court = 2 efforts (1 h 15).</p>
          <p>Pèse-toi dans les jours d'avant. Fais-le seulement un jour 🟢.</p>
          <p>Ensuite : <b className="text-texte">Réglages → Vélo → Calculer depuis mon test</b>, entre tes puissances moyennes. Zones et watts de tes séances se mettent à jour tout seuls.</p>
        </Rubrique>

        <Rubrique titre="🗺️ Saison : où j'en suis">
          <p>Ta phase du moment (reprise, VO2, seuil…), la frise jusqu'en mars et les semaines à venir : séance d'intensité, budget, semaines allégées, tests, course.</p>
        </Rubrique>

        <Rubrique titre="📈 Progrès : est-ce que j'avance ?">
          <p><b className="text-texte">W/kg</b> : ta puissance rapportée à ton poids, test après test. C'est le meilleur signe de progrès.</p>
          <p><b className="text-texte">Efficacité</b> : plus de watts pour le même cœur en endurance = tu progresses.</p>
          <p><b className="text-texte">Forme et fatigue</b> et <b className="text-texte">Récupération</b> : pour vérifier que tu ne te crames pas.</p>
          <p>En bas : toutes tes séances.</p>
        </Rubrique>

        <Rubrique titre="❓ Les petits « ? »">
          <p>Partout dans l'appli, touche un <b className="text-texte">?</b> pour savoir comment un chiffre est calculé et sur quelle étude il s'appuie.</p>
        </Rubrique>

        <Rubrique titre="🔔 Rappels">
          <p>Chaque matin à 8 h 30 pour ton matin, le mardi pour la pesée. Rien n'arrive si c'est déjà fait.</p>
          <p>À activer une fois dans <b className="text-texte">Réglages → Rappels</b>, sur l'iPhone.</p>
        </Rubrique>

        <Rubrique titre="🔄 Sauvegarde et mises à jour">
          <p>Tout se sauvegarde <b className="text-texte">seul sur le serveur</b> : téléphone et ordi voient les mêmes données.</p>
          <p>Après une mise à jour : <b className="text-texte">ferme complètement l'appli puis rouvre-la</b>. Le numéro de version est en bas de Réglages.</p>
        </Rubrique>
      </div>
    </>
  )
}
