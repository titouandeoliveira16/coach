import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { enregistrerArrivee, reponsesExistantes, SEMAINE_TYPE_DEPART, type ReponsesArrivee } from './donnees'

const base: ReponsesArrivee = {
  naissance: '2000-01-01', sexe: 'femme', tailleCm: 165, poidsKg: 60, discipline: 'xco',
  anciennete: '1 à 3 ans', heuresRecentes: '3 à 6 h', intervalles: false, arretSemaines: 0, heuresSemaine: '4 à 6 h',
  semaineType: SEMAINE_TYPE_DEPART, nutrition: true, maxSemaineMin: 75, minLongMin: 90, maxLongMin: 120, course: { nom: 'Manche XCO', date: '2027-05-16' },
}

/** Compte déjà utilisé (Titouan) passé au questionnaire : rien de ce qui est acquis ne se perd. */
it('ses tests, sa CP et ses réglages restent ; le programme est recalculé ; la course disparaît', async () => {
    await db.delete(); await db.open()
    const tests = [{ date: '2026-10-01', type: 'cp' as const, valeur: 240 }]
    await enregistrer(db.reglages, { id: 'entrainement', valeur: { cpW: 240, wPrimeKj: 18, tests, zonesVelo: [], programme: { semaineType: ['course', 'velo-dur', 'renfo', 'course', 'velo-z2', 'course', 'velo-long'], maxSemaineMin: 75, minLongMin: 90, maxLongMin: 120, phases: [], testsCp: [], competitions: [{ date: '2026-12-13', nom: '5 km' }] } } })
    await enregistrer(db.reglages, { id: 'profil', valeur: { naissance: '1999-01-01', poidsKg: 72, objectif: 'perte' } })
    const x = await reponsesExistantes()
    expect(x!.reponses.semaineType).not.toContain('course')
    expect(x!.textes.cp).toBe('240')
    await enregistrerArrivee({ ...base, ...x!.reponses, cpW: 240 } as ReponsesArrivee)
    const e = (await db.reglages.get('entrainement'))!.valeur as { tests: unknown[]; wPrimeKj: number; programme: { competitions: unknown[] } }
    expect(e.tests).toEqual(tests)
    expect(e.wPrimeKj).toBe(18)
    expect(e.programme.competitions).toEqual([{ date: '2027-05-16', nom: 'Manche XCO' }])
    expect(((await db.reglages.get('profil'))!.valeur as { objectif: string }).objectif).toBe('perte')
  })
