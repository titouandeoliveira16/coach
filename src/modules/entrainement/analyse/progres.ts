import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { modeleForme } from '../../../metrics/charge'
import { analyserVfc } from '../../../metrics/vfc'
import { lundiDe } from '../seances/donnees'
import { PROGRAMME_DEFAUT } from '../reglagesEntrainement'
import type { ReglagesEntrainement } from '../types'
import { analyser, chargesParJour } from './donnees'

const somme = (x: number[]) => x.reduce((a, b) => a + b, 0)

/** Données de l'onglet Progrès : watts, volume par semaine, forme / fatigue, VFC et FC de repos. */
export async function donneesProgres() {
  const jour = aujourdhui()
  const a = await analyser(jour)
  const { contexte: c, seances } = a
  const r = (await db.reglages.get('entrainement'))?.valeur as Partial<ReglagesEntrainement> | undefined

  // CP : tests et évolution depuis le précédent
  const tests = (r?.tests ?? []).filter((t) => t.type === 'cp').sort((x, y) => x.date.localeCompare(y.date))
  const cpPrecedente = tests.length >= 2 ? tests[tests.length - 2].valeur : undefined

  // Efficacité aérobie vélo : watts par battement sur les sorties faciles de 45 min et plus (capteur + cardio)
  const efficacite = seances
    .filter((s) => s.sport === 'velo' && s.puissanceMoyW && s.fcMoy && s.dureeSec >= 2700 &&
      (s.tempsZones ? s.tempsZones[0] + s.tempsZones[1] >= 0.8 * s.dureeSec : s.fcMoy < c.bornes[1]))
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((s) => ({ date: s.date, valeur: s.puissanceMoyW! / s.fcMoy! }))
  const moy = (x: { valeur: number }[]) => (x.length ? somme(x.map((v) => v.valeur)) / x.length : undefined)
  const effRecente = moy(efficacite.slice(-4))
  const effAvant = efficacite.length >= 6 ? moy(efficacite.slice(-8, -4)) : undefined

  // kJ vélo : 28 derniers jours contre les 28 précédents
  const kjEntre = (du: string, au: string) => somme(seances.filter((s) => s.sport === 'velo' && s.date >= du && s.date <= au).map((s) => s.kj ?? 0))
  const kj28 = kjEntre(decalerJour(jour, -27), jour)
  const kj28Avant = kjEntre(decalerJour(jour, -55), decalerJour(jour, -28))

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

  return {
    a, cpW: r?.cpW, cpPrecedente, tests, testsPrevus: (r?.programme?.testsCp ?? PROGRAMME_DEFAUT.testsCp).filter((d) => d >= jour).sort(),
    efficacite, effRecente, effAvant, kj28, kj28Avant, semaines, kjVelo, chargeCourse, unite: c.chargeRef === 'trimp' ? 'TRIMP' : 'sRPE', forme, physio }
}
