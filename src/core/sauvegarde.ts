import { db } from './db'

/** Clé du réglage qui retient la date de la dernière sauvegarde. */
export const CLE_DERNIERE_SAUVEGARDE = 'derniere-sauvegarde'

/** Contenu d'un fichier de sauvegarde : toutes les tables de la base. */
interface FichierSauvegarde {
  app: 'coach'
  format: 1
  exporteLe: string
  tables: Record<string, unknown[]>
}

/**
 * Exporte TOUTES les données (tous modules confondus) dans un fichier JSON.
 * Sur iPhone, ouvre la feuille de partage : « Enregistrer dans Fichiers », AirDrop, mail…
 * Renvoie false si l'utilisateur a annulé.
 */
export async function exporterDonnees(): Promise<boolean> {
  const maintenant = new Date().toISOString()
  const fichier: FichierSauvegarde = { app: 'coach', format: 1, exporteLe: maintenant, tables: {} }
  for (const table of db.tables) {
    fichier.tables[table.name] = await table.toArray()
  }

  const nom = `coach-sauvegarde-${maintenant.slice(0, 10)}.json`
  const contenu = new File([JSON.stringify(fichier, null, 2)], nom, { type: 'application/json' })

  if (navigator.canShare?.({ files: [contenu] })) {
    try {
      await navigator.share({ files: [contenu] })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
      throw e
    }
  } else {
    // Ordinateur : téléchargement classique
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(contenu)
    lien.download = nom
    lien.click()
    URL.revokeObjectURL(lien.href)
  }

  await db.reglages.put({ id: CLE_DERNIERE_SAUVEGARDE, valeur: { le: maintenant } })
  return true
}

/**
 * Remplace toutes les données par celles d'un fichier de sauvegarde.
 * Lève une erreur (message en français) si le fichier n'est pas valide.
 */
export async function importerDonnees(fichier: File): Promise<void> {
  let donnees: FichierSauvegarde
  try {
    donnees = JSON.parse(await fichier.text())
  } catch {
    throw new Error("Ce fichier n'est pas un fichier JSON lisible.")
  }
  if (donnees?.app !== 'coach' || typeof donnees.tables !== 'object') {
    throw new Error("Ce fichier n'est pas une sauvegarde de Coach.")
  }

  // Tout ou rien : en cas d'erreur, aucune donnée n'est modifiée
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const lignes = donnees.tables[table.name]
      if (Array.isArray(lignes)) await table.bulkPut(lignes)
    }
    // Les données sont désormais celles de ce fichier : il devient la dernière sauvegarde
    await db.reglages.put({ id: CLE_DERNIERE_SAUVEGARDE, valeur: { le: donnees.exporteLe } })
  })
}
