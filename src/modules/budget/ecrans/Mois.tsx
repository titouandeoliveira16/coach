import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { formatDate, formatEuros } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { BarreRepartition, Camembert } from '../../../core/ui/graphiques'
import { Bilan } from '../Bilan'
import { AVerifier, nbAVerifier } from '../AVerifier'
import { Controle } from '../Controle'
import {
  aVenir, controleAFaire, couleurJauge, debutSuivi, decalerMois, depensesParCategorie, detailFixesRestantes, echeance, joursDansMois, moisDe, nomMois,
  patrimoineAu, plafondDe, premierJour, repartition503020, resteAVivre, resumeMois,
} from '../calculs'
import { DetailMouvement } from '../DetailMouvement'
import { useBudget, useReglagesBudget } from '../donnees'
import { useOuvrirSaisie } from '../ouvrirSaisie'
import type { Mouvement } from '../types'
import { ETAT, Jauge, LigneMouvement, NavMois } from '../ui'
import { IconeCategorie } from '../IconeCategorie'

/** Jours sans rien noter à la main avant de le signaler (mode rattrapage) */
const JOURS_SANS_SAISIE = 3

/** Écran principal : reste à vivre, ce qu'il y a à faire, jauges par catégorie, répartition, derniers mouvements. */
export function Mois() {
  const d = useBudget()
  const [reglages, modifierReglages] = useReglagesBudget()
  const ouvrirSaisie = useOuvrirSaisie()
  const jour = aujourdhui()
  const actuel = moisDe(jour)
  const [mois, setMois] = useState(actuel)
  const [detail, setDetail] = useState<Mouvement>()
  const [voirReste, setVoirReste] = useState(false)
  const [voirBilan, setVoirBilan] = useState(false)
  if (!d) return null

  const enCours = mois === actuel
  const r = resumeMois(d, mois)
  const reste = enCours ? resteAVivre(d, jour) : undefined
  const parCat = depensesParCategorie(d.mouvements, d.categories, mois)
  const principales = d.categories.filter((c) => c.genre === 'depense' && !c.parentId)
  const jauges = principales
    .map((c) => ({ c, depense: parCat.get(c.id) ?? 0, plafond: plafondDe(c.id, mois, d.plafonds) }))
    .filter((j) => j.depense > 0 || (!j.c.archive && (j.plafond ?? 0) > 0))
  // Repère du jour sur les jauges des dépenses variables : où tu devrais en être au même rythme tout le mois
  const repere = enCours ? Number(jour.slice(8)) / joursDansMois(mois) : undefined

  // ---- À faire (mois en cours) ----
  const precedent = decalerMois(actuel, -1)
  const debut = debutSuivi(d.comptes)
  const bilanAMontrer = enCours && reglages.bilanVu !== precedent && !!debut && debut < premierJour(actuel)
  const controle = enCours && reglages.rappelControle !== false && controleAFaire(reglages.dernierControle, jour)
  const aVerifier = enCours ? nbAVerifier(d) : 0
  // À partir du 5 : placements sans relevé ce mois-ci (les livrets se suivent tout seuls avec les virements)
  const aReleverCeMois = enCours && Number(jour.slice(8)) >= 5
    ? d.comptes.filter((c) => !c.archive && c.type === 'investissement' && c.dateDepart < premierJour(actuel)
      && !d.releves.some((r) => r.compteId === c.id && r.date >= premierJour(actuel)))
    : []
  // Remboursements d'avant la 14.7 (ou importés) sans catégorie : comptés comme revenus tant qu'ils ne sont pas rattachés
  const aRattacher = enCours ? d.mouvements.filter((m) => m.type === 'revenu' && m.categorieId === 'remboursement' && !m.rembourse && m.date >= premierJour(precedent)) : []
  // Rien noté à la main depuis plusieurs jours : le reste à vivre est sans doute faux
  const derniereSaisie = d.mouvements.find((m) => !m.abonnementId && m.date <= jour)?.date
  const enRetard = enCours && !!derniereSaisie && ecartJours(derniereSaisie, jour) >= JOURS_SANS_SAISIE
  const aFaire = bilanAMontrer || controle || aVerifier > 0 || aReleverCeMois.length > 0 || aRattacher.length > 0 || enRetard

  // Parts du camembert regroupées par nom (plusieurs catégories inconnues → une seule part « Sans catégorie »)
  const parts = new Map<string, { nom: string; couleur: string; valeur: number }>()
  for (const [id, valeur] of parCat) {
    const c = d.categories.find((x) => x.id === id)
    const nom = c ? c.nom : 'Sans catégorie'
    const p = parts.get(nom)
    parts.set(nom, { nom, couleur: c?.couleur ?? '#94a3b8', valeur: (p?.valeur ?? 0) + valeur })
  }

  const rep = repartition503020(d, mois)
  const derniers = d.mouvements.filter((m) => moisDe(m.date) === mois).slice(0, 5)
  const patrimoine = patrimoineAu(d.comptes, d.mouvements, d.releves, enCours ? jour : `${mois}-${joursDansMois(mois)}`)
  const v = enCours ? aVenir(d, jour) : undefined
  const section = 'border-t border-bordure pt-3 first:border-t-0 first:pt-0'

  return (
    <div className="space-y-3 pb-20">
      <NavMois mois={mois} onChanger={setMois} max={actuel} />

      {reste ? (
        <Carte className={voirReste ? 'border-accent!' : ''}>
          <p className="text-sm text-texte-2">
            Reste à vivre ce mois-ci
            <Aide titre="Reste à vivre" texte="L'argent que tu as vraiment aujourd'hui (compte courant + espèces), moins ce qui doit encore sortir ce mois-ci (charges fixes pas encore payées, abonnements pas encore passés), plus les revenus réguliers attendus avant le 25. Un revenu reçu à partir du 25 (salaire de fin de mois) sert au mois suivant : il est retiré d'ici, même une fois arrivé. Ce que tu mets de côté sur un livret sort tout de suite de ton compte, donc du reste à vivre." />
          </p>
          <p className="chiffre text-5xl" style={{ color: reste.reste < 0 ? ETAT.rouge : undefined }}>{formatEuros(reste.reste)}</p>
          <p className="mt-1 text-sm text-texte-3">
            {formatEuros(reste.courant)} sur {d.comptes.filter((c) => c.type === 'courant' && !c.archive).length > 1 ? 'tes comptes courants' : 'ton compte'}{reste.especes ? ` ${reste.especes < 0 ? '−' : '+'} ${formatEuros(Math.abs(reste.especes))} en espèces` : ''}
            {reste.fixesRestantes > 0 && ` − ${formatEuros(reste.fixesRestantes)} de charges fixes à venir`}
            {reste.abonnements > 0 && ` − ${formatEuros(reste.abonnements)} d'abonnements à venir`}
            {reste.revenusAttendus > 0 && ` + ${formatEuros(reste.revenusAttendus)} de revenus attendus`}
            {reste.pourMoisSuivant > 0 && ` − ${formatEuros(reste.pourMoisSuivant)} déjà reçus pour ${nomMois(decalerMois(mois, 1)).split(' ')[0]}`}
          </p>
          {(reste.fixesRestantes > 0 || reste.abonnements > 0 || reste.revenusAttendus > 0) && (
            <button type="button" onClick={() => setVoirReste(!voirReste)} className="mt-1 min-h-9 text-sm font-semibold text-accent">{voirReste ? 'Réduire ▴' : 'Voir le détail ›'}</button>
          )}
          {voirReste && v && (
            <ul className="mt-2 space-y-1 border-t border-bordure pt-2 text-sm">
              {detailFixesRestantes(d, mois).map((x) => (
                <li key={x.categorie.id} className="flex justify-between gap-2"><span className="text-texte-2">{x.categorie.nom} <span className="text-xs text-texte-3">(charge fixe pas encore payée)</span></span><span className="tabular-nums">− {formatEuros(x.montant)}</span></li>
              ))}
              {[...v.depenses, ...v.revenus].sort((a, b) => a.jour - b.jour).map((a) => {
                const revenu = v.revenus.includes(a)
                return (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="text-texte-2">{a.nom} <span className="text-xs text-texte-3">(prévu le {Number(echeance(a, mois).slice(8))})</span></span>
                    <span className="tabular-nums" style={revenu ? { color: ETAT.vert } : undefined}>{revenu ? '+' : '−'} {formatEuros(a.montant)}</span>
                  </li>
                )
              })}
              <li className="pt-1 text-xs text-texte-3">Une charge déjà payée mais pas saisie apparaît ici comme « à venir » : saisis-la pour la retirer.</li>
            </ul>
          )}
        </Carte>
      ) : (
        <Carte>
          <p className="text-sm text-texte-2">Mis de côté en {nomMois(mois).split(' ')[0]}</p>
          <p className="chiffre text-5xl" style={{ color: r.epargne < 0 ? ETAT.rouge : undefined }}>{formatEuros(r.epargne, { signe: true })}</p>
          <p className="mt-1 text-sm text-texte-3">{formatEuros(r.revenus)} de revenus − {formatEuros(r.depenses)} dépensés</p>
          <button type="button" onClick={() => setVoirBilan(true)} className="mt-1 min-h-9 text-sm font-semibold text-accent">Bilan du mois ›</button>
        </Carte>
      )}

      {/* Demande de Titouan (19/11/2026) : ce que tu as mis de côté et investi depuis le début du mois */}
      {enCours && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[14px] bg-surface p-3">
            <p className="text-xs text-texte-2">Épargné ce mois-ci<Aide titre="Épargné ce mois-ci" texte="Revenus du mois − dépenses du mois, jusqu'à aujourd'hui. Il bouge jusqu'à la fin du mois : les dépenses à venir le feront baisser. Un virement d'un livret vers un placement n'est pas de l'épargne en plus." /></p>
            <p className="chiffre mt-0.5 text-2xl" style={{ color: r.epargne < 0 ? ETAT.rouge : undefined }}>{formatEuros(r.epargne, { signe: true })}</p>
            <p className="text-[11px] text-texte-3">pour l'instant</p>
          </div>
          <div className="rounded-[14px] bg-surface p-3">
            <p className="text-xs text-texte-2">Investi ce mois-ci<Aide titre="Investi ce mois-ci" texte="Versé sur tes comptes d'investissement (PEA, CTO…) depuis le 1er du mois, retraits déduits." /></p>
            <p className="chiffre mt-0.5 text-2xl">{formatEuros(r.investi)}</p>
            <p className="text-[11px] text-texte-3">sur tes placements</p>
          </div>
        </div>
      )}

      {aFaire && (
        <Carte titre="À faire" className="border-accent!">
          <div className="space-y-3">
            {enRetard && (
              <div className={section}>
                <p className="font-semibold">Rien noté depuis le {formatDate(derniereSaisie!)}</p>
                <p className="text-sm text-texte-2">Ton reste à vivre est sans doute trop haut. Ouvre ta banque et rattrape : la date que tu choisis reste la même d'une saisie à l'autre (Hier, Avant-hier ou une autre date).</p>
                <button type="button" onClick={() => ouvrirSaisie({ date: decalerJour(derniereSaisie!, 1) })} className="mt-2 w-full rounded-xl bg-surface-2 py-2.5 font-semibold">Rattraper à partir du {formatDate(decalerJour(derniereSaisie!, 1))}</button>
              </div>
            )}
            {aVerifier > 0 && <div className={section}><AVerifier d={d} /></div>}
            {aRattacher.length > 0 && (
              <div className={section}>
                <p className="font-semibold">Remboursements à rattacher</p>
                <p className="text-sm text-texte-2">Dis ce qu'on t'a remboursé : ça viendra en moins de cette dépense au lieu de compter comme un revenu.</p>
                {aRattacher.map((m) => <LigneMouvement key={m.id} m={m} categories={d.categories} comptes={d.comptes} onToucher={() => ouvrirSaisie(m)} avecDate />)}
              </div>
            )}
            {controle && <div className={section}><Controle d={d} /></div>}
            {aReleverCeMois.length > 0 && (
              <Link to="/budget/patrimoine" className={`${section} block`}>
                <p className="font-semibold">Relevés du mois</p>
                <p className="mt-1 text-sm text-texte-2">Note la valeur du jour de : {aReleverCeMois.map((c) => c.nom).join(', ')} ›</p>
              </Link>
            )}
            {bilanAMontrer && (
              <button type="button" onClick={() => setVoirBilan(true)} className={`${section} block w-full text-left`}>
                <p className="font-semibold">Bilan de {nomMois(precedent)} ›</p>
                <p className="mt-1 text-sm text-texte-2">Ce que tu as gagné, dépensé et mis de côté le mois dernier.</p>
              </button>
            )}
          </div>
        </Carte>
      )}

      <Carte titre="Catégories">
        {jauges.length === 0 && <p className="pr-20 text-sm text-texte-3">Fixe tes plafonds pour suivre chaque catégorie.</p>}
        <div className="space-y-3">
          {jauges.map(({ c, depense, plafond }) => {
            const etat = plafond ? couleurJauge(depense, plafond) : undefined
            return (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-medium"><IconeCategorie cle={c.emoji} className="h-4 w-4 shrink-0 text-texte-2" />{c.nom}{c.fixe && <span className="ml-1 text-xs text-texte-3">fixe</span>}</span>
                  <span className="shrink-0 tabular-nums">
                    <b>{formatEuros(depense)}</b>
                    {plafond ? <span className="text-texte-3"> / {formatEuros(plafond)}</span> : <span className="text-texte-3"> · pas de plafond</span>}
                  </span>
                </div>
                {plafond ? (
                  <>
                    <div className="mt-1"><Jauge part={depense / plafond} couleur={ETAT[etat!]} repere={c.fixe ? undefined : repere} /></div>
                    <p className="mt-0.5 text-xs" style={{ color: etat === 'rouge' ? ETAT.rouge : 'var(--color-texte-3)' }}>
                      {depense > plafond ? `Dépassé de ${formatEuros(depense - plafond)}` : `Reste ${formatEuros(plafond - depense)}`}
                    </p>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
        {repere !== undefined && jauges.some((j) => j.plafond && !j.c.fixe) && (
          <p className="mt-2 text-xs text-texte-3">Le petit trait : où tu devrais en être aujourd'hui pour finir le mois pile au plafond.</p>
        )}
        <Link to={`/budget/plafonds?mois=${mois}`} className="mt-3 block text-center text-sm font-semibold text-accent">Modifier les plafonds ›</Link>
      </Carte>

      <Carte titre="Répartition des dépenses">
        <Camembert format={(n) => formatEuros(n)} parts={[...parts.values()]} />
        {rep.besoins + rep.loisirs + rep.epargne > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm text-texte-2">
              Besoins · loisirs · {enCours ? 'pas encore dépensé' : 'mis de côté'}
              <Aide titre="Règle 50/30/20" texte="Repère courant en finances personnelles (Elizabeth Warren) : environ 50 % de tes revenus pour les besoins (courses, voiture, santé…), 30 % pour les loisirs (sorties, shopping, abonnements de loisir…) et 20 % mis de côté. Mis de côté = revenus − dépenses du mois : déplacer de l'argent d'un livret vers un placement n'est pas de l'épargne en plus. Un remboursement d'ami vient en moins de la dépense remboursée." />
            </p>
            <BarreRepartition parts={[
              { nom: 'Besoins', couleur: '#3987e5', valeur: rep.besoins },
              { nom: 'Loisirs', couleur: '#d95926', valeur: rep.loisirs },
              // Mois en cours (audit du 18/11/2026) : ce reste n'est pas encore « mis de côté », il peut encore être dépensé
              { nom: enCours ? 'Pas encore dépensé' : 'Mis de côté', couleur: enCours ? '#6b7380' : '#199e70', valeur: rep.epargne },
              ...(rep.autres > 0 ? [{ nom: 'À catégoriser', couleur: '#6b7380', valeur: rep.autres }] : []),
            ]} />
          </div>
        )}
      </Carte>

      <Link to="/budget/patrimoine" className="flex items-center justify-between rounded-[14px] bg-surface p-4 active:scale-[0.98]">
        <span className="text-[13px] font-semibold text-texte-2">Patrimoine {enCours ? '' : `fin ${nomMois(mois).split(' ')[0]}`}</span>
        <span className="chiffre text-xl">{formatEuros(patrimoine)} ›</span>
      </Link>

      <Carte titre={enCours ? 'Derniers mouvements' : `Mouvements de ${nomMois(mois).split(' ')[0]}`}>
        {derniers.length === 0 && <p className="text-sm text-texte-3">{enCours ? 'Rien pour l’instant : touche le + pour ta première saisie.' : 'Aucun mouvement ce mois-là.'}</p>}
        {derniers.map((m) => <LigneMouvement key={m.id} m={m} categories={d.categories} comptes={d.comptes} onToucher={() => setDetail(m)} avecDate />)}
        {derniers.length > 0 && <Link to="/budget/mouvements" className="mt-1 block text-center text-sm font-semibold text-accent">Tous les mouvements ›</Link>}
      </Carte>

      {detail && <DetailMouvement m={detail} onFermer={() => setDetail(undefined)} />}
      {voirBilan && (
        <Feuille titre={`Bilan de ${nomMois(enCours ? precedent : mois)}`} onFermer={() => setVoirBilan(false)}>
          <Bilan d={d} mois={enCours ? precedent : mois} rituel={enCours} />
          {enCours && (
            <button type="button" onClick={async () => { await modifierReglages({ bilanVu: precedent }); setVoirBilan(false) }} className="mt-3 w-full rounded-xl bg-surface-2 py-2.5 font-semibold">C'est noté</button>
          )}
        </Feuille>
      )}
    </div>
  )
}
