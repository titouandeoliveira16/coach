import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { useReglage } from '../../../core/reglages'
import { estMineur, useProfil } from '../../../core/profil'
import { Aide } from '../../../core/ui/Aide'
import { AIDES } from '../aides'
import { exosDe, FORCE_DEFAUT, semainesApprentissage, type Lieu, type ReglagesForce } from '../muscu/force'
import { genererSemaineVelo, recalculerApresReglage } from '../plan/programme'
import { lundiDe } from '../seances/donnees'

const CHOIX = ['Pas pour l’instant', '1 séance par semaine', '2 séances par semaine']
const puce = (actif: boolean) => `rounded-full border px-3 py-1.5 text-sm ${actif ? 'border-muscu bg-muscu font-semibold text-fond' : 'border-bordure text-texte-2'}`

/**
 * Muscu, un seul endroit (13/11/2026) : Mon profil sportif → Musculation. Le choix (comme au questionnaire), puis dans
 * le cadre violet : salle ou maison, la date de la 1re séance et les règles.
 */
export function DetailMuscu() {
  const [f, modifier] = useReglage<ReglagesForce>('force', FORCE_DEFAUT)
  const [, modifierPs] = useReglage<{ muscu?: string }>('profil-sportif', {})
  const [message, setMessage] = useState<string>()
  const [profil] = useProfil()
  const choix = f.actif ? (f.seances === 2 ? CHOIX[2] : CHOIX[1]) : CHOIX[0]

  const choisir = async (c: string) => {
    const actif = c !== CHOIX[0]
    await modifier({ actif, seances: c === CHOIX[2] ? 2 : 1 })
    await modifierPs({ muscu: c })
    await recalculerApresReglage()
    if (!actif) return setMessage(undefined)
    // Plus de jour possible cette semaine : la semaine prochaine est construite tout de suite pour montrer la 1re séance
    const prochaine = async () => (await db.prevues.where('date').aboveOrEqual(aujourdhui()).toArray()).filter((p) => p.muscu && p.statut === 'prevue').sort((a, b) => a.date.localeCompare(b.date))[0]
    let erreur = ''
    if (!(await prochaine())) await genererSemaineVelo(decalerJour(lundiDe(aujourdhui()), 7)).catch((e: Error) => { erreur = e.message })
    const p = await prochaine()
    setMessage(p ? `Prochaine séance : ${depuisJour(p.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`
      : erreur ? `La semaine prochaine n’a pas pu être construite : ${erreur}`
      : 'Pas de jour possible : ta semaine type n’a aucun jour sans vélo. Mets un jour sur « muscu » dans Ma semaine type.')
  }

  if (estMineur(profil, aujourdhui())) return (
    <p className="text-sm text-texte-2">Pas de musculation lourde dans l'appli avant 18 ans : elle demande quelqu'un pour te montrer les mouvements et l'accord d'un parent. Parles-en à ton coach.</p>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {CHOIX.map((c) => <button key={c} type="button" onClick={() => choisir(c)} className={puce(choix === c)}>{c}</button>)}
      </div>
      {f.actif && (
        <div className="mt-3 rounded-2xl border-[1.5px] border-muscu p-3">
          {message && <p className="mb-2 text-sm text-muscu">{message}</p>}
          <p className="text-[13px] text-texte-2">Où ?<Aide titre="Muscu du cycliste" texte={AIDES.muscuForce} /></p>
          <div className="mt-1.5 flex gap-2">
            {(['salle', 'maison'] as Lieu[]).map((l) => (
              <button key={l} type="button" onClick={async () => { await modifier({ lieu: l }); await recalculerApresReglage() }} className={puce(f.lieu === l)}>{l === 'salle' ? 'Salle' : 'Maison'}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-texte-3">{exosDe({ lieu: f.lieu, variante: 'souleve' }).map((e) => e.nom).join(' · ')} (soulevé et leg curl en alternance) · puis prévention</p>
          {f.seances === 2 && (
            <>
              <p className="mt-3 text-[13px] text-texte-2">Ta 2e séance de la semaine</p>
              <div className="mt-1.5 flex gap-2">
                {(['salle', 'maison'] as Lieu[]).map((l) => (
                  <button key={l} type="button" onClick={async () => { await modifier({ lieu2: l === f.lieu ? undefined : l }); await recalculerApresReglage() }} className={puce((f.lieu2 ?? f.lieu) === l)}>{l === 'salle' ? 'Salle' : 'Maison'}</button>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[13px] text-texte-2">As-tu déjà fait du squat avec une charge ?</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {([['jamais', 'Jamais'], ['un-peu', 'Un peu'], ['regulier', 'Régulièrement']] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={async () => { await modifier({ experience: v }); await recalculerApresReglage() }} className={puce((f.experience ?? 'regulier') === v)}>{t}</button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-texte-2">Placée sur un jour sans vélo (ou un jour « muscu » de ta semaine type) ; sinon le soir d’une séance dure, 3 h après au moins. Jamais la veille d’une séance clé.</p>
          <p className="mt-1 text-xs text-texte-3">Apprentissage {semainesApprentissage(f.experience)} semaines → force lourde l’hiver → entretien 1 fois par semaine (2 séries) dès la fin de prépa → dernière séance 5 à 7 jours avant ta course A, rien dans les 4 derniers jours, reprise 3 jours après. 2 séances par semaine font plus progresser ; 1 garde l’essentiel. Le programme avance avec les semaines faites. Semaine allégée du vélo : mêmes charges, 2 séries. Séance manquée : même charge ; arrêt de 4 à 8 semaines : −10 % ; au-delà : −20 % et 2 semaines légères.</p>
        </div>
      )}
    </div>
  )
}
