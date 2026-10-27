import { db } from '../core/db'
import { enregistrer } from '../core/stockage'

/**
 * Import de données personnelles depuis un fichier gardé sur le téléphone (jamais dans le code, le dépôt est public).
 * Chaque partie est facultative :
 *  - profil : taille, date de naissance, FC max… (fusionné avec le profil) ;
 *  - entrainement : réglages d'entraînement (ex. zones), seulement s'ils ne sont pas déjà enregistrés ;
 *  - recordsPuissance : records de départ de la courbe de puissance (durée en s → watts et date) ;
 *  - comptesDepart : solde (€) et date de départ de comptes du Budget déjà créés.
 */
export interface FichierDonnees {
  profil?: Record<string, unknown>
  entrainement?: Record<string, unknown>
  recordsPuissance?: Record<string, { w: number; date: string }>
  comptesDepart?: Record<string, { solde: number; date: string }>
}

export function lireFichierDonnees(texte: string): FichierDonnees {
  let f: FichierDonnees
  try {
    f = JSON.parse(texte)
  } catch {
    throw new Error('Fichier illisible.')
  }
  if (!f || typeof f !== 'object' || !(f.profil || f.entrainement || f.recordsPuissance || f.comptesDepart))
    throw new Error('Rien à importer dans ce fichier.')
  return f
}

/** Applique le fichier. Renvoie la liste de ce qui a été fait (en français). */
export async function importerDonnees(f: FichierDonnees) {
  const fait: string[] = []
  const lire = async (id: string) => ((await db.reglages.get(id))?.valeur as Record<string, unknown> | undefined) ?? {}
  if (f.profil) {
    await enregistrer(db.reglages, { id: 'profil', valeur: { ...(await lire('profil')), ...f.profil } })
    fait.push('profil')
  }
  if (f.entrainement) {
    const actuel = await lire('entrainement')
    const manquants = Object.fromEntries(Object.entries(f.entrainement).filter(([k]) => actuel[k] === undefined))
    if (Object.keys(manquants).length) {
      await enregistrer(db.reglages, { id: 'entrainement', valeur: { ...actuel, ...manquants } })
      fait.push('réglages d’entraînement')
    }
  }
  if (f.recordsPuissance) {
    await enregistrer(db.reglages, { id: 'recordsPuissance', valeur: { ...(await lire('recordsPuissance')), ...f.recordsPuissance } })
    fait.push(`${Object.keys(f.recordsPuissance).length} records de puissance`)
  }
  let comptes = 0
  for (const [id, { solde, date }] of Object.entries(f.comptesDepart ?? {})) {
    const c = await db.comptes.get(id)
    if (!c) continue
    const { verseInitial: _v, ...reste } = c
    await enregistrer(db.comptes, { ...reste, soldeInitial: Math.round(solde * 100), dateDepart: date })
    comptes++
  }
  if (comptes) fait.push(`${comptes} comptes du Budget`)
  return fait
}
