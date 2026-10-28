import { useEffect, useState } from 'react'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { AIDES_MUSCU } from '../aides'
import { annulerDerniere, noterSeance, type EtatMuscu } from '../donnees'
import { maxEstime, PLAFOND_REPS, REPOS_COMPLEMENTAIRE, REPOS_LOURD, repsMinimum, SEMAINES, seanceDe, type Serie } from '../programme'

const kg = (n: number) => `${formatNombre(n, 1)} kg`

/** La séance du jour : échauffement, séries lourdes (la dernière « + »), 5×5, minuteur de repos. */
export function Seance({ e }: { e: EtatMuscu }) {
  const reference = e.reference!
  const s = seanceDe(e.semaine, reference)
  const plus = s.principales.find((x) => x.plus)
  const [reps, setReps] = useState<number>(plus?.reps ?? 0)
  const [message, setMessage] = useState<string>()

  return (
    <div className="space-y-3">
      <Carte>
        <p className="text-xs uppercase tracking-wider text-texte-3">Cycle {e.cycle} · semaine {e.semaine}/4</p>
        <p className="text-2xl font-bold">{SEMAINES[e.semaine].nom}</p>
        <p className="mt-1 text-sm text-texte-2">
          Référence <b className="text-texte">{kg(reference)}</b>
          <Aide titre="Méthode 5/3/1" texte={AIDES_MUSCU.methode} />
        </p>
        {e.decision && <p className="mt-2 rounded-xl bg-surface-2 p-2.5 text-sm">{e.decision.raison}</p>}
      </Carte>

      <Carte titre="Échauffement">
        <Series series={s.echauffement} />
      </Carte>

      <Carte titre={e.semaine === 4 ? 'Séries (légères : ton corps récupère)' : 'Séries lourdes · 3 min de repos'}>
        <Series series={s.principales} />
        {plus && (
          <div className="mt-3 rounded-xl bg-surface-2 p-3">
            <p className="text-sm">Dernière série : <b>le plus de reps possible</b>, en gardant 1 rep en réserve ({PLAFOND_REPS} au plus). Combien ?</p>
            <div className="mt-2 grid grid-cols-6 gap-1">
              {Array.from({ length: PLAFOND_REPS + 1 }, (_, n) => (
                <button key={n} type="button" onClick={() => setReps(n)}
                  className={`rounded-md py-2 text-sm font-semibold ${reps === n ? 'bg-accent text-fond' : 'bg-surface text-texte-2'}`}>{n}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-texte-3">
              {reps < repsMinimum(e.semaine)
                ? `Moins de ${repsMinimum(e.semaine)} : ta référence est un peu haute pour aujourd'hui, pas grave.`
                : `Max estimé : ${kg(maxEstime(plus.kg, Math.max(1, reps)))}`}
              <Aide titre="Max estimé" texte={AIDES_MUSCU.maxEstime} />
            </p>
          </div>
        )}
        <Minuteur secondes={REPOS_LOURD} />
      </Carte>

      {s.complementaires.length > 0 && (
        <Carte titre="Puis 5 × 5 · 2 min de repos">
          <p className="text-sm text-texte-2">5 séries de 5 à <b className="text-texte">{kg(s.complementaires[0].kg)}</b> : le volume qui fait progresser le muscle.</p>
          <Minuteur secondes={REPOS_COMPLEMENTAIRE} />
        </Carte>
      )}

      <p className="px-1 text-xs text-texte-3">⚠️ Série « + » : toujours avec les barres de sécurité ou un pareur.</p>
      {message && <p className="rounded-xl bg-surface p-3 text-sm">{message}</p>}
      <Bouton onClick={async () => setMessage(await noterSeance(plus ? reps : undefined, plus?.kg))}>✅ Séance faite</Bouton>
      {e.seances.length > 0 && (
        <button type="button" onClick={() => { annulerDerniere(); setMessage(undefined) }} className="w-full py-2 text-sm text-texte-3 underline">
          Annuler la dernière séance notée
        </button>
      )}
    </div>
  )
}

function Series({ series }: { series: Serie[] }) {
  return (
    <ul className="space-y-1">
      {series.map((x, i) => (
        <li key={i} className="flex justify-between">
          <span className="text-texte-2">{i + 1}.</span>
          <span><b className="tabular-nums">{kg(x.kg)}</b> × {x.reps}{x.plus ? '+' : ''}</span>
        </li>
      ))}
    </ul>
  )
}

/** Minuteur de repos (tourne tant que l'écran reste ouvert). */
function Minuteur({ secondes }: { secondes: number }) {
  const [fin, setFin] = useState<number>()
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    if (!fin) return
    const t = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(t)
  }, [fin])
  const reste = fin ? Math.max(0, Math.ceil((fin - maintenant) / 1000)) : undefined
  const texte = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
  return (
    <button type="button" onClick={() => { setMaintenant(Date.now()); setFin(reste ? undefined : Date.now() + secondes * 1000) }}
      className={`mt-3 w-full rounded-xl border py-2.5 font-semibold ${reste === 0 ? 'border-[#4ade80] text-[#4ade80]' : 'border-bordure text-texte-2'}`}>
      {reste === undefined ? `⏱️ Repos ${texte(secondes)}` : reste === 0 ? '✅ Repos terminé · toucher pour relancer' : `⏱️ ${texte(reste)} · toucher pour arrêter`}
    </button>
  )
}
