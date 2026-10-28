/** Lit un nombre saisi au clavier français ("18,5" ou "18.5"). Vide ou invalide → undefined. */
export function lireNombre(texte: string): number | undefined {
  const n = Number(texte.trim().replace(',', '.'))
  return texte.trim() === '' || Number.isNaN(n) ? undefined : n
}

/** Affiche un nombre à la française : 18,5 */
export function formatNombre(n: number | undefined, decimales = 0): string {
  if (n === undefined) return ''
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimales })
}

/** Durée en secondes → "3'15" (minutes et secondes, pour les allures) */
export function formatMinSec(totalSec: number): string {
  let min = Math.floor(totalSec / 60)
  let sec = Math.round(totalSec % 60)
  if (sec === 60) {
    min += 1
    sec = 0
  }
  return `${min}'${String(sec).padStart(2, '0')}`
}

/** Date ISO → "il y a 3 jours", "aujourd'hui"… */
export function depuis(dateIso: string): string {
  const jours = Math.floor((Date.now() - new Date(dateIso).getTime()) / 86_400_000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  return `il y a ${jours} jours`
}

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** Centimes → "1 234,56 €" (`signe` : "+" devant les montants positifs) */
/** Montant au centime près, toujours 2 chiffres après la virgule (pas d'arrondi). */
export function formatEuros(centimes: number, { signe = false } = {}): string {
  const t = EUROS.format(centimes / 100)
  return signe && centimes > 0 ? `+${t}` : t
}

/** "2026-10-26" → "26/10/2026" */
export const formatDate = (jour: string) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`
