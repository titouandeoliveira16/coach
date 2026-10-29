import { deriveDansBloc, tempsAuDessus } from '../../../metrics/fc'
import { FAMILLES_PLAFONNEES } from '../../../metrics/programme'
import { reperesBlocs } from '../../../metrics/puissance'
import type { Seance, SeancePrevue } from '../types'

/** Familles à cible stable : comparer les watts de chaque bloc a du sens (pas pour les 30/15 ni les over-unders). */
const FAMILLES_STABLES = new Set(['seuil', 'sweet-spot', 'tempo', 'vo2-longs'])

/** Bloc tenu, pour les séances d'avant les plages : au moins 97 % de la cible (marge de mesure du home trainer et du capteur). */
export const SEUIL_TENU = 0.97

/** Watts de chaque bloc de travail d'une séance faite, comparés à la séance prévue (et montée de la FC dans chaque bloc). */
export function blocsDeLaSeance(w1Hz: number[], p: SeancePrevue, fc1Hz?: number[]): Seance['blocs'] {
  const v = p.velo
  if (!v?.cibleW || !v.etapes || !FAMILLES_STABLES.has(v.famille)) return undefined
  const travail = v.etapes.filter((e) => e.w === v.cibleW && e.dureeSec >= 60)
  if (!travail.length) return undefined
  const dureeSec = Math.min(...travail.map((e) => e.dureeSec))
  const reperes = reperesBlocs(w1Hz, dureeSec, travail.length)
  if (!reperes) return undefined
  const derives = fc1Hz?.length ? reperes.map((b) => deriveDansBloc(fc1Hz, b.debut, dureeSec)) : undefined
  // FC moyenne de la dernière minute de chaque bloc (pour juger un bloc au-dessus de la CP)
  const fins = fc1Hz?.length ? reperes.map((b) => Math.round(fc1Hz.slice(b.debut + dureeSec - 60, b.debut + dureeSec).reduce((a, f) => a + f, 0) / 60)) : undefined
  const { wMin, wMax } = travail[0]
  return {
    cibleW: v.cibleW, ...(wMin ? { minW: wMin } : {}), ...(wMax && FAMILLES_PLAFONNEES.has(v.famille) ? { maxW: wMax } : {}),
    dureeSec, w: reperes.map((b) => b.w),
    ...(derives && derives.every((d) => d !== undefined) ? { deriveFc: derives.map((d) => Math.round(d! * 10) / 10), fcFin: fins } : {}),
  }
}

/** Intervalles VO2 longs : temps passé à 90 % ou plus de la FC max (Buchheit & Laursen 2013). */
export function tempsFc90(p: SeancePrevue, fc1Hz: number[] | undefined, fcMax: number) {
  if (p.velo?.famille !== 'vo2-longs' || !fc1Hz?.length) return undefined
  return tempsAuDessus(fc1Hz, 0.9 * fcMax)
}

/** Moyenne du bloc dans la plage : au-dessus du bas, et sous le haut pour le seuil, le sweet spot et le tempo. */
export const blocTenu = (w: number, b: NonNullable<Seance['blocs']>) => w >= (b.minW ?? SEUIL_TENU * b.cibleW) && (!b.maxW || w <= b.maxW)

/** Tous les blocs tenus → réussie ; sinon, c'est à toi de dire (une coupure de Zwift peut fausser un bloc). */
export const tousTenus = (b: NonNullable<Seance['blocs']>) => b.w.every((w) => blocTenu(w, b))
