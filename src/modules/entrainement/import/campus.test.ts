import { describe, expect, it } from 'vitest'
import { dureeDe, lireCampus, minutesCleDe } from './campus'

const semaine = Array.from({ length: 7 }, (_, i) => `2026-10-${String(26 + i).padStart(2, '0')}`.replace('2026-10-32', '2026-11-01'))

describe('capture Campus', () => {
  it('durées et répétitions', () => {
    expect(dureeDe('Durée 1h10')).toBe(70)
    expect(dureeDe("20' échauffement, 3 x 10' seuil 30, 10' retour : 60 min")).toBe(60)
    expect(minutesCleDe("3 x 10' à allure seuil 30")).toBe(30)
    expect(minutesCleDe('10 x 30" VMA')).toBe(5)
  })

  it('découpe par jour et reconnaît les types', () => {
    const texte = `Lundi 26
Footing
45 min
Mardi 27
Test 1500 m
40 min
Mercredi 28
Repos
Jeudi 29
Renforcement musculaire
30 min
Vendredi 30
Repos
Samedi 31
Sortie longue
1h10
Dim. 1
Séance seuil
Échauffement 20' en endurance fondamentale
3 x 10' seuil 30
Total 60 min`
    const s = lireCampus(texte, semaine)
    expect(s.map((x) => [x.date, x.sport, x.typeCourse, x.dureeMin])).toEqual([
      ['2026-10-26', 'course', 'Endurance fondamentale', 45],
      ['2026-10-27', 'course', 'Test', 40],
      ['2026-10-29', 'renfo', undefined, 30],
      ['2026-10-31', 'course', 'Sortie longue', 70],
      ['2026-11-01', 'course', 'Seuil 30', 60],
    ])
    expect(s[4].minutesCle).toBe(30)
  })
})
