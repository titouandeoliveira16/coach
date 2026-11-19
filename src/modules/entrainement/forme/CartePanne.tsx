import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { enregistrer, supprimer } from '../../../core/stockage'
import { lundiDe } from '../seances/donnees'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { declarerPanneVelo, panneEnCours, veloRepare } from '../plan/imprevus'

const jourLong = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })

/** Imprévu : vélo en panne. L'appli annule le vélo de ces jours-là et déplace l'intensité après la réparation. */
/** `lien` : petit lien « Imprévu › » (en haut de la carte de la séance, 12/11/2026) ; `compact` : bouton de la rangée du bas. */
export function CartePanne({ compact = false, lien = false }: { compact?: boolean; lien?: boolean } = {}) {
  const panne = useLiveQuery(async () => (await panneEnCours()) ?? null)
  const [ouverte, setOuverte] = useState(false)
  const [au, setAu] = useState(aujourdhui())
  const [bilan, setBilan] = useState<string[]>()
  const [occupe, setOccupe] = useState(false)
  const [choix, setChoix] = useState<'panne'>()
  const indispo = useLiveQuery(() => db.indispos.get(aujourdhui()))
  if (panne === undefined) return null

  if (bilan)
    return compact || lien ? (
      <Feuille titre="Programme adapté" onFermer={() => setBilan(undefined)}>
        <ul className="space-y-1 text-sm">{bilan.map((b, i) => <li key={i}>• {b}</li>)}</ul>
        <button type="button" onClick={() => setBilan(undefined)} className="mt-3 min-h-11 w-full rounded-xl bg-accent font-semibold text-fond">OK</button>
      </Feuille>
    ) : (
      <Carte titre="Programme adapté">
        <ul className="space-y-1 text-sm">{bilan.map((b, i) => <li key={i}>• {b}</li>)}</ul>
        <button type="button" onClick={() => setBilan(undefined)} className="mt-3 min-h-11 w-full rounded-xl bg-accent font-semibold text-fond">OK</button>
      </Carte>
    )

  if (panne && lien)
    return <button type="button" onClick={() => veloRepare()} className="shrink-0 font-semibold text-attention">En panne · il remarche</button>
  if (panne && compact)
    return (
      <button type="button" onClick={() => veloRepare()} className="min-h-12 flex-1 rounded-xl border border-attention/50 bg-attention/10 px-2 text-sm font-semibold">
        En panne · <span className="text-accent">il remarche</span>
      </button>
    )
  if (panne)
    return (
      <div className="flex items-center justify-between rounded-2xl border border-attention/50 bg-attention/10 px-4 py-3 text-sm">
        <span>Vélo en panne jusqu'au {jourLong(panne.au)}</span>
        <button type="button" className="font-semibold text-accent" onClick={() => veloRepare()}>Il remarche</button>
      </div>
    )

  return (
    <>
      {lien ? (
        <button type="button" data-visite="imprevu" onClick={() => setOuverte(true)} className="-my-2 min-h-11 shrink-0 px-2 font-semibold text-accent">Imprévu ›</button>
      ) : compact ? (
        <button type="button" onClick={() => setOuverte(true)} className="min-h-12 flex-1 whitespace-nowrap rounded-xl border border-bordure bg-surface px-1 text-[13px] font-semibold text-texte-2">
          Imprévu
        </button>
      ) : (
        <button type="button" onClick={() => setOuverte(true)} className="w-full rounded-[14px] bg-surface px-4 py-3 text-left text-sm text-texte-2">
          Un imprévu ? Vélo en panne…
        </button>
      )}
      {ouverte && !choix && (
        // Un seul endroit pour les imprévus (audit du 18/11/2026 : avant, panne ici, malade dans le détail du feu, « je ne
        // peux pas » dans Semaine)
        <Feuille titre="Imprévu" onFermer={() => setOuverte(false)}>
          <div className="space-y-2">
            {([['Malade', 'Malade', 'La journée est marquée indisponible ; reprise en douceur ensuite.'],
              ['Douleur / blessure', 'Douleur', 'La journée est marquée indisponible ; 3 jours en douceur ensuite.']] as const).map(([r, nom, sous]) => (
              <button key={r} type="button" aria-pressed={indispo?.raison === r} onClick={async () => {
                const annule = indispo?.raison === r
                if (annule) await supprimer(db.indispos, aujourdhui())
                else await enregistrer(db.indispos, { date: aujourdhui(), raison: r })
                setOuverte(false)
                // Un retour visible (contrôle du 19/11/2026 : la feuille se fermait sans rien dire)
                setBilan([annule ? `${nom} : annulé, la journée redevient normale.` : `${nom} : noté pour aujourd'hui. Pas d'intensité, la reprise se fera en douceur ; ton feu du jour en tient compte.`])
              }} className={`presse min-h-12 w-full rounded-xl border px-4 py-3 text-left ${indispo?.raison === r ? 'border-accent' : 'border-bordure'}`}>
                <b className="block">{indispo?.raison === r ? `✓ ${nom} (toucher pour annuler)` : nom}</b>
                <span className="text-xs text-texte-3">{sous}</span>
              </button>
            ))}
            <button type="button" onClick={() => setChoix('panne')} className="presse min-h-12 w-full rounded-xl border border-bordure px-4 py-3 text-left">
              <b className="block">Vélo en panne</b>
              <span className="text-xs text-texte-3">Le vélo de ces jours-là est annulé, l'intensité déplacée après.</span>
            </button>
            <button type="button" disabled={occupe} onClick={async () => {
              setOccupe(true)
              await enregistrer(db.indispos, { date: aujourdhui(), raison: 'Perso' })
              const { genererSemaineVelo } = await import('../plan/programme')
              const phrases = await genererSemaineVelo(lundiDe(aujourdhui())).catch(() => [] as string[])
              setOccupe(false)
              setOuverte(false)
              setBilan(['Aujourd’hui est marqué indisponible : ta semaine est recalculée (l’intensité passe à un autre jour si possible).', ...phrases])
            }} className="presse min-h-12 w-full rounded-xl border border-bordure px-4 py-3 text-left">
              <b className="block">Je ne peux pas rouler aujourd'hui</b>
              <span className="text-xs text-texte-3">Ta semaine se recalcule autour (pour un autre jour : Semaine → la séance → Changer de jour).</span>
            </button>
          </div>
        </Feuille>
      )}
      {ouverte && choix === 'panne' && (
        <Feuille titre="Vélo en panne" onFermer={() => { setOuverte(false); setChoix(undefined) }}>
          <p className="text-sm text-texte-2">Jusqu'à quand (inclus) ?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((n) => {
              const d = decalerJour(aujourdhui(), n)
              return (
                <button key={n} type="button" onClick={() => setAu(d)}
                  className={`rounded-xl border py-2 text-sm font-semibold ${au === d ? 'border-accent bg-accent text-fond' : 'border-bordure text-texte-2'}`}>
                  {n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : 'Après-demain'}
                </button>
              )
            })}
          </div>
          <label className="mt-2 flex items-center justify-between text-sm text-texte-2">
            Autre date
            <input type="date" value={au} min={aujourdhui()} onChange={(e) => e.target.value && setAu(e.target.value)} className="rounded-lg border border-bordure bg-surface-2 px-2 py-2" />
          </label>
          <p className="mt-3 text-xs text-texte-3">
            Le vélo de ces jours-là est annulé (l'intensité est déplacée après la réparation si possible). On ne rattrape pas les séances perdues : c'est plus sûr.
          </p>
          <Bouton className="mt-3" disabled={occupe} onClick={async () => {
            setOccupe(true)
            const phrases = await declarerPanneVelo(aujourdhui(), au)
            setOccupe(false)
            setOuverte(false)
            setChoix(undefined)
            setBilan(phrases.length ? phrases : ['Aucune séance vélo prévue ces jours-là : rien à changer.'])
          }}>Adapter mon programme</Bouton>
        </Feuille>
      )}
    </>
  )
}
