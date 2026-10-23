import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { enregistrer, supprimer } from '../../../core/stockage'
import { srpe } from '../../../metrics/charge'
import { replanifier, trimpPrevu, type Deplacement } from '../../../metrics/planif'
import { proposerSemaineCourse, type SeanceProposee } from '../../../metrics/propositionsCourse'
import { chargeDe, chargerContexte, domaineDe, lundiDe, nouvelId } from '../seances/donnees'
import type { BlocCourse, Indispo, Raison, SeancePrevue } from '../types'

/** Les 7 dates (lundi → dimanche) de la semaine qui commence `lundi`. */
export const joursDe = (lundi: string) => Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i))

/** RPE typique d'une séance selon son intensité (pour estimer une charge sRPE prévue). */
const RPE_TYPIQUE = { basse: 2.5, moyenne: 5.5, haute: 7.5 } as const

/** Séances qui comptent encore dans le plan (ni abandonnées ni reportées). */
const actives = (p: SeancePrevue) => p.statut === 'prevue' || p.statut === 'faite'

/** Applique le résultat d'une replanification et renvoie des phrases lisibles. */
async function appliquer(deplacements: Deplacement[], raison?: Raison) {
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
  return appliquer(replanifier(semaine, [...prevues, p], indispos, [p.id], demain), raison)
}

export const enregistrerPrevue = (p: SeancePrevue) => enregistrer(db.prevues, p)
export const supprimerPrevue = (id: string) => supprimer(db.prevues, id)

