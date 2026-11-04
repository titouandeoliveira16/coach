import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import { srpe } from '../../../metrics/charge'
import { replanifier, trimpPrevu, type Deplacement } from '../../../metrics/planif'
import { chargeDe, chargerContexte, lundiDe } from '../seances/donnees'
import { TYPES_COURSE, type Indispo, type Raison, type SeancePrevue } from '../types'
import { joursPanneVelo } from './imprevus'

/** Les 7 dates (lundi → dimanche) de la semaine qui commence `lundi`. */
export const joursDe = (lundi: string) => Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i))

/** RPE typique d'une séance selon son intensité (pour estimer une charge sRPE prévue). */
const RPE_TYPIQUE = { basse: 2.5, moyenne: 5.5, haute: 7.5 } as const

/** Séances qui comptent encore dans le plan (ni abandonnées ni reportées). */
const actives = (p: SeancePrevue) => p.statut === 'prevue' || p.statut === 'faite'

/** Applique le résultat d'une replanification et renvoie des phrases lisibles. */
export async function appliquer(deplacements: Deplacement[], raison?: Raison) {
  const phrases: string[] = []
  for (const d of deplacements) {
    const p = await db.prevues.get(d.id)
    if (!p) continue
    if (d.statut === 'deplacee' && d.vers) {
      await enregistrer(db.prevues, { ...p, date: d.vers, statut: 'prevue', raison })
      phrases.push(`${p.titre} déplacée au ${new Date(`${d.vers}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' })}`)
    } else {
      await enregistrer(db.prevues, { ...p, statut: d.statut === 'reportee' ? 'reportee' : 'abandonnee', raison })
      phrases.push(`${p.titre} ${d.statut === 'reportee' ? 'à reporter à la semaine prochaine (séance clé)' : 'abandonnée'}`)
    }
  }
  return phrases
}

/** Replace des séances de la semaine (à partir d'aujourd'hui). */
async function replacer(ids: string[], lundi: string, raison?: Raison) {
  const semaine = joursDe(lundi)
  const prevues = (await db.prevues.where('date').between(semaine[0], semaine[6], true, true).toArray()).filter(actives)
  const indispos = new Set((await db.indispos.where('date').between(semaine[0], semaine[6], true, true).toArray()).map((i) => i.date))
  const plan = prevues.filter((p) => p.statut === 'prevue' || ids.includes(p.id))
  const debut = aujourdhui() > semaine[0] ? aujourdhui() : semaine[0]
  return appliquer(replanifier(semaine, plan, indispos, ids, debut), raison)
}

/** Marque un jour indisponible et replace automatiquement ses séances prévues. */
export async function declarerIndispo(i: Indispo) {
  await enregistrer(db.indispos, i)
  const aDeplacer = (await db.prevues.where('date').equals(i.date).toArray()).filter((p) => p.statut === 'prevue').map((p) => p.id)
  return aDeplacer.length ? replacer(aDeplacer, lundiDe(i.date), i.raison) : []
}

export const leverIndispo = (date: string) => supprimer(db.indispos, date)

/** Séance prévue non faite : on la replace (ou on l'abandonne / la reporte selon sa priorité). */
export async function declarerNonFaite(p: SeancePrevue, raison: Raison) {
  await enregistrer(db.prevues, { ...p, statut: 'non-faite', raison })
  const lundi = lundiDe(p.date)
  const demain = decalerJour(aujourdhui(), 1)
  // On ne replace que vers le futur (à partir de demain)
  const semaine = joursDe(lundi)
  if (demain > semaine[6]) return [`${p.titre} non faite (${raison}) : la semaine est terminée.`]
  const prevues = (await db.prevues.where('date').between(semaine[0], semaine[6], true, true).toArray()).filter((x) => x.statut === 'prevue')
  const indispos = new Set((await db.indispos.where('date').between(semaine[0], semaine[6], true, true).toArray()).map((i) => i.date))
  // Vélo en panne : pas de vélo ces jours-là
  if (p.sport === 'velo') for (const d of await joursPanneVelo()) indispos.add(d)
  return appliquer(replanifier(semaine, [...prevues, p], indispos, [p.id], demain), raison)
}

/**
 * Change une séance de jour. Si le jour choisi a déjà des séances à faire, elles prennent sa place : les jours sont échangés.
 */
/**
 * Change une séance de jour. Par défaut, si une séance est déjà prévue ce jour-là, les deux échangent leur jour ;
 * avec `ensemble`, les deux restent le même jour (ex. renfo le jour d'un footing).
 */
export async function changerDeJour(p: SeancePrevue, vers: string, ensemble = false) {
  if (vers === p.date) return []
  const la = (await db.prevues.where('date').equals(vers).toArray()).filter((x) => x.statut === 'prevue' && x.id !== p.id)
  await enregistrer(db.prevues, { ...p, date: vers, deplacee: true })
  const nom = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' })
  if (ensemble && la.length) {
    const deuxDures = p.intensite === 'haute' && la.some((x) => x.intensite === 'haute')
    const renfo = p.sport === 'renfo' || la.some((x) => x.sport === 'renfo')
    return [
      `${p.titre} passe au ${nom(vers)}, avec ${la.map((x) => x.titre).join(' et ')} : 2 séances ce jour-là.`,
      ...(renfo ? ['Fais le renfo au moins 3 h après (ou avant) l’autre séance : dans la même séance, l’explosivité progresse moins (Schumann 2022).'] : []),
      ...(deuxDures ? ['Attention : deux séances dures le même jour, c’est beaucoup. Garde-le exceptionnel.'] : []),
    ]
  }
  for (const x of la) await enregistrer(db.prevues, { ...x, date: p.date, deplacee: true })
  return la.length
    ? [`${p.titre} passe au ${nom(vers)}, ${la.map((x) => x.titre).join(' et ')} au ${nom(p.date)}.`]
    : [`${p.titre} passe au ${nom(vers)}.`]
}

/**
 * Jours où déplacer une séance plutôt que l'annuler : de demain (ou aujourd'hui si elle était prévue avant) à dimanche,
 * jours libres sans indisponibilité. Pour une séance dure : « conseillé » s'il n'y a pas de séance dure la veille ni le lendemain.
 */
export async function joursPourDeplacer(p: SeancePrevue) {
  const jour = aujourdhui()
  const semaine = joursDe(lundiDe(p.date))
  const debut = p.date < jour ? jour : decalerJour(jour, 1)
  const autour = (await db.prevues.where('date').between(decalerJour(semaine[0], -1), decalerJour(semaine[6], 1), true, true).toArray())
    .filter((x) => x.id !== p.id && (x.statut === 'prevue' || x.statut === 'faite'))
  const indispos = new Set((await db.indispos.where('date').between(semaine[0], semaine[6], true, true).toArray()).map((i) => i.date))
  if (p.sport === 'velo') for (const d of await joursPanneVelo()) indispos.add(d)
  const dur = (d: string) => autour.some((x) => x.date === d && x.intensite === 'haute')
  return semaine
    .filter((d) => d >= debut && d !== p.date && !indispos.has(d) && !autour.some((x) => x.date === d))
    .map((d) => {
      const voisinDur = p.intensite === 'haute' && (dur(decalerJour(d, -1)) || dur(decalerJour(d, 1)))
      return { date: d, conseille: !voisinDur, note: voisinDur ? 'séance dure juste avant ou après' : 'libre' }
    })
}

/** Annuler vraiment une séance (sans la replacer) : elle reste notée « pas faite », avec la raison. */
export async function annulerPrevue(p: SeancePrevue, raison: Raison) {
  await enregistrer(db.prevues, { ...p, statut: 'non-faite', raison })
  return [`${p.titre} annulée (${raison}) : elle n'est pas rattrapée.`]
}

export const enregistrerPrevue = (p: SeancePrevue) => enregistrer(db.prevues, p)
export const supprimerPrevue = (id: string) => supprimer(db.prevues, id)

/**
 * Charge estimée d'une séance prévue. Course Campus : le temps à l'allure clé compte à son intensité,
 * le reste (échauffement, récup, retour au calme) en endurance.
 */
export function chargePrevue(p: SeancePrevue, ref: 'trimp' | 'srpe') {
  const charge = (i: SeancePrevue['intensite'], min: number) => (ref === 'trimp' ? trimpPrevu(i, min) : srpe(RPE_TYPIQUE[i], min))
  const cle = p.minutesCle ? Math.min(p.minutesCle, p.dureeMin) : undefined
  return cle !== undefined && p.intensite !== 'basse' ? charge(p.intensite, cle) + charge('basse', p.dureeMin - cle) : charge(p.intensite, p.dureeMin)
}

/** Intensité, type et priorité d'une séance de course selon son type Campus. */
export const champsCourse = (t: keyof typeof TYPES_COURSE): Pick<SeancePrevue, 'intensite' | 'type' | 'priorite' | 'longue'> => ({
  intensite: TYPES_COURSE[t].intensite,
  type: TYPES_COURSE[t].type,
  priorite: TYPES_COURSE[t].intensite === 'haute' || t === 'Sortie longue' ? 'cle' : 'normale',
  longue: t === 'Sortie longue' || undefined,
})

/** Charges de la semaine : prévue, réalisée, semaine précédente, moyenne des 4 précédentes (même unité que le tableau de bord). */
export async function chargesSemaine(lundi: string) {
  const c = await chargerContexte()
  const seances = await db.seances.where('date').between(decalerJour(lundi, -28), decalerJour(lundi, 6), true, true).toArray()
  const prevues = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()).filter(actives)
  const realiseeEntre = (du: string, au: string) => seances.filter((s) => s.date >= du && s.date <= au).reduce((a, s) => a + chargeDe(s, c), 0)

  const realisee = realiseeEntre(lundi, decalerJour(lundi, 6))
  // Prévue = séances faites (charge réelle) + séances encore à faire (charge estimée)
  const estimer = (p: SeancePrevue) => chargePrevue(p, c.chargeRef)
  const reste = prevues.filter((p) => p.statut === 'prevue').reduce((a, p) => a + estimer(p), 0)
  const prevue = realisee + reste
  const precedentes = [1, 2, 3, 4].map((n) => realiseeEntre(decalerJour(lundi, -7 * n), decalerJour(lundi, -7 * n + 6)))
  // Budget kJ (vélo) : réalisé + reste à faire
  const kjRealises = seances.filter((s) => s.date >= lundi && s.date <= decalerJour(lundi, 6)).reduce((a, s) => a + (s.kj ?? 0), 0)
  const kjReste = prevues.filter((p) => p.statut === 'prevue').reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
  return {
    prevue, realisee, precedente: precedentes[0], moyenne4: precedentes.reduce((a, b) => a + b, 0) / 4,
    unite: c.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE', kjRealises, kjPrevus: kjRealises + kjReste,
  }
}
