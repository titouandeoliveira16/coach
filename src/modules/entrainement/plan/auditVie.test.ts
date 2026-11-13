import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { heuresDe, phaseDe } from '../../../metrics/programme'
import { enregistrerArrivee, semaineDepuisJours, type ReponsesArrivee } from '../arrivee/donnees'
import { genererSemaineVelo, lireMeta } from './programme'
import type { ReglagesEntrainement } from '../types'

/**
 * Audit « vraie vie » (13/11/2026) : une saison entière semaine par semaine, avec des séances ratées, raccourcies,
 * des jours rouges et des semaines sans vélo, et des règles vérifiées chaque semaine.
 */
const base: ReponsesArrivee = {
  naissance: '1998-03-03', sexe: 'homme', tailleCm: 178, poidsKg: 70, cpW: 260, discipline: 'route', anciennete: '3 à 5 ans',
  heuresRecentes: '6 à 10 h', intervalles: true, arretSemaines: 0, heuresSemaine: '6 à 8 h', nutrition: false, typeCourse: 'cyclo',
  semaineType: semaineDepuisJours(4), maxSemaineMin: 75, minLongMin: 120, maxLongMin: 240, course: { nom: 'A', date: '2027-04-25' },
}
const INTENSES = ['vo2-courts', 'vo2-longs', 'seuil-plus', 'seuil', 'seuil-variable', 'sweet-spot', 'tempo', 'sprints']
// Hasard reproductible
const hasard = (graine: number) => () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647 }

const profils: [string, Partial<ReponsesArrivee>, number][] = [
  ['route 4 j, tout fait', {}, 0],
  ['route 4 j, vraie vie', {}, 1],
  ['route 5 j, 8-10 h, vraie vie', { semaineType: semaineDepuisJours(5), heuresSemaine: '8 à 10 h' }, 2],
  ['route 3 j, 4-6 h, vraie vie', { semaineType: semaineDepuisJours(3), heuresSemaine: '4 à 6 h', maxLongMin: 150 }, 3],
  ['débutant 3 j après arrêt, vraie vie', { anciennete: 'Moins d’un an', heuresRecentes: 'Moins de 3 h', intervalles: false, arretSemaines: 4, semaineType: semaineDepuisJours(3), heuresSemaine: '4 à 6 h', maxLongMin: 150 }, 4],
]

describe('audit vraie vie', () => {
  for (const [nom, p, graine] of profils)
    it(nom, async () => {
      await db.delete(); await db.open()
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-09T07:00:00'))
      const r = { ...base, ...p }
      await enregistrerArrivee(r)
      const alea = hasard(graine * 7919 + 1)
      const vraieVie = graine > 0
      const problemes: string[] = []
      let refPrec: number | undefined
      for (let l = '2026-11-09'; l <= '2027-05-03'; l = decalerJour(l, 7)) {
        vi.setSystemTime(new Date(`${l}T06:00:00`))
        await genererSemaineVelo(l)
        const e = (await db.reglages.get('entrainement'))!.valeur as ReglagesEntrainement
        const prog = e.programme!
        const meta = (await lireMeta(l))!
        const { phase } = phaseDe(l, prog.phases)
        const semaine = (await db.prevues.where('date').between(l, decalerJour(l, 6), true, true).toArray()).filter((x) => x.sport === 'velo' && x.origine === 'auto')
        // 1. Budget : jamais plus de +10 % d'une semaine sur l'autre (référence, hors allègement)
        if (refPrec && meta.budgetRef > refPrec * 1.1 + 1) problemes.push(`${l} : budget de référence ${refPrec} → ${meta.budgetRef} (+${Math.round((meta.budgetRef / refPrec - 1) * 100)} %) · ${meta.raison}`)
        refPrec = meta.budgetRef
        // 2. Pas d'intensité en reprise ni en récupération
        if (phase.type === 'reprise' || phase.type === 'recuperation')
          for (const s of semaine) if (INTENSES.includes(s.velo?.famille ?? '')) problemes.push(`${l} : ${s.titre} en ${phase.type}`)
        // 3. Durées dans tes créneaux
        for (const s of semaine.filter((x) => x.velo?.famille !== 'course')) {
          const longue = !!s.longue || s.velo?.famille === 'z2-long'
          // Séance dédiée au 1er seuil : peut dépasser ton créneau de semaine de 50 min au plus (choix du 10.5.1)
          const max = longue ? prog.maxLongMin : s.velo?.famille === 'test' ? 150 : s.velo?.formatId === 'sv1-dedie' ? Math.min(125, prog.maxSemaineMin + 50) : prog.maxSemaineMin
          if (s.dureeMin > max + 5) problemes.push(`${l} : ${s.titre} ${s.dureeMin} min pour un créneau de ${max} min`)
        }
        // 4. Heures de la semaine dans ta tranche
        // (la course elle-même n'entre pas dans tes créneaux)
        const heures = semaine.filter((x) => x.velo?.famille !== 'course').reduce((a, s) => a + s.dureeMin, 0) / 60
        if (heures > heuresDe(r.heuresSemaine)[1] + 0.25) problemes.push(`${l} : ${heures.toFixed(1)} h prévues pour une tranche « ${r.heuresSemaine} »`)
        // 5. Jamais de test en affûtage
        if (phase.type === 'affutage' && semaine.some((s) => s.velo?.famille === 'test')) problemes.push(`${l} : test CP en affûtage`)
        // 6. Une séance de vélo par jour au plus, jamais deux jours durs d'affilée
        const dures = semaine.filter((s) => s.intensite === 'haute').map((s) => s.date).sort()
        for (let i = 1; i < dures.length; i++) if (decalerJour(dures[i - 1], 1) === dures[i]) problemes.push(`${l} : deux jours durs d'affilée`)
        if (new Set(semaine.map((s) => s.date)).size < semaine.length) problemes.push(`${l} : deux séances le même jour`)

        // La semaine vécue
        const malade = vraieVie && alea() < 0.06
        const rouges = vraieVie && alea() < 0.2 ? 2 : 0
        for (const [i, s] of semaine.sort((a, b) => a.date.localeCompare(b.date)).entries()) {
          if (i < rouges) await db.decisions.put({ date: s.date, couleur: 'rouge', force: true } as never)
          const rate = malade || (vraieVie && alea() < 0.12)
          if (rate) { await db.prevues.put({ ...s, statut: 'non-faite' }); continue }
          const part = vraieVie && alea() < 0.15 ? 0.7 : 1
          await db.prevues.put({ ...s, statut: 'faite' })
          await db.seances.put({ id: `s-${s.id}`, date: s.date, sport: 'velo', dureeSec: s.dureeMin * 60 * part, kj: Math.round((s.kjPrevu ?? 0) * part), prevueId: s.id, source: 'manuel' } as never)
        }
      }
      vi.useRealTimers()
      expect(problemes).toEqual([])
    }, 120_000)
})
