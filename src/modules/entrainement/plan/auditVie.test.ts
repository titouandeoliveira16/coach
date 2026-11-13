import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { deplier, heuresDe, phaseDe } from '../../../metrics/programme'
import { enregistrerArrivee, semaineDepuisJours, type ReponsesArrivee } from '../arrivee/donnees'
import { genererSemaineVelo, lireMeta, seancesClesSautees } from './programme'
import { declarerPanneVelo } from './imprevus'
import type { ReglagesEntrainement, SemaineTypeFuture } from '../types'
import { heuresAu, programmeAu } from '../reglagesEntrainement'
import { adapterDuJour } from './adaptation'

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

const futures: SemaineTypeFuture[] = [
  { debut: '2027-01-04', semaineType: semaineDepuisJours(5), maxSemaineMin: 75, maxLongMin: 240, heuresSemaine: '8 à 10 h' },
  { debut: '2027-02-01', semaineType: semaineDepuisJours(5), maxSemaineMin: 90, maxLongMin: 270 },
  { debut: '2027-03-15', semaineType: semaineDepuisJours(3), maxSemaineMin: 60, maxLongMin: 180, heuresSemaine: '4 à 6 h' },
]
const profils: [string, Partial<ReponsesArrivee>, number, SemaineTypeFuture[]?][] = [
  ['route 4 j, tout fait', {}, 0],
  ['route 4 j, vraie vie', {}, 1],
  ['route 5 j, 8-10 h, vraie vie', { semaineType: semaineDepuisJours(5), heuresSemaine: '8 à 10 h' }, 2],
  ['route 3 j, 4-6 h, vraie vie', { semaineType: semaineDepuisJours(3), heuresSemaine: '4 à 6 h', maxLongMin: 150 }, 3],
  ['débutant 3 j après arrêt, vraie vie', { anciennete: 'Moins d’un an', heuresRecentes: 'Moins de 3 h', intervalles: false, arretSemaines: 4, semaineType: semaineDepuisJours(3), heuresSemaine: '4 à 6 h', maxLongMin: 150 }, 4],
  ['XCO 4 j, vraie vie', { discipline: 'xco', typeCourse: undefined }, 5],
  ['marathon VTT 5 j, 8-10 h, vraie vie', { discipline: 'xcm', typeCourse: undefined, semaineType: semaineDepuisJours(5), heuresSemaine: '8 à 10 h' }, 6],
  ['route 4 j, 2 courses A (6 semaines d’écart), vraie vie', { course: { nom: 'A1', date: '2027-04-11', distanceKm: 120, deniveleM: 1500 }, autresCourses: [{ date: '2027-05-23', nom: 'A2', niveau: 'A', epreuve: 'cyclo', distanceKm: 150, deniveleM: 2500 }] }, 7],
  ['route en ligne 5 j, vraie vie', { typeCourse: 'en-ligne', semaineType: semaineDepuisJours(5), heuresSemaine: '8 à 10 h' }, 8],
  ['semaine type qui change : 4 j → 5 j (4 janv.), plus long (1er févr.), 3 j (15 mars), vraie vie', {}, 9, futures],
]
/** Semaines de panne de vélo (du mercredi au samedi) et semaines où la séance d'intensité saute exprès. */
const PANNES = ['2026-12-16', '2027-02-24']
const SAUTS = ['2027-01-18', '2027-01-25']

