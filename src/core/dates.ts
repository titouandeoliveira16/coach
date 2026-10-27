/** Outils de dates. Les jours sont stockés en texte "AAAA-MM-JJ", à l'heure locale. */

/** Date → "2026-10-23" (heure locale, pas UTC : 0 h 30 reste le bon jour) */
export function versJour(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const jj = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${jj}`
}

export const aujourdhui = () => versJour(new Date())

/** "2026-10-23" → Date à midi (évite les décalages d'heure d'été) */
export const depuisJour = (jour: string) => new Date(`${jour}T12:00:00`)

/** Décale un jour de n jours ("2026-10-23", -6 → "2026-10-17") */
export function decalerJour(jour: string, n: number): string {
  const d = depuisJour(jour)
  d.setDate(d.getDate() + n)
  return versJour(d)
}

/** Nombre de jours entre deux jours (b - a) */
export const ecartJours = (a: string, b: string) =>
  Math.round((depuisJour(b).getTime() - depuisJour(a).getTime()) / 86_400_000)

/** "2026-10-23" → "ven. 23" */
export const jourCourt = (jour: string) =>
  depuisJour(jour).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })

/** Noms des jours, dans l'ordre de Date.getDay() (0 = dimanche) */
export const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
