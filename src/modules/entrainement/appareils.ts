/**
 * Appareils du coureur (16/11/2026) : le questionnaire demande avec quoi il enregistre ses sorties, l'appli lui dit quoi
 * relier dans Intervals.icu et nomme les boutons d'envoi d'après son matériel. Intervals.icu envoie les séances prévues
 * à Garmin, COROS, Suunto, Wahoo et Zwift (pas à Polar) ; iGPSPORT passe par le lien de Cycle.
 */
export const APPAREILS = ['Garmin', 'COROS', 'Wahoo', 'Suunto', 'Polar', 'iGPSPORT', 'Bryton', 'Zwift'] as const
export type Appareil = (typeof APPAREILS)[number]

const ENVOI_MONTRE: Partial<Record<Appareil, string>> = { Garmin: 'Envoyer à Garmin', COROS: 'Envoyer à ma COROS', Wahoo: 'Envoyer à mon Wahoo', Suunto: 'Envoyer à ma Suunto' }

/** Libellé du bouton « montre / compteur » (calendrier Intervals) ; undefined : aucun de ses appareils ne reçoit les séances. */
export function libelleEnvoiMontre(appareils?: string[]) {
  if (!appareils?.length) return 'Envoyer à Garmin'
  const a = appareils.find((x) => x in ENVOI_MONTRE) as Appareil | undefined
  return a ? ENVOI_MONTRE[a] : undefined
}
/** Bouton Zwift : seulement si tu l'as coché (ou si tes appareils ne sont pas encore connus). */
export const avecZwift = (appareils?: string[]) => !appareils?.length || appareils.includes('Zwift')

/** Ce qu'il faut relier dans Intervals.icu (Settings → Connections), selon tes appareils. */
export function conseilsConnexions(appareils?: string[]): string[] {
  if (!appareils?.length) return ['Touche « Connect » à côté de chacun de tes appareils : Garmin Connect, COROS, Wahoo, Polar, Suunto ou Zwift, et accepte le partage.']
  const lignes: string[] = []
  const intervals = appareils.filter((a) => ['Garmin', 'COROS', 'Wahoo', 'Suunto', 'Polar', 'Zwift'].includes(a))
  if (intervals.length) lignes.push(`Touche « Connect » à côté de ${intervals.map((a) => (a === 'Garmin' ? 'Garmin Connect' : a)).join(', ')}, et accepte le partage.`)
  const envoi = intervals.filter((a) => a !== 'Polar')
  if (envoi.length) lignes.push(`Pour recevoir tes séances sur ${envoi.join(', ')} : dans la même fenêtre, coche « Upload planned workouts ».`)
  if (appareils.includes('Polar')) lignes.push('Polar : tes sorties remontent, mais Polar n’accepte pas les séances envoyées par d’autres applis.')
  if (appareils.includes('iGPSPORT')) lignes.push('iGPSPORT : il n’a pas de lien avec Intervals. Une fois Intervals relié, relie-le dans Entraînement → Réglages → Compteur iGPSPORT : tes sorties (historique compris) remonteront toutes seules, et tu pourras envoyer tes séances sur le compteur.')
  if (appareils.includes('Bryton')) lignes.push('Bryton : pas encore de lien automatique. En attendant, exporte le fichier .fit de ta sortie et importe-le dans l’appli (+ → Importer un .FIT) ; dis-le à ton entraîneur, le lien peut être ajouté.')
  const enregistreurs = appareils.filter((a) => a !== 'Zwift')
  if (enregistreurs.length >= 2) lignes.push(`Tu as ${enregistreurs.join(' et ')} : pour une même sortie, un seul des deux enregistre (sinon l’appli doit fusionner les deux).`)
  return lignes
}
