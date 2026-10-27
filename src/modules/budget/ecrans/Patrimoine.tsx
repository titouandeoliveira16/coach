import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { formatDate, formatEuros, lireNombre } from '../../../core/format'
import { Aide } from '../../../core/ui/Aide'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { GraphiqueLignes } from '../../../core/ui/graphiques'
import { ageReleve, dernierReleve, derniersMois, moisCourt, moisDe, patrimoineAu, patrimoineParMois, soldeAu, verseAu, type Donnees } from '../calculs'
import { enregistrerCompte, enregistrerReleve, nouvelId, supprimerReleve, useBudget } from '../donnees'
import type { Compte, TypeCompte } from '../types'
import { ETAT } from '../ui'

const GROUPES: { types: TypeCompte[]; titre: string }[] = [
  { types: ['courant', 'especes'], titre: 'Au quotidien' },
  { types: ['epargne'], titre: 'Épargne disponible' },
  { types: ['investissement'], titre: 'Investissements' },
]
const NOMS_TYPES: Record<TypeCompte, string> = { courant: 'Courant', epargne: 'Épargne disponible', especes: 'Espèces', investissement: 'Investissement' }
const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'
const centimes = (t: string) => Math.round((lireNombre(t) ?? 0) * 100)
const texteEuros = (c: number) => String(c / 100).replace('.', ',')

