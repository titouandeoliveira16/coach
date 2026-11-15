import type { Etape, SousEtape } from '../../../metrics/programme'

/**
 * Séance Cycle → séance personnalisée iGPSPORT (16/11/2026). Format du « EditCustomWorkOut » de l'appli iGPSPORT
 * (accès non officiel, repéré par l'outil libre intervalssync) : des pas (durée, watts min-max, cadence) et des
 * répétitions. Une étape sans watts (sprint à fond) n'a pas de cible.
 */
export interface PasIgp {
  type: 'Step' | 'Repetition'
  name: string
  uuid: string
  intensityClass: 'WarmUp' | 'CoolDown' | 'Rest' | 'Active'
  openDuration: 'false'
  length: { unit: 'Second' | 'Repetition'; value: number }
  intensityTarget?: { unit: 'PowerCustom'; value: 0; minValue: number; maxValue: number }
  cadenceTarget?: { unit: 'Cadence'; minValue: number; maxValue: number }
  steps?: PasIgp[]
}

const id = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

function classe(libelle: string, premier: boolean): PasIgp['intensityClass'] {
  if (premier || /mise en route|échauffement|souffle/i.test(libelle)) return 'WarmUp'
  if (/retour au calme/i.test(libelle)) return 'CoolDown'
  if (/récup|facile|repos/i.test(libelle)) return 'Rest'
  return 'Active'
}

function pas(e: Etape | SousEtape, premier = false): PasIgp {
  const p: PasIgp = {
    type: 'Step', name: e.libelle.slice(0, 64), uuid: id(), intensityClass: classe(e.libelle, premier), openDuration: 'false',
    length: { unit: 'Second', value: Math.max(1, Math.round(e.dureeSec)) },
  }
  const min = e.wMin ?? (e.w ? e.w - 5 : undefined)
  const max = e.wMax ?? (e.w ? e.w + 5 : undefined)
  if (min && max) p.intensityTarget = { unit: 'PowerCustom', value: 0, minValue: Math.round(Math.min(min, max)), maxValue: Math.round(Math.max(min, max)) }
  const c = e.cadence?.match(/(\d+)\s*-\s*(\d+)/)
  if (c) p.cadenceTarget = { unit: 'Cadence', minValue: Number(c[1]), maxValue: Number(c[2]) }
  return p
}

/** Étapes d'une séance → structure iGPSPORT ; `derniere` : la dernière répétition ne garde que ses 1res sous-étapes. */
export function versIgpsport(etapes: Etape[]): PasIgp[] {
  const out: PasIgp[] = []
  etapes.forEach((e, i) => {
    if (!e.repetition) {
      if (e.dureeSec > 0) out.push(pas(e, i === 0))
      return
    }
    const { fois, etapes: sous, derniere } = e.repetition
    const pleines = derniere !== undefined && derniere < sous.length ? fois - 1 : fois
    if (pleines > 0) out.push({
      type: 'Repetition', name: e.libelle.slice(0, 64), uuid: id(), intensityClass: 'Active', openDuration: 'false',
      length: { unit: 'Repetition', value: pleines }, steps: sous.filter((s) => s.dureeSec > 0).map((s) => pas(s)),
    })
    if (pleines < fois) for (const s of sous.slice(0, derniere)) if (s.dureeSec > 0) out.push(pas(s))
  })
  return out
}

/** Durée totale (s) d'une structure. */
export function dureeIgpsport(structure: PasIgp[]): number {
  return structure.reduce((t, p) => t + (p.type === 'Repetition' ? p.length.value * dureeIgpsport(p.steps ?? []) : p.length.value), 0)
}
