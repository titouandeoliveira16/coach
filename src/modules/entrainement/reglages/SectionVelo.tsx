import { useState } from 'react'
import { zonesDepuisCp } from '../../../core/zones'
import { aujourdhui } from '../../../core/dates'
import { Feuille } from '../../../core/ui/Feuille'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { formatNombre } from '../../../core/format'
import { useProfil } from '../../../core/profil'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'
import type { Role } from '../../../metrics/programme'
import { CalculateurCP } from './CalculateurCP'
import { poidsAu } from '../forme/pesees'
import { recalculerApresTest } from '../plan/programme'

const ROLES: { role: Role; nom: string; icone: string; court?: string }[] = [
  { role: 'course', nom: 'Course', icone: '🏃' },
  { role: 'velo-dur', nom: 'Vélo intensité', icone: '🚴', court: 'dur' },
  { role: 'velo-z2', nom: 'Vélo Z2', icone: '🚴', court: 'Z2' },
  { role: 'velo-long', nom: 'Vélo long', icone: '🚴', court: 'long' },
  { role: 'renfo', nom: 'Renfo', icone: '🏋️' },
  { role: 'libre', nom: 'Libre / repos', icone: '·' },
]
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Vélo : ta CP (modifiable, même si les tests la mettent à jour) et ta semaine type en 7 cases. */
export function SectionVelo() {
  const [reglages, modifier] = useReglagesEntrainement()
  const [profil] = useProfil()
  const [cpOuvert, setCpOuvert] = useState(false)
  const [calculateur, setCalculateur] = useState(false)
  const [message, setMessage] = useState<string>()
  const [jour, setJour] = useState<number>()
  const prog = programmeDe(reglages.programme)
  const wkg = reglages.cpW && profil.poidsKg ? reglages.cpW / profil.poidsKg : undefined

  return (
    <section className={`rounded-2xl border bg-surface p-3.5 ${cpOuvert ? 'border-accent' : 'border-bordure'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-texte-3">Vélo</span>
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

      <p className="mt-3 text-xs text-texte-3">Ma semaine type : l'appli place le vélo sur ces jours. Touche un jour pour le changer.</p>
      <div className="mt-1.5 grid grid-cols-7 gap-1 text-center">
        {prog.semaineType.map((role, i) => {
          const x = ROLES.find((y) => y.role === role) ?? ROLES[5]
          return (
            <button key={i} type="button" onClick={() => setJour(i)}
              className={`rounded-lg py-1.5 text-[11px] ${role === 'velo-dur' ? 'bg-accent/20' : 'bg-surface-2'}`}>
              <span className="block text-texte-3">{JOURS[i][0]}</span>
              <span className="block text-base leading-tight">{x.icone}</span>
              {x.court && <span className={`block ${role === 'velo-dur' ? 'text-accent' : 'text-texte-2'}`}>{x.court}</span>}
            </button>
          )
        })}
      </div>
      {jour !== undefined && (
        <Feuille titre={JOURS[jour]} onFermer={() => setJour(undefined)}>
          <div className="space-y-2">
            {ROLES.map((x) => (
              <button key={x.role} type="button"
                onClick={() => { modifier({ programme: { ...prog, semaineType: prog.semaineType.map((r, k) => (k === jour ? x.role : r)) } }); setJour(undefined) }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${prog.semaineType[jour] === x.role ? 'border-accent text-accent' : 'border-bordure'}`}>
                <span className="text-lg">{x.icone}</span><span className="font-semibold">{x.nom}</span>
              </button>
            ))}
          </div>
        </Feuille>
      )}
    </section>
  )
}
