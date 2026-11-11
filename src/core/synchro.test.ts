import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * Synchro (audit du 11/11/2026) : faux serveur Supabase en mémoire, avec un numéro d'arrivée « seq » donné à chaque
 * écriture comme le déclencheur SQL. Vérifie les trois pertes de données relevées par l'audit.
 */
interface Ligne { user_id: string; table_nom: string; cle: string; valeur: unknown; supprime: boolean; modifie_le: string; synchro_le: string; seq: number }
const serveur = {
  lignes: new Map<string, Ligne>(),
  seq: 0,
  /** Toutes les lignes d'un même envoi ont la même date (comme now() en SQL) */
  horloge: '2026-11-11T10:00:00.000Z',
  refuser: (_l: Partial<Ligne>) => false,
  pendantEnvoi: async () => {},
  sansSeq: false,
}
let rappelSession: ((evenement: string, session: unknown) => void) | undefined

function requete() {
  const filtres: { col: string; val: string | number }[] = []
  let tri = 'seq'
  let limite = Infinity
  const b = {
    select: () => b,
    order: (col: string) => ((tri = col), b),
    limit: (n: number) => ((limite = n), b),
    gt: (col: string, val: string | number) => (filtres.push({ col, val }), b),
    then: (ok: (r: { data: unknown; error: unknown }) => unknown) => {
      if (serveur.sansSeq && (tri === 'seq' || filtres.some((f) => f.col === 'seq'))) return Promise.resolve(ok({ data: null, error: { message: 'column donnees.seq does not exist' } }))
      const data = [...serveur.lignes.values()]
        .filter((l) => filtres.every((f) => (l as unknown as Record<string, string | number>)[f.col] > f.val))
        .sort((a, c) => ((a as unknown as Record<string, string | number>)[tri] > (c as unknown as Record<string, string | number>)[tri] ? 1 : -1))
        .slice(0, limite)
      return Promise.resolve(ok({ data, error: null }))
    },
  }
  return b
}
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      ...requete(),
      select: () => requete(),
      upsert: async (lignes: Partial<Ligne> | Partial<Ligne>[]) => {
        await serveur.pendantEnvoi()
        const liste = Array.isArray(lignes) ? lignes : [lignes]
        if (liste.some((l) => serveur.refuser(l))) return { error: { message: 'violates check constraint' } }
        for (const l of liste) {
          serveur.seq++
          serveur.lignes.set(`${l.user_id}|${l.table_nom}|${l.cle}`, { ...(l as Ligne), synchro_le: serveur.horloge, seq: serveur.seq })
        }
        return { error: null }
      },
    }),
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        rappelSession = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signOut: async () => ({ error: null }),
    },
  },
}))

const memoire = new Map<string, string>()
beforeEach(async () => {
  vi.resetModules()
  memoire.clear()
  vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) })
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('window', { addEventListener: () => {} })
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
  Object.assign(serveur, { lignes: new Map(), seq: 0, refuser: () => false, pendantEnvoi: async () => {}, sansSeq: false })
  const { db, TABLES_DONNEES } = await import('./db')
  for (const t of [...TABLES_DONNEES(), db.suppressions]) await t.clear()
})
afterEach(() => vi.unstubAllGlobals())

/** Charge les modules (neufs) et connecte l'utilisateur « u1 ». */
async function demarrer() {
  const synchro = await import('./synchro')
  const { db } = await import('./db')
  const stockage = await import('./stockage')
  synchro.demarrerSynchro()
  rappelSession!('TOKEN_REFRESHED', { user: { id: 'u1' } })
  return { ...synchro, db, ...stockage }
}

