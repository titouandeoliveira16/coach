import { describe, expect, it } from 'vitest'
import { cpProvisoire, fcMaxTanaka, preparerArrivee, SEMAINE_TYPE_DEPART, type ReponsesArrivee } from './donnees'

const base: ReponsesArrivee = {
  naissance: '2000-01-01', sexe: 'femme', tailleCm: 165, poidsKg: 60, discipline: 'xco',
  anciennete: '1 à 3 ans', heuresRecentes: '3 à 6 h', intervalles: false, arretSemaines: 0, heuresSemaine: '4 à 6 h',
  semaineType: SEMAINE_TYPE_DEPART, nutrition: true, maxSemaineMin: 75, minLongMin: 90, maxLongMin: 120, course: { nom: 'Manche XCO', date: '2027-05-16' },
}

describe('questionnaire d’arrivée', () => {
  it('sans CP ni FC max : valeurs provisoires prudentes', () => {
    const p = preparerArrivee(base, '2026-11-09')
    expect(p.entrainement.cpW).toBe(cpProvisoire(60))
    expect(p.profil.fcMax).toBe(fcMaxTanaka(26))
    expect(p.entrainement.tests).toEqual([])
    expect(p.entrainement.programme.competitions).toEqual([{ date: '2027-05-16', nom: 'Manche XCO', niveau: 'A' }])
    expect(p.entrainement.programme.discipline).toBe('xco')
    expect(p.profilSportif.sports).toEqual(['VTT'])
    // Rien de la saison de Titouan
    expect(p.entrainement.programme.phases[0].debut).toBe('2026-11-09')
    expect(p.entrainement.programme.testsCp[0]).toBe('2026-11-14') // samedi, jour de la sortie longue
  })
  it('CP connue gardée, zones calées dessus', () => {
    const p = preparerArrivee({ ...base, cpW: 220, fcMax: 195 }, '2026-11-09')
    expect(p.entrainement.cpW).toBe(220)
    expect(p.profil.fcMax).toBe(195)
    expect(p.entrainement.zonesVelo[1].fcMax).toBe(Math.round(195 * 0.8))
  })
})

describe('semaine type de départ', () => {
  it('1 dur, 1 longue, le reste en Z2 selon le nombre de jours', async () => {
    const { semaineDepuisJours } = await import('./donnees')
    expect(semaineDepuisJours(3)).toEqual(['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'libre', 'velo-long'])
    expect(semaineDepuisJours(4)).toEqual(['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-z2', 'velo-long'])
    expect(semaineDepuisJours(5).filter((r) => r === 'velo-z2').length).toBe(3)
    expect(semaineDepuisJours(6).filter((r) => r === 'velo-dur').length).toBe(1)
  })
})

describe('compte déjà utilisé passé au questionnaire', () => {
  it('CP testée il y a moins de 4 semaines : pas de nouveau test les 2 premières semaines', () => {
    const p = preparerArrivee({ ...base, cpW: 250 }, '2026-11-09', [{ date: '2026-11-01', type: 'cp', valeur: 250 }])
    expect(p.entrainement.programme.testsCp.every((d) => d >= '2026-11-23')).toBe(true)
  })
})
