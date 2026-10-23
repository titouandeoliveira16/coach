import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CalculateurCP } from './CalculateurCP'
import { JoursVelo } from './SectionProgramme'

/** Réglages vélo : CP, calculateur de test et semaine type. */
export function SectionVelo() {
  const [reglages, modifier] = useReglagesEntrainement()
  const [profil] = useProfil()
  const [calculateur, setCalculateur] = useState(false)

  const wkg = reglages.cpW && profil.poidsKg ? reglages.cpW / profil.poidsKg : undefined

  return (
    <Carte titre="Vélo">
      <ChampNombre libelle="CP" unite="W" decimales={0} valeur={reglages.cpW} onValider={(v) => modifier({ cpW: v })} />
      {wkg && (
        <p className="py-1.5 text-right text-sm text-texte-2">
          soit <span className="font-semibold text-texte">{formatNombre(wkg, 2)} W/kg</span>
        </p>
      )}

      <button
        type="button"
        onClick={() => setCalculateur(!calculateur)}
        className="mt-1 w-full py-2 text-left text-sm font-semibold text-accent"
      >
        {calculateur ? '× Fermer le calculateur' : '+ Calculer depuis mon test 12-7-3'}
      </button>
      {calculateur && (
        <CalculateurCP
          onUtiliser={(cpW, wPrimeKj) => {
            modifier({ cpW, wPrimeKj, tests: [...reglages.tests, { date: aujourdhui(), type: 'cp', valeur: cpW }] })
            setCalculateur(false)
          }}
        />
      )}

      <JoursVelo />
    </Carte>
  )
}