/** Comptes, épargne de précaution, patrimoine total et son évolution. */
export function Patrimoine() {
  const d = useBudget()
  const [ouvert, setOuvert] = useState<Compte | 'nouveau'>()
  const [archives, setArchives] = useState(false)
  if (!d) return null
  const jour = aujourdhui()
  const total = patrimoineAu(d.comptes, d.mouvements, d.releves, jour)
  const precaution = d.comptes.filter((c) => c.type === 'epargne').reduce((s, c) => s + soldeAu(c, d.mouvements, d.releves, jour), 0)
  const mois = derniersMois(moisDe(jour), 12)
  const serie = patrimoineParMois(d, mois, jour)
  const premier = serie.findIndex((v) => v !== undefined)
  const actifs = d.comptes.filter((c) => !c.archive)

  return (
    <div className="space-y-3 pt-2">
      <Carte>
        <p className="text-sm text-texte-2">Patrimoine total<Aide titre="Patrimoine" texte="Somme de tous tes comptes : solde calculé pour le courant, les livrets et les espèces ; dernière valeur connue (relevé + versements depuis) pour les investissements." /></p>
        <p className="text-5xl font-bold tabular-nums">{formatEuros(total, { ronds: true })}</p>
        {premier >= 0 && mois.length - premier >= 2 && (
          <div className="mt-3">
            <GraphiqueLignes etiquettes={mois.slice(premier).map(moisCourt)} zero
              series={[{ nom: 'Patrimoine', couleur: '#facc15', valeurs: serie.slice(premier).map((v) => (v === undefined ? undefined : v / 100)) }]}
              format={(n) => (n >= 1000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€` : `${Math.round(n)} €`)} />
          </div>
        )}
      </Carte>

      <Carte>
        <p className="text-sm text-texte-2">🛟 Épargne de précaution<Aide titre="Épargne de précaution" texte="Total disponible tout de suite sur tes livrets (Livret A + Livret Jeune) : ton coussin en cas d'imprévu." /></p>
        <p className="text-3xl font-bold tabular-nums">{formatEuros(precaution, { ronds: true })}</p>
      </Carte>

      {GROUPES.map((g) => {
        const comptes = actifs.filter((c) => g.types.includes(c.type))
        if (!comptes.length) return null
        return (
          <Carte key={g.titre} titre={g.titre}>
            {comptes.map((c) => <LigneCompte key={c.id} c={c} d={d} jour={jour} onToucher={() => setOuvert(c)} />)}
          </Carte>
        )
      })}

      <Bouton variante="secondaire" onClick={() => setOuvert('nouveau')}>+ Ajouter un compte</Bouton>
      {d.comptes.some((c) => c.archive) && (
        <>
          <button type="button" onClick={() => setArchives(!archives)} className="w-full py-2 text-sm text-texte-3">{archives ? '▾' : '▸'} Comptes archivés</button>
          {archives && <Carte>{d.comptes.filter((c) => c.archive).map((c) => <LigneCompte key={c.id} c={c} d={d} jour={jour} onToucher={() => setOuvert(c)} />)}</Carte>}
        </>
      )}

      {ouvert === 'nouveau' && <NouveauCompte ordre={d.comptes.length} onFermer={() => setOuvert(undefined)} />}
      {ouvert && ouvert !== 'nouveau' && <FicheCompte c={d.comptes.find((x) => x.id === ouvert.id) ?? ouvert} d={d} onFermer={() => setOuvert(undefined)} />}
    </div>
  )
}

function LigneCompte({ c, d, jour, onToucher }: { c: Compte; d: Donnees; jour: string; onToucher: () => void }) {
  const valeur = soldeAu(c, d.mouvements, d.releves, jour)
  const invest = c.type === 'investissement'
  const plusValue = invest ? valeur - verseAu(c, d.mouvements, jour) : 0
  const suivi = invest
  const age = suivi ? ageReleve(c.id, d.releves, jour) : undefined
  return (
    <button type="button" onClick={onToucher} className="flex w-full items-center justify-between gap-3 py-2 text-left active:opacity-60">
      <span className="min-w-0">
        <span className="block font-medium">{c.nom}</span>
        {suivi && <span className="block text-xs text-texte-3">{age === undefined ? 'Pas encore de relevé' : age === 0 ? "Relevé aujourd'hui" : `Relevé il y a ${age} j`}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold tabular-nums">{formatEuros(valeur)}</span>
        {invest && plusValue !== 0 && <span className="block text-xs tabular-nums" style={{ color: plusValue > 0 ? ETAT.vert : ETAT.rouge }}>{formatEuros(plusValue, { signe: true })}</span>}
      </span>
    </button>
  )
}

function NouveauCompte({ ordre, onFermer }: { ordre: number; onFermer: () => void }) {
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeCompte>('epargne')
  const [solde, setSolde] = useState('')
  return (
    <Feuille titre="Nouveau compte" onFermer={onFermer}>
      <div className="space-y-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex. LDDS)" className={champ} />
        <select value={type} onChange={(e) => setType(e.target.value as TypeCompte)} className={champ}>
          {(Object.keys(NOMS_TYPES) as TypeCompte[]).map((t) => <option key={t} value={t}>{NOMS_TYPES[t]}</option>)}
        </select>
        <input value={solde} onChange={(e) => setSolde(e.target.value)} inputMode="decimal" placeholder="Solde aujourd'hui (€)" className={champ} />
        <Bouton disabled={!nom.trim()} onClick={async () => {
          await enregistrerCompte({ id: nouvelId(), nom: nom.trim(), type, soldeInitial: centimes(solde), dateDepart: aujourdhui(), ordre })
          onFermer()
        }}>Ajouter</Bouton>
      </div>
    </Feuille>
  )
}

function FicheCompte({ c, d, onFermer }: { c: Compte; d: Donnees; onFermer: () => void }) {
  const jour = aujourdhui()
  const invest = c.type === 'investissement'
  const avecReleves = invest || c.type === 'epargne'
  const [nom, setNom] = useState(c.nom)
  const [releveDate, setReleveDate] = useState(jour)
  const [releveValeur, setReleveValeur] = useState('')
  const [soldeInitial, setSoldeInitial] = useState(texteEuros(c.soldeInitial))
  const [verseInitial, setVerseInitial] = useState(texteEuros(c.verseInitial ?? c.soldeInitial))
  const [avance, setAvance] = useState(false)
  const valeur = soldeAu(c, d.mouvements, d.releves, jour)
  const verse = verseAu(c, d.mouvements, jour)
  const releves = d.releves.filter((r) => r.compteId === c.id).sort((a, b) => b.date.localeCompare(a.date))
  const modifier = (changements: Partial<Compte>) => enregistrerCompte({ ...c, ...changements })

  return (
    <Feuille titre={c.nom} onFermer={onFermer}>
      <p className="text-3xl font-bold tabular-nums">{formatEuros(valeur)}</p>
      {invest && (
        <p className="mt-1 text-sm text-texte-2">
          Argent versé {formatEuros(verse, { ronds: true })}
          {valeur !== verse && <> · <span style={{ color: valeur > verse ? ETAT.vert : ETAT.rouge }}>{valeur > verse ? 'plus-value' : 'moins-value'} {formatEuros(valeur - verse, { signe: true })}</span></>}
        </p>
      )}

      {avecReleves && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-3">Nouveau relevé</p>
          <p className="text-xs text-texte-3">{invest ? 'Regarde la valeur sur ton appli bancaire et note-la ici.' : 'Pas besoin chaque mois : tes virements suffisent. Utile une fois par an, quand les intérêts arrivent.'}</p>
          <div className="mt-1 flex gap-2">
            <input type="date" value={releveDate} max={jour} min={c.dateDepart} onChange={(e) => e.target.value && setReleveDate(e.target.value)} className={`${champ} w-auto`} />
            <input value={releveValeur} onChange={(e) => setReleveValeur(e.target.value)} inputMode="decimal" placeholder="Valeur (€)" className={champ} />
          </div>
          <Bouton className="mt-2" disabled={lireNombre(releveValeur) === undefined} onClick={async () => {
            await enregistrerReleve(c.id, releveDate, centimes(releveValeur))
            setReleveValeur('')
          }}>Enregistrer le relevé</Bouton>
          {releves.length > 0 && (
            <ul className="mt-2 text-sm">
              {releves.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between py-1">
                  <span className="text-texte-2">{formatDate(r.date)}</span>
                  <span className="flex items-center gap-3"><b className="tabular-nums">{formatEuros(r.valeur)}</b>
                    <button type="button" aria-label="Supprimer le relevé" onClick={() => supprimerReleve(r.id)} className="text-texte-3">×</button></span>
                </li>
              ))}
            </ul>
          )}
          {dernierReleve(c.id, d.releves) === undefined && <p className="mt-1 text-xs text-texte-3">Sans relevé, la valeur = valeur de départ + versements.</p>}
        </div>
      )}

      <button type="button" onClick={() => setAvance(!avance)} className="mt-4 w-full py-1 text-left text-sm font-semibold text-texte-3">{avance ? '▾' : '▸'} Modifier le compte</button>
      {avance && (
        <div className="space-y-2">
          <label className="block text-sm text-texte-2">Nom
            <input value={nom} onChange={(e) => setNom(e.target.value)} onBlur={() => nom.trim() && nom !== c.nom && modifier({ nom: nom.trim() })} className={champ} />
          </label>
          <label className="block text-sm text-texte-2">Solde au départ ({formatDate(c.dateDepart)}), en €
            <input value={soldeInitial} inputMode="decimal" onChange={(e) => setSoldeInitial(e.target.value)} onBlur={() => modifier({ soldeInitial: centimes(soldeInitial) })} className={champ} />
          </label>
          {invest && (
            <label className="block text-sm text-texte-2">Dont argent versé de ta poche, en €
              <input value={verseInitial} inputMode="decimal" onChange={(e) => setVerseInitial(e.target.value)} onBlur={() => modifier({ verseInitial: centimes(verseInitial) })} className={champ} />
            </label>
          )}
          <Bouton variante="secondaire" onClick={async () => { await modifier({ archive: !c.archive }); onFermer() }}>
            {c.archive ? 'Réactiver le compte' : 'Archiver le compte'}
          </Bouton>
          {!c.archive && <p className="text-xs text-texte-3">Archiver cache le compte de la saisie ; son historique reste.</p>}
        </div>
      )}
    </Feuille>
  )
}
