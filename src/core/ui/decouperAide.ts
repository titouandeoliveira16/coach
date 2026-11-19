/**
 * Aide longue (audit du 18/11/2026 : 18 aides de plus de 120 mots, jusqu'à 637) : les 2 premières phrases d'abord, le
 * reste (détail et sources) derrière « Pour aller plus loin ».
 */
export function decouperAide(texte: string) {
  if (texte.split(/\s+/).length <= 70) return { court: texte }
  const phrases = texte.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÝÉ«(0-9])/)
  if (phrases.length <= 2) return { court: texte }
  const mots = (t: string) => t.split(/\s+/).length
  const n = mots(phrases[0]) + mots(phrases[1]) <= 90 ? 2 : 1
  const court = phrases.slice(0, n).join(' ')
  const suite = phrases.slice(n).join(' ')
  if (mots(court) <= 90) return { court, suite }
  // Première phrase très longue : coupée à une pause (« : » ou « ; ») après une trentaine de mots
  const m = /^((?:\S+\s+){30,}?\S*?[:;])\s+/.exec(court)
  if (!m || mots(m[1]) > 90) return { court, suite }
  return { court: `${m[1].replace(/[:;]$/, '')}…`, suite: `…${court.slice(m[0].length)} ${suite}`.trim() }
}
