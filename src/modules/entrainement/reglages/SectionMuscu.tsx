import { useReglage } from '../../../core/reglages'
import { Aide } from '../../../core/ui/Aide'
import { AIDES } from '../aides'
import { EXOS, FORCE_DEFAUT, type Lieu, type ReglagesForce } from '../muscu/force'
import { recalculerSemainesAVenir } from '../plan/programme'

const puce = (actif: boolean) => `rounded-full border px-4 py-1.5 text-sm ${actif ? 'border-muscu bg-muscu font-semibold text-fond' : 'border-bordure text-texte-2'}`

/** Muscu reliée à l'Entraînement (maquette M4 validée le 13/11/2026) : au choix, 1 ou 2 séances, salle ou maison. */
export function SectionMuscu() {
  const [f, modifier] = useReglage<ReglagesForce>('force', FORCE_DEFAUT)
  const changer = async (m: Partial<ReglagesForce>) => {
    await modifier(m)
    await recalculerSemainesAVenir()
  }
  // Réactivée plus tard : tes charges sont gardées ; le temps passé sans séance est rattrapé (même charge jusqu'à 3
  // semaines, −10 % jusqu'à 8, au-delà −20 % et 2 semaines légères)
  const activer = () => changer({ actif: !f.actif })
  return (
    <section className={`rounded-2xl border bg-surface p-3.5 ${f.actif ? 'border-muscu' : 'border-bordure'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">Muscu<Aide titre="Muscu du cycliste" texte={AIDES.muscuForce} /></span>
        <button type="button" role="switch" aria-checked={f.actif} onClick={activer}
          className={`relative h-7 w-12 rounded-full transition-colors ${f.actif ? 'bg-muscu' : 'bg-surface-2'}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${f.actif ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {f.actif && (
        <>
          <p className="mt-3 text-[13px] text-texte-2">Séances par semaine</p>
          <div className="mt-1.5 flex gap-2">
            {([1, 2] as const).map((n) => <button key={n} type="button" onClick={() => changer({ seances: n })} className={puce(f.seances === n)}>{n}</button>)}
          </div>
          <p className="mt-3 text-[13px] text-texte-2">Où ?</p>
          <div className="mt-1.5 flex gap-2">
            {(['salle', 'maison'] as Lieu[]).map((l) => <button key={l} type="button" onClick={() => changer({ lieu: l })} className={puce(f.lieu === l)}>{l === 'salle' ? 'Salle' : 'Maison'}</button>)}
          </div>
          <p className="mt-2 text-xs text-texte-3">{EXOS[f.lieu].map((e) => e.nom).join(' · ')}</p>
          <p className="mt-3 text-[13px] text-texte-2">Placée sur un jour sans vélo ; sinon le soir d’une séance dure, 3 h après au moins. Jamais la veille d’une séance clé.</p>
          <p className="mt-1 text-xs text-texte-3">Apprentissage 2 semaines → force lourde 12 semaines → entretien 1 fois par semaine → rien dans les 4 jours avant ta course. Le programme avance avec les semaines faites. Semaine allégée du vélo : mêmes charges, 2 séries.</p>
          <p className="mt-1 text-xs text-texte-3">Séance ou semaine manquée : on reprend à la même charge. Arrêt plus long : jusqu’à 3 semaines, même charge ; 4 à 8 semaines, −10 % ; au-delà, −20 % et 2 semaines légères. Tes charges restent gardées si tu désactives la muscu.</p>
        </>
      )}
    </section>
  )
}
