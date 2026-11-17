import { useState } from 'react'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampHeures } from '../../../core/ui/ChampHeures'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { ChoixNote } from '../../../core/ui/ChoixNote'
import { aujourdhui } from '../../../core/dates'
import type { MesureMatin } from '../types'
import { QUESTIONS, enregistrerMesure } from './donnees'
import { useReglage } from '../../../core/reglages'

const MONTRES = ['Garmin', 'COROS', 'Suunto', 'Polar', 'Wahoo']

/**
 * Formulaire du matin : chiffres de la montre puis 5 pastilles de ressenti.
 * Objectif : moins de 15 secondes.
 */
export function SaisieMatin({ existante, onTermine }: { existante?: MesureMatin; onTermine: () => void }) {
  const [m, setM] = useState<Omit<MesureMatin, 'modifieLe'>>(existante ?? { date: aujourdhui() })
  // Une valeur changée à la main n'est plus remplacée par la montre aux imports suivants
  const changer = (changements: Partial<MesureMatin>) => setM((x) => ({ ...x, ...changements, ...(x.importes ? { importes: x.importes.filter((k) => !(k in changements)) } : {}) }))
  // Ta montre (profil sportif → Mes appareils), pas « ta Garmin » pour tout le monde
  const [ps] = useReglage<{ appareils?: string[] }>('profil-sportif', {})
  const montre = ps.appareils?.find((a) => MONTRES.includes(a))

  return (
    <Carte titre="Ton matin">
      <p className="mb-1 text-xs text-texte-3">
        {existante?.vfcMs !== undefined && !QUESTIONS.some((q) => existante[q.cle] !== undefined)
          ? `✓ Chiffres reçus de ta montre${montre ? ` (${montre})` : ''} via Intervals.icu : il ne reste que ton ressenti.`
          : montre === 'Garmin' || !montre ? 'Garmin Connect → Statut VFC (moyenne de la nuit) et FC au repos (ou l’appli de ta montre).' : `L'appli ${montre} → VFC de la nuit et FC au repos.`}
      </p>
      <ChampNombre libelle="VFC" unite="ms" decimales={0} valeur={m.vfcMs} onValider={(v) => changer({ vfcMs: v })} />
      <ChampNombre libelle="FC de repos" unite="bpm" decimales={0} valeur={m.fcRepos} onValider={(v) => changer({ fcRepos: v })} />
      <ChampHeures libelle="Durée de sommeil" valeur={m.sommeilH} onValider={(v) => changer({ sommeilH: v })} />

      <div className="mt-2 border-t border-bordure pt-2">
        {QUESTIONS.map((q) => (
          <ChoixNote key={q.cle} libelle={q.libelle} bornes={q.bornes} valeur={m[q.cle]} onChoisir={(n) => changer({ [q.cle]: n })} />
        ))}
      </div>

      <Bouton
        className="mt-3"
        onClick={async () => {
          await enregistrerMesure(m)
          onTermine()
        }}
      >
        Enregistrer
      </Bouton>
    </Carte>
  )
}
