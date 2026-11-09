import { describe, expect, it } from 'vitest'
import { budgetSemaine, deuxIntensitesPossibles, hausseBudget, heuresDe, jourDeuxiemeIntensite, niveauDe, verifierSemaineType } from './programme'

describe('profil sportif → moteur', () => {
  it('niveau lu depuis la réponse, intermédiaire par défaut', () => {
    expect(niveauDe('Débutant (moins d’un an)')).toBe('debutant')
    expect(niveauDe('Confirmé (3 à 5 ans)')).toBe('confirme')
    expect(niveauDe('Expert (plus de 5 ans)')).toBe('expert')
    expect(niveauDe(undefined)).toBe('intermediaire')
  })
  it('tranche d’heures, 4 à 6 h par défaut', () => {
    expect(heuresDe('6 à 8 h')).toEqual([6, 8])
    expect(heuresDe('Moins de 4 h')).toEqual([2, 4])
    expect(heuresDe()).toEqual([4, 6])
  })
  it('débutant : +5 % au lieu de +7,5 %', () => {
    const prec = { budgetRef: 2000, kjPrevus: 2000, kjRealises: 2000, rouges: 0, oranges: 0, allegee: false }
    expect(hausseBudget('debutant')).toBe(0.05)
    expect(budgetSemaine(prec, 2000, 4000, false, undefined, hausseBudget('debutant')).budgetRef).toBe(2100)
    expect(budgetSemaine(prec, 2000, 4000, false, undefined, hausseBudget('confirme')).budgetRef).toBe(2150)
  })
  it('2 intensités (forme Chauvin) : 4 jours de vélo ou plus, sauf débutant', () => {
    expect(deuxIntensitesPossibles('intermediaire', 4)).toBe(true)
    expect(deuxIntensitesPossibles('confirme', 3)).toBe(false)
    expect(deuxIntensitesPossibles('debutant', 5)).toBe(false)
  })
  it('jour de la 2e intensité : 48 h des jours durs, la plus éloignée, veille de la longue permise', () => {
    // Mardi dur, Z2 mercredi / jeudi / samedi, longue dimanche (semaine à 5 de Chauvin : intensif samedi)
    expect(jourDeuxiemeIntensite(['2026-11-11', '2026-11-12', '2026-11-14'], ['2026-11-10'])).toBe('2026-11-14')
    expect(jourDeuxiemeIntensite(['2026-11-11'], ['2026-11-10'])).toBeUndefined()
})
})

describe('semaine type choisie par l’athlète', () => {
  it('le 2e jour dur choisi passe en premier s’il respecte les 48 h', () => {
    expect(jourDeuxiemeIntensite(['2026-11-11', '2026-11-13', '2026-11-14'], ['2026-11-10'], ['2026-11-13'])).toBe('2026-11-13')
    expect(jourDeuxiemeIntensite(['2026-11-11', '2026-11-14'], ['2026-11-10'], ['2026-11-11'])).toBe('2026-11-14')
  })
  it('dit ce qui manque', () => {
    expect(verifierSemaineType(['libre', 'velo-dur', 'velo-z2', 'renfo', 'velo-z2', 'libre', 'velo-z2']))
      .toMatchObject({ ok: false, message: expect.stringMatching(/sortie longue/) })
    expect(verifierSemaineType(['libre', 'velo-dur', 'velo-z2', 'renfo', 'velo-dur', 'libre', 'velo-long']))
      .toEqual({ ok: true, message: '✓ 4 jours de vélo · 2 séances dures · 1 sortie longue' })
    expect(verifierSemaineType(['velo-dur', 'velo-dur', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-long']).ok).toBe(false)
    expect(verifierSemaineType(['libre', 'velo-dur', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-long']).message).toMatch(/se suivent/)
    expect(verifierSemaineType(['libre', 'velo-dur', 'velo-z2', 'libre', 'velo-dur', 'libre', 'velo-long'], true).message).toMatch(/débutant/)
  })
})
