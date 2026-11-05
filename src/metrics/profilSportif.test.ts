import { describe, expect, it } from 'vitest'
import { budgetSemaine, deuxIntensitesPossibles, hausseBudget, heuresDe, jourDeuxiemeIntensite, niveauDe } from './programme'

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
  it('2 intensités : confirmé ou expert, au moins 6 h', () => {
    expect(deuxIntensitesPossibles('confirme', [6, 8])).toBe(true)
    expect(deuxIntensitesPossibles('expert', [4, 6])).toBe(false)
    expect(deuxIntensitesPossibles('intermediaire', [8, 10])).toBe(false)
  })
  it('jour de la 2e intensité : 48 h des jours durs, pas la veille de la longue', () => {
    // Mardi dur, Z2 mercredi / jeudi / vendredi, longue samedi
    expect(jourDeuxiemeIntensite(['2026-11-11', '2026-11-12', '2026-11-13'], ['2026-11-10'], '2026-11-14')).toBe('2026-11-12')
    expect(jourDeuxiemeIntensite(['2026-11-11', '2026-11-13'], ['2026-11-10'], '2026-11-14')).toBeUndefined()
  })
})
