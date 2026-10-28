import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aujourdhui } from '../../../core/dates'
import { formatEuros } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { BarreRepartition, Camembert } from '../../../core/ui/graphiques'
import { Bilan } from '../Bilan'
import { CarteControle } from '../CarteControle'
import {
  controleAFaire, couleurJauge, debutSuivi, decalerMois, depensesParCategorie, dernierJour, moisDe, nomMois, patrimoineAu, plafondDe,
  premierJour, previsionFinDeMois, repartition503020, resteAVivre, resumeMois, soldeAu,
} from '../calculs'
import { DetailMouvement } from '../DetailMouvement'
import { useBudget, useReglagesBudget } from '../donnees'
import type { Mouvement } from '../types'
import { ETAT, Jauge, LigneMouvement, NavMois } from '../ui'

/** Écran principal : reste à vivre, prévision, jauges par catégorie, camembert, raccourcis. */
export function Mois() {
  const d = useBudget()
  const [reglages, modifierReglages] = useReglagesBudget()
  const jour = aujourdhui()
  const actuel = moisDe(jour)
  const [mois, setMois] = useState(actuel)
  const [detail, setDetail] = useState<Mouvement>()
  if (!d) return null

  const enCours = mois === actuel
  const r = resumeMois(d, mois)
  const prevision = enCours ? previsionFinDeMois(d, jour) : undefined
  const reste = enCours ? resteAVivre(d, jour) : undefined
  const soldeCourantFin = d.comptes.filter((c) => c.type === 'courant' && c.dateDepart <= dernierJour(mois))
    .reduce((s, c) => s + soldeAu(c, d.mouvements, d.releves, dernierJour(mois)), 0)
  const parCat = depensesParCategorie(d.mouvements, d.categories, mois)
  const principales = d.categories.filter((c) => c.genre === 'depense' && !c.parentId)
  const jauges = principales
    .map((c) => ({ c, depense: parCat.get(c.id) ?? 0, plafond: plafondDe(c.id, mois, d.plafonds) }))
    .filter((j) => j.depense > 0 || (!j.c.archive && (j.plafond ?? 0) > 0))

  // Bilan du mois précédent : proposé en début de mois jusqu'à ce qu'il soit fermé
  const precedent = decalerMois(actuel, -1)
  const debut = debutSuivi(d.comptes)
  const bilanAMontrer = enCours && reglages.bilanVu !== precedent && !!debut && debut < premierJour(actuel)

  const rep = repartition503020(d, mois)
  const derniers = d.mouvements.slice(0, 5)
  // À partir du 5 : placements sans relevé ce mois-ci (les livrets se suivent tout seuls avec les virements)
  const aReleverCeMois = enCours && Number(jour.slice(8)) >= 5
    ? d.comptes.filter((c) => !c.archive && c.type === 'investissement' && c.dateDepart < premierJour(actuel)
      && !d.releves.some((r) => r.compteId === c.id && r.date >= premierJour(actuel)))
    : []
  const patrimoine = patrimoineAu(d.comptes, d.mouvements, d.releves, jour)

  return (
    <div className="space-y-3">
      <NavMois mois={mois} onChanger={setMois} max={actuel} />

      {bilanAMontrer && (
        <Carte titre={`📊 Bilan de ${nomMois(precedent)}`}>
          <Bilan d={d} mois={precedent} rituel />
          <button type="button" onClick={() => modifierReglages({ bilanVu: precedent })} className="mt-3 w-full rounded-xl bg-surface-2 py-2.5 font-semibold">C'est noté</button>
        </Carte>
      )}

      {enCours && reglages.rappelControle !== false && controleAFaire(reglages.dernierControle, jour) && <CarteControle d={d} />}

      {aReleverCeMois.length > 0 && (
        <Link to="/budget/patrimoine" className="block rounded-2xl border border-accent bg-surface p-4 active:scale-[0.98]">
          <p className="font-semibold">📈 Relevés du mois</p>
          <p className="mt-1 text-sm text-texte-2">Note la valeur du jour de : {aReleverCeMois.map((c) => c.nom).join(', ')} ›</p>
        </Link>
      )}

      {reste ? (
        <Carte>
          <p className="text-sm text-texte-2">
            Reste à vivre ce mois-ci
            <Aide titre="Reste à vivre" texte="L'argent que tu as vraiment aujourd'hui (compte courant + espèces), moins les charges fixes encore à payer ce mois-ci (plafond des catégories « charge fixe » pas encore payé). Ce que tu mets de côté sur un livret sort tout de suite de ton compte, donc du reste à vivre. Le contrôle du dimanche le recale sur ta banque." />
          </p>
          <p className="text-5xl font-bold tabular-nums" style={{ color: reste.reste < 0 ? ETAT.rouge : undefined }}>{formatEuros(reste.reste)}</p>
          <p className="mt-1 text-sm text-texte-3">
            {formatEuros(reste.courant)} sur ton compte{reste.especes ? ` + ${formatEuros(reste.especes)} en espèces` : ''}
            {reste.fixesRestantes > 0 && ` − ${formatEuros(reste.fixesRestantes)} de charges fixes à venir`}
          </p>
        </Carte>
      ) : (
        <Carte>
          <p className="text-sm text-texte-2">Revenus − dépenses du mois</p>
          <p className="text-5xl font-bold tabular-nums" style={{ color: r.revenus - r.depenses < 0 ? ETAT.rouge : undefined }}>{formatEuros(r.revenus - r.depenses, { signe: true })}</p>
          <p className="mt-1 text-sm text-texte-3">{formatEuros(r.revenus)} de revenus − {formatEuros(r.depenses)} dépensés</p>
        </Carte>
      )}

      <Carte>
        {prevision ? (
          <>
            <p className="text-sm text-texte-2">
              Compte courant fin {nomMois(mois).split(' ')[0]} (prévision)
              <Aide titre="Prévision du compte courant" texte="Solde d'aujourd'hui − charges fixes encore prévues − tes dépenses variables au rythme actuel (moyenne par jour depuis le début du mois ; les 7 premiers jours, le rythme du mois précédent) × jours restants. Les revenus à venir ne sont pas comptés." />
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: prevision.prevision < 0 ? ETAT.rouge : undefined }}>{formatEuros(prevision.prevision)}</p>
            <p className="mt-1 text-sm text-texte-3">
              Aujourd'hui {formatEuros(prevision.solde)} · environ {formatEuros(prevision.rythme)} par jour · {prevision.restants} j restants
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-texte-2">Compte courant fin {nomMois(mois).split(' ')[0]}</p>
            <p className="text-3xl font-bold tabular-nums">{formatEuros(soldeCourantFin)}</p>
          </>
        )}
      </Carte>

      <Carte titre="Catégories">
        {jauges.length === 0 && <p className="text-sm text-texte-3">Fixe tes plafonds pour suivre chaque catégorie.</p>}
        <div className="space-y-3">
          {jauges.map(({ c, depense, plafond }) => {
            const etat = plafond ? couleurJauge(depense, plafond) : undefined
            return (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{c.emoji} {c.nom}{c.fixe && <span className="ml-1 text-xs text-texte-3">fixe</span>}</span>
                  <span className="shrink-0 tabular-nums">
                    <b>{formatEuros(depense)}</b>
                    {plafond ? <span className="text-texte-3"> / {formatEuros(plafond)}</span> : <span className="text-texte-3"> · pas de plafond</span>}
                  </span>
                </div>
                {plafond ? (
                  <>
                    <div className="mt-1"><Jauge part={depense / plafond} couleur={ETAT[etat!]} /></div>
                    <p className="mt-0.5 text-xs" style={{ color: etat === 'rouge' ? ETAT.rouge : 'var(--color-texte-3)' }}>
                      {depense > plafond ? `Dépassé de ${formatEuros(depense - plafond)}` : `Reste ${formatEuros(plafond - depense)}`}
                    </p>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
        <Link to={`/budget/plafonds?mois=${mois}`} className="mt-3 block text-center text-sm font-semibold text-accent">Modifier les plafonds ›</Link>
      </Carte>

      <Carte titre="Répartition des dépenses">
        <Camembert format={(n) => formatEuros(n)}
          parts={[...parCat.entries()].map(([id, valeur]) => {
            const c = d.categories.find((x) => x.id === id)
            return { nom: c ? `${c.emoji} ${c.nom}` : 'Sans catégorie', couleur: c?.couleur ?? '#94a3b8', valeur }
          })} />
        {rep.besoins + rep.loisirs + rep.epargne > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm text-texte-2">
              Besoins · loisirs · épargne
              <Aide titre="Règle 50/30/20" texte="Repère courant en finances personnelles (Elizabeth Warren) : environ 50 % de tes revenus pour les besoins (courses, voiture, santé…), 30 % pour les loisirs (sorties, shopping, vacances…) et 20 % mis de côté (livrets + investissements). Ici, la part de chacun dans ce qui est sorti ce mois-ci ; le bilan mensuel le compare à tes revenus. Besoin ou loisir se règle par catégorie dans Réglages." />
            </p>
            <BarreRepartition parts={[
              { nom: 'Besoins', couleur: '#3987e5', valeur: rep.besoins },
              { nom: 'Loisirs', couleur: '#d95926', valeur: rep.loisirs },
              { nom: 'Épargne', couleur: '#199e70', valeur: rep.epargne },
              ...(rep.autres > 0 ? [{ nom: 'À catégoriser', couleur: '#6b7380', valeur: rep.autres }] : []),
            ]} />
          </div>
        )}
      </Carte>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/budget/patrimoine" className="rounded-2xl border border-bordure bg-surface p-4 active:scale-[0.98]">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-3">Patrimoine</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatEuros(patrimoine)}</p>
        </Link>
        <Link to="/budget/analyses" className="rounded-2xl border border-bordure bg-surface p-4 active:scale-[0.98]">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-3">Historique</p>
          <p className="mt-1 text-xl font-bold">📊 Analyses</p>
        </Link>
      </div>

      <Carte titre="Derniers mouvements">
        {derniers.length === 0 && <p className="text-sm text-texte-3">Rien pour l'instant : touche le + pour ta première saisie.</p>}
        {derniers.map((m) => <LigneMouvement key={m.id} m={m} categories={d.categories} comptes={d.comptes} onToucher={() => setDetail(m)} avecDate />)}
        {derniers.length > 0 && <Link to="/budget/mouvements" className="mt-1 block text-center text-sm font-semibold text-accent">Tous les mouvements ›</Link>}
      </Carte>

      {detail && <DetailMouvement m={detail} onFermer={() => setDetail(undefined)} />}
    </div>
  )
}
