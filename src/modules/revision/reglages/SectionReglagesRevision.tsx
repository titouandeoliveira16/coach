import { useState } from 'react'
import { decalerJour, depuisJour, NOMS_JOURS } from '../../../core/dates'
import { Carte } from '../../../core/ui/Carte'
import { useParametres } from '../donnees'
import { PARAMETRES_DEFAUT, creneauxDu, enVacances, type Capacites, type Creneau, type Parametres } from '../programme'
import { LIBELLES_CRENEAUX } from '../ui'

const champ = 'rounded-lg border border-bordure bg-surface-2 px-2 py-2 outline-none focus:border-accent'
const ORDRE = [1, 2, 3, 4, 5, 6, 0] // lundi → dimanche
const NOMS_CAPACITES: [keyof Parametres['capacites'], string][] = [
  ['vacances', 'Vacances (apprentissage)'], ['cours', 'Cours (apprentissage)'], ['sujets', 'Phase sujets'], ['sujets-vacances', 'Sujets, vacances de Noël'],
]
const TYPES: Creneau['type'][] = ['rappels', 'stage', 'internat', 'fixation', 'relecture', 'libre']

/** Réglages du module Révision : dates, capacités de rappels, créneaux du nouveau stage. */
export function SectionReglagesRevision() {
  const [p, modifier] = useParametres()
  const [ouvert, setOuvert] = useState<'dates' | 'capacites' | 'stage'>()
  const bascule = (s: typeof ouvert) => setOuvert(ouvert === s ? undefined : s)

  return (
    <>
      <Carte titre="Révision CAPEPS">
        <Titre ouvert={ouvert === 'dates'} onClick={() => bascule('dates')}>Dates (concours, vacances, phases)</Titre>
        {ouvert === 'dates' && <Dates p={p} modifier={modifier} />}
        <Titre ouvert={ouvert === 'capacites'} onClick={() => bascule('capacites')}>Temps de rappels par jour</Titre>
        {ouvert === 'capacites' && <TableCapacites p={p} modifier={modifier} />}
        <Titre ouvert={ouvert === 'stage'} onClick={() => bascule('stage')}>Nouveau stage (après-midis et soirées)</Titre>
        {ouvert === 'stage' && <NouveauStage p={p} modifier={modifier} />}
      </Carte>
    </>
  )
}

function Titre({ ouvert, onClick, children }: { ouvert: boolean; onClick: () => void; children: string }) {
  return <button type="button" onClick={onClick} className="w-full py-2.5 text-left font-semibold">{ouvert ? '▾' : '▸'} {children}</button>
}

type Props = { p: Parametres; modifier: (c: Partial<Parametres>) => void }

function LigneDate({ libelle, valeur, onChanger }: { libelle: string; valeur: string; onChanger: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm text-texte-2">{libelle}</span>
      <input type="date" value={valeur} onChange={(e) => e.target.value && onChanger(e.target.value)} className={champ} />
    </label>
  )
}

function Dates({ p, modifier }: Props) {
  return (
    <div className="space-y-1 pb-3">
      <LigneDate libelle="Écrit 1 (l'écrit 2 le lendemain)" valeur={p.concours} onChanger={(v) => modifier({ concours: v, veille: decalerJour(v, -1) })} />
      <LigneDate libelle="Début de la phase sujets" valeur={p.debutSujets} onChanger={(v) => modifier({ debutSujets: v })} />
      <LigneDate libelle="Dernière ligne droite" valeur={p.derniereLigne} onChanger={(v) => modifier({ derniereLigne: v })} />
      <LigneDate libelle="Changement de stage" valeur={p.changementStage} onChanger={(v) => modifier({ changementStage: v })} />
      <LigneDate libelle="Envoi du mémoire au tuteur" valeur={p.memoireEnvoi} onChanger={(v) => modifier({ memoireEnvoi: v })} />
      <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-texte-3">Vacances</p>
      {p.vacances.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5 py-1">
          <input value={v.nom} onChange={(e) => modifier({ vacances: p.vacances.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)) })} className={`${champ} w-20 min-w-0`} />
          <input type="date" value={v.debut} onChange={(e) => e.target.value && modifier({ vacances: p.vacances.map((x, k) => (k === i ? { ...x, debut: e.target.value } : x)) })} className={`${champ} min-w-0 flex-1`} />
          <input type="date" value={v.fin} onChange={(e) => e.target.value && modifier({ vacances: p.vacances.map((x, k) => (k === i ? { ...x, fin: e.target.value } : x)) })} className={`${champ} min-w-0 flex-1`} />
          <button type="button" aria-label="Retirer" onClick={() => modifier({ vacances: p.vacances.filter((_, k) => k !== i) })} className="px-1 text-texte-3">×</button>
        </div>
      ))}
      <button type="button" onClick={() => modifier({ vacances: [...p.vacances, { nom: 'Hiver', debut: '2027-02-06', fin: '2027-02-21' }] })} className="text-sm font-semibold text-accent">+ Ajouter des vacances</button>
      <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-texte-3">Jours de repos</p>
      <p className="text-sm text-texte-2">{p.repos.map((r) => depuisJour(r).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })).join(' · ')}</p>
      <button type="button" onClick={() => modifier(PARAMETRES_DEFAUT)} className="mt-2 text-xs text-texte-3 underline">Revenir aux dates de départ</button>
    </div>
  )
}

