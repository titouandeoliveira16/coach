import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { annulerRappel, enregistrerMemoire, finirNotion, modifierNotion, noterRappel, useParametres, useRevision } from '../donnees'
import { Minuteur, useMinuteur } from '../Minuteur'
import { NOMS_PERIODES, capacite, creneauxDu, dureeRappel, joursAvant, periodeDu, placerRappels, projection, type Creneau } from '../programme'
import type { Rappel, Resultat } from '../types'
import { BoutonsResultat, LIBELLES_CRENEAUX, libelleRappel } from '../ui'

const dateLongue = (j: string) => depuisJour(j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const heureActuelle = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Aujourd'hui : quoi faire maintenant, la notion du jour, les rappels du jour. */
export function Aujourdhui() {
  const d = useRevision()
  const [p, modifierP] = useParametres()
  const minuteur = useMinuteur()
  const [minuteurOuvert, setMinuteurOuvert] = useState<string>()
  if (!d) return null
  const jour = aujourdhui()
  const finieAujourdhui = d.notions.find((n) => n.j0 === jour)
  const enCours = d.notions.find((n) => n.statut === 'en-cours')
  const { parJour, fin } = projection(d.notions, jour, p, !!finieAujourdhui)
  const notionDuJour = parJour.get(jour)
  const creneaux = creneauxDu(jour, p, !!enCours && !!notionDuJour)
  const plan = placerRappels(d.rappels, jour, p)
  const duJour = plan.get(jour) ?? []
  const faitsAujourdhui = d.rappels.filter((r) => r.fait === jour)
  const echus = d.rappels.filter((r) => !r.fait && !r.annule && r.prevu <= jour)
  const glissent = echus.length - duJour.length
  const minutes = duJour.reduce((s, r) => s + dureeRappel(r), 0)
  const cap = capacite(jour, p)
  const h = heureActuelle()
  const maintenant = creneaux.find((c) => c.debut <= h && h < c.fin)
  const ensuite = creneaux.filter((c) => c.debut > h)
  const nom = (id: string) => d.notions.find((n) => n.id === id)?.nom ?? '?'
  const j = joursAvant(jour, p)
  const memoire = creneaux.find((c) => c.type === 'memoire')
  const seanceMemoire = d.memoire.find((m) => m.id === jour)
  const per = periodeDu(jour, p)
  const lundiCours = per === 'cours' && depuisJour(jour).getDay() === 1

  const noter = (r: Rappel, res: Resultat) => noterRappel(r, res, jour)

  return (
    <div className="space-y-3 pb-4">
      {/* Compte à rebours */}
      <Carte>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-6xl font-bold tabular-nums text-accent">{Math.max(j, 0)}</p>
            <p className="text-texte-2">jour{j > 1 ? 's' : ''} avant l'écrit 1</p>
          </div>
          <p className="text-right text-sm text-texte-3">
            Écrits les 2 et 3 mars 2027<br />
            {j > 7 && `${Math.floor(j / 7)} semaines et ${j % 7} j`}
          </p>
        </div>
      </Carte>

      <p className="text-lg capitalize text-texte-2">{dateLongue(jour)} · <span className="text-texte-3">{NOMS_PERIODES[per]}</span></p>

      {/* Minuteur en cours */}
      {minuteur.etat && (
        <button type="button" onClick={() => setMinuteurOuvert('')} className="w-full rounded-2xl border border-accent bg-surface p-4 text-left">
          ⏱️ Minuteur en cours{minuteur.etat.objectif ? ` · ${minuteur.etat.objectif}` : ''} ›
        </button>
      )}

      {/* Maintenant */}
      <Carte titre="Maintenant">
        {maintenant ? <LigneCreneau c={maintenant} /> : <p className="text-texte-2">Rien de prévu à cette heure-ci{ensuite[0] ? '.' : ' : profite.'}</p>}
        {ensuite[0] && <p className="mt-2 text-sm text-texte-3">Ensuite : {ensuite[0].debut.replace(':', ' h ')} · {LIBELLES_CRENEAUX[ensuite[0].type](ensuite[0])}</p>}
        {maintenant && ['notion', 'rappels', 'sujet', 'express', 'memoire', 'synthese'].includes(maintenant.type) && (
          <Bouton className="mt-3" onClick={() => setMinuteurOuvert(maintenant.type === 'notion' && enCours ? enCours.nom : '')}>⏱️ Lancer un bloc de 50 min</Bouton>
        )}
      </Carte>

      {/* Notion du jour */}
      {finieAujourdhui ? (
        <Carte titre="Notion du jour">
          <p className="text-lg font-semibold">✅ {finieAujourdhui.nom}</p>
          <label className="mt-2 flex items-center gap-3">
            <input type="checkbox" checked={!!finieAujourdhui.fixation} onChange={(e) => modifierNotion({ ...finieAujourdhui, fixation: e.target.checked })} className="h-6 w-6 accent-[#60a5fa]" />
            <span>Feuille blanche de fixation faite <span className="text-texte-3">(cet après-midi, 45 min à 1 h)</span></span>
          </label>
          <p className="mt-2 text-sm text-texte-3">Ses rappels sont créés : J+1 demain, puis J+4, J+10, J+21, J+45, J+90.</p>
        </Carte>
      ) : enCours ? (
        <Carte titre={notionDuJour ? 'Notion du jour' : 'Notion en cours'}>
          <p className="text-xl font-bold">{enCours.nom}</p>
          <p className="text-sm text-texte-3">{enCours.epreuve === 'E1' ? 'Écrit 1' : 'Écrit 2'} · {enCours.theme} · notion {enCours.ordre}/41</p>
          {!notionDuJour && <p className="mt-1 text-sm text-texte-2">Pas de nouvelle notion prévue aujourd'hui : continue-la si tu as du temps, sinon au prochain créneau.</p>}
          <p className="mt-2 text-sm text-texte-2">Le matin, en blocs de 50 min avec un objectif chacun (ex. « partie 1 de la fiche ») et une mini feuille blanche à la fin de chaque bloc.</p>
          <Bouton className="mt-3" onClick={() => finirNotion(enCours, jour)}>Notion finie ✓</Bouton>
        </Carte>
      ) : null}

      {/* Rappels */}
      <Carte titre={`Rappels du jour · ${minutes} min`}>
        {duJour.length === 0 && faitsAujourdhui.length === 0 && <p className="text-texte-2">Aucun rappel aujourd'hui.</p>}
        <ul className="divide-y divide-bordure">
          {duJour.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{nom(r.notionId)}</span>
                <span className="shrink-0 text-sm text-texte-3">{libelleRappel(r)} · {dureeRappel(r)} min</span>
              </div>
              <BoutonsResultat onChoisir={(res) => noter(r, res)} />
            </li>
          ))}
          {faitsAujourdhui.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-texte-3">
              <span>{r.resultat === 'su' ? '✅' : r.resultat === 'hesitant' ? '🟠' : '🔁'} {nom(r.notionId)} <span className="text-xs">{libelleRappel(r)}</span></span>
              <button type="button" onClick={() => annulerRappel(r)} className="text-xs underline">annuler</button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-texte-3">
          En feuille blanche, l'après-midi. Capacité du jour : {cap} min.
          {glissent > 0 && ` ${glissent} rappel${glissent > 1 ? 's' : ''} glisse${glissent > 1 ? 'nt' : ''} aux jours suivants.`}
          <Aide titre="Rappels (méthode des J)" texte="Feuille blanche : cache la fiche, écris tout ce que tu sais, puis corrige avec la fiche. Su : la série continue. Hésitant : un rappel de plus demain. Raté : la notion repart de zéro (J+1, J+4…). Chaque jour, les rappels en retard passent en premier (J+1 d'abord) dans la limite du temps du jour ; le reste glisse au lendemain. Faire revenir une notion à intervalles croissants, en se forçant à la retrouver de mémoire, est ce qui la fixe le mieux (Roediger & Karpicke 2006 ; Cepeda 2008)." />
        </p>
      </Carte>

      {lundiCours && (
        <label className="flex items-center justify-between rounded-2xl border border-bordure bg-surface px-4 py-3">
          <span>Pas de stage cet après-midi</span>
          <input type="checkbox" checked={p.lundisSansStage.includes(jour)} className="h-6 w-6 accent-[#60a5fa]"
            onChange={(e) => modifierP({ lundisSansStage: e.target.checked ? [...p.lundisSansStage, jour] : p.lundisSansStage.filter((x) => x !== jour) })} />
        </label>
      )}

      {/* Mémoire */}
      {memoire && (
        <Carte titre="📝 Mémoire de recherche">
          <input value={seanceMemoire?.objectif ?? ''} onChange={(e) => enregistrerMemoire({ id: jour, ...seanceMemoire, objectif: e.target.value })}
            placeholder="Objectif de la demi-journée" className="w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent" />
          <label className="mt-2 flex items-center gap-3">
            <input type="checkbox" checked={!!seanceMemoire?.fait} onChange={(e) => enregistrerMemoire({ id: jour, ...seanceMemoire, fait: e.target.checked })} className="h-6 w-6 accent-[#60a5fa]" />
            <span>Demi-journée faite</span>
          </label>
          {!p.memoireEnvoye && (
            <label className="mt-1 flex items-center gap-3">
              <input type="checkbox" checked={false} onChange={() => modifierP({ memoireEnvoye: true })} className="h-6 w-6 accent-[#60a5fa]" />
              <span>Document envoyé au tuteur <span className="text-texte-3">(visé le {depuisJour(p.memoireEnvoi).toLocaleDateString('fr-FR')})</span></span>
            </label>
          )}
        </Carte>
      )}

      {/* Avancement */}
      <Carte titre="Avancement">
        <p>{d.notions.filter((n) => n.statut === 'finie').length} notions sur 41 apprises.</p>
        {fin && (
          <p className="mt-1 text-sm text-texte-2">
            Fin de l'apprentissage prévue : <b className="text-texte">{depuisJour(fin).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}</b> (cible : 21 décembre).
            {fin > '2027-01-15' && " C'est après mi-janvier : la phase sujets sera plus courte. On peut regarder ensemble où gagner du temps (une notion de plus pendant les vacances, par exemple)."}
          </p>
        )}
        <p className="mt-1 text-xs text-texte-3">Recalculé à chaque notion finie : un retard décale simplement les dates.</p>
        <Link to="/revision/notions" className="mt-2 block text-sm font-semibold text-accent">Voir les 41 notions ›</Link>
      </Carte>

      {/* Reste de la journée */}
      {ensuite.length > 0 && (
        <Carte titre="La suite de ta journée">
          {ensuite.map((c) => <LigneCreneau key={c.debut} c={c} />)}
        </Carte>
      )}

      {minuteurOuvert !== undefined && <Minuteur objectifPropose={minuteurOuvert} onFermer={() => setMinuteurOuvert(undefined)} />}
    </div>
  )
}

function LigneCreneau({ c }: { c: Creneau }) {
  return (
    <div className={`flex gap-3 py-1 ${c.optionnel ? 'opacity-60' : ''}`}>
      <span className="w-28 shrink-0 whitespace-nowrap tabular-nums text-texte-3">{c.debut.replace(':', 'h')}–{c.fin.replace(':', 'h')}</span>
      <span>{LIBELLES_CRENEAUX[c.type](c)}</span>
    </div>
  )
}
