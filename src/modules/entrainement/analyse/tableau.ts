import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { modeleForme } from '../../../metrics/charge'
import { analyserVfc } from '../../../metrics/vfc'
import { chargesSemaine } from '../plan/donnees'
import { lundiDe } from '../seances/donnees'
import type { Seance, Sport } from '../types'
import { analyser, chargesParJour, distribution, partsRpe, type FiltreSport } from './donnees'

/** Cibles de distribution (part du temps) selon le modèle choisi (Seiler ; Casado et al., 2023). */
export const CIBLES = {
  polarise: { basse: 0.8, moyenne: 0.05, haute: 0.15 },
  pyramidal: { basse: 0.78, moyenne: 0.17, haute: 0.05 },
}

const somme = (v: number[]) => v.reduce((a, b) => a + b, 0)
const entre = (s: Seance, du: string, au: string) => s.date >= du && s.date <= au

/** Totaux de volume d'un ensemble de séances. */
function volume(seances: Seance[], sport?: Sport) {
  const l = sport ? seances.filter((s) => s.sport === sport) : seances
  return {
    heures: somme(l.map((s) => s.dureeSec)) / 3600,
    km: somme(l.map((s) => s.distanceKm ?? 0)),
    denivele: somme(l.map((s) => s.deniveleM ?? 0)),
    kj: somme(l.map((s) => s.kj ?? 0)),
    n: l.length,
  }
}

/** Données de tout le tableau de bord. */
export async function tableauDeBord(filtre: FiltreSport) {
  const jour = aujourdhui()
  const a = await analyser(jour)
  const { contexte: c, seances } = a
  const lundi = lundiDe(jour)

  // --- Charge : CTL / ATL / TSB sur 90 jours (recalculés depuis le début pour être justes) ---
  const premier = seances.reduce((m, s) => (s.date < m ? s.date : m), jour)
  const debutModele = premier < decalerJour(jour, -365) ? decalerJour(jour, -365) : premier
  const forme = modeleForme(chargesParJour(seances, c, debutModele, jour, filtre)).filter((p) => p.date > decalerJour(jour, -90))

  // --- Charge hebdo sur 12 semaines (vélo + course) + charge prévue de la semaine en cours ---
  const semaines = Array.from({ length: 12 }, (_, i) => decalerJour(lundi, -7 * (11 - i)))
  const chargeSem = (sport: 'velo' | 'course' | 'total') => semaines.map((l) => somme(chargesParJour(seances, c, l, decalerJour(l, 6), sport).map((x) => x.charge)))
  const prevueSemaine = (await chargesSemaine(lundi)).prevue

  // --- Physio sur 90 jours ---
  const mesures = await db.mesures.where('date').between(decalerJour(jour, -160), jour, true, true).toArray()
  const jours90 = Array.from({ length: 90 }, (_, i) => decalerJour(jour, -89 + i))
  const parDate = new Map(mesures.map((m) => [m.date, m]))
  const jvfc = mesures.map((m) => ({ date: m.date, rmssd: m.vfcMs, fcRepos: m.fcRepos }))
  const physio = jours90.map((d) => {
    const m = parDate.get(d)
    const v = analyserVfc(jvfc, d)
    return { date: d, ln: m?.vfcMs ? Math.log(m.vfcMs) : undefined, ln7: v.ln7, bas: v.zoneBasse, haut: v.zoneHaute, fcRepos: m?.fcRepos, sommeil: m?.sommeilH }
  })
  const pesees = await db.pesees.where('date').between(decalerJour(jour, -365), jour, true, true).toArray()

  // --- Volume ---
  const semaine = seances.filter((s) => entre(s, lundi, jour))
  const moisDebut = `${jour.slice(0, 8)}01`
  const mois = seances.filter((s) => entre(s, moisDebut, jour))
  const annee = seances.filter((s) => entre(s, `${jour.slice(0, 4)}-01-01`, jour))
  const heuresSem = (sport: Sport) => semaines.map((l) => volume(seances.filter((s) => entre(s, l, decalerJour(l, 6))), sport).heures)

  // --- Intensité ---
  const sept = seances.filter((s) => entre(s, decalerJour(jour, -6), jour))
  const vingtHuit = seances.filter((s) => entre(s, decalerJour(jour, -27), jour))

  // --- Progression : efficience sur les séances en basse intensité ---
  const faciles = seances
    .filter((s) => s.fcMoy && s.dureeSec >= 1200 && (s.tempsZones ? s.tempsZones[0] + s.tempsZones[1] >= 0.8 * s.dureeSec : s.fcMoy! < c.bornes[1]))
    .sort((x, y) => x.date.localeCompare(y.date))
  const efficienceCourse = faciles.filter((s) => s.sport === 'course' && s.distanceKm).map((s) => ({ date: s.date, valeur: ((s.distanceKm! / s.dureeSec) * 3600 * 100) / s.fcMoy! }))
  const efficienceVelo = faciles.filter((s) => s.sport === 'velo' && s.puissanceMoyW).map((s) => ({ date: s.date, valeur: s.puissanceMoyW! / s.fcMoy! }))
  const decouplages = seances.filter((s) => s.decouplage !== undefined).sort((x, y) => x.date.localeCompare(y.date)).slice(-20)

  return {
    a, forme, semaines, prevueSemaine,
    chargeVelo: chargeSem('velo'), chargeCourse: chargeSem('course'),
    // Natation, renfo, autres
    chargeAutres: chargeSem('total').map((x, i) => Math.max(0, x - chargeSem('velo')[i] - chargeSem('course')[i])),
    physio, pesees,
    volume: { semaine, mois, annee, heuresVelo: heuresSem('velo'), heuresCourse: heuresSem('course') },
    intensite: { sept: distribution(sept, c), vingtHuit: distribution(vingtHuit, c), rpeSept: partsRpe(sept), rpe28: partsRpe(vingtHuit) },
    progression: { efficienceCourse, efficienceVelo, decouplages },
    bilan: await bilanHebdo(),
  }
}
export { volume }

