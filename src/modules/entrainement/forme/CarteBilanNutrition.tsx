import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { evolutionTaille, type Energie, type Faim } from '../../../metrics/nutrition'
import { AIDES } from '../aides'
import { lireReglagesNutrition } from './besoins'
import { appliquerProposition, dimancheDuBilan, enregistrerBilan, propositionDuBilan } from './bilanNutrition'

const FAIMS: [Faim, string][] = [['ok', '😌 Ça va'], ['un-peu', '😐 Un peu'], ['souvent', '😣 Souvent']]
const ENERGIES: [Energie, string][] = [['bien', '👍 Bien'], ['moyen', '➖ Moyen'], ['mauvais', '👎 Mauvais']]

function Choix<T extends string>({ options, valeur, onChoisir }: { options: [T, string][]; valeur?: T; onChoisir: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(([v, nom]) => (
        <button key={v} type="button" onClick={() => onChoisir(v)} aria-pressed={valeur === v}
          className={`rounded-xl border py-2 text-sm font-semibold ${valeur === v ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface-2 text-texte-2'}`}>{nom}</button>
      ))}
    </div>
  )
}

/** Bilan du dimanche (jusqu'au mardi) : faim, énergie, tour de taille, puis proposition d'ajustement à valider. */
export function CarteBilanNutrition() {
  const dimanche = dimancheDuBilan()
  const etat = useLiveQuery(async () => {
    if (!dimanche) return null
    const n = await lireReglagesNutrition()
    const bilan = n.bilans?.find((b) => b.date === dimanche)
    const proposition = bilan && n.propositionVue !== dimanche ? await propositionDuBilan(dimanche) : undefined
    return { bilan, proposition, taille: evolutionTaille(n.bilans ?? []), vue: n.propositionVue === dimanche }
  }, [dimanche])
  const [faim, setFaim] = useState<Faim>()
  const [energie, setEnergie] = useState<Energie>()
  const [tailleCm, setTailleCm] = useState<number>()

  if (!dimanche || !etat || etat.vue) return null
  const { bilan, proposition, taille } = etat

  if (!bilan) {
    return (
      <Carte titre="🍽️ Bilan nutrition de la semaine">
        <p className="mb-1 text-sm text-texte-2">Faim cette semaine ?</p>
        <Choix options={FAIMS} valeur={faim} onChoisir={setFaim} />
        <p className="mb-1 mt-3 text-sm text-texte-2">Énergie à l'entraînement ?</p>
        <Choix options={ENERGIES} valeur={energie} onChoisir={setEnergie} />
        <div className="mt-3">
          <ChampNombre libelle="Tour de taille (facultatif)" unite="cm" valeur={tailleCm} onValider={setTailleCm} />
          <p className="text-xs text-texte-3">Le matin, à jeun, au nombril, en fin d'expiration, ruban à plat sans serrer : 2 mesures, garde la moyenne. 📸 Et ta photo (elle reste dans ton téléphone).</p>
        </div>
        <Bouton className="mt-3" disabled={!faim || !energie} onClick={() => enregistrerBilan({ date: dimanche, faim: faim!, energie: energie!, ...(tailleCm ? { tailleCm } : {}) })}>
          Enregistrer
        </Bouton>
      </Carte>
    )
  }

  // Bilan fait : évolution du tour de taille et proposition (perte de gras seulement)
  if (!proposition) return null
  const action = proposition.type === 'ajuster'
    ? `${proposition.delta > 0 ? 'Augmenter' : 'Réduire'} ton déficit de ${formatNombre(Math.abs(proposition.delta))} kcal par jour`
    : proposition.type === 'pause' ? '7 jours au maintien (pas de déficit)' : undefined
  return (
    <Carte titre="🍽️ Bilan nutrition">
      {taille && (
        <p className="text-sm text-texte-2">
          📏 Tour de taille : <b className="text-texte">{taille.ecart > 0 ? '+' : ''}{formatNombre(taille.ecart, 1)} cm</b> depuis le {jourCourt(taille.depuis)}
          {taille.significatif ? '' : ' (dans la marge de mesure)'}
        </p>
      )}
      <p className="mt-1">{proposition.raison}<Aide titre="Bilan nutrition" texte={AIDES.bilanNutrition} /></p>
      {action ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Bouton onClick={() => appliquerProposition(dimanche, proposition)}>{action}</Bouton>
          <Bouton variante="secondaire" onClick={() => appliquerProposition(dimanche)}>Pas maintenant</Bouton>
        </div>
      ) : (
        <Bouton variante="secondaire" className="mt-3" onClick={() => appliquerProposition(dimanche)}>OK</Bouton>
      )}
    </Carte>
  )
}
