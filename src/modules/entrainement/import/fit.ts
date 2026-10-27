import { Decoder, Stream } from '@garmin/fitsdk'
import type { Contexte } from '../seances/donnees'
import { completerMetriques } from '../seances/donnees'
import type { Seance, Sport } from '../types'
import { analyserFlux, type Flux } from './flux'

/* Le fichier est lu entièrement dans le navigateur : rien n'est envoyé à un tiers. */

interface Session {
  sport?: string
  subSport?: string
  startTime?: Date
  totalTimerTime?: number
  totalElapsedTime?: number
  totalDistance?: number
  totalAscent?: number
}

interface Record {
  timestamp?: Date
  heartRate?: number
  power?: number
  enhancedSpeed?: number
  speed?: number
}

function sportDe(session: Session): Sport {
  const s = `${session.sport ?? ''}`.toLowerCase()
  if (s.includes('cycling') || s.includes('biking')) return 'velo'
  if (s.includes('running')) return 'course'
  if (s.includes('swimming')) return 'natation'
  if (s.includes('training') || s.includes('fitness')) return 'renfo'
  return 'autre'
}

/** Lit un fichier .FIT et renvoie la séance avec toutes ses métriques. */
export async function importerFit(fichier: File, c: Contexte): Promise<Seance> {
  const octets = new Uint8Array(await fichier.arrayBuffer())
  const stream = Stream.fromByteArray(Array.from(octets))
  if (!Decoder.isFIT(stream)) throw new Error("Ce fichier n'est pas un fichier .FIT.")
  const { messages, errors } = new Decoder(stream).read()
  const session = (messages.sessionMesgs?.[0] ?? {}) as Session
  const records = (messages.recordMesgs ?? []) as Record[]
  if (!records.length && errors.length) throw new Error('Fichier .FIT illisible ou abîmé.')

  const debut = session.startTime ?? records[0]?.timestamp
  if (!debut) throw new Error('Heure de départ introuvable dans le fichier.')
  const sport = sportDe(session)
  const t0 = debut.getTime()
  const avecTemps = records.filter((r) => r.timestamp)
  const flux: Flux = {
    t: avecTemps.map((r) => (r.timestamp!.getTime() - t0) / 1000),
    fc: avecTemps.map((r) => r.heartRate ?? null),
    w: avecTemps.map((r) => r.power ?? null),
    v: avecTemps.map((r) => r.enhancedSpeed ?? r.speed ?? null),
  }
  const sous = `${session.subSport ?? ''}`.toLowerCase()
  const seance = analyserFlux(flux, {
    sport,
    debut,
    dureeSec: session.totalTimerTime,
    distanceM: session.totalDistance,
    deniveleM: session.totalAscent,
    homeTrainer: sous.includes('indoor') || sous.includes('virtual') || sous.includes('trainer'),
    source: 'fit',
  }, c)
  return completerMetriques(seance, c)
}