/**
 * Bilan de la semaine (dimanche soir ; lundi, celui de la semaine écoulée), en 5 lignes.
 * Règle du PDF : budget validé et indicateurs au vert → on monte d'un cran ; sinon on stabilise.
 */
export async function bilanHebdo() {
  const jour = aujourdhui()
  const dimanche = new Date(`${jour}T12:00:00`).getDay() === 0
  const lundi = dimanche ? lundiDe(jour) : decalerJour(lundiDe(jour), -7)
  const fin = decalerJour(lundi, 6)
  const ch = await chargesSemaine(lundi)
  const seances = await db.seances.where('date').between(lundi, fin, true, true).toArray()
  const prevues = (await db.prevues.where('date').between(lundi, fin, true, true).toArray()).filter((p) => p.statut !== 'abandonnee')
  const decisions = await db.decisions.where('date').between(lundi, fin, true, true).toArray()
  const a = await analyser(fin)
  if (!seances.length && !prevues.length) return undefined

  const v = { velo: volume(seances, 'velo'), course: volume(seances, 'course') }
  const ecart = ch.moyenne4 > 0 ? ((ch.realisee - ch.moyenne4) / ch.moyenne4) * 100 : undefined
  const faites = prevues.filter((p) => p.statut === 'faite').length
  const alertes = decisions.filter((d) => d.couleur !== 'vert').length
  const vfcOk = a.vfc.ln7 !== undefined && a.vfc.zoneBasse !== undefined ? a.vfc.ln7 >= a.vfc.zoneBasse : undefined
  const fcOk = a.vfc.fcRepos7 !== undefined && a.vfc.fcReposBase !== undefined ? a.vfc.fcRepos7 <= a.vfc.fcReposBase + 5 : undefined

  const auVert = alertes <= 1 && vfcOk !== false && fcOk !== false
  const conforme = !prevues.length || faites / prevues.length >= 0.8
  const conseil =
    ecart !== undefined && ecart > 15
      ? 'Hausse marquée cette semaine : stabilise la charge la semaine prochaine.'
      : auVert && conforme
        ? 'Budget validé et indicateurs au vert : monte d’un cran (+5 à 10 % de charge).'
        : !auVert
          ? 'Indicateurs dans le rouge : stabilise, voire baisse un peu avant de remonter.'
          : 'Plan pas entièrement suivi : refais une semaine équivalente avant d’augmenter.'

  return {
    lundi,
    lignes: [
      `Charge : ${Math.round(ch.realisee)} ${ch.unite}${ecart !== undefined ? ` (${ecart >= 0 ? '+' : ''}${Math.round(ecart)} % vs ta moyenne 4 semaines)` : ''}.`,
      `Volume : vélo ${v.velo.heures.toFixed(1).replace('.', ',')} h${v.velo.kj ? ` · ${Math.round(v.velo.kj)} kJ` : ''}, course ${v.course.heures.toFixed(1).replace('.', ',')} h · ${v.course.km.toFixed(1).replace('.', ',')} km.`,
      prevues.length ? `Plan : ${faites}/${prevues.length} séances prévues réalisées.` : 'Plan : aucune séance prévue cette semaine.',
      `Physio : ${vfcOk === undefined ? 'VFC en calibration' : vfcOk ? 'VFC dans ta zone' : 'VFC sous ta zone'}${fcOk === undefined ? '' : fcOk ? ', FC de repos stable' : ', FC de repos élevée'} · ${alertes} jour(s) en alerte.`,
      `Conseil : ${conseil}`,
    ],
  }
}
