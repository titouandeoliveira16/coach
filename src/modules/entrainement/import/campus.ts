import { TYPES_COURSE, type TypeCourse } from '../types'

/**
 * Lecture d'une capture d'écran du plan Campus Coach (texte reconnu sur le téléphone, sans IA en ligne).
 * Le texte est découpé par jour, puis chaque jour donne une séance : type (mots-clés), durée, minutes à l'allure clé.
 * Tout reste modifiable avant l'ajout : la reconnaissance n'est jamais parfaite.
 */
export interface SeanceLue {
  date?: string
  sport: 'course' | 'renfo'
  typeCourse?: TypeCourse
  titre: string
  dureeMin?: number
  minutesCle?: number
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] // ordre de la semaine (lundi = 0)
const RE_JOUR = /^(?:le\s+)?(lun|mar|mer|jeu|ven|sam|dim)[a-z]*\.?(?:\s+(\d{1,2}))?\b/
const RE_DATE = /\b(\d{1,2})[/.](\d{1,2})\b/

/** Mots-clés → type Campus, du plus spécifique au plus général. */
const MOTS: [RegExp, TypeCourse][] = [
  [/competition|course officielle|\bdossard/, 'Compétition'],
  [/\btest\b/, 'Test'],
  [/\bvma\b|fractionne/, 'VMA'],
  [/seuil\s*30|\bs30\b/, 'Seuil 30'],
  [/seuil\s*60|\bs60\b|\bseuil\b/, 'Seuil 60'],
  [/sweet\s*spot/, 'Sweet spot'],
  [/allure\s*(specifique|marathon|semi|10\s*km|5\s*km)|\bas\b/, 'Allure spécifique'],
  [/tempo/, 'Tempo'],
  [/cote/, 'Côtes'],
  [/sortie\s*longue|\blongue\b/, 'Sortie longue'],
  [/endurance\s*active/, 'Endurance active'],
  [/footing|endurance|\bef\b|recuperation|decrassage/, 'Endurance fondamentale'],
]
const RE_RENFO = /renfo|renforcement|gainage|musculation|\bppg\b/

/** Durée totale d'un bloc de texte (min) : « 1h10 », sinon la plus grande valeur en minutes hors répétitions. */
export function dureeDe(texte: string) {
  const t = sansAccents(texte)
  const h = t.match(/\b(\d)\s*h\s*(\d{1,2})?\b/)
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0)
  const sansReps = t.replace(/\d+\s*[x×]\s*\d+\s*(?:min|mn|'|")?/g, ' ')
  const minutes = [...sansReps.matchAll(/\b(\d{1,3})\s*(?:min|mn|minutes|')(?![a-z])/g)].map((m) => Number(m[1])).filter((m) => m >= 10 && m <= 240)
  return minutes.length ? Math.max(...minutes) : undefined
}

/** Minutes à l'allure clé : somme des répétitions « 3 x 10' », « 6x1000 » ignoré (distance). */
export function minutesCleDe(texte: string) {
  const t = sansAccents(texte)
  let total = 0
  for (const m of t.matchAll(/(\d{1,2})\s*[x×]\s*(\d{1,3})\s*(min|mn|'|"|s\b)/g)) {
    const n = Number(m[1])
    const d = Number(m[2])
    total += m[3] === '"' || m[3] === 's' ? (n * d) / 60 : n * d
  }
  return total ? Math.round(total) : undefined
}

/**
 * @param semaine les 7 dates (lundi → dimanche) de la semaine affichée
 */
export function lireCampus(texte: string, semaine: string[]): SeanceLue[] {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const blocs: { date?: string; lignes: string[] }[] = []
  let courant: { date?: string; lignes: string[] } = { lignes: [] }

  for (const ligne of lignes) {
    const n = sansAccents(ligne)
    const jour = n.match(RE_JOUR)
    const date = n.match(RE_DATE)
    let trouvee: string | undefined
    if (jour) {
      const numero = jour[2] ? Number(jour[2]) : undefined
      trouvee = (numero && semaine.find((d) => Number(d.slice(8)) === numero)) || semaine[JOURS.indexOf(jour[1])]
    } else if (date) {
      trouvee = semaine.find((d) => Number(d.slice(8)) === Number(date[1]) && Number(d.slice(5, 7)) === Number(date[2]))
    }
    if (trouvee) {
      if (courant.lignes.length || courant.date) blocs.push(courant)
      courant = { date: trouvee, lignes: [ligne] }
    } else courant.lignes.push(ligne)
  }
  blocs.push(courant)

  const seances: SeanceLue[] = []
  for (const b of blocs) {
    const t = sansAccents(b.lignes.join('\n'))
    if (/\brepos\b/.test(t) && !MOTS.some(([re]) => re.test(t))) continue
    // Le type le plus intense trouvé dans le bloc (l'échauffement « en endurance » ne doit pas masquer un seuil)
    const types = MOTS.filter(([re]) => re.test(t)).map(([, type]) => type)
    const special = types.find((x) => x === 'Test' || x === 'Compétition')
    const typeCourse = special ?? types.sort((a, c) => TYPES_COURSE[c].fi - TYPES_COURSE[a].fi)[0]
    const ligneType = b.lignes.find((l) => MOTS.some(([re]) => re.test(sansAccents(l))) && !RE_JOUR.test(sansAccents(l)))
    if (typeCourse)
      seances.push({
        date: b.date, sport: 'course', typeCourse, titre: (ligneType ?? typeCourse).slice(0, 60),
        dureeMin: dureeDe(t), minutesCle: TYPES_COURSE[typeCourse].intensite !== 'basse' ? minutesCleDe(t) : undefined,
      })
    if (RE_RENFO.test(t)) seances.push({ date: b.date, sport: 'renfo', titre: 'Renfo', dureeMin: typeCourse ? undefined : dureeDe(t) })
  }
  return seances
}
