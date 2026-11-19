/** Calculs du module Entraînement (fonctions pures, sans affichage). */

/** Un effort maximal du test CP : sa durée et la puissance moyenne tenue. */
export interface EffortTest {
  dureeSec: number
  puissanceW: number
}

/**
 * Modèle de puissance critique à 2 paramètres (Monod & Scherrer, Moritani) :
 * le travail total W = P × t suit une droite W = CP × t + W′.
 * Une régression linéaire sur les efforts du test donne :
 *  - la pente = CP (W)
 *  - l'ordonnée à l'origine = W′ (J)
 *  - R² : qualité de l'ajustement (proche de 1 = test cohérent)
 * Il faut au moins 2 efforts de durées différentes.
 */
export function calculerCP(efforts: EffortTest[]) {
  if (efforts.length < 2) return undefined
  const x = efforts.map((e) => e.dureeSec)
  const y = efforts.map((e) => e.dureeSec * e.puissanceW)
  const n = efforts.length
  const mx = x.reduce((a, b) => a + b) / n
  const my = y.reduce((a, b) => a + b) / n
  const sxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0)
  if (sxx === 0) return undefined
  const sxy = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0)
  const cp = sxy / sxx
  const wPrime = my - cp * mx
  const syy = y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { cpW: cp, wPrimeKj: wPrime / 1000, r2 }
}

/**
 * Test impossible (audit du 18/11/2026) : un effort plus long doit être tenu à moins de watts qu'un plus court, la CP doit
 * rester sous la puissance de l'effort le plus long, et W′ doit être positif (Jones & Vanhatalo 2017). Sinon c'est une
 * erreur de saisie ou un effort pas fait à fond : la CP ne doit pas être enregistrée. Renvoie la raison, ou undefined.
 */
export function testImpossible(efforts: EffortTest[]): string | undefined {
  const r = calculerCP(efforts)
  if (!r) return undefined
  const tries = [...efforts].sort((a, b) => a.dureeSec - b.dureeSec)
  if (tries.some((e, i) => i > 0 && e.puissanceW >= tries[i - 1].puissanceW)) return 'Un effort plus long a été tenu à autant ou plus de watts qu’un effort plus court : vérifie les watts saisis.'
  if (r.wPrimeKj <= 0 || r.cpW >= tries.at(-1)!.puissanceW) return 'Ces efforts donnent une CP au-dessus de ta puissance sur l’effort le plus long : ce n’est pas possible. Vérifie les watts, ou refais le test.'
  return undefined
}