function TableCapacites({ p, modifier }: Props) {
  return (
    <div className="pb-3">
      <p className="mb-2 text-xs text-texte-3">Minutes de rappels possibles chaque jour. Au-delà, les rappels glissent au lendemain.</p>
      <div className="grid grid-cols-[auto_repeat(7,1fr)] items-center gap-1 text-center text-xs">
        <span />
        {ORDRE.map((j) => <span key={j} className="text-texte-3">{NOMS_JOURS[j].slice(0, 3)}</span>)}
        {NOMS_CAPACITES.map(([cle, nom]) => (
          <Ligne key={cle} nom={nom} valeurs={p.capacites[cle]} onChanger={(v) => modifier({ capacites: { ...p.capacites, [cle]: v } })} />
        ))}
      </div>
      <p className="mt-2 text-xs text-texte-3">Fixes : dernière semaine (jeu-ven 240, sam 120, dim 0), veille 60, repos et concours 0.</p>
    </div>
  )
}

function Ligne({ nom, valeurs, onChanger }: { nom: string; valeurs: Capacites; onChanger: (v: Capacites) => void }) {
  return (
    <>
      <span className="pr-1 text-left text-texte-2">{nom}</span>
      {ORDRE.map((j) => (
        <input key={j} inputMode="numeric" defaultValue={valeurs[j]} className="w-full rounded bg-surface-2 py-1.5 text-center"
          onBlur={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n) && n !== valeurs[j]) onChanger(valeurs.map((v, k) => (k === j ? n : v)) as Capacites)
          }} />
      ))}
    </>
  )
}

/** Exemple de jour (hors vacances, après le changement de stage) pour un jour de la semaine. */
function jourType(p: Parametres, js: number) {
  let d = p.changementStage
  for (let i = 0; i < 60 && (depuisJour(d).getDay() !== js || enVacances(d, p)); i++) d = decalerJour(d, 1)
  return d
}

function NouveauStage({ p, modifier }: Props) {
  const [js, setJs] = useState(1)
  const perso = p.apresMidiNouveauStage[js]
  const modele = creneauxDu(jourType(p, js), { ...p, apresMidiNouveauStage: {} }, true).filter((c) => c.debut >= '12:30')
  const liste = perso ?? modele
  const ecrire = (l: Creneau[]) => modifier({ apresMidiNouveauStage: { ...p.apresMidiNouveauStage, [js]: l } })

  return (
    <div className="pb-3">
      <p className="mb-2 text-xs text-texte-3">
        À partir du {depuisJour(p.changementStage).toLocaleDateString('fr-FR')} : redéfinis les après-midis et soirées selon ton nouveau stage. Les matinées ne changent pas.
      </p>
      <div className="mb-2 flex gap-1">
        {ORDRE.map((j) => (
          <button key={j} type="button" onClick={() => setJs(j)} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${js === j ? 'bg-accent text-fond' : 'bg-surface-2 text-texte-2'}`}>
            {NOMS_JOURS[j].slice(0, 3)}{p.apresMidiNouveauStage[j] ? '•' : ''}
          </button>
        ))}
      </div>
      {liste.map((c, i) => (
        <div key={i} className="flex items-center gap-1 py-1">
          <input type="time" value={c.debut} onChange={(e) => ecrire(liste.map((x, k) => (k === i ? { ...x, debut: e.target.value } : x)))} className={`${champ} w-[5.5rem] px-1`} />
          <input type="time" value={c.fin} onChange={(e) => ecrire(liste.map((x, k) => (k === i ? { ...x, fin: e.target.value } : x)))} className={`${champ} w-[5.5rem] px-1`} />
          <select value={TYPES.includes(c.type) ? c.type : 'rappels'} onChange={(e) => ecrire(liste.map((x, k) => (k === i ? { debut: x.debut, fin: x.fin, type: e.target.value as Creneau['type'] } : x)))} className={`${champ} min-w-0 flex-1`}>
            {TYPES.map((t) => <option key={t} value={t}>{LIBELLES_CRENEAUX[t]({ debut: '', fin: '', type: t })}</option>)}
          </select>
          <button type="button" aria-label="Retirer" onClick={() => ecrire(liste.filter((_, k) => k !== i))} className="px-1 text-texte-3">×</button>
        </div>
      ))}
      <div className="mt-1 flex justify-between">
        <button type="button" onClick={() => ecrire([...liste, { debut: '17:00', fin: '18:00', type: 'rappels' }])} className="text-sm font-semibold text-accent">+ Créneau</button>
        {perso && (
          <button type="button" className="text-sm text-texte-3" onClick={() => {
            const { [js]: _retire, ...reste } = p.apresMidiNouveauStage
            modifier({ apresMidiNouveauStage: reste })
          }}>Revenir au modèle</button>
        )}
      </div>
      <p className="mt-2 text-xs text-texte-3">Pense à ajuster aussi le temps de rappels de la phase sujets si ton nouveau stage libère ou prend des après-midis.</p>
    </div>
  )
}
