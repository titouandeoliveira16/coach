import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Feuille } from '../../../core/ui/Feuille'
import { verifierSemaineType } from '../../../metrics/programme'
import { lundiDe } from '../seances/donnees'
import type { ReglagesProgramme, SemaineTypeFuture } from '../types'
import { Defileur, EditeurSemaine } from './EditeurSemaine'

const jourLong = (d: string) => depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const nbVelos = (t: SemaineTypeFuture['semaineType']) => t.filter((x) => x.startsWith('velo')).length
const DUREES_SEMAINE = [45, 60, 75, 90, 105, 120, 150].map((m) => [`${m} min`, m] as [string, number])
const DUREES_LONGUE = [90, 120, 150, 180, 210, 240, 270, 300].map((m) => [`${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`, m] as [string, number])

/**
 * Semaines types à venir (ex. 5 vélos dès un déménagement, plus de temps après un examen) : chacune s'applique à partir
 * de son lundi. Le plafond de kJ suit les jours et les durées : la progression continue au lieu de bloquer.
 */
export function SemainesAVenir({ prog, onChanger }: { prog: ReglagesProgramme; onChanger: (futures: SemaineTypeFuture[]) => Promise<void> }) {
  const futures = [...(prog.semainesTypesFutures ?? [])].sort((a, b) => a.debut.localeCompare(b.debut))
  const [edition, setEdition] = useState<{ index?: number; s: SemaineTypeFuture }>()
  const lundiProchain = decalerJour(lundiDe(aujourdhui()), 7)

  const ouvrir = (index?: number) => {
    const precedente = index === undefined ? futures.at(-1) : undefined
    setEdition({ index, s: index !== undefined ? futures[index] : { debut: precedente ? decalerJour(precedente.debut, 7) : lundiProchain, semaineType: (precedente ?? prog).semaineType, maxSemaineMin: precedente?.maxSemaineMin ?? prog.maxSemaineMin, maxLongMin: precedente?.maxLongMin ?? prog.maxLongMin } })
  }
  const enregistrer = async () => {
    if (!edition) return
    const s = { ...edition.s, debut: lundiDe(edition.s.debut) }
    const autres = futures.filter((_, i) => i !== edition.index && futures[i].debut !== s.debut)
    await onChanger([...autres, s].sort((a, b) => a.debut.localeCompare(b.debut)))
    setEdition(undefined)
  }

  return (
    <div className="mt-3 border-t border-bordure pt-3">
      <p className="text-[13px] font-semibold text-texte-2">Plus tard</p>
      <p className="mt-0.5 text-xs text-texte-3">Plus de jours ou plus de temps à partir d'une date (déménagement, fin d'examen) : ta charge pourra continuer de monter.</p>
      {futures.map((f, i) => (
        <div key={f.debut} className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">À partir du {jourLong(f.debut)}</span>
            <span className="block text-texte-2">{nbVelos(f.semaineType)} vélos · semaine {f.maxSemaineMin ?? prog.maxSemaineMin} min · longue {Math.round(((f.maxLongMin ?? prog.maxLongMin) / 60) * 10) / 10} h</span>
          </span>
          <button type="button" onClick={() => ouvrir(i)} className="shrink-0 text-sm font-semibold text-accent">Modifier</button>
        </div>
      ))}
      <button type="button" onClick={() => ouvrir()} className="mt-2 w-full py-2 text-left text-sm font-semibold text-accent">+ Une semaine type à partir d'une date</button>

      {edition && (
        <Feuille titre="Semaine type à partir du…" onFermer={() => setEdition(undefined)}>
          <label className="block text-sm text-texte-2">
            Date (la semaine de ce jour)
            <input type="date" min={lundiProchain} value={edition.s.debut} onChange={(e) => e.target.value && setEdition({ ...edition, s: { ...edition.s, debut: e.target.value } })}
              className="mt-1 h-12 w-full rounded-xl border border-bordure bg-surface-2 px-3 text-texte" />
          </label>
          <div className="mt-3">
            <EditeurSemaine semaine={edition.s.semaineType} onChanger={(semaineType) => setEdition({ ...edition, s: { ...edition.s, semaineType } })} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-texte-2">Vélo en semaine, au plus</span>
            <Defileur etiquette="Vélo en semaine" options={DUREES_SEMAINE} valeur={edition.s.maxSemaineMin} onChoisir={(maxSemaineMin) => setEdition({ ...edition, s: { ...edition.s, maxSemaineMin } })} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-texte-2">Sortie longue, au plus</span>
            <Defileur etiquette="Sortie longue" options={DUREES_LONGUE} valeur={edition.s.maxLongMin} onChoisir={(maxLongMin) => setEdition({ ...edition, s: { ...edition.s, maxLongMin } })} />
          </div>
          <Bouton className="mt-4" disabled={!verifierSemaineType(edition.s.semaineType).ok} onClick={enregistrer}>Enregistrer</Bouton>
          {edition.index !== undefined && (
            <button type="button" className="mt-1 w-full py-2 text-sm text-mauvais" onClick={async () => {
              await onChanger(futures.filter((_, i) => i !== edition.index))
              setEdition(undefined)
            }}>Supprimer</button>
          )}
        </Feuille>
      )}
    </div>
  )
}
