import { useState } from 'react'
import { aujourdhui, depuisJour } from '../../../core/dates'
import { formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { Puces } from '../../../core/ui/Puces'
import { AIDES } from '../aides'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import type { TestPhysio } from '../types'

const CHARGES = ['trimp', 'srpe'] as const
const MODELES = ['polarise', 'pyramidal'] as const

/** Paramètres d'analyse : charge de référence, distribution visée, seuil course, historique des tests. */
export function SectionAnalyse() {
  const [r, modifier] = useReglagesEntrainement()
  const [nouveau, setNouveau] = useState<Partial<TestPhysio>>({ type: 'vma' })

  return (
    <Carte titre="Analyse">
      <div className="py-2">
        <p className="mb-2 text-texte-2">Charge de référence<Aide titre="Charge de référence" texte={`${AIDES.trimp} — ${AIDES.srpe}`} /></p>
        <Puces options={CHARGES} valeur={r.chargeRef} effacable={false} libelle={(o) => (o === 'trimp' ? 'TRIMP (FC)' : 'sRPE (ressenti)')}
          onChoisir={(chargeRef) => chargeRef && modifier({ chargeRef })} />
      </div>
      <div className="py-2">
        <p className="mb-2 text-texte-2">Distribution visée<Aide titre="Distribution" texte="Polarisé : ~80 % basse, ~0-5 % moyenne, ~15-20 % haute. Pyramidal : ~75-80 % basse, ~15 % moyenne, ~5 % haute (Seiler ; Casado et al., 2023). Ton PDF : polarisé au palier Apprenti, pyramidal au palier Avancé." /></p>
        <Puces options={MODELES} valeur={r.modeleCible} effacable={false} libelle={(o) => (o === 'polarise' ? 'Polarisé' : 'Pyramidal')}
          onChoisir={(modeleCible) => modeleCible && modifier({ modeleCible })} />
      </div>

      <div className="mt-3 border-t border-bordure pt-3">
        <p className="mb-2 text-sm font-semibold">Historique des tests</p>
        {[...r.tests].sort((a, b) => b.date.localeCompare(a.date)).map((t, i) => (
          <div key={i} className="flex items-center justify-between py-1 text-sm">
            <span className="text-texte-2">{depuisJour(t.date).toLocaleDateString('fr-FR')}</span>
            <span className="font-semibold">{t.type === 'vma' ? `VMA ${formatNombre(t.valeur, 1)} km/h` : `CP ${t.valeur} W`}</span>
            <button type="button" className="px-2 text-texte-3" aria-label="Supprimer ce test"
              onClick={() => modifier({ tests: r.tests.filter((x) => x !== t) })}>×</button>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <select value={nouveau.type} onChange={(e) => setNouveau({ ...nouveau, type: e.target.value as TestPhysio['type'] })}
            className="rounded-lg border border-bordure bg-surface-2 px-2 py-2">
            <option value="vma">VMA</option>
            <option value="cp">CP</option>
          </select>
          <input inputMode="decimal" placeholder={nouveau.type === 'vma' ? 'km/h' : 'W'} value={nouveau.valeur ?? ''}
            onChange={(e) => setNouveau({ ...nouveau, valeur: Number(e.target.value.replace(',', '.')) || undefined })}
            className="w-20 rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-right" />
          <button type="button" disabled={!nouveau.valeur}
            className="flex-1 rounded-lg bg-accent py-2 font-semibold text-fond disabled:opacity-40"
            onClick={() => {
              const test = { date: aujourdhui(), type: nouveau.type!, valeur: nouveau.valeur! }
              // Le dernier test devient la valeur de référence
              modifier({ tests: [...r.tests, test], ...(test.type === 'vma' ? { vmaKmh: test.valeur } : { cpW: test.valeur }) })
              setNouveau({ type: nouveau.type })
            }}>
            + Ajouter
          </button>
        </div>
        <p className="mt-1 text-xs text-texte-3">Le test ajouté met à jour ta VMA ou ta CP de référence.</p>
      </div>
    </Carte>
  )
}
