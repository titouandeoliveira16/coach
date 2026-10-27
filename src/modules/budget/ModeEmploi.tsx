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
        <Rubrique titre="🎯 Plafonds et jauges">
          <p>Dans « Mois », « Modifier les plafonds » : un plafond par catégorie. Change-les quand tu veux : les mois passés ne bougent pas, et le mois suivant reprend les mêmes.</p>
          <p>Jauge <span style={{ color: '#4ade80' }}>verte</span> sous 75 %, <span style={{ color: '#fb923c' }}>orange</span> jusqu'à 100 %, <span style={{ color: '#f87171' }}>rouge</span> au-delà. Un message t'avertit quand une catégorie atteint 90 % puis 100 %.</p>
          <p>Chaque catégorie est un <B>besoin</B> ou un <B>loisir</B> : la barre « Besoins · loisirs · épargne » et le bilan te situent par rapport au repère 50/30/20 (50 % besoins, 30 % loisirs, 20 % épargne).</p>
          <p>Les <B>charges fixes</B> (loyer, abonnements) pas encore payées sont retirées d'avance de ton reste à vivre.</p>
        </Rubrique>
        <Rubrique titre="🛟 Livrets">
          <p>Quand tu mets de côté, note un <B>virement</B> (ex. courant → Livret A) : le solde du livret se met à jour tout seul. Pas de relevé à faire.</p>
          <p>Tu prends sur ton épargne ? Note un <B>virement</B> livret → courant, puis ta dépense comme d'habitude. Ou la dépense directement en choisissant « Payé avec : Livret A ».</p>
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
