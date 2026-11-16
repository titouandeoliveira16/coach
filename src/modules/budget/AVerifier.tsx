import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../core/dates'
import { formatEuros, lireNombre } from '../../core/format'
import { abonnementsAVerifier, echeance, estRevenuAttendu, type Donnees } from './calculs'
import { confirmerAbonnement, relancerAbonnement, sauterAbonnement } from './donnees'
import type { Abonnement } from './types'

/** Nombre d'échéances à confirmer aujourd'hui (pour la carte « À faire »). */
export const nbAVerifier = (d: Donnees) => abonnementsAVerifier(d, aujourdhui()).length

/** Le jour du prélèvement (et les jours suivants, y compris ceux du mois précédent) : « est-ce passé sur ton compte ? ». */
export function AVerifier({ d }: { d: Donnees }) {
  const liste = abonnementsAVerifier(d, aujourdhui())
  if (!liste.length) return null
  return (
    <div>
      <p className="font-semibold">À vérifier sur ton compte</p>
      <div className="mt-2 space-y-4">{liste.map(({ a, mois }) => <Ligne key={`${a.id}|${mois}`} a={a} mois={mois} revenu={estRevenuAttendu(a, d)} />)}</div>
    </div>
  )
}

function Ligne({ a, mois, revenu }: { a: Abonnement; mois: string; revenu: boolean }) {
  const [autre, setAutre] = useState(false)
  const [texte, setTexte] = useState('')
  const montant = lireNombre(texte)
  const valide = montant !== undefined && montant > 0
  const bouton = 'min-h-11 rounded-lg border border-bordure bg-surface-2 py-2 text-sm font-semibold'
  return (
    <div>
      <p className="text-sm">
        <b>{a.nom}</b> · {formatEuros(a.montant)} (prévu le {depuisJour(echeance(a, mois)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}) : {revenu ? 'est-il arrivé sur ton compte ?' : 'est-ce passé sur ton compte ?'}
      </p>
      {autre ? (
        <div className="mt-2 flex gap-2">
          <input value={texte} onChange={(e) => setTexte(e.target.value)} inputMode="decimal" placeholder={revenu ? 'Montant reçu (€)' : 'Montant débité (€)'} className="w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2 outline-none focus:border-accent" />
          <button type="button" disabled={!valide} className={`${bouton} px-4 disabled:opacity-40`} onClick={() => confirmerAbonnement(a, mois, Math.round(montant! * 100))}>OK</button>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {/* Une seule couleur de fond par bouton : sinon le gris l'emporte et « Oui » devient illisible */}
          <button type="button" className="min-h-11 rounded-lg bg-accent py-2 text-sm font-semibold text-fond" onClick={() => confirmerAbonnement(a, mois)}>Oui</button>
          <button type="button" className={bouton} onClick={() => setAutre(true)}>Autre montant</button>
          <button type="button" className={bouton} onClick={() => relancerAbonnement(a, mois)}>Pas encore</button>
          <button type="button" className={bouton} onClick={() => sauterAbonnement(a, mois)}>Pas ce mois-ci</button>
        </div>
      )}
    </div>
  )
}