/** Charges de la semaine : prévue, réalisée, semaine précédente, moyenne des 4 précédentes (même unité que le tableau de bord). */
export async function chargesSemaine(lundi: string) {
  const c = await chargerContexte()
  const seances = await db.seances.where('date').between(decalerJour(lundi, -28), decalerJour(lundi, 6), true, true).toArray()
  const prevues = (await db.prevues.where('date').between(lundi, decalerJour(lundi, 6), true, true).toArray()).filter(actives)
  const realiseeEntre = (du: string, au: string) => seances.filter((s) => s.date >= du && s.date <= au).reduce((a, s) => a + chargeDe(s, c), 0)

  const realisee = realiseeEntre(lundi, decalerJour(lundi, 6))
  // Prévue = séances faites (charge réelle) + séances encore à faire (charge estimée)
  const estimer = (p: SeancePrevue) =>
    c.chargeRef === 'trimp' ? trimpPrevu(p.intensite, p.dureeMin) : srpe(RPE_TYPIQUE[p.intensite], p.dureeMin)
  const reste = prevues.filter((p) => p.statut === 'prevue').reduce((a, p) => a + estimer(p), 0)
  const prevue = realisee + reste
  const precedentes = [1, 2, 3, 4].map((n) => realiseeEntre(decalerJour(lundi, -7 * n), decalerJour(lundi, -7 * n + 6)))
  return { prevue, realisee, precedente: precedentes[0], moyenne4: precedentes.reduce((a, b) => a + b, 0) / 4, unite: c.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE' }
}

/** Propose les séances de course de la semaine selon le bloc en cours. */
export async function proposerCourse(bloc: BlocCourse, lundi: string): Promise<SeanceProposee[]> {
  const c = await chargerContexte()
  const semaine = joursDe(lundi)
  const seances = await db.seances.where('date').between(decalerJour(lundi, -21), semaine[6], true, true).toArray()
  const prevues = (await db.prevues.where('date').between(semaine[0], semaine[6], true, true).toArray()).filter(actives)
  const indispos = new Set((await db.indispos.where('date').between(semaine[0], semaine[6], true, true).toArray()).map((i) => i.date))
  const volumes = [3, 2, 1].map((n) => {
    const du = decalerJour(lundi, -7 * n)
    return seances.filter((s) => s.sport === 'course' && s.date >= du && s.date <= decalerJour(du, 6)).reduce((a, s) => a + s.dureeSec / 60, 0)
  })
  // Jours de vélo intense (prévu ou fait), et séances vélo longues (> 2 h) : la course de qualité les évite
  const joursVeloIntense = new Set([
    ...prevues.filter((p) => p.sport === 'velo' && (p.intensite !== 'basse' || p.dureeMin >= 120)).map((p) => p.date),
    ...seances.filter((s) => s.sport === 'velo' && (domaineDe(s, c.bornes) !== 'basse' || s.dureeSec >= 7200)).map((s) => s.date),
  ])
  const numeroSemaine = Math.floor((new Date(`${lundi}T12:00:00`).getTime() - new Date(`${bloc.debut}T12:00:00`).getTime()) / (7 * 86400000)) + 1
  return proposerSemaineCourse({
    objectif: bloc.objectif, dateObjectif: bloc.dateObjectif, seancesParSemaine: bloc.seancesParSemaine,
    vmaKmh: c.vmaKmh ?? 18.5, semaine, volumesPrecedentsMin: volumes, numeroSemaine: Math.max(1, numeroSemaine),
    indispos, joursVeloIntense,
  })
}

/** Ajoute les propositions au plan (remplace les anciennes propositions de course non faites de la semaine). */
export async function ajouterPropositions(props: SeanceProposee[], lundi: string) {
  const semaine = joursDe(lundi)
  const anciennes = (await db.prevues.where('date').between(semaine[0], semaine[6], true, true).toArray())
    .filter((p) => p.origine === 'propose' && p.sport === 'course' && p.statut === 'prevue')
  for (const p of anciennes) await supprimer(db.prevues, p.id)
  for (const p of props) {
    await enregistrer(db.prevues, {
      id: nouvelId(), date: p.date, sport: 'course', titre: p.titre, intensite: p.intensite, dureeMin: p.dureeMin,
      detail: p.detail, priorite: p.intensite !== 'basse' || p.longue ? 'cle' : 'normale', longue: p.longue,
      type: p.longue ? 'Sortie longue' : p.intensite === 'haute' ? 'Fractionné / VMA' : p.intensite === 'moyenne' ? 'Seuil' : 'Endurance',
      statut: 'prevue', origine: 'propose',
    })
  }
}

/** Une séance d'un fichier de plan (format préparé par Claude à partir de ton plan écrit). */
interface LignePlan {
  date: string
  sport: 'velo' | 'course'
  titre: string
  intensite: 'basse' | 'moyenne' | 'haute'
  dureeMin: number
  type?: SeancePrevue['type']
  detail?: string
  priorite?: 'cle' | 'normale'
  longue?: boolean
}

/**
 * Importe un plan (fichier JSON { "app": "coach-plan", "seances": [...] }).
 * Réimporter le même fichier remplace les séances au lieu de les dupliquer.
 */
export async function importerPlan(fichier: File) {
  let contenu: { app?: string; seances?: LignePlan[] }
  try {
    contenu = JSON.parse(await fichier.text())
  } catch {
    throw new Error("Ce fichier n'est pas un fichier JSON lisible.")
  }
  if (contenu.app !== 'coach-plan' || !Array.isArray(contenu.seances)) throw new Error("Ce fichier n'est pas un plan Coach.")
  let n = 0
  for (const l of contenu.seances) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date) || !l.titre || !l.dureeMin) continue
    const id = `plan-${l.date}-${l.sport}-${l.titre}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    const existante = await db.prevues.get(id)
    await enregistrer(db.prevues, {
      id, date: l.date, sport: l.sport === 'course' ? 'course' : 'velo', titre: l.titre, type: l.type,
      intensite: ['basse', 'moyenne', 'haute'].includes(l.intensite) ? l.intensite : 'basse',
      dureeMin: Math.round(l.dureeMin), detail: l.detail, priorite: l.priorite === 'cle' ? 'cle' : 'normale', longue: l.longue,
      statut: existante?.statut ?? 'prevue', raison: existante?.raison, origine: 'manuel',
    })
    n++
  }
  return n
}
