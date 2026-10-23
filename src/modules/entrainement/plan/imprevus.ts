import { db } from '../../../core/db'
import { aujourdhui, decalerJour, depuisJour, NOMS_JOURS } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { replanifier } from '../../../metrics/planif'
import { lundiDe } from '../seances/donnees'
import type { SeancePrevue } from '../types'
import { appliquer, joursDe } from './donnees'

/**
 * Imprévus : le vélo est en panne (matériel) pour quelques jours.
 * Les séances vélo de ces jours-là sont annulées (l'intensité est déplacée après la réparation si possible),
 * et le footing facile qui suit est un peu rallongé pour compenser une partie de l'endurance perdue.
 * Prudence (reprise de la course) : au plus +15 min, +25 % de la séance, et seulement en endurance fondamentale.
 */
export interface Panne {
  du: string
  au: string
}

const CLE = 'pannes-velo'
export const lirePannes = async () => ((await db.reglages.get(CLE))?.valeur as Panne[] | undefined) ?? []

/** Jours où le vélo est indisponible. */
export async function joursPanneVelo() {
  const jours = new Set<string>()
  for (const p of await lirePannes()) for (let d = p.du; d <= p.au; d = decalerJour(d, 1)) jours.add(d)
  return jours
}

/** Panne en cours (aujourd'hui ou plus tard). */
export async function panneEnCours() {
  return (await lirePannes()).find((p) => p.au >= aujourdhui())
}

const nomJour = (d: string) => NOMS_JOURS[depuisJour(d).getDay()]
const arrondi5 = (n: number) => Math.round(n / 5) * 5

/** Minutes ajoutées à un footing pour compenser des minutes de vélo facile perdues. */
export function minutesCompensation(minutesVeloPerdues: number, dureeFooting: number) {
  const m = Math.min(15, arrondi5(dureeFooting * 0.25), arrondi5(minutesVeloPerdues / 2))
  return m >= 5 ? m : 0
}

export async function declarerPanneVelo(du: string, au: string) {
  await enregistrer(db.reglages, { id: CLE, valeur: [...(await lirePannes()).filter((p) => p.au < du || p.du > au), { du, au }] })
  const phrases: string[] = []
  const indispos = await joursPanneVelo()
  const touchees = (await db.prevues.where('date').between(du, au, true, true).toArray()).filter((p) => p.sport === 'velo' && p.statut === 'prevue')

  let minutesPerdues = 0
  for (const p of touchees) {
    if (p.intensite !== 'basse') {
      // Séance d'intensité ou test : déplacée après la panne, dans la semaine, si un jour convient
      const semaine = joursDe(lundiDe(p.date))
      const plan = (await db.prevues.where('date').between(semaine[0], semaine[6], true, true).toArray()).filter((x) => x.statut === 'prevue')
      const fin = decalerJour(au, 1)
      phrases.push(...(fin > semaine[6]
        ? (await enregistrer(db.prevues, { ...p, statut: 'abandonnee', raison: 'Matériel' }), [`${p.titre} annulée (vélo en panne).`])
        : await appliquer(replanifier(semaine, plan, indispos, [p.id], fin), 'Matériel')))
    } else {
      minutesPerdues += p.dureeMin
      await enregistrer(db.prevues, { ...p, statut: 'abandonnee', raison: 'Matériel' })
      phrases.push(`${nomJour(p.date)} : ${p.titre} annulée (vélo en panne).`)
    }
  }

  // Compensation : le premier footing facile prévu pendant la panne ou le lendemain
  const footing = (await db.prevues.where('date').between(aujourdhui() > du ? aujourdhui() : du, decalerJour(au, 1), true, true).toArray())
    .filter((p) => p.sport === 'course' && p.statut === 'prevue' && p.intensite === 'basse' && !p.compensationMin)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const plus = footing ? minutesCompensation(minutesPerdues, footing.dureeMin) : 0
  if (footing && plus) {
    await enregistrer(db.prevues, compenser(footing, plus))
    phrases.push(`${nomJour(footing.date)} : ${footing.titre} passe à ${footing.dureeMin + plus} min (+${plus}'), toujours en endurance fondamentale, seulement si ton feu est vert.`)
  } else if (minutesPerdues) {
    phrases.push('Pas de footing facile à rallonger : on ne rattrape pas, la semaine reprend normalement.')
  }
  return phrases
}

const compenser = (p: SeancePrevue, plus: number): SeancePrevue => ({
  ...p,
  dureeMin: p.dureeMin + plus,
  compensationMin: plus,
  detail: `${p.detail ? `${p.detail} · ` : ''}+${plus}' pour compenser le vélo en panne, en endurance fondamentale (aisance respiratoire).`,
})

/** Le vélo remarche : fin de la panne aujourd'hui (les séances vélo peuvent être recalculées). */
export async function veloRepare() {
  const hier = decalerJour(aujourdhui(), -1)
  const pannes = (await lirePannes()).flatMap((p) => (p.au < aujourdhui() ? [p] : p.du <= hier ? [{ ...p, au: hier }] : []))
  await enregistrer(db.reglages, { id: CLE, valeur: pannes })
}
