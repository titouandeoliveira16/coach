import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { Bouton } from '../../../core/ui/Bouton'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatNombre } from '../../../core/format'
import { calculerCP } from '../calculs'

/** Durées du test 12-7-3 (minutes) */
const DUREES_MIN = [12, 7, 3]

/**
 * Calculateur du test CP 12-7-3 : on saisit la puissance moyenne
 * de chaque effort, on obtient CP et W′, puis on les enregistre.
 */
export function CalculateurCP({ onUtiliser, cpActuelle, onRefaire }: { onUtiliser: (cpW: number, wPrimeKj: number, complet: boolean) => void; cpActuelle?: number; onRefaire?: () => void }) {
  const [puissances, setPuissances] = useState<(number | undefined)[]>([undefined, undefined, undefined])
  const [confirme, setConfirme] = useState(false)
  // Test fait à fond ? (13/11/2026) : chaque effort comparé à ton meilleur effort de même durée des 6 semaines d'avant
  const meilleurs = useLiveQuery(async () => {
    const jour = aujourdhui()
    const seances = (await db.seances.where('date').between(decalerJour(jour, -42), jour, true, false).toArray()).filter((x) => x.sport === 'velo' && x.meilleurs)
    return DUREES_MIN.map((m) => Math.max(0, ...seances.map((x) => x.meilleurs?.[m * 60] ?? 0)))
  })

  const efforts = DUREES_MIN.flatMap((min, i) => {
    const p = puissances[i]
    return p ? [{ dureeSec: min * 60, puissanceW: p }] : []
  })
  const resultat = calculerCP(efforts)
  // Effort sous 95 % de ton meilleur récent de même durée : test sans doute pas fait à fond (seuil = choix d'entraîneur)
  const enDessous = DUREES_MIN.map((min, i) => ({ min, w: puissances[i], meilleur: meilleurs?.[i] ?? 0 })).filter((x) => x.w && x.meilleur && x.w < x.meilleur * 0.95)
  const forteHausse = resultat && cpActuelle && resultat.cpW > cpActuelle * 1.1
  const douteux = enDessous.length > 0 || !!forteHausse

  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="mb-1 text-sm font-semibold">Test CP</p>
      <p className="mb-2 text-xs text-texte-3">Puissance moyenne de chaque effort à fond. Test court : remplis seulement 3 et 12 min.</p>
      {DUREES_MIN.map((min, i) => (
        <ChampNombre
          key={min}
          libelle={`Effort ${min} min`}
          unite="W"
          decimales={0}
          valeur={puissances[i]}
          onValider={(v) => setPuissances((p) => p.map((x, j) => (j === i ? v : x)))}
        />
      ))}

      {resultat && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Resultat libelle="CP" valeur={`${formatNombre(resultat.cpW)} W`} />
            <Resultat libelle="W′" valeur={`${formatNombre(resultat.wPrimeKj, 1)} kJ`} />
            <Resultat libelle="R²" valeur={formatNombre(resultat.r2, 3)} />
          </div>
          {efforts.length === 3 && resultat.r2 < 0.99 && (
            <p className="text-xs text-argent">
              R² un peu bas : un des efforts n'était peut-être pas tout à fait maximal.
            </p>
          )}
          {douteux && !confirme ? (
            <div className="rounded-xl border-[1.5px] border-attention/50 p-3 text-sm">
              {enDessous.map((x) => (
                <p key={x.min} className="text-texte-2">Effort {x.min} min : <b className="text-texte">{x.w} W</b>, sous ton meilleur des 6 dernières semaines (<b className="text-texte">{x.meilleur} W</b>).</p>
              ))}
              {forteHausse && <p className="text-texte-2">CP en hausse de {Math.round((resultat.cpW / cpActuelle! - 1) * 100)} % d’un coup : vérifie les watts saisis.</p>}
              <p className="mt-1 font-semibold text-attention">{enDessous.length ? 'Le test n’a sans doute pas été fait à fond : une CP trop basse rendrait toutes tes séances trop faciles.' : 'Une erreur de saisie fausserait toutes tes séances.'}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onRefaire?.()} className="rounded-xl bg-accent py-2.5 font-semibold text-fond">Je refais le test</button>
                <button type="button" onClick={() => setConfirme(true)} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">C’est juste</button>
              </div>
            </div>
          ) : (
            <Bouton onClick={() => onUtiliser(Math.round(resultat.cpW), Math.round(resultat.wPrimeKj * 10) / 10, efforts.length === 3)}>
              Utiliser ces valeurs
            </Bouton>
          )}
        </div>
      )}
    </div>
  )
}

function Resultat({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-lg bg-surface p-2">
      <p className="text-xs text-texte-3">{libelle}</p>
      <p className="font-bold">{valeur}</p>
    </div>
  )
}
