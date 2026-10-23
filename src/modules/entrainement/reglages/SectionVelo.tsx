import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { Carte } from '../../../core/ui/Carte'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { useReglagesEntrainement } from '../reglagesEntrainement'
import { CalculateurCP } from './CalculateurCP'
import { poidsAu } from '../forme/pesees'
import { recalculerApresTest } from '../plan/programme'
import { JoursVelo } from './SectionProgramme'

/** Réglages vélo : CP, calculateur de test et semaine type. */
export function SectionVelo() {
  const [reglages, modifier] = useReglagesEntrainement()
  const [profil] = useProfil()
  const [calculateur, setCalculateur] = useState(false)
  const [message, setMessage] = useState<string>()

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
        {calculateur ? '× Fermer le calculateur' : '+ Calculer depuis mon test'}
      </button>
      {calculateur && (
        <CalculateurCP
          onUtiliser={async (cpW, wPrimeKj) => {
            // Zones de puissance recalées sur la nouvelle CP (même % de CP qu'avant)
            const ratio = cpW / (reglages.cpW ?? 260)
            const zonesVelo = reglages.zonesVelo.map((z) => ({ ...z, wMin: Math.round(z.wMin * ratio), wMax: z.wMax && Math.round(z.wMax * ratio) }))
            const poidsKg = await poidsAu(aujourdhui())
            await modifier({ cpW, wPrimeKj, zonesVelo, tests: [...reglages.tests, { date: aujourdhui(), type: 'cp', valeur: cpW, poidsKg }] })
            setCalculateur(false)
            await recalculerApresTest()
            setMessage(`CP ${cpW} W enregistrée : zones et watts de tes séances à venir recalculés.`)
          }}
        />
      )}

      {message && <p className="mt-2 text-sm text-nutrition">{message}</p>}
      <JoursVelo />
    </Carte>
  )
}
