import { useState } from 'react'
import { zonesDepuisCp } from '../../../core/zones'
import { aujourdhui } from '../../../core/dates'
import { useReglage } from '../../../core/reglages'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import { niveauDuProfil, verifierSemaineType } from '../../../metrics/programme'
import { EditeurSemaine } from './EditeurSemaine'
import { SemainesAVenir } from './SemainesAVenir'
import type { ProfilSportif } from './ProfilSportif'
import { CalculateurCP } from './CalculateurCP'
import { poidsAu } from '../forme/pesees'
import { recalculerApresTest, recalculerSemainesAVenir } from '../plan/programme'


/** Vélo : ta CP (modifiable, même si les tests la mettent à jour) et ta semaine type (‹ › par jour). */
export function SectionVelo() {
  const [reglages, modifier] = useReglagesEntrainement()
  const [profil] = useProfil()
  const [cpOuvert, setCpOuvert] = useState(false)
  const [calculateur, setCalculateur] = useState(false)
  const [message, setMessage] = useState<string>()
  const [ps] = useReglage<ProfilSportif>('profil-sportif', { sports: [], materiel: [] })
  const prog = programmeDe(reglages.programme)
  const wkg = reglages.cpW && profil.poidsKg ? reglages.cpW / profil.poidsKg : undefined

  return (
    <section className={`rounded-2xl border bg-surface p-3.5 ${cpOuvert ? 'border-accent' : 'border-bordure'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-texte-2">Vélo</span>
        <button type="button" onClick={() => setCpOuvert(!cpOuvert)} className="text-sm">
          <span className="text-texte-2">CP</span> <b>{reglages.cpW ?? '—'} W</b>{wkg && <span className="text-texte-3"> · {formatNombre(wkg, 2)} W/kg</span>}
          <span className="font-semibold text-accent"> · {cpOuvert ? 'réduire ▴' : 'modifier'}</span>
        </button>
      </div>
      {cpOuvert && (
        <div className="mt-2">
          <ChampNombre libelle="CP" unite="W" decimales={0} valeur={reglages.cpW} onValider={(v) => modifier({ cpW: v })} />
          <p className="text-xs text-texte-3">Elle se met à jour toute seule après chaque test CP.</p>
          <button type="button" onClick={() => setCalculateur(!calculateur)} className="mt-1 w-full py-2 text-left text-sm font-semibold text-accent">
            {calculateur ? '× Fermer le calculateur' : '+ Calculer depuis mon test'}
          </button>
          {calculateur && (
            <CalculateurCP
              onUtiliser={async (cpW, wPrimeKj, wPrimeComplet) => {
                // Zones de puissance recalculées en % de la nouvelle CP ; les bornes de FC restent
                const zonesVelo = zonesDepuisCp(cpW, reglages.zonesVelo)
                const poidsKg = await poidsAu(aujourdhui())
                await modifier({ cpW, wPrimeKj, wPrimeComplet, zonesVelo, tests: [...reglages.tests, { date: aujourdhui(), type: 'cp', valeur: cpW, poidsKg }] })
                setCalculateur(false)
                await recalculerApresTest()
                setMessage(`CP ${cpW} W enregistrée : zones et watts de tes séances à venir recalculés. Pense à mettre ta FTP Zwift à ${cpW} W (Zwift → Menu → Paramètres → FTP) et à renvoyer tes séances déjà envoyées.`)
              }}
            />
          )}
        </div>
      )}
      {message && <p className="mt-2 text-sm text-nutrition">{message}</p>}

      <p className="mt-3 mb-1 text-xs text-texte-3">Ma semaine type : l'appli place le vélo sur ces jours. Ta semaine en cours se recalcule dès que tu changes quelque chose.</p>
      <EditeurSemaine semaine={prog.semaineType} debutant={niveauDuProfil(ps) === 'debutant'} onChanger={async (semaineType) => {
        await modifier({ programme: { ...prog, semaineType } })
        // Semaine incomplète (ex. sortie longue pas encore placée) : on attend qu'elle soit valide
        if (verifierSemaineType(semaineType).ok) await recalculerSemainesAVenir()
      }} />
      <SemainesAVenir prog={prog} onChanger={async (semainesTypesFutures) => {
        await modifier({ programme: { ...prog, semainesTypesFutures } })
        await recalculerSemainesAVenir()
      }} />
    </section>
  )
}