describe('audit vraie vie', () => {
  for (const [nom, p, graine, aVenir] of profils)
    it(nom, async () => {
      await db.delete(); await db.open()
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-09T07:00:00'))
      const r = { ...base, ...p }
      await enregistrerArrivee(r)
      // Muscu reliée (13/11/2026), 2 séances par semaine
      await db.reglages.put({ id: 'force', valeur: { actif: true, lieu: 'salle', seances: 2, debut: '2026-11-09', exos: {} } } as never)
      if (aVenir) {
        const e0 = (await db.reglages.get('entrainement'))!.valeur as ReglagesEntrainement
        await db.reglages.put({ id: 'entrainement', valeur: { ...e0, programme: { ...e0.programme!, semainesTypesFutures: aVenir } } } as never)
      }
      const alea = hasard(graine * 7919 + 1)
      const vraieVie = graine > 0
      const problemes: string[] = []
      let refPrec: number | undefined
      const fin = [r.course.date, ...(r.autresCourses ?? []).map((c) => c.date)].sort().pop()!
      const derniers = new Map<string, { palier: number; resultat?: string }>()
      for (let l = '2026-11-09'; l <= decalerJour(fin, 14); l = decalerJour(l, 7)) {
        vi.setSystemTime(new Date(`${l}T06:00:00`))
        await genererSemaineVelo(l)
        const e = (await db.reglages.get('entrainement'))!.valeur as ReglagesEntrainement
        const prog = programmeAu(e.programme!, l)
        const tranche = heuresAu(e.programme!, r.heuresSemaine, l) ?? r.heuresSemaine
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
          // Séance dédiée au 1er seuil : 10 min de plus que ton créneau au plus (13/11/2026)
          const max = longue ? prog.maxLongMin : s.velo?.famille === 'test' ? 150 : s.velo?.formatId === 'sv1-dedie' ? prog.maxSemaineMin + 10 : prog.maxSemaineMin
          if (s.dureeMin > max + 5) problemes.push(`${l} : ${s.titre} ${s.dureeMin} min pour un créneau de ${max} min`)
        }
        // 4. Heures de la semaine dans ta tranche
        // (la course elle-même n'entre pas dans tes créneaux)
        const heures = semaine.filter((x) => x.velo?.famille !== 'course').reduce((a, s) => a + s.dureeMin, 0) / 60
        if (heures > heuresDe(tranche)[1] + 0.25) problemes.push(`${l} : ${heures.toFixed(1)} h prévues pour une tranche « ${tranche} »`)
        // 10. Semaine type qui change : autant de séances de vélo que de jours de vélo de la semaine type du moment (hors course)
        if (aVenir && !semaine.some((x) => x.velo?.famille === 'course')) {
          const jours = prog.semaineType.filter((x) => x.startsWith('velo')).length
          if (semaine.length !== jours) problemes.push(`${l} : ${semaine.length} séances de vélo pour ${jours} jours de vélo dans la semaine type`)
        }
        // 11. Feu orange : séance d'intensité raccourcie aux mêmes watts, séance au 1er seuil en endurance
        for (const x of semaine) {
          const a = adapterDuJour(x, 'orange')
          if (!a.modifiee || !a.etapes || !x.velo?.etapes) continue
          const avant = deplier(x.velo.etapes), apres = deplier(a.etapes)
          const duree = (l2: typeof avant) => l2.reduce((t, e2) => t + e2.dureeSec, 0)
          const wMax = (l2: typeof avant) => Math.max(0, ...l2.map((e2) => e2.w ?? 0))
          if (duree(apres) >= duree(avant)) problemes.push(`${l} : feu orange, ${x.titre} pas raccourcie`)
          if (INTENSES.includes(x.velo.famille) && Math.abs(wMax(apres) - wMax(avant)) > 5) problemes.push(`${l} : feu orange, ${x.titre} à ${wMax(apres)} W au lieu de ${wMax(avant)} W`)
          if (x.velo.formatId === 'sv1-dedie' && wMax(apres) >= (x.velo.sv1W ?? Infinity)) problemes.push(`${l} : feu orange, séance 1er seuil gardée au 1er seuil`)
        }
        // 5. Jamais de test en affûtage
        if (phase.type === 'affutage' && semaine.some((s) => s.velo?.famille === 'test')) problemes.push(`${l} : test CP en affûtage`)
        // 6. Une séance de vélo par jour au plus, jamais deux jours durs d'affilée
        const dures = semaine.filter((s) => s.intensite === 'haute').map((s) => s.date).sort()
        for (let i = 1; i < dures.length; i++) if (decalerJour(dures[i - 1], 1) === dures[i]) problemes.push(`${l} : deux jours durs d'affilée`)
        if (new Set(semaine.map((s) => s.date)).size < semaine.length) problemes.push(`${l} : deux séances le même jour`)

        // 7. Paliers : entre 0 et 3, et jamais plus haut juste après une séance ratée de la même famille
        for (const s of semaine.filter((x) => INTENSES.includes(x.velo?.famille ?? '') && x.velo?.palier !== undefined)) {
          const pal = s.velo!.palier!
          if (pal < 0 || pal > 3) problemes.push(`${l} : palier ${pal} hors limites (${s.titre})`)
          const prec = derniers.get(s.velo!.famille)
          if (prec?.resultat === 'ratee' && pal > prec.palier) problemes.push(`${l} : ${s.titre} au palier ${pal + 1} juste après un palier ${prec.palier + 1} raté`)
        }
        // 8. Panne : aucune séance de vélo à faire pendant la panne
        const panne = PANNES.find((d) => d >= l && d <= decalerJour(l, 6))
        if (vraieVie && panne) {
          vi.setSystemTime(new Date(`${panne}T06:00:00`))
          await declarerPanneVelo(panne, decalerJour(panne, 3))
          const pendant = (await db.prevues.where('date').between(panne, decalerJour(panne, 3), true, true).toArray()).filter((x) => x.sport === 'velo' && x.statut === 'prevue')
          if (pendant.length) problemes.push(`${l} : ${pendant.length} séance(s) de vélo encore prévue(s) pendant la panne`)
        }
        // 9. Séance clé sautée deux semaines de suite : l'alerte se déclenche
        if (vraieVie && l === decalerJour(SAUTS[1], 7) && !(await seancesClesSautees(l)).includes('intensite')
          && (await db.prevues.where('date').between(SAUTS[0], decalerJour(SAUTS[1], 6), true, true).toArray()).filter((x) => x.origine === 'auto' && INTENSES.includes(x.velo?.famille ?? '')).length >= 2)
          problemes.push(`${l} : intensité sautée 2 semaines de suite sans alerte`)

        // 12. Muscu : jamais le même jour qu'un vélo sauf le soir d'une séance dure, jamais la veille d'une séance clé ni
        // dans les 4 jours avant une course, 2 au plus (1 en entretien et avant la course), rien en récupération
        const toutes = (await db.prevues.where('date').between(l, decalerJour(l, 7), true, true).toArray()).filter((x) => x.statut === 'prevue')
        const muscus = toutes.filter((x) => x.muscu && x.date <= decalerJour(l, 6))
        const max = phase.type === 'recuperation' ? 0 : ['fin-prepa', 'specifique', 'affutage', 'entretien'].includes(phase.type) ? 1 : 2
        if (muscus.length > max) problemes.push(`${l} : ${muscus.length} séances de muscu en ${phase.type}`)
        const courses = [...prog.competitions.map((c) => c.date)]
        for (const m of muscus) {
          const velo = toutes.find((x) => x.sport === 'velo' && x.date === m.date)
          if (velo && !(m.muscu!.soir && velo.intensite !== 'basse' && velo.velo?.famille !== 'test')) problemes.push(`${l} : muscu le ${m.date} avec ${velo.titre}`)
          const lendemain = toutes.find((x) => x.sport === 'velo' && x.date === decalerJour(m.date, 1) && (x.intensite === 'haute' || x.longue || x.velo?.famille === 'test' || x.velo?.famille === 'course'))
          if (lendemain) problemes.push(`${l} : muscu le ${m.date}, veille de ${lendemain.titre}`)
          if (courses.some((c) => c >= m.date && c <= decalerJour(m.date, 4))) problemes.push(`${l} : muscu le ${m.date}, moins de 4 jours avant une course`)
        }

        // La semaine vécue
        const semaineVecue = (await db.prevues.where('date').between(l, decalerJour(l, 6), true, true).toArray()).filter((x) => x.sport === 'velo' && x.origine === 'auto' && x.statut === 'prevue')
        const malade = vraieVie && alea() < 0.06
        const rouges = vraieVie && alea() < 0.2 ? 2 : 0
        for (const [i, s] of semaineVecue.sort((a, b) => a.date.localeCompare(b.date)).entries()) {
          if (i < rouges) await db.decisions.put({ date: s.date, couleur: 'rouge', force: true } as never)
          const intense = INTENSES.includes(s.velo?.famille ?? '')
          const rate = malade || (vraieVie && alea() < 0.12) || (vraieVie && intense && SAUTS.includes(l))
          if (rate) { await db.prevues.put({ ...s, statut: 'non-faite' }); continue }
          const part = vraieVie && alea() < 0.15 ? 0.7 : 1
          const resultat = intense ? (vraieVie && alea() < 0.3 ? 'ratee' : 'reussie') : undefined
          if (intense) derniers.set(s.velo!.famille, { palier: s.velo!.palier ?? 0, resultat: s.velo!.allegee ? undefined : resultat })
          await db.prevues.put({ ...s, statut: 'faite', ...(resultat ? { resultat } : {}) } as never)
          await db.seances.put({ id: `s-${s.id}`, date: s.date, sport: 'velo', dureeSec: s.dureeMin * 60 * part, kj: Math.round((s.kjPrevu ?? 0) * part), prevueId: s.id, source: 'manuel' } as never)
        }
      }
      vi.useRealTimers()
      if (problemes.length) console.log(`${nom}\n  ${problemes.join('\n  ')}`)
      expect(problemes).toEqual([])
    }, 120_000)
})
