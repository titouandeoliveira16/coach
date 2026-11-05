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
    expect(p.entrainement.programme.competitions).toEqual([{ date: '2027-05-16', nom: 'Manche XCO' }])
    expect(p.entrainement.programme.discipline).toBe('xco')
    expect(p.profilSportif.sports).toEqual(['VTT'])
    // Rien de la saison de Titouan
    expect(p.entrainement.programme.phases[0].debut).toBe('2026-11-09')
    expect(p.entrainement.programme.testsCp[0]).toBe('2026-11-15')
  })
  it('CP connue gardée, zones calées dessus', () => {
    const p = preparerArrivee({ ...base, cpW: 220, fcMax: 195 }, '2026-11-09')
    expect(p.entrainement.cpW).toBe(220)
    expect(p.profil.fcMax).toBe(195)
    expect(p.entrainement.zonesVelo[1].fcMax).toBe(Math.round(195 * 0.8))
  })
})

describe('semaine type de départ', () => {
  it('1 dur, 1 longue, le reste en Z2 selon le temps disponible', async () => {
    const { semaineDepuisHeures } = await import('./donnees')
    expect(semaineDepuisHeures('Moins de 4 h')).toEqual(['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'libre', 'velo-long'])
    expect(semaineDepuisHeures('6 à 8 h').filter((r) => r === 'velo-z2').length).toBe(3)
    expect(semaineDepuisHeures('Plus de 12 h').filter((r) => r === 'velo-dur').length).toBe(1)
  })
})
