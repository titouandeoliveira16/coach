import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { aujourdhui, jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { peseeAttendue } from './donnees'

/**
 * Pesée hebdomadaire : s'affiche en grand le jour de pesée (ou si elle a été ratée),
 * sinon une simple ligne avec le dernier poids. Met à jour le poids du profil.
 */
export function CartePesee() {
  const [profil, modifierProfil] = useProfil()
  const dernieres = useLiveQuery(() => db.pesees.orderBy('date').reverse().limit(2).toArray())
  const [poids, setPoids] = useState<number>()
  const [ouverte, setOuverte] = useState(false)

  if (!dernieres) return null
  const [derniere, precedente] = dernieres
  const attendue = peseeAttendue(profil.jourPesee, derniere?.date)
  const ecart = derniere && precedente ? derniere.poidsKg - precedente.poidsKg : undefined

  if (!attendue && !ouverte) {
    return (
      <button type="button" onClick={() => setOuverte(true)} className="flex w-full items-center justify-between rounded-2xl border border-bordure bg-surface px-4 py-3">
        <span className="text-texte-2">⚖️ Poids</span>
        <span>
          <span className="font-semibold">{derniere ? `${formatNombre(derniere.poidsKg, 1)} kg` : '–'}</span>
          {ecart !== undefined && (
            <span className="ml-2 text-sm text-texte-3">
              {ecart > 0 ? '+' : ''}
              {formatNombre(ecart, 1)}
            </span>
          )}
          {derniere && <span className="ml-2 text-xs text-texte-3">{jourCourt(derniere.date)}</span>}
        </span>
      </button>
    )
  }

  return (
    <Carte titre="⚖️ Pesée de la semaine">
      <p className="mb-1 text-xs text-texte-3">Le matin, à jeun, après être passé aux toilettes.</p>
      <ChampNombre libelle="Poids" unite="kg" valeur={poids ?? profil.poidsKg} onValider={setPoids} />
      <Bouton
        className="mt-2"
        disabled={!(poids ?? profil.poidsKg)}
        onClick={async () => {
          const kg = poids ?? profil.poidsKg
          if (!kg) return
          await db.pesees.put({ date: aujourdhui(), poidsKg: kg })
          await modifierProfil({ poidsKg: kg })
          setOuverte(false)
        }}
      >
        Enregistrer la pesée
      </Bouton>
    </Carte>
  )
}
