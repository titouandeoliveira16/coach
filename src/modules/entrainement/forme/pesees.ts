import { db } from '../../../core/db'
import type { Profil } from '../../../core/profil'
import { enregistrer, supprimer } from '../../../core/stockage'

/**
 * Pesées. Une pesée effacée à la main est retenue (réglage synchronisé) : ni l'import Garmin
 * ni un autre appareil resté sur une ancienne version ne peuvent la faire revenir.
 */
export const CLE_PESEES_EFFACEES = 'pesees-effacees'

/** Jours marqués « pas de pesée aujourd'hui » (oubli) : pas de rappel, et aucun poids de ce jour-là n'est compté. */
export const CLE_SANS_PESEE = 'pesees-sans'

const lireEffacees = async () => ((await db.reglages.get(CLE_PESEES_EFFACEES))?.valeur as string[] | undefined) ?? []
export const lireSansPesee = async () => ((await db.reglages.get(CLE_SANS_PESEE))?.valeur as string[] | undefined) ?? []

/** Marque (ou démarque) un jour sans pesée ; on garde les 60 derniers jours. */
export async function marquerSansPesee(date: string, sans: boolean) {
  const jours = (await lireSansPesee()).filter((d) => d !== date)
  await enregistrer(db.reglages, { id: CLE_SANS_PESEE, valeur: (sans ? [...jours, date] : jours).sort().slice(-60) })
}

/** Pesées valides, de la plus récente à la plus ancienne. */
export async function peseesValides() {
  const effacees = new Set([...(await lireEffacees()), ...(await lireSansPesee())])
  return (await db.pesees.orderBy('date').reverse().toArray()).filter((p) => !effacees.has(p.date))
}

export async function enregistrerPesee(date: string, poidsKg: number) {
  await enregistrer(db.pesees, { date, poidsKg })
  const effacees = await lireEffacees()
  if (effacees.includes(date)) await enregistrer(db.reglages, { id: CLE_PESEES_EFFACEES, valeur: effacees.filter((d) => d !== date) })
  if ((await lireSansPesee()).includes(date)) await marquerSansPesee(date, false)
  await majPoidsProfil()
}

export async function effacerPesee(date: string) {
  await supprimer(db.pesees, date)
  const effacees = await lireEffacees()
  if (!effacees.includes(date)) await enregistrer(db.reglages, { id: CLE_PESEES_EFFACEES, valeur: [...effacees, date] })
  await majPoidsProfil()
}

/** Pesées effacées revenues (import ou autre appareil) : supprimées à nouveau. */
export async function nettoyerPeseesEffacees() {
  for (const d of await lireEffacees()) if (await db.pesees.get(d)) await supprimer(db.pesees, d)
}

/** Le poids du profil suit la dernière pesée valide. */
async function majPoidsProfil() {
  const derniere = (await peseesValides())[0]
  if (!derniere) return
  const profil = (await db.reglages.get('profil'))?.valeur as Profil | undefined
  if (profil?.poidsKg !== derniere.poidsKg) await enregistrer(db.reglages, { id: 'profil', valeur: { ...profil, poidsKg: derniere.poidsKg } })
}

/** Poids à une date : dernière pesée valide dans les 30 jours avant, sinon le poids du profil. */
export async function poidsAu(date: string) {
  const avant = (await peseesValides()).find((p) => p.date <= date && Date.parse(date) - Date.parse(p.date) <= 30 * 86_400_000)
  if (avant) return avant.poidsKg
  return ((await db.reglages.get('profil'))?.valeur as Profil | undefined)?.poidsKg
}
