import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, jourCourt } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { evolutionTaille, type Energie, type Faim } from '../../../metrics/nutrition'
import { AIDES } from '../aides'
import { useNutritionActive } from '../reglages/ProfilSportif'
import { lireReglagesNutrition } from './besoins'
import { appliquerProposition, dimancheDuBilan, enregistrerBilan, propositionDuBilan } from './bilanNutrition'

const FAIMS: [Faim, string][] = [['ok', '😌 Ça va'], ['un-peu', '😐 Un peu'], ['souvent', '😣 Souvent']]
const ENERGIES: [Energie, string][] = [['bien', '👍 Bien'], ['moyen', '➖ Moyen'], ['mauvais', '👎 Mauvais']]
const nom = <T,>(options: [T, string][], v: T) => options.find(([x]) => x === v)?.[1] ?? ''

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

/**
 * Bilan nutrition du dimanche : faim, énergie, tour de taille, puis proposition d'ajustement à valider.
 *  - « aujourdhui » : le dimanche seulement ; une fois rempli (et la proposition vue), il disparaît ;
 *  - « semaine » : le lundi, rappel de celui de la veille, encore modifiable. Plus rien ensuite.
 * Rien sans le module nutrition (Réglages → Mon profil sportif).
 */
export function CarteBilanNutrition({ lieu }: { lieu: 'aujourdhui' | 'semaine' }) {
  const active = useNutritionActive()
  const dimanche = dimancheDuBilan()
  const ici = !!dimanche && (lieu === 'aujourdhui') === (dimanche === aujourdhui())
  const etat = useLiveQuery(async () => {
    if (!dimanche) return null
    const n = await lireReglagesNutrition()
    const bilan = n.bilans?.find((b) => b.date === dimanche)
    const proposition = bilan && n.propositionVue !== dimanche ? await propositionDuBilan(dimanche) : undefined
    return { bilan, proposition, taille: evolutionTaille(n.bilans ?? []) }
  }, [dimanche])
  const [faim, setFaim] = useState<Faim>()
  const [energie, setEnergie] = useState<Energie>()
  const [tailleCm, setTailleCm] = useState<number>()
  const [edition, setEdition] = useState(false)

  if (!active || !ici || !dimanche || !etat) return null
  const { bilan, proposition, taille } = etat

  if (!bilan || edition) {
    const enregistrer = async () => {
      await enregistrerBilan({ date: dimanche, faim: (faim ?? bilan?.faim)!, energie: (energie ?? bilan?.energie)!, ...((tailleCm ?? bilan?.tailleCm) ? { tailleCm: tailleCm ?? bilan?.tailleCm } : {}) })
      setEdition(false)
    }
    return (
      <Carte titre="🍽️ Bilan nutrition de la semaine">
        <p className="mb-1 text-sm text-texte-2">Faim cette semaine ?</p>
        <Choix options={FAIMS} valeur={faim ?? bilan?.faim} onChoisir={setFaim} />
        <p className="mb-1 mt-3 text-sm text-texte-2">Énergie à l'entraînement ?</p>
        <Choix options={ENERGIES} valeur={energie ?? bilan?.energie} onChoisir={setEnergie} />
        <div className="mt-3">
          <ChampNombre libelle="Tour de taille (facultatif)" unite="cm" valeur={tailleCm ?? bilan?.tailleCm} onValider={setTailleCm} />
          <p className="text-xs text-texte-3">Le matin, à jeun, au nombril, en fin d'expiration, ruban à plat sans serrer : 2 mesures, garde la moyenne. 📸 Et ta photo (elle reste dans ton téléphone).</p>
        </div>
        <Bouton className="mt-3" disabled={!(faim ?? bilan?.faim) || !(energie ?? bilan?.energie)} onClick={enregistrer}>
          Enregistrer
        </Bouton>
      </Carte>
    )
  }

  // Le lundi, dans Semaine : ce qui a été noté, à modifier si besoin (et la proposition si elle attend encore)
  const rappel = lieu === 'semaine' && (
    <p className="text-sm text-texte-2">
      Faim : <b className="text-texte">{nom(FAIMS, bilan.faim)}</b> · Énergie : <b className="text-texte">{nom(ENERGIES, bilan.energie)}</b>
      {bilan.tailleCm ? <> · <b className="text-texte">{formatNombre(bilan.tailleCm, 1)} cm</b></> : null}
      <button type="button" onClick={() => setEdition(true)} className="ml-2 text-texte-3 underline">modifier</button>
    </p>
  )
  if (!proposition) return rappel ? <Carte titre="🍽️ Bilan nutrition de la semaine">{rappel}</Carte> : null

  const action = proposition.type === 'ajuster'
    ? `${proposition.delta > 0 ? 'Augmenter' : 'Réduire'} ton déficit de ${formatNombre(Math.abs(proposition.delta))} kcal par jour`
    : proposition.type === 'pause' ? '7 jours au maintien (pas de déficit)' : undefined
  return (
    <Carte titre="🍽️ Bilan nutrition">
      {rappel && <div className="mb-2">{rappel}</div>}
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
