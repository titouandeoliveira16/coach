import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../../core/db'
import { aujourdhui } from '../../../core/dates'
import { formatMinSec, formatNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ChampDuree } from '../../../core/ui/ChampDuree'
import { ChampNombre } from '../../../core/ui/ChampNombre'
import { ChoixNote } from '../../../core/ui/ChoixNote'
import { Puces } from '../../../core/ui/Puces'
import { srpe } from '../../../metrics/charge'
import { allureSecKm, pctVma, vitesseKmh } from '../../../metrics/course'
import { AIDES } from '../aides'
import { importerFit } from '../import/fit'
import { TYPES_SEANCE, type Seance, type Sport } from '../types'
import { chargerContexte, completerMetriques, derniereSeance, enregistrerSeance, nouvelId, supprimerSeance, trouverDoublon } from './donnees'

/** Échelle CR-10 de Borg modifiée par Foster. */
const LIBELLES_RPE: Record<number, string> = {
  0: 'Repos', 1: 'Très, très facile', 2: 'Facile', 3: 'Modéré', 4: 'Un peu dur', 5: 'Dur',
  6: 'Dur +', 7: 'Très dur', 8: 'Très dur +', 9: 'Presque maximal', 10: 'Maximal',
}

const vide = (sport: Sport): Seance => ({ id: nouvelId(), date: aujourdhui(), sport, dureeSec: 0, source: 'manuel' })

/**
 * Saisie (ou modification) d'une séance. Objectif : moins de 30 secondes.
 * Peut être pré-remplie : duplication, fichier .FIT, séance prévue (via l'état de navigation).
 */
