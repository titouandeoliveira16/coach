import { useState } from 'react'
import { aPlat, COULEUR_PREUVE, couleurZone, type Etape, type SeanceCatalogue } from './donnees'

/** Profil de la séance : une barre par étape, hauteur = intensité, couleur = zone (comme un écran de home trainer). */
export function Profil({ s }: { s: SeanceCatalogue }) {
  if (!s.deroule) return null
  const etapes = aPlat(s.deroule)
  const total = etapes.reduce((t, e) => t + (e.duree ?? 0), 0)
  const hMax = s.unite === '%VMA' ? 130 : 160
  const largeurs = etapes.map((e) => ((e.duree ?? 0) / total) * 1000)
  const departs = largeurs.map((_, i) => largeurs.slice(0, i).reduce((a, w) => a + w, 0))
  return (
    <svg viewBox="0 0 1000 56" preserveAspectRatio="none" className="mt-2 block h-12 w-full" aria-hidden>
      {etapes.map((e, i) => {
        const h = Math.min(1, (e.max ? hMax : Math.max(e.intensite?.[1] ?? 0, 30)) / hMax) * 52 + 4
        return <rect key={i} x={departs[i]} y={56 - h} width={Math.max(largeurs[i] - 0.6, 0.6)} height={h} fill={couleurZone(e, s.unite)} />
      })}
    </svg>
  )
}

function texteEtape(e: Etape, unite?: string) {
  const d = (e.duree ?? 0) >= 60 ? `${String(+((e.duree ?? 0) / 60).toFixed(1)).replace('.', ',')} min` : `${e.duree} s`
  const nom = { echauffement: 'Échauffement', effort: 'Effort', recup: 'Récup', retour: 'Retour au calme', repetition: '' }[e.type]
  const i = e.max ? 'à fond' : e.intensite![0] === e.intensite![1] ? `${e.intensite![0]} ${unite}` : `${e.intensite![0]}-${e.intensite![1]} ${unite}`
  return `${nom} ${d} · ${i}${e.cadence ? ` · ${e.cadence} tr/min` : ''}${e.note ? ` (${e.note})` : ''}`
}

function Etapes({ etapes, unite }: { etapes: Etape[]; unite?: string }) {
  return (
    <ul className="space-y-0.5 pl-3 text-xs tabular-nums text-texte">
      {etapes.map((e, i) => e.type === 'repetition'
        ? <li key={i}>{e.fois} × :<Etapes etapes={e.etapes ?? []} unite={unite} /></li>
        : <li key={i}>{texteEtape(e, unite)}</li>)}
    </ul>
  )
}

const Titre = ({ children }: { children: string }) => <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-texte-3">{children}</p>

/** Une séance : résumé et profil, détail au toucher. */
export function Fiche({ s }: { s: SeanceCatalogue }) {
  const [ouverte, setOuverte] = useState(false)
  const p = s.preuve
  const meta = [s.zone !== '—' && s.zone, s.rpe !== '—' && `RPE ${s.rpe}`, s.dureeMin && `${s.dureeMin} min`, s.travailMin ? `${String(s.travailMin).replace('.', ',')} min de qualité` : '']
    .filter(Boolean).join(' · ')
  return (
    <div className="rounded-2xl border border-bordure bg-surface">
      <button type="button" onClick={() => setOuverte(!ouverte)} className="w-full p-3.5 text-left">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{s.nom}</span>
          <span className="shrink-0 rounded border px-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: COULEUR_PREUVE[p.niveau], borderColor: COULEUR_PREUVE[p.niveau] }}>{p.niveau}</span>
        </span>
        <Profil s={s} />
        <span className="mt-1.5 block text-sm text-texte-2">{s.resume}</span>
        {meta && <span className="mt-1 block text-xs text-texte-3">{meta}</span>}
      </button>
      {ouverte && (
        <div className="border-t border-dashed border-bordure px-3.5 pb-3.5 text-sm text-texte-2">
          <Titre>Ce que ça travaille</Titre>
          <p>{s.objectif}</p>
          {s.deroule && <><Titre>{`Déroulé (${s.unite})`}</Titre><Etapes etapes={s.deroule} unite={s.unite} /></>}
          {s.exercices && (
            <>
              <Titre>Exercices</Titre>
              <ul className="list-disc space-y-0.5 pl-4">
                {s.exercices.map((x) => <li key={x.nom}>{x.nom} : {x.series} × {x.reps}{x.repos ? `, repos ${x.repos >= 60 ? `${x.repos / 60} min` : `${x.repos} s`}` : ''}</li>)}
              </ul>
            </>
          )}
          {s.variantes.length > 0 && <><Titre>Variantes et progression</Titre><ul className="list-disc space-y-0.5 pl-4">{s.variantes.map((v) => <li key={v}>{v}</li>)}</ul></>}
          <Titre>Quand</Titre>
          <ul className="list-disc space-y-0.5 pl-4">
            {s.quand.phases.length > 0 && <li>Phases : {s.quand.phases.join(', ')}</li>}
            {s.quand.parSemaine && <li>Fréquence : {s.quand.parSemaine} par semaine</li>}
            {s.quand.recuperation && <li>Récupération : {s.quand.recuperation}</li>}
          </ul>
          {s.conseils.length > 0 && <><Titre>Conseils</Titre><ul className="list-disc space-y-0.5 pl-4">{s.conseils.map((c) => <li key={c}>{c}</li>)}</ul></>}
          <Titre>Ce que dit la science</Titre>
          <p>{p.resultat}</p>
          <ul className="mt-1 space-y-1 text-xs">
            {p.references.map((r) => (
              <li key={r.auteurs + r.annee}>
                {r.auteurs} ({r.annee}). <i className="text-texte">{r.titre}</i>. {r.revue}.
                {r.pmid && <> <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer" className="text-accent underline">PubMed</a></>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
