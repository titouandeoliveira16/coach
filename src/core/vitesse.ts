import { db } from './db'
import { enregistrer } from './stockage'

/**
 * Vitesse réelle de l'appli sur ton téléphone (20/11/2026, demande de Titouan) : à chaque ouverture, le temps jusqu'au
 * premier écran affiché. Les 30 dernières sont gardées sur ton compte (réglage « vitesse »), rien d'autre (ni écran, ni
 * donnée). Sert à voir si l'appli ralentit avec le temps (plus de semaines, plus de séances), ce que les tests sur un
 * ordinateur ne voient pas.
 */
export interface MesureVitesse { date: string; ms: number; enLigne: boolean }

const CLE = 'vitesse'

/** À l'ouverture : attend le premier affichage de l'appli (2 images après le rendu), puis enregistre le temps écoulé. */
export function mesurerOuverture() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const ms = Math.round(performance.now())
    // Appli rouverte depuis l'arrière-plan sans rechargement : pas une vraie ouverture
    if (ms > 60_000) return
    setTimeout(() => { void noter({ date: new Date().toISOString().slice(0, 10), ms, enLigne: navigator.onLine }) }, 3000)
  }))
}

async function noter(m: MesureVitesse) {
  const avant = ((await db.reglages.get(CLE))?.valeur as MesureVitesse[] | undefined) ?? []
  await enregistrer(db.reglages, { id: CLE, valeur: [...avant, m].slice(-30) })
}

/** Temps médian d'ouverture (ms) et nombre de mesures. */
export function resumeVitesse(liste: MesureVitesse[] | undefined) {
  if (!liste?.length) return undefined
  const t = liste.map((x) => x.ms).sort((a, b) => a - b)
  return { mediane: t[Math.floor(t.length / 2)], pire: t[t.length - 1], n: t.length }
}
