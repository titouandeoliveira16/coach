import { useState } from 'react'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { ChoixNote } from '../../../core/ui/ChoixNote'
import { aujourdhui } from '../../../core/dates'
import type { MesureMatin } from '../types'
import { QUESTIONS, enregistrerMesure } from './donnees'

/**
 * Formulaire du matin : chiffres de la montre puis 5 pastilles de ressenti.
 * Objectif : moins de 15 secondes.
 */
export function SaisieMatin({ existante, onTermine }: { existante?: MesureMatin; onTermine: () => void }) {
  const [m, setM] = useState<Omit<MesureMatin, 'modifieLe'>>(existante ?? { date: aujourdhui() })
  const changer = (changements: Partial<MesureMatin>) => setM((x) => ({ ...x, ...changements }))

  return (
    <Carte titre="Ton matin">
      <p className="mb-1 text-xs text-texte-3">
        {existante?.vfcMs !== undefined && !QUESTIONS.some((q) => existante[q.cle] !== undefined)
          ? '✓ Chiffres reçus de ta Garmin (via Intervals.icu) : il ne reste que ton ressenti.'
          : 'Garmin Connect → Statut VFC (moyenne de la nuit) et FC au repos.'}
      </p>
      <ChampNombre libelle="VFC" unite="ms" decimales={0} valeur={m.vfcMs} onValider={(v) => changer({ vfcMs: v })} />
      <ChampNombre libelle="FC de repos" unite="bpm" decimales={0} valeur={m.fcRepos} onValider={(v) => changer({ fcRepos: v })} />
      <ChampNombre libelle="Durée de sommeil" unite="h" valeur={m.sommeilH} onValider={(v) => changer({ sommeilH: v })} />

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
