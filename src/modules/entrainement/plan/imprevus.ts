import { db } from '../../../core/db'
import { aujourdhui, decalerJour, depuisJour, NOMS_JOURS } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { replanifier } from '../../../metrics/planif'
import { lundiDe } from '../seances/donnees'
import type { SeancePrevue } from '../types'
import { appliquer, joursDe } from './donnees'

/**
 * Imprévus : le vélo est en panne (matériel) pour quelques jours.
 * Les séances vélo de ces jours-là sont annulées (l'intensité est déplacée après la réparation si possible) ;
 * on ne rattrape pas les séances perdues (vélo seul depuis 11/2026 : plus de footing à rallonger).
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

  // Vélo seul (11/2026) : on ne rattrape pas les séances perdues, la semaine reprend normalement après la réparation
  if (minutesPerdues) phrases.push('On ne rattrape pas : la semaine reprend normalement après la réparation.')
  return phrases
}

/** Le vélo remarche : fin de la panne aujourd'hui (les séances vélo peuvent être recalculées). */
export async function veloRepare() {
  const hier = decalerJour(aujourdhui(), -1)
  const pannes = (await lirePannes()).flatMap((p) => (p.au < aujourdhui() ? [p] : p.du <= hier ? [{ ...p, au: hier }] : []))
  await enregistrer(db.reglages, { id: CLE, valeur: pannes })
}

/**
 * Feu rouge (fatigue, pas maladie) : la séance d'intensité vélo du jour est reportée au prochain jour possible
 * de la semaine (jamais à côté d'une séance dure), plutôt que supprimée (Vesterinen 2016, Javaloyes 2019).
 * Sans jour possible, elle passe « à reporter ».
 */
export async function reporterIntensite(p: SeancePrevue) {
  const semaine = joursDe(lundiDe(p.date))
  const demain = decalerJour(p.date, 1)
  const plan = (await db.prevues.where('date').between(semaine[0], semaine[6], true, true).toArray()).filter((x) => x.statut === 'prevue')
  const indispos = new Set([...(await db.indispos.toArray()).map((i) => i.date), ...(await joursPanneVelo())])
  const d = demain > semaine[6] ? undefined : replanifier(semaine, plan, indispos, [p.id], demain)[0]
  await enregistrer(db.prevues, d?.statut === 'deplacee' && d.vers
    ? { ...p, date: d.vers, reporteeDu: p.date, raison: 'Fatigue' }
    : { ...p, statut: 'reportee', reporteeDu: p.date, raison: 'Fatigue' })
}

/** Le feu n'est plus rouge (ou « je maintiens ») : la séance reportée revient au jour prévu. */
export async function annulerReport(jour: string) {
  for (const p of await db.prevues.toArray())
    if (p.reporteeDu === jour && (p.statut === 'prevue' || p.statut === 'reportee'))
      await enregistrer(db.prevues, { ...p, date: jour, statut: 'prevue', reporteeDu: undefined, raison: undefined })
}

/** Jours d'affilée « malade » à partir desquels on reprend en douceur. */
const JOURS_MALADE_MIN = 3
/** Jours de reprise sans intensité après la maladie. */
export const JOURS_REPRISE = 3

/**
 * Reprise après au moins 3 jours malade : les 3 jours suivants, pas d'intensité et Z2 courte (45 min max).
 * Renvoie le numéro du jour de reprise (1 à 3), ou null.
 */
export async function repriseApresMaladie(jour: string): Promise<number | null> {
  if ((await db.indispos.get(jour))?.raison === 'Malade') return null
  for (let n = 1; n <= JOURS_REPRISE; n++) {
    const d = decalerJour(jour, -n)
    if ((await db.indispos.get(d))?.raison !== 'Malade') continue
    // Dernier jour malade trouvé : la maladie a-t-elle duré au moins 3 jours ?
    let duree = 0
    while ((await db.indispos.get(decalerJour(d, -duree)))?.raison === 'Malade') duree++
    return duree >= JOURS_MALADE_MIN ? n : null
  }
  return null
}
