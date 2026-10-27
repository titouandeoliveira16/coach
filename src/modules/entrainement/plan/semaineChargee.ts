import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import { construireZ2 } from '../../../metrics/programme'
import type { SeancePrevue, Sport } from '../types'

/**
 * Semaine chargée (examens, stage, voyage) : on garde le minimum qui entretient la forme,
 * on enlève le reste, et on ne rattrape jamais.
 *  - par sport (vélo, course) : la 1re séance d'intensité à venir + une séance facile raccourcie
 *    (vélo 60 min, de préférence la sortie longue ; course 30 min) ;
 *  - si l'intensité ou la séance facile de ce sport est déjà faite cette semaine, on ne la garde pas une 2e fois ;
 *  - le renfo et les autres sports ne bougent pas.
 * Garder un peu d'intensité suffit à maintenir le VO2max plusieurs semaines avec 2 séances
 * (Hickson 1981-1985 ; revue de Spiering et al., 2021). Durées : choix d'entraîneur.
 */
export const MIN_FACILE: Partial<Record<Sport, number>> = { velo: 60, course: 30 }

const estDure = (p: SeancePrevue) => p.intensite !== 'basse'

export interface ChoixMinimal {
  enlever: string[]
  raccourcir: { id: string; dureeMin: number }[]
}

/**
 * Choix pur : `aVenir` = séances encore prévues d'ici dimanche ; `faites` = ce qui est déjà fait cette semaine.
 */
export function choisirSemaineMinimale(aVenir: SeancePrevue[], faites: { sport: Sport; dure: boolean }[]): ChoixMinimal {
  const res: ChoixMinimal = { enlever: [], raccourcir: [] }
  for (const sport of ['velo', 'course'] as const) {
    const l = aVenir.filter((p) => p.sport === sport).sort((a, b) => a.date.localeCompare(b.date))
    const dureFaite = faites.some((f) => f.sport === sport && f.dure)
    const facileFaite = faites.some((f) => f.sport === sport && !f.dure)
    const dure = dureFaite ? undefined : l.find(estDure)
    const faciles = l.filter((p) => !estDure(p))
    const facile = facileFaite ? undefined : (faciles.find((p) => p.longue) ?? faciles[0])
    for (const p of l) {
      if (p === dure) continue
      if (p === facile) {
        if (p.dureeMin > MIN_FACILE[sport]!) res.raccourcir.push({ id: p.id, dureeMin: MIN_FACILE[sport]! })
      } else res.enlever.push(p.id)
    }
  }
  return res
}

/** Ce qui a été changé, pour pouvoir annuler. */
export interface SemaineChargee {
  enlevees: string[]
  raccourcies: SeancePrevue[]
}

const cle = (lundi: string) => `chargee-${lundi}`
export const lireSemaineChargee = async (lundi: string) => (await db.reglages.get(cle(lundi)))?.valeur as SemaineChargee | undefined

/** Version raccourcie d'une séance facile. */
function raccourcie(p: SeancePrevue, dureeMin: number): SeancePrevue {
  if (p.sport === 'velo' && p.velo?.cibleW) {
    const z = construireZ2(dureeMin, p.velo.cibleW)
    return { ...p, titre: z.titre, detail: z.detail, dureeMin, kjPrevu: z.kj, velo: z.velo, longue: undefined, type: 'Endurance' }
  }
  return { ...p, dureeMin, detail: `${p.detail ? `${p.detail} · ` : ''}raccourci à ${dureeMin} min (semaine chargée)` }
}

/** Passe la semaine en « semaine chargée » (ou la réapplique après un recalcul du vélo). */
export async function passerSemaineChargee(lundi: string) {
  const dimanche = decalerJour(lundi, 6)
  const depuis = aujourdhui() > lundi ? aujourdhui() : lundi
  const aVenir = (await db.prevues.where('date').between(depuis, dimanche, true, true).toArray()).filter((p) => p.statut === 'prevue')
  const faites = (await db.prevues.where('date').between(lundi, dimanche, true, true).toArray())
    .filter((p) => p.statut === 'faite').map((p) => ({ sport: p.sport, dure: estDure(p) }))
  const choix = choisirSemaineMinimale(aVenir, faites)
  const avant = await lireSemaineChargee(lundi)
  const etat: SemaineChargee = { enlevees: [...(avant?.enlevees ?? [])], raccourcies: [...(avant?.raccourcies ?? [])] }

  const phrases: string[] = []
  for (const id of choix.enlever) {
    const p = aVenir.find((x) => x.id === id)!
    await enregistrer(db.prevues, { ...p, statut: 'abandonnee', raison: 'Semaine chargée' })
    etat.enlevees.push(id)
    phrases.push(`${p.titre} enlevée.`)
  }
  for (const r of choix.raccourcir) {
    const p = aVenir.find((x) => x.id === r.id)!
    await enregistrer(db.prevues, raccourcie(p, r.dureeMin))
    if (!etat.raccourcies.some((x) => x.id === p.id)) etat.raccourcies.push(p)
    phrases.push(`${p.titre} raccourcie à ${r.dureeMin} min.`)
  }
  await enregistrer(db.reglages, { id: cle(lundi), valeur: etat })
  return phrases.length ? phrases : ['Rien à enlever : ta semaine est déjà minimale.']
}

/** Annule la semaine chargée : les séances à venir reviennent comme avant. */
export async function annulerSemaineChargee(lundi: string) {
  const etat = await lireSemaineChargee(lundi)
  if (!etat) return
  const jour = aujourdhui()
  for (const id of etat.enlevees) {
    const p = await db.prevues.get(id)
    if (p && p.date >= jour && p.statut === 'abandonnee' && p.raison === 'Semaine chargée') await enregistrer(db.prevues, { ...p, statut: 'prevue', raison: undefined })
  }
  for (const avant of etat.raccourcies) {
    const p = await db.prevues.get(avant.id)
    if (p && p.date >= jour && p.statut === 'prevue') await enregistrer(db.prevues, avant)
  }
  await supprimer(db.reglages, cle(lundi))
}