it('un 2e appareil reçoit toutes les lignes d’un gros envoi groupé (plus de 500, même date d’arrivée)', async () => {
  for (let i = 0; i < 1200; i++) serveur.lignes.set(`u1|reglages|r${i}`, { user_id: 'u1', table_nom: 'reglages', cle: `r${i}`, valeur: { id: `r${i}`, valeur: i }, supprime: false, modifie_le: '2026-11-10T08:00:00.000Z', synchro_le: serveur.horloge, seq: ++serveur.seq })
  const { synchroniser, db } = await demarrer()
  await synchroniser()
  expect(await db.reglages.count()).toBe(1200)
})

it('serveur pas encore mis à jour (sans colonne seq) : repli sur l’ancien curseur', async () => {
  serveur.sansSeq = true
  serveur.lignes.set('u1|reglages|a', { user_id: 'u1', table_nom: 'reglages', cle: 'a', valeur: { id: 'a', valeur: 1 }, supprime: false, modifie_le: '2026-11-10T08:00:00.000Z', synchro_le: serveur.horloge, seq: 0 })
  const { synchroniser, db } = await demarrer()
  await synchroniser()
  expect(await db.reglages.get('a')).toMatchObject({ valeur: 1 })
})

it('une suppression faite pendant l’envoi n’est pas perdue', async () => {
  const { synchroniser, db, enregistrer, supprimer } = await demarrer()
  await enregistrer(db.reglages, { id: 'a', valeur: 1 })
  await enregistrer(db.reglages, { id: 'b', valeur: 2 })
  await supprimer(db.reglages, 'a')
  // Pendant l'appel réseau, l'utilisateur supprime aussi « b »
  serveur.pendantEnvoi = async () => {
    serveur.pendantEnvoi = async () => {}
    await supprimer(db.reglages, 'b')
  }
  await synchroniser()
  expect(await db.suppressions.get('reglages|b')).toBeDefined()
  await synchroniser()
  expect(serveur.lignes.get('u1|reglages|b')?.supprime).toBe(true)
  expect(await db.suppressions.count()).toBe(0)
})

it('une ligne refusée par le serveur ne bloque pas les autres et sera retentée', async () => {
  const { synchroniser, db, enregistrer } = await demarrer()
  serveur.refuser = (l) => l.cle === 'mauvaise'
  await enregistrer(db.reglages, { id: 'bonne', valeur: 1 })
  await enregistrer(db.reglages, { id: 'mauvaise', valeur: 2 })
  await synchroniser()
  expect(serveur.lignes.has('u1|reglages|bonne')).toBe(true)
  expect(serveur.lignes.has('u1|reglages|mauvaise')).toBe(false)
  // Le serveur l'accepte enfin : elle part à la synchro suivante, même sans nouvelle modification
  serveur.refuser = () => false
  await synchroniser()
  expect(serveur.lignes.has('u1|reglages|mauvaise')).toBe(true)
})

it('déconnexion hors ligne : refusée, rien n’est effacé', async () => {
  const { seDeconnecter, db, enregistrer } = await demarrer()
  await enregistrer(db.reglages, { id: 'saisie', valeur: 1 })
  vi.stubGlobal('navigator', { onLine: false })
  await expect(seDeconnecter()).rejects.toThrow(/réseau/)
  expect(await db.reglages.get('saisie')).toBeDefined()
})

it('déconnexion en ligne : tout est envoyé, puis l’appareil est vidé', async () => {
  const { seDeconnecter, db, enregistrer } = await demarrer()
  await enregistrer(db.reglages, { id: 'saisie', valeur: 1 })
  await seDeconnecter()
  expect(serveur.lignes.has('u1|reglages|saisie')).toBe(true)
  expect(await db.reglages.count()).toBe(0)
})

it('un autre compte qui se connecte sur l’appareil ne récupère pas les données du précédent', async () => {
  const { db, enregistrer } = await demarrer()
  memoire.set('coach-proprietaire', 'u1')
  await enregistrer(db.reglages, { id: 'a-u1', valeur: 1 })
  rappelSession!('SIGNED_IN', { user: { id: 'u2' } })
  await vi.waitFor(async () => expect(await db.reglages.get('a-u1')).toBeUndefined())
})
