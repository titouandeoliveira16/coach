import { useEffect, useRef, useState } from 'react'

/**
 * Minuteur de blocs 50 min de travail / 10 min de vraie pause.
 * L'heure de départ est gardée sur l'appareil : fermer l'appli ne l'arrête pas (le temps écoulé se recalcule au retour).
 * Sur iPhone, il ne peut sonner que si l'appli est ouverte.
 */
const CLE = 'coach-minuteur'
const TRAVAIL = 50 * 60
const CYCLE = 60 * 60

interface Etat {
  debut: number
  objectif: string
}

function lire(): Etat | undefined {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}
function ecrire(e: Etat | undefined) {
  try {
    if (e) localStorage.setItem(CLE, JSON.stringify(e))
    else localStorage.removeItem(CLE)
  } catch {
    /* stockage indisponible : le minuteur marche quand même tant que l'écran reste ouvert */
  }
}

/** Petit signal sonore + vibration au changement de phase. */
function signal() {
  try {
    navigator.vibrate?.([300, 150, 300])
    const ctx = new AudioContext()
    for (const [i, f] of [880, 660, 880].entries()) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.25)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.22)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.25)
      o.stop(ctx.currentTime + i * 0.25 + 0.25)
    }
  } catch {
    /* pas de son possible */
  }
}

/** Minuteur en cours (ou undefined), mis à jour chaque seconde. */
export function useMinuteur() {
  const [etat, setEtat] = useState(lire)
  const [, setTic] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return {
    etat,
    demarrer: (objectif: string) => {
      const e = { debut: Date.now(), objectif }
      ecrire(e)
      setEtat(e)
    },
    arreter: () => {
      ecrire(undefined)
      setEtat(undefined)
    },
  }
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Écran plein du minuteur. */
export function Minuteur({ objectifPropose, onFermer }: { objectifPropose?: string; onFermer: () => void }) {
  const { etat, demarrer, arreter } = useMinuteur()
  const [objectif, setObjectif] = useState(etat?.objectif ?? objectifPropose ?? '')
  const ecoule = etat ? (Date.now() - etat.debut) / 1000 : 0
  const bloc = Math.floor(ecoule / CYCLE) + 1
  const dansCycle = ecoule % CYCLE
  const travail = dansCycle < TRAVAIL
  const reste = travail ? TRAVAIL - dansCycle : CYCLE - dansCycle
  const phase = etat ? `${bloc}-${travail}` : ''
  const precedente = useRef(phase)
  useEffect(() => {
    if (precedente.current && phase && precedente.current !== phase) signal()
    precedente.current = phase
  }, [phase])

  return (
    <div className="pt-sur pb-sur fixed inset-0 z-50 flex flex-col bg-fond px-5">
      <div className="flex items-center justify-between py-3">
        <p className="font-bold">Minuteur 50 / 10</p>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="px-2 text-2xl text-texte-3">×</button>
      </div>
      {!etat ? (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-center text-4xl">📵</p>
          <p className="text-center text-lg font-semibold">Téléphone loin, hors de vue, en silencieux.</p>
          <label className="block text-sm text-texte-2">Objectif de ce bloc
            <input value={objectif} onChange={(e) => setObjectif(e.target.value)} placeholder="ex. partie 1 de la fiche"
              className="mt-1 w-full rounded-lg border border-bordure bg-surface-2 px-3 py-3 text-texte outline-none focus:border-accent" />
          </label>
          <button type="button" onClick={() => demarrer(objectif.trim())} className="rounded-xl bg-accent py-4 text-lg font-bold text-fond">Démarrer 50 min</button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-texte-3">Bloc {bloc} · {travail ? 'travail' : 'pause'}</p>
          <p className="text-7xl font-bold tabular-nums" style={{ color: travail ? undefined : '#4ade80' }}>{mmss(reste)}</p>
          {(objectif || etat.objectif) && travail && <p className="text-lg">🎯 {objectif || etat.objectif}</p>}
          {travail ? (
            <p className="text-texte-2">📵 Téléphone loin. Dans {Math.ceil(reste / 60)} min : mini feuille blanche de ce bloc.</p>
          ) : dansCycle < TRAVAIL + 180 ? (
            <p className="text-lg">✍️ Mini feuille blanche : écris en 3 min ce que tu retiens de ce bloc, puis vraie pause (lève-toi, bois, pas d'écran).</p>
          ) : (
            <p className="text-texte-2">Vraie pause : bouge, bois, pas d'écran. Prochain bloc dans {Math.ceil(reste / 60)} min.</p>
          )}
          {!travail && (
            <input value={objectif} onChange={(e) => setObjectif(e.target.value)} onBlur={() => ecrire({ ...etat, objectif: objectif.trim() })}
              placeholder="Objectif du prochain bloc" className="mt-2 w-full rounded-lg border border-bordure bg-surface-2 px-3 py-3 outline-none" />
          )}
          <button type="button" onClick={() => { arreter(); onFermer() }} className="mt-6 w-full rounded-xl bg-surface-2 py-3 font-semibold">J'ai fini (arrêter)</button>
        </div>
      )}
    </div>
  )
}
