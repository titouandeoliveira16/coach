import { useState } from 'react'
import { aujourdhui } from '../../core/dates'
import { formatEuros, lireNombre } from '../../core/format'
import { soldeAu, type Donnees } from './calculs'
import { enregistrerMouvement, nouvelId, useReglagesBudget } from './donnees'
import { useOuvrirSaisie } from './ouvrirSaisie'
import { ChampSolde } from './ChampSolde'
import type { Compte } from './types'

const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'

/** Le dimanche : compare le solde du compte courant avec celui de ta banque, et justifie l'écart s'il y en a un. */
export function Controle({ d }: { d: Donnees }) {
  const [, modifier] = useReglagesBudget()
  const jour = aujourdhui()
  const courants = d.comptes.filter((c) => c.type === 'courant' && !c.archive && c.dateDepart <= jour)
  const [faits, setFaits] = useState<string[]>([])
  if (!courants.length) return null
  const reste = courants.filter((c) => !faits.includes(c.id))
  const fini = async (id: string) => {
    setFaits([...faits, id])
    if (reste.length === 1) await modifier({ dernierControle: jour })
  }
  return (
    <div>
      <p className="font-semibold">Contrôle de la semaine</p>
      <p className="text-sm text-texte-2">Ouvre l'appli de ta banque et note le solde affiché : on vérifie que rien n'a été oublié.</p>
      {reste.map((c) => <UnCompte key={c.id} c={c} d={d} plusieurs={courants.length > 1} onFini={() => fini(c.id)} />)}
    </div>
  )
}

function UnCompte({ c, d, plusieurs, onFini }: { c: Compte; d: Donnees; plusieurs: boolean; onFini: () => void }) {
  const ouvrirSaisie = useOuvrirSaisie()
  const jour = aujourdhui()
  const [texte, setTexte] = useState('')
  const [compare, setCompare] = useState(false)
  const [note, setNote] = useState('')
  const banque = lireNombre(texte)
  const appli = soldeAu(c, d.mouvements, d.releves, jour)
  // Recalculé en direct : une dépense oubliée saisie fait fondre l'écart
  const ecart = banque === undefined ? 0 : Math.round(banque * 100) - appli

  // L'écart devient un mouvement « À catégoriser » (dépense ou revenu) : il compte dans le mois, et tout ce qui est
  // saisi ensuite (même le jour même) compte normalement
  const ajuster = async () => {
    const libelle = `Écart du contrôle${note.trim() ? ` : ${note.trim()}` : ''}`
    await enregistrerMouvement(ecart < 0
      ? { id: nouvelId(), type: 'depense', montant: -ecart, date: jour, compteId: c.id, categorieId: 'divers', note: libelle }
      : { id: nouvelId(), type: 'revenu', montant: ecart, date: jour, compteId: c.id, categorieId: 'autre-revenu', note: libelle })
    onFini()
  }

  return (
    <div className="mt-3">
      {plusieurs && <p className="text-sm font-semibold">{c.nom}</p>}
      <div className="flex gap-2">
        <ChampSolde valeur={texte} onChanger={(t) => { setTexte(t); setCompare(false) }} placeholder="Solde banque (€)" />
        <button type="button" disabled={banque === undefined} onClick={() => setCompare(true)} className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-fond disabled:opacity-40">Comparer</button>
      </div>
      {compare && banque !== undefined && (ecart === 0 ? (
        <div className="mt-2 text-sm">
          <p>Pile juste : {formatEuros(appli)}.</p>
          <button type="button" onClick={onFini} className="mt-2 w-full rounded-xl bg-surface-2 py-2.5 font-semibold">C'est noté</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          <p>
            Écart de <b style={{ color: 'var(--color-attention)' }}>{formatEuros(ecart, { signe: true })}</b> : l'appli affiche {formatEuros(appli)}.
            {ecart < 0 ? ' Ta banque a moins : une dépense oubliée ?' : ' Ta banque a plus : un revenu oublié ou un remboursement ?'}
            {' '}Regarde les lignes de ta banque depuis ton dernier contrôle. Les paiements encore « en cours » sont parfois déjà retirés du solde affiché, parfois pas.
          </p>
          <button type="button" className="w-full rounded-xl bg-surface-2 py-2.5 font-semibold"
            onClick={() => ouvrirSaisie({ type: ecart < 0 ? 'depense' : 'revenu', montant: Math.abs(ecart), compteId: c.id, date: jour })}>
            Saisir l'oubli
          </button>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ou dis d'où il vient (ex. frais)" className={champ} />
          <button type="button" className="w-full rounded-xl border border-bordure py-2.5 font-semibold text-texte-2" onClick={ajuster}>
            Ajuster : noter {formatEuros(Math.abs(ecart))} {ecart < 0 ? 'de dépense' : 'de rentrée'} « à catégoriser »
          </button>
        </div>
      ))}
    </div>
  )
}
