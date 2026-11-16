/**
 * Calcul de semaine en cours (audit du 14/11/2026, fait le 16/11) : une mise à jour de l'appli attend la fin du calcul,
 * et une photo de la semaine d'avant est gardée sur l'appareil pendant le calcul. Si l'appli est coupée en plein calcul,
 * la photo est remise au démarrage suivant (puis la semaine est recalculée).
 */
let enCours = 0
export const calculEnCours = () => enCours > 0
const CLE = 'coach-calcul-semaine'

export interface PhotoSemaine<T> { lundi: string; avant: T[]; le: string }

export function debutCalcul<T>(lundi: string, avant: T[]) {
  enCours++
  try { localStorage.setItem(CLE, JSON.stringify({ lundi, avant, le: new Date().toISOString() } satisfies PhotoSemaine<T>)) } catch { /* stockage plein ou indisponible */ }
}
export function finCalcul() {
  enCours = Math.max(0, enCours - 1)
  if (!enCours) try { localStorage.removeItem(CLE) } catch { /* stockage indisponible */ }
}
export function photoInterrompue<T>(): PhotoSemaine<T> | undefined {
  try {
    const brut = localStorage.getItem(CLE)
    return brut ? (JSON.parse(brut) as PhotoSemaine<T>) : undefined
  } catch { return undefined }
}
export function oublierPhoto() {
  try { localStorage.removeItem(CLE) } catch { /* stockage indisponible */ }
}
