import { TABLES_DONNEES, db, type Reglage } from './db'
import { enregistrer, signalerEcriture } from './stockage'

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
  for (const table of TABLES_DONNEES()) {
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

  await enregistrer(db.reglages, { id: CLE_DERNIERE_SAUVEGARDE, valeur: { le: maintenant } })
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

  // Les lignes restaurées sont datées de maintenant : elles priment et partent au serveur
  const maintenant = new Date().toISOString()
  const tables = TABLES_DONNEES()

  // Tout ou rien : en cas d'erreur, aucune donnée n'est modifiée
  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.clear()
      const lignes = donnees.tables[table.name]
      if (Array.isArray(lignes)) {
        await table.bulkPut((lignes as Record<string, unknown>[]).map(({ _recu, ...l }) => ({ ...l, _modifie: maintenant })))
      }
    }
    // Les données sont désormais celles de ce fichier : il devient la dernière sauvegarde
    await db.reglages.put({ id: CLE_DERNIERE_SAUVEGARDE, valeur: { le: donnees.exporteLe }, _modifie: maintenant } as Reglage)
  })
  signalerEcriture()
}

/** Transforme des lignes (objets) en CSV (séparateur « ; », compatible Excel français). */
export function versCsv(lignes: Record<string, unknown>[]) {
  const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l)))].filter((c) => !c.startsWith('_'))
  const cellule = (v: unknown) => {
    if (v === undefined || v === null) return ''
    const texte = Array.isArray(v) ? v.join('|') : typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
  }
  return [colonnes.join(';'), ...lignes.map((l) => colonnes.map((c) => cellule(l[c])).join(';'))].join('\n')
}

/** Exporte chaque table de données en CSV (un fichier par table). */
export async function exporterCsv(): Promise<boolean> {
  const jour = new Date().toISOString().slice(0, 10)
  const fichiers: File[] = []
  for (const table of TABLES_DONNEES()) {
    if (table.name === 'reglages') continue
    const lignes = (await table.toArray()) as Record<string, unknown>[]
    if (lignes.length) fichiers.push(new File(['﻿' + versCsv(lignes)], `coach-${table.name}-${jour}.csv`, { type: 'text/csv' }))
  }
  if (!fichiers.length) throw new Error('Aucune donnée à exporter.')
  if (navigator.canShare?.({ files: fichiers })) {
    try {
      await navigator.share({ files: fichiers })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
      throw e
    }
  } else {
    for (const f of fichiers) {
      const lien = document.createElement('a')
      lien.href = URL.createObjectURL(f)
      lien.download = f.name
      lien.click()
      URL.revokeObjectURL(lien.href)
    }
  }
  return true
}
