import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../core/dates'
import { formatEuros, lireNombre } from '../../core/format'
import { Carte } from '../../core/ui/Carte'
import { abonnementsAVerifier, echeance, moisDe, type Donnees } from './calculs'
import { confirmerAbonnement, relancerAbonnement, sauterAbonnement } from './donnees'
import type { Abonnement } from './types'

/** Le jour du prélèvement (et les jours suivants) : « est-ce passé sur ton compte ? ». */
export function CarteAVerifier({ d }: { d: Donnees }) {
  const jour = aujourdhui()
  const liste = abonnementsAVerifier(d, jour)
  if (!liste.length) return null
  return (
    <Carte titre="🔁 Abonnements à vérifier">
      <div className="space-y-4">{liste.map((a) => <Ligne key={a.id} a={a} mois={moisDe(jour)} />)}</div>
    </Carte>
  )
}

function Ligne({ a, mois }: { a: Abonnement; mois: string }) {
  const [autre, setAutre] = useState(false)
  const [texte, setTexte] = useState('')
  const montant = lireNombre(texte)
  const bouton = 'rounded-lg border border-bordure bg-surface-2 py-2 text-sm font-semibold'
  return (
    <div>
      <p className="text-sm">
        <b>{a.nom}</b> · {formatEuros(a.montant)} (prévu le {depuisJour(echeance(a, mois)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}) : est-ce passé sur ton compte ?
      </p>
      {autre ? (
        <div className="mt-2 flex gap-2">
          <input value={texte} onChange={(e) => setTexte(e.target.value)} inputMode="decimal" placeholder="Montant débité (€)" className="w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2 outline-none focus:border-accent" />
          <button type="button" disabled={!montant} className={`${bouton} px-4 disabled:opacity-40`} onClick={() => confirmerAbonnement(a, mois, Math.round(montant! * 100))}>OK</button>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className={`${bouton} bg-accent text-fond`} onClick={() => confirmerAbonnement(a, mois)}>✅ Oui</button>
          <button type="button" className={bouton} onClick={() => setAutre(true)}>✏️ Autre montant</button>
          <button type="button" className={bouton} onClick={() => relancerAbonnement(a, mois)}>⏳ Pas encore</button>
          <button type="button" className={bouton} onClick={() => sauterAbonnement(a, mois)}>❌ Pas ce mois-ci</button>
        </div>
      )}
    </div>
  )
}
