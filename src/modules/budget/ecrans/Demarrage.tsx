import { useState } from 'react'
import { useSynchro } from '../../../core/synchro'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { EnTete } from '../../../core/ui/EnTete'
import { aujourdhui } from '../../../core/dates'
import { COMPTES_DEPART, demarrer } from '../donnees'

/** Premier lancement : le solde de chaque compte aujourd'hui. */
export function Demarrage() {
  const { session, statut } = useSynchro()
  const [soldes, setSoldes] = useState<Record<string, number>>({})
  const [occupe, setOccupe] = useState(false)
  const [jour, setJour] = useState(aujourdhui())
  const [jourEpargne, setJourEpargne] = useState(aujourdhui())
  const groupes = [
    { titre: 'Au quotidien', comptes: COMPTES_DEPART.filter((c) => c.type === 'courant' || c.type === 'especes'), date: jour, setDate: setJour },
    { titre: 'Épargne et placements', comptes: COMPTES_DEPART.filter((c) => c.type === 'epargne' || c.type === 'investissement'), date: jourEpargne, setDate: setJourEpargne },
  ]

  return (
    <>
      <EnTete titre="Budget" />
      <div className="space-y-3 px-4">
        <Carte>
          <p className="text-lg font-semibold">Bienvenue 👋</p>
          <p className="mt-1 text-sm text-texte-2">
            Indique ce qu'il y a sur chaque compte <b className="text-texte">au départ</b> (aujourd'hui, ou le 1er du mois si tu démarres un mois). Ensuite, l'appli calcule les soldes toute seule
            à partir de ce que tu saisis. Tu pourras ajouter, renommer ou archiver des comptes plus tard.
          </p>
          {session && statut === 'en-cours' && <p className="mt-2 text-sm text-texte-3">Synchronisation en cours… (si tu as déjà commencé sur un autre appareil, tes comptes vont arriver)</p>}
        </Carte>
        {groupes.map((g) => (
          <Carte key={g.titre} titre={g.titre}>
            <label className="mb-1 flex items-center justify-between">
              <span className="text-sm text-texte-2">Soldes au</span>
              <input type="date" value={g.date} onChange={(e) => e.target.value && g.setDate(e.target.value)} className="rounded-lg border border-bordure bg-surface-2 px-2 py-2" />
            </label>
            {g.comptes.map((c) => (
              <ChampNombre key={c.id} libelle={c.nom} unite="€" decimales={2} valeur={soldes[c.id] !== undefined ? soldes[c.id] / 100 : undefined}
                onValider={(v) => setSoldes({ ...soldes, [c.id]: Math.round((v ?? 0) * 100) })} />
            ))}
          </Carte>
        ))}
        <p className="text-xs text-texte-3">Laisse vide un compte à 0 €. PEA, CTO et Bricks : leur valeur à cette date. Une date plus ancienne pour l'épargne et les placements permet de voir leur évolution dès le premier relevé.</p>
        <Bouton disabled={occupe} onClick={async () => { setOccupe(true); await demarrer(soldes, jour, jourEpargne) }}>C'est parti</Bouton>
      </div>
    </>
  )
}
