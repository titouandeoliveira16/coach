import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { aujourdhui } from '../../../core/dates'
import { Carte } from '../../../core/ui/Carte'
import { CarteAujourdhui } from '../forme/CarteAujourdhui'
import { CartePesee } from '../forme/CartePesee'
import { CarteResultat } from '../forme/CarteResultat'
import { ResumeMatin } from '../forme/ResumeMatin'
import { SaisieMatin } from '../forme/SaisieMatin'
import { SeptJours } from '../forme/SeptJours'
import { QUESTIONS, mesuresRecentes } from '../forme/donnees'

/** Nombre de jours de mesures avant de pouvoir calculer un signal fiable (étape 6). */
const JOURS_CALIBRATION = 14

/** Forme du jour : mesure du matin, pesée hebdo et 7 derniers jours. */
export function Forme() {
  const recentes = useLiveQuery(() => mesuresRecentes(7))
  const total = useLiveQuery(() => db.mesures.count())
  const [edition, setEdition] = useState(false)

  const dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  if (!recentes) return null
  const duJour = recentes.find((m) => m.date === aujourdhui())
  // Les chiffres peuvent arriver seuls de Garmin (Intervals.icu) : le matin n'est complet qu'avec le ressenti
  const complet = duJour !== undefined && QUESTIONS.some((q) => duJour[q.cle] !== undefined)

  return (
    <div className="space-y-3">
      <p className="text-lg capitalize text-texte-2">{dateDuJour}</p>

      {complet && !edition ? (
        <ResumeMatin mesure={duJour!} onModifier={() => setEdition(true)} />
      ) : (
        <SaisieMatin key={duJour?.modifieLe} existante={duJour} onTermine={() => setEdition(false)} />
      )}

      {complet && !edition && <CarteAujourdhui />}

      <CarteResultat />

      <CartePesee />

      <SeptJours mesures={recentes} />

      {total !== undefined && total < JOURS_CALIBRATION && (
        <Carte>
          <p className="text-sm text-texte-2">
            🧭 Calibration : <span className="font-semibold text-texte">{total}/{JOURS_CALIBRATION} jours</span> de mesures.
          </p>
          <p className="mt-1 text-xs text-texte-3">
            Le signal 🟢 🟠 🔴 comparera ta moyenne de VFC sur 7 jours à ta zone normale. Il lui faut d'abord une base.
          </p>
        </Carte>
      )}
    </div>
  )
}
