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

/** Mode d'emploi du module Budget. */
export function ModeEmploiBudget() {
  return (
    <>
      <EnTete titre="Mode d'emploi" />
      <div className="space-y-3 px-4">
        <Rubrique titre="L'idée en 30 secondes" ouverte>
          <p>Tu notes à la main ce qui entre et sort (aucune connexion à ta banque). L'appli calcule tes soldes, ton <B>reste à vivre</B> et ton <B>patrimoine</B>.</p>
          <p>Ton travail : <B>10 secondes par dépense</B>, et le 1er du mois, 5 minutes pour le bilan.</p>
        </Rubrique>
        <Rubrique titre="➕ Saisir un mouvement">
          <p>Touche le <B>+</B>, tape le montant, choisis la catégorie, puis « Enregistrer ». Le compte courant et la date du jour sont déjà choisis.</p>
          <p><B>Dépense</B> : sort d'un compte, compte dans le budget. <B>Revenu</B> : entre sur un compte. <B>Virement</B> (ex. courant → Livret A, retrait d'espèces) : ni dépense ni revenu. <B>Investir</B> (ex. courant → PEA) : suivi à part.</p>
          <p>Dépense partagée à plusieurs : note seulement <B>ta part</B>.</p>
          <p>Toucher un mouvement permet de le <B>modifier</B>, le <B>supprimer</B> ou le <B>dupliquer</B> (pratique pour un achat qui revient avec un autre montant).</p>
        </Rubrique>
        <Rubrique titre="🧾 Cas particuliers : la règle d'or">
          <p><B>Note ta part, le jour où l'argent sort vraiment de ton compte.</B></p>
          <p><B>Paiement en plusieurs fois (Klarna, 3×, 4×)</B> : une dépense à chaque prélèvement, avec son vrai montant et sa vraie date (pas le total le jour de l'achat).</p>
          <p><B>Tu avances pour des amis</B> : note seulement ta part en dépense. Quand ils te remboursent, ne note rien : leur part n'a jamais été ta dépense. (Si tu as noté le total, note le remboursement en revenu « Remboursement ».)</p>
          <p><B>Un ami t'avance</B> : rien le jour même ; ta part en dépense le jour où tu le rembourses.</p>
          <p><B>Retrait d'espèces</B> : un virement courant → Espèces ; les achats en liquide se notent ensuite depuis « Espèces ».</p>
          <p><B>Remboursement d'un achat (retour, Sécu)</B> : un revenu, ou supprime la dépense si c'est la même semaine.</p>
        </Rubrique>
        <Rubrique titre="🔍 Contrôle du dimanche">
          <p>Chaque dimanche, une carte te demande le solde affiché par ta banque pour ton compte courant (et une notification à l'heure du rappel du soir).</p>
          <p>Pile juste : parfait. Un écart : <B>« Saisir l'oubli »</B> ouvre la saisie avec le montant déjà rempli ; si tu ne retrouves pas, écris d'où il vient (frais bancaires, arrondi…) et <B>« Ajuster »</B> remet le solde au niveau de ta banque.</p>
          <p>Fais-le après avoir noté tes dépenses du jour. Attention aux paiements encore « en cours » à la banque : ils sont parfois déjà retirés du solde affiché, parfois pas.</p>
        </Rubrique>
        <Rubrique titre="🔁 Abonnements">
          <p>Réglages → <B>Abonnements</B> : nom, montant, catégorie, compte et jour du prélèvement. Ils sont <B>comptés d'avance</B> dans ton reste à vivre et ta prévision.</p>
          <p>Le jour du prélèvement, une carte (et la notification du soir) te demande : <B>est-ce passé sur ton compte ?</B> Oui (le mouvement est noté), autre montant, pas encore (redemandé demain) ou pas ce mois-ci.</p>
          <p>Résilié ? Supprime-le : les paiements déjà notés restent.</p>
        </Rubrique>
        <Rubrique titre="🎯 Plafonds et jauges">
          <p>Dans « Mois », « Modifier les plafonds » : un plafond par catégorie. Change-les quand tu veux : les mois passés ne bougent pas, et le mois suivant reprend les mêmes.</p>
          <p>Jauge <span style={{ color: '#4ade80' }}>verte</span> sous 75 %, <span style={{ color: '#fb923c' }}>orange</span> jusqu'à 100 %, <span style={{ color: '#f87171' }}>rouge</span> au-delà. Un message t'avertit quand une catégorie atteint 90 % puis 100 %.</p>
          <p>Chaque catégorie est un <B>besoin</B> ou un <B>loisir</B> : la barre « Besoins · loisirs · épargne » et le bilan te situent par rapport au repère 50/30/20 (50 % besoins, 30 % loisirs, 20 % épargne).</p>
          <p><B>Reste à vivre</B> = l'argent que tu as vraiment (compte courant + espèces), moins les <B>charges fixes</B> (loyer, abonnements) pas encore payées ce mois-ci.</p>
        </Rubrique>
        <Rubrique titre="🛟 Livrets">
          <p>Quand tu mets de côté, note un <B>virement</B> (ex. courant → Livret A) : le solde du livret se met à jour tout seul. Pas de relevé à faire.</p>
          <p>Tu prends sur ton épargne ? Note un <B>virement</B> : <B>De</B> Livret A, <B>Vers</B> Compte courant, puis ta dépense comme d'habitude. Ou la dépense directement en choisissant « Payé avec : Livret A ».</p>
          <p>Une fois par an, quand les intérêts tombent, un relevé du livret remet le solde pile.</p>
        </Rubrique>
        <Rubrique titre="📈 Placements (PEA, compte-titres, Bricks)">
          <p>Leur valeur bouge avec les marchés : le <B>5 de chaque mois</B> (une notification et une carte te le rappellent), ouvre Patrimoine → le compte → <B>Nouveau relevé</B>, et note la valeur affichée par ta banque.</p>
          <p>L'appli sépare <B>l'argent versé</B> et la <B>valeur actuelle</B> : la différence est ta plus-value (ou moins-value).</p>
        </Rubrique>
        <Rubrique titre="📊 Le 1er du mois">
          <p>Le bilan du mois passé s'affiche en haut de « Mois » : revenus, dépenses, épargne, investissements, catégories en hausse ou en baisse, plafonds dépassés, patrimoine.</p>
          <p>Fais tes relevés, ajuste tes plafonds, puis « C'est noté ». Les anciens bilans restent dans Analyses.</p>
        </Rubrique>
        <Rubrique titre="🔔 Rappel du soir">
          <p>Réglages → « Rappel de saisie » : une notification à l'heure choisie, seulement si tu n'as rien saisi ce jour-là.</p>
        </Rubrique>
      </div>
    </>
  )
}
