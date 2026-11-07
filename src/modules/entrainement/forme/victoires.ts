import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { NOMS_FAMILLES, type Famille } from '../../../metrics/programme'
import { partsRealisees, progressionFamilles } from '../plan/programme'
import { lundiDe } from '../seances/donnees'
import type { ReglagesEntrainement } from '../types'

/**
 * Petits moments de victoire (validés le 7/11/2026) : séance tenue, nouveau record de puissance, test CP en hausse,
 * série de semaines au budget. Jamais pour une séance ratée ; au plus une célébration par jour.
 */
export interface Victoire {
  id: string
  type: 'seance' | 'record' | 'test' | 'serie'
  date: string
  icone: string
  titre: string
  texte: string
  /** Séance tenue : palier atteint dans sa famille (1 à 4) */
  palier?: number
  famille?: string
}

const DUREES_RECORD: [number, string][] = [[5, '5 s'], [60, '1 min'], [300, '5 min'], [1200, '20 min']]
const fmtW = (w: number) => `${Math.round(w)} W`

export async function victoiresRecentes(jours = 30, jour = aujourdhui()): Promise<Victoire[]> {
  const depuis = decalerJour(jour, -jours)
  const v: Victoire[] = []

  // Séances d'intensité tenues
  const familles = await progressionFamilles()
  for (const p of await db.prevues.where('date').between(depuis, jour, true, true).toArray()) {
    if (p.resultat !== 'reussie' || p.sport !== 'velo') continue
    const f = p.velo?.famille as Famille | undefined
    const palier = familles.find((x) => x.famille === f)?.palier
    v.push({
      id: `seance-${p.id}`, type: 'seance', date: p.date, icone: '✅', titre: 'Séance tenue !', texte: p.titre,
      palier, famille: f && NOMS_FAMILLES[f] ? NOMS_FAMILLES[f] : undefined,
    })
  }

  // Records de puissance : un effort récent au-dessus de tout ce qui précède (séances + records importés)
  const seances = (await db.seances.filter((s) => s.sport === 'velo' && !!s.meilleurs).toArray()).sort((a, b) => a.date.localeCompare(b.date))
  const importes = ((await db.reglages.get('recordsPuissance'))?.valeur as Record<string, { w: number; date: string }> | undefined) ?? {}
  for (const [d, nom] of DUREES_RECORD) {
    let meilleur = importes[d]?.w ?? 0
    for (const s of seances) {
      const w = s.meilleurs?.[d]
      if (!w) continue
      if (w > meilleur && meilleur > 0 && s.date >= depuis && s.date <= jour)
        v.push({ id: `record-${d}-${s.id}`, type: 'record', date: s.date, icone: '🏆', titre: `Nouveau record ${nom}`, texte: `${fmtW(w)} · +${Math.round(w - meilleur)} W par rapport à l’ancien` })
      meilleur = Math.max(meilleur, w)
    }
  }

  // Tests CP en hausse
  const r = (await db.reglages.get('entrainement'))?.valeur as ReglagesEntrainement | undefined
  const tests = (r?.tests ?? []).filter((t) => t.type === 'cp').sort((a, b) => a.date.localeCompare(b.date))
  tests.forEach((t, i) => {
    const avant = tests[i - 1]
    if (!avant || t.valeur <= avant.valeur || t.date < depuis || t.date > jour) return
    v.push({
      id: `test-${t.date}`, type: 'test', date: t.date, icone: '📈', titre: `Test CP : +${Math.round(t.valeur - avant.valeur)} W`,
      texte: t.poidsKg ? `${(t.valeur / t.poidsKg).toFixed(2).replace('.', ',')} W/kg` : `${Math.round(t.valeur)} W`,
    })
  })

  // Série : semaines complètes de suite avec le budget vélo tenu à 90 % ou plus (4 au moins)
  const lundi = lundiDe(jour)
  const parts = await partsRealisees(lundi)
  let n = 0
  for (const x of parts) {
    if (x === undefined || x < 0.9) break
    n++
  }
  if (n >= 4) v.push({ id: `serie-${lundi}-${n}`, type: 'serie', date: lundi, icone: '🔥', titre: `${n} semaines de suite`, texte: 'budget vélo tenu à 90 % ou plus' })

  return v.sort((a, b) => b.date.localeCompare(a.date))
}

/** Célébrations déjà montrées, et le dernier jour où on en a montré une (une par jour au plus). */
interface Vues { ids: string[]; jour?: string }
const lireVues = async () => ((await db.reglages.get('celebrations'))?.valeur as Vues | undefined) ?? { ids: [] }

/** La célébration à montrer maintenant (victoire des 3 derniers jours, pas encore vue, aucune autre aujourd'hui). */
export async function celebrationDuJour(): Promise<Victoire | null> {
  const jour = aujourdhui()
  const vues = await lireVues()
  if (vues.jour === jour) return null
  const recentes = (await victoiresRecentes(3, jour)).filter((x) => !vues.ids.includes(x.id))
  // La séance tenue passe en premier
  return recentes.find((x) => x.type === 'seance') ?? recentes[0] ?? null
}

export async function marquerVue(v: Victoire) {
  const vues = await lireVues()
  // Les autres victoires du même jour sont marquées vues aussi : une seule célébration par jour
  const autres = (await victoiresRecentes(3)).map((x) => x.id)
  await enregistrer(db.reglages, { id: 'celebrations', valeur: { ids: [...new Set([...vues.ids, v.id, ...autres])].slice(-200), jour: aujourdhui() } satisfies Vues })
}
