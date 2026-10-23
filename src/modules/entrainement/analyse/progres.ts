import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { modeleForme } from '../../../metrics/charge'
import { analyserVfc } from '../../../metrics/vfc'
import { lundiDe } from '../seances/donnees'
import type { ReglagesEntrainement } from '../types'
import { analyser, chargesParJour } from './donnees'

const somme = (x: number[]) => x.reduce((a, b) => a + b, 0)

/** Données de l'onglet Progrès : watts, volume par semaine, forme / fatigue, VFC et FC de repos. */
export async function donneesProgres() {
  const jour = aujourdhui()
  const a = await analyser(jour)
  const { contexte: c, seances } = a
  const r = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined

  // Watts : tests CP et puissance des sorties Z2 (séances vélo faciles de 45 min et plus, avec capteur)
  const tests = (r?.tests ?? []).filter((t) => t.type === 'cp').map((t) => ({ date: t.date, w: t.valeur }))
  const z2 = seances
    .filter((s) => s.sport === 'velo' && s.puissanceMoyW && s.dureeSec >= 2700 && s.date > decalerJour(jour, -180) &&
      (s.tempsZones ? s.tempsZones[0] + s.tempsZones[1] >= 0.8 * s.dureeSec : s.rpe !== undefined && s.rpe <= 3))
    .map((s) => ({ date: s.date, w: s.puissanceMoyW! }))
  const datesWatts = [...new Set([...tests, ...z2].map((x) => x.date))].sort()
  const watts = datesWatts.map((d) => ({ date: d, cp: tests.find((t) => t.date === d)?.w, z2: z2.find((t) => t.date === d)?.w }))

  // Volume par semaine (12 semaines) : kJ vélo et charge course
  const lundi = lundiDe(jour)
  const semaines = Array.from({ length: 12 }, (_, i) => decalerJour(lundi, -7 * (11 - i)))
  const dans = (d: string, l: string) => d >= l && d <= decalerJour(l, 6)
  const kjVelo = semaines.map((l) => somme(seances.filter((s) => s.sport === 'velo' && dans(s.date, l)).map((s) => s.kj ?? 0)))
  const chargeCourse = semaines.map((l) => somme(chargesParJour(seances, c, l, decalerJour(l, 6), 'course').map((x) => x.charge)))

  // Forme et fatigue (tous sports) sur 90 jours, recalculées depuis le début
  const premier = seances.reduce((m, s) => (s.date < m ? s.date : m), jour)
  const debut = premier < decalerJour(jour, -365) ? decalerJour(jour, -365) : premier
  const forme = modeleForme(chargesParJour(seances, c, debut, jour)).filter((p) => p.date > decalerJour(jour, -90))

  // VFC et FC de repos sur 60 jours
  const mesures = await db.mesures.where('date').between(decalerJour(jour, -130), jour, true, true).toArray()
  const parDate = new Map(mesures.map((m) => [m.date, m]))
  const jv = mesures.map((m) => ({ date: m.date, rmssd: m.vfcMs, fcRepos: m.fcRepos }))
  const physio = Array.from({ length: 60 }, (_, i) => decalerJour(jour, -59 + i)).map((d) => {
    const v = analyserVfc(jv, d)
    return { date: d, ln7: v.ln7, bas: v.zoneBasse, haut: v.zoneHaute, fcRepos: parDate.get(d)?.fcRepos }
  })

  return { a, cpW: r?.cpW, vmaKmh: r?.vmaKmh, watts, semaines, kjVelo, chargeCourse, unite: c.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE', forme, physio }
}