export function FormulaireSeance() {
  const { id } = useParams()
  const navigate = useNavigate()
  const etat = useLocation().state as { seance?: Seance } | null
  const existante = useLiveQuery(() => (id && id !== 'nouvelle' ? db.seances.get(id) : undefined), [id])
  const contexte = useLiveQuery(chargerContexte)
  const [s, setS] = useState<Seance>(etat?.seance ?? vide('velo'))
  const [message, setMessage] = useState<string>()
  const [chargeFichier, setChargeFichier] = useState(false)
  const champFit = useRef<HTMLInputElement>(null)
  const edition = id !== 'nouvelle'

  useEffect(() => {
    if (existante) setS(existante)
  }, [existante])

  const changer = (c: Partial<Seance>) => setS((x) => ({ ...x, ...c }))
  const apercu = contexte ? completerMetriques(s, contexte) : s
  const min = s.dureeSec / 60

  const dupliquer = async () => {
    const d = await derniereSeance(s.sport)
    if (!d) return setMessage(`Aucune séance de ${s.sport === 'velo' ? 'vélo' : 'course'} à dupliquer.`)
    const { id: _id, debut: _debut, stravaId: _strava, prevueId: _prevue, notes: _notes, ...reste } = d
    setS({ ...reste, id: nouvelId(), date: aujourdhui(), source: 'manuel', trimpFlux: false, tempsZones: undefined, decouplage: undefined })
    setMessage('Dernière séance copiée : ajuste ce qui a changé.')
  }

  const importer = async (fichier?: File) => {
    if (!fichier) return
    setChargeFichier(true)
    setMessage(undefined)
    try {
      const importee = await importerFit(fichier, contexte!)
      const doublon = await trouverDoublon(importee)
      setS({ ...importee, id: doublon?.id ?? importee.id, rpe: doublon?.rpe, sensations: doublon?.sensations, notes: doublon?.notes, type: doublon?.type ?? importee.type })
      setMessage(doublon ? 'Cette séance existait déjà : elle sera complétée avec les données du fichier.' : 'Fichier lu ✓ Ajoute ton RPE et tes sensations.')
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setChargeFichier(false)
    }
  }

  const valider = async () => {
    if (!s.dureeSec) return setMessage('Indique au moins la durée.')
    await enregistrerSeance(s)
    navigate('/entrainement/historique', { replace: true, state: { enregistree: s.id } })
  }

  return (
    <div className="pt-sur px-4 pb-8">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="py-2 pr-4 text-accent">‹ Retour</button>
        <h1 className="text-xl font-bold">{edition ? 'Modifier la séance' : 'Nouvelle séance'}</h1>
        <span className="w-16" />
      </div>

      <div className="space-y-3">
        {/* ① Sport */}
        <div className="grid grid-cols-2 gap-3">
          {(['velo', 'course'] as Sport[]).map((sp) => (
            <button key={sp} type="button" onClick={() => changer({ sport: sp })}
              className={`rounded-2xl border py-4 text-lg font-bold ${s.sport === sp ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface text-texte-2'}`}>
              {sp === 'velo' ? '🚴 Vélo' : '🏃 Course'}
            </button>
          ))}
        </div>

        {!edition && (
          <div className="grid grid-cols-2 gap-2">
            <Bouton variante="secondaire" onClick={dupliquer} className="text-sm">⧉ Dupliquer la dernière</Bouton>
            <Bouton variante="secondaire" onClick={() => champFit.current?.click()} disabled={chargeFichier || !contexte} className="text-sm">
              {chargeFichier ? 'Lecture…' : '📄 Importer un .FIT'}
            </Bouton>
            {/* Pas de filtre de type : iOS grise parfois les .fit */}
            <input ref={champFit} type="file" className="hidden" onChange={(e) => { importer(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        )}
        {!edition && (
          <button type="button" onClick={() => navigate('/entrainement/aide-fit')} className="text-sm text-texte-3 underline">
            Comment récupérer mon fichier .FIT ?
          </button>
        )}
        {message && <p className="text-sm text-texte-2">{message}</p>}

        {/* ② Champs communs */}
        <Carte>
          <label className="flex items-center justify-between py-1.5">
            <span className="text-texte-2">Date</span>
            <input type="date" value={s.date} max={aujourdhui()} onChange={(e) => changer({ date: e.target.value })}
              className="rounded-lg border border-bordure bg-surface-2 px-3 py-2 font-semibold outline-none" />
          </label>
          <ChampDuree libelle="Durée" valeurSec={s.dureeSec || undefined} onChanger={(dureeSec) => changer({ dureeSec })} />
          <div className="py-2">
            <p className="mb-2 text-texte-2">Type</p>
            <Puces options={TYPES_SEANCE} valeur={s.type} onChoisir={(type) => changer({ type })} />
          </div>
        </Carte>

        {/* ③ Spécifique au sport */}
        <Carte titre={s.sport === 'velo' ? 'Vélo' : 'Course'}>
          {s.sport === 'velo' && (
            <label className="flex items-center justify-between py-2">
              <span className="text-texte-2">Home trainer</span>
              <input type="checkbox" checked={!!s.homeTrainer} onChange={(e) => changer({ homeTrainer: e.target.checked })} className="h-6 w-6 accent-[var(--color-accent)]" />
            </label>
          )}
          <ChampNombre libelle="Distance" unite="km" valeur={s.distanceKm} onValider={(distanceKm) => changer({ distanceKm })} />
          <ChampNombre libelle="Dénivelé +" unite="m" decimales={0} valeur={s.deniveleM} onValider={(deniveleM) => changer({ deniveleM })} />
          {s.sport === 'velo' ? (
            <>
              <ChampNombre libelle="Puissance moy." unite="W" decimales={0} valeur={s.puissanceMoyW} onValider={(puissanceMoyW) => changer({ puissanceMoyW, kj: undefined })} />
              <ChampNombre libelle="Travail" unite="kJ" decimales={0} valeur={s.kj ?? apercu.kj} onValider={(kj) => changer({ kj })} />
              {s.distanceKm && s.dureeSec > 0 && (
                <Ligne libelle="Vitesse moyenne" valeur={`${formatNombre(vitesseKmh(s.distanceKm, s.dureeSec), 1)} km/h`} />
              )}
            </>
          ) : (
            s.distanceKm && s.dureeSec > 0 && contexte?.vmaKmh && (
              <Ligne libelle="Allure" aide={AIDES.allure}
                valeur={`${formatMinSec(allureSecKm(s.distanceKm, s.dureeSec))}/km · ${Math.round(pctVma(vitesseKmh(s.distanceKm, s.dureeSec), contexte.vmaKmh))} % VMA`} />
            )
          )}
          <ChampNombre libelle="FC moyenne" unite="bpm" decimales={0} valeur={s.fcMoy} onValider={(fcMoy) => changer({ fcMoy, trimpFlux: s.trimpFlux && fcMoy === s.fcMoy })} />
          <ChampNombre libelle="FC max" unite="bpm" decimales={0} valeur={s.fcMax} onValider={(fcMax) => changer({ fcMax })} />
        </Carte>

        {/* ④ Ressenti */}
        <Carte titre="Ressenti">
          <div className="py-1">
            <div className="flex items-baseline justify-between">
              <span className="text-texte-2">RPE (0-10)<Aide titre="RPE" texte={AIDES.rpeRegle} /></span>
              <span className="text-2xl font-bold">{s.rpe !== undefined ? formatNombre(s.rpe, 1) : '–'}</span>
            </div>
            <input type="range" min={0} max={10} step={0.5} value={s.rpe ?? 5} aria-label="RPE"
              onChange={(e) => changer({ rpe: Number(e.target.value) })}
              // Toucher le curseur sans le déplacer (ex. RPE 5) valide aussi la valeur
              onPointerUp={(e) => changer({ rpe: Number(e.currentTarget.value) })}
              className="mt-2 w-full accent-[var(--color-accent)]" />
            <p className="text-sm text-texte-3">
              {s.rpe !== undefined ? LIBELLES_RPE[Math.floor(s.rpe)] : 'Fais glisser pour noter la difficulté globale'}
              {s.rpe !== undefined && s.rpe < 3 && <span className="ml-2 font-semibold text-nutrition">kJ faciles</span>}
              {s.rpe !== undefined && s.rpe >= 7.5 && <span className="ml-2 font-semibold text-[#f87171]">stress</span>}
            </p>
          </div>
          <ChoixNote libelle="Sensations" bornes={['Mauvaises', 'Excellentes']} valeur={s.sensations} onChoisir={(sensations) => changer({ sensations })} />
          <textarea placeholder="Notes (facultatif)" value={s.notes ?? ''} onChange={(e) => changer({ notes: e.target.value || undefined })} rows={2}
            className="mt-2 w-full rounded-xl border border-bordure bg-surface-2 p-3 outline-none focus:border-accent" />
        </Carte>

        {/* Aperçu des charges */}
        {min > 0 && (
          <Carte titre="Charge de la séance">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Chiffre libelle="sRPE" aide={AIDES.srpe} valeur={s.rpe !== undefined ? Math.round(srpe(s.rpe, min)) : undefined} />
              <Chiffre libelle={apercu.trimpFlux ? 'TRIMP' : 'TRIMP est.'} aide={AIDES.trimp} valeur={apercu.trimp !== undefined ? Math.round(apercu.trimp) : undefined} />
              <Chiffre libelle={s.sport === 'velo' ? 'TSS' : 'rTSS'} aide={s.sport === 'velo' ? AIDES.tss : AIDES.rtss} valeur={apercu.tss !== undefined ? Math.round(apercu.tss) : undefined} />
            </div>
            {apercu.decouplage !== undefined && <Ligne libelle="Découplage cardiaque" aide={AIDES.decouplage} valeur={`${formatNombre(apercu.decouplage, 1)} %`} />}
            {apercu.puissanceNormW !== undefined && <Ligne libelle="Puissance normalisée" aide={AIDES.np} valeur={`${Math.round(apercu.puissanceNormW)} W`} />}
          </Carte>
        )}

        <Bouton onClick={valider} className="py-4 text-lg">Enregistrer</Bouton>
        {edition && (
          <button type="button" className="w-full py-3 text-[#f87171]"
            onClick={async () => { if (confirm('Supprimer cette séance ?')) { await supprimerSeance(s.id); navigate(-1) } }}>
            Supprimer la séance
          </button>
        )}
      </div>
    </div>
  )
}

function Ligne({ libelle, valeur, aide }: { libelle: string; valeur: string; aide?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-texte-2">{libelle}{aide && <Aide titre={libelle} texte={aide} />}</span>
      <span className="font-semibold">{valeur}</span>
    </div>
  )
}

function Chiffre({ libelle, valeur, aide }: { libelle: string; valeur?: number; aide: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className="text-xs text-texte-3">{libelle}<Aide titre={libelle} texte={aide} /></p>
      <p className="text-2xl font-bold tabular-nums">{valeur ?? '–'}</p>
    </div>
  )
}
