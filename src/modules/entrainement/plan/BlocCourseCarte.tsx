import { useState } from 'react'
import { depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { Puces } from '../../../core/ui/Puces'
import type { SeanceProposee } from '../../../metrics/propositionsCourse'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import type { BlocCourse } from '../types'
import { ajouterPropositions, proposerCourse } from './donnees'

const OBJECTIFS = ['5k', '10k', 'semi', 'marathon', 'entretien'] as const
const LIBELLES = { '5k': '5 km', '10k': '10 km', semi: 'Semi', marathon: 'Marathon', entretien: 'Entretien' }

/** Objectif course (bloc) et propositions de la semaine. */
export function BlocCourseCarte({ lundi }: { lundi: string }) {
  const [r, modifier] = useReglagesEntrainement()
  const [brouillon, setBrouillon] = useState<BlocCourse>(r.bloc ?? { objectif: '10k', debut: lundi, seancesParSemaine: 3 })
  const [ouvert, setOuvert] = useState(false)
  const [props, setProps] = useState<SeanceProposee[]>()
  const bloc = r.bloc

  return (
    <Carte titre="🏃 Course à pied">
      {bloc && !ouvert ? (
        <p className="text-sm text-texte-2">
          Objectif <span className="font-semibold text-texte">{LIBELLES[bloc.objectif]}</span>
          {bloc.dateObjectif && ` le ${depuisJour(bloc.dateObjectif).toLocaleDateString('fr-FR')}`} · {bloc.seancesParSemaine} séances / semaine
          <button type="button" onClick={() => setOuvert(true)} className="ml-2 text-accent">Modifier</button>
        </p>
      ) : (
        <div className="space-y-3">
          <Puces options={OBJECTIFS} valeur={brouillon.objectif} effacable={false} libelle={(o) => LIBELLES[o]} onChoisir={(objectif) => objectif && setBrouillon({ ...brouillon, objectif })} />
          <label className="flex items-center justify-between">
            <span className="text-texte-2">Date de l'objectif</span>
            <input type="date" value={brouillon.dateObjectif ?? ''} onChange={(e) => setBrouillon({ ...brouillon, dateObjectif: e.target.value || undefined })}
              className="rounded-lg border border-bordure bg-surface-2 px-3 py-2" />
          </label>
          <ChampNombre libelle="Séances par semaine" decimales={0} valeur={brouillon.seancesParSemaine} onValider={(v) => v && setBrouillon({ ...brouillon, seancesParSemaine: Math.min(6, Math.max(1, v)) })} />
          <Bouton onClick={async () => { await modifier({ bloc: { ...brouillon, debut: bloc?.debut ?? lundi } }); setOuvert(false) }}>Enregistrer l'objectif</Bouton>
        </div>
      )}

      {bloc && !ouvert && (
        <div className="mt-3">
          {!props ? (
            <Bouton variante="secondaire" onClick={async () => setProps(await proposerCourse(bloc, lundi))}>Proposer mes séances de la semaine</Bouton>
          ) : (
            <div className="space-y-2">
              {props.map((p, i) => (
                <div key={i} className="rounded-xl bg-surface-2 p-2.5 text-sm">
                  <p className="font-semibold"><span className="capitalize">{depuisJour(p.date).toLocaleDateString('fr-FR', { weekday: 'long' })}</span> · {p.titre} · {p.dureeMin} min</p>
                  <p className="text-texte-2">{p.detail}</p>
                </div>
              ))}
              {props.length === 0 && <p className="text-sm text-texte-2">Aucun jour disponible cette semaine.</p>}
              {props.length > 0 && props.every((p) => p.intensite === 'basse') && (
                <p className="text-sm text-argent">
                  Pas de séance de qualité cette semaine : aucun jour libre qui ne soit ni la veille, ni le jour, ni le lendemain d'une séance vélo intense.
                  Garde l'endurance (règle 3 du PDF : une séance facile vaut mieux qu'une séance intense de trop).
                </p>
              )}
              <p className="text-xs text-texte-3">Propositions, pas des ordres : tu pourras tout modifier après ajout.</p>
              <Bouton disabled={!props.length} onClick={async () => { await ajouterPropositions(props, lundi); setProps(undefined) }}>Ajouter au plan</Bouton>
              <button type="button" onClick={() => setProps(undefined)} className="w-full py-1 text-sm text-texte-3">Annuler</button>
            </div>
          )}
        </div>
      )}
    </Carte>
  )
}
