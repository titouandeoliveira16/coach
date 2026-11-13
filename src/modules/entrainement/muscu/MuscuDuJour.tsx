import { useNavigate } from 'react-router-dom'
import { db } from '../../../core/db'
import { useReglage } from '../../../core/reglages'
import { enregistrer } from '../../../core/stockage'
import type { SeancePrevue } from '../types'
import { chargeProposee, EXOS, FORCE_DEFAUT, type ReglagesForce } from './force'
import { Picto } from './Picto'

const COURTS: Record<string, string> = { squat: 'Squat', presse: 'Presse', souleve: 'Soulevé', curl: 'Leg curl', mollets: 'Mollets', bulgare: 'Bulgare', stepup: 'Step-up', souleve1: 'Soulevé', curlsol: 'Leg curl', mollets1: 'Mollets' }

/** La muscu du jour dans la carte « Séance du jour » (maquette M1 validée le 13/11/2026). */
export function MuscuDuJour({ p, couleur }: { p: SeancePrevue; couleur: 'vert' | 'orange' | 'rouge' }) {
  const navigate = useNavigate()
  const [force, modifier] = useReglage<ReglagesForce>('force', FORCE_DEFAUT)
  const s = p.muscu!
  const exos = EXOS[s.lieu]
  const squat = exos.find((e) => !e.sansCharge)!
  const charge = chargeProposee(squat, force.exos[squat.id], s.reps, s.facteur)
  const changerLieu = async () => {
    const lieu = s.lieu === 'salle' ? 'maison' : 'salle'
    await modifier({ lieu })
    await enregistrer(db.prevues, { ...p, muscu: { ...s, lieu } })
  }
  return (
    <>
      <p className="mt-0.5 text-[22px] font-bold leading-tight">{p.titre}</p>
      <p className="mt-0.5 text-[13px] text-muscu">
        {s.periode === 'lourd' ? `Semaine ${s.semaine} sur 12 · ` : s.periode === 'apprentissage' ? `Semaine ${s.semaine} sur 2 · ` : ''}{s.series} × {s.reps}{s.legere ? ' légères' : ''} + prévention · ~{p.dureeMin} min{s.facteur ? ` · reprise ${Math.round(s.facteur * 100)} %` : ''}{s.soir ? ' · le soir, 3 h après le vélo' : ''}
      </p>
      {couleur !== 'vert' && (
        <p className="mt-1 text-[13px] text-attention">{couleur === 'rouge' ? 'Feu rouge : pas de muscu lourde aujourd’hui, décale-la à un autre jour.' : 'Feu orange : une série de moins par exercice, mêmes charges.'}</p>
      )}
      <div className="mt-2.5 grid grid-cols-5 gap-1.5">
        {exos.map((e) => (
          <div key={e.id} className="flex flex-col items-center rounded-xl bg-surface-2 py-1.5">
            <Picto type={e.picto} taille={32} />
            <span className="mt-0.5 text-[10px] text-texte-2">{COURTS[e.id] ?? e.nom}</span>
          </div>
        ))}
      </div>
      {charge && <p className="mt-2 text-[13px] text-texte-2">{squat.nom} à <b className="text-texte">{charge} kg</b></p>}
      <div aria-hidden className="min-h-2 flex-1" />
      <button type="button" onClick={() => navigate(`/entrainement/muscu/${p.id}`)} className="mt-2 min-h-12 w-full shrink-0 rounded-xl bg-muscu text-base font-bold text-fond">Commencer la séance</button>
      <div className="mt-1.5 flex shrink-0 justify-between text-[13px]">
        <button type="button" onClick={changerLieu} className="py-1 text-texte-2">{s.lieu === 'salle' ? 'Salle' : 'Maison'} · <u>{s.lieu === 'salle' ? 'à la maison' : 'en salle'}</u></button>
        <button type="button" onClick={() => enregistrer(db.prevues, { ...p, statut: 'non-faite' })} className="py-1 text-texte-3">Pas aujourd’hui</button>
      </div>
    </>
  )
}

/** Muscu le soir d'une séance de vélo : une ligne en bas de la carte. */
export function MuscuDuSoir({ p }: { p: SeancePrevue }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(`/entrainement/muscu/${p.id}`)} className="mt-2 flex w-full shrink-0 items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-left text-[13px]">
      <span><b className="text-muscu">Ce soir</b> · {p.titre} · {p.muscu?.series} × {p.muscu?.reps} (3 h après le vélo au moins)</span>
      <span className="font-semibold text-muscu">Commencer ›</span>
    </button>
  )
}
export const estMuscu = (p: SeancePrevue) => !!p.muscu
