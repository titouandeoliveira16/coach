import { useState } from 'react'
import { aujourdhui } from '../../core/dates'
import { formatEuros } from '../../core/format'
import { categoriesParUsage } from './calculs'
import { enregistrerMouvement, nouvelId, useBudget } from './donnees'
import type { Mouvement, TypeMouvement } from './types'

const TYPES: { id: TypeMouvement; nom: string }[] = [
  { id: 'depense', nom: 'Dépense' },
  { id: 'revenu', nom: 'Revenu' },
  { id: 'virement', nom: 'Virement' },
  { id: 'investissement', nom: 'Investir' },
]
const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']
const champ = 'w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 outline-none focus:border-accent'

/** Centimes → texte du pavé ("12,5") */
const versTexte = (c?: number) => (c ? String(c / 100).replace('.', ',') : '')
const versCentimes = (t: string) => Math.round(Number(t.replace(',', '.') || '0') * 100)

/**
 * Saisie rapide d'un mouvement : le montant d'abord (pavé numérique), puis la catégorie en un toucher.
 * `initial` : mouvement à modifier (avec id) ou à dupliquer (sans id).
 */
export function Saisie({ initial, onFermer }: { initial?: Partial<Mouvement>; onFermer: (message?: string) => void }) {
  const d = useBudget()
  const [texte, setTexte] = useState(versTexte(initial?.montant))
  const [type, setType] = useState<TypeMouvement>(initial?.type ?? 'depense')
  const [categorieId, setCategorieId] = useState(initial?.categorieId)
  const [compteId, setCompteId] = useState(initial?.compteId)
  const [versCompteId, setVersCompteId] = useState(initial?.versCompteId)
  const [date, setDate] = useState(initial?.date ?? aujourdhui())
  const [note, setNote] = useState(initial?.note ?? '')
  const [occupe, setOccupe] = useState(false)
  if (!d) return null

  const actifs = d.comptes.filter((c) => !c.archive)
  const courant = actifs.find((c) => c.type === 'courant')?.id ?? actifs[0]?.id
  const investissements = actifs.filter((c) => c.type === 'investissement')
  // Comptes proposés selon le type ; le compte courant est pré-rempli
  const sources = type === 'investissement' ? actifs.filter((c) => c.type !== 'investissement') : actifs
  const de = compteId && sources.some((c) => c.id === compteId) ? compteId : courant
  const destinations = (type === 'investissement' ? investissements : actifs).filter((c) => c.id !== de)
  const vers = versCompteId && destinations.some((c) => c.id === versCompteId) ? versCompteId : destinations[0]?.id

  const genre = type === 'revenu' ? 'revenu' : 'depense'
  const principales = categoriesParUsage(d.categories, d.mouvements, genre, aujourdhui())
  const choisie = d.categories.find((c) => c.id === categorieId)
  const principale = choisie?.parentId ?? choisie?.id
  const sousCategories = d.categories.filter((c) => c.parentId && c.parentId === principale && !c.archive)
  const categorieValide = choisie && choisie.genre === genre

  const montant = versCentimes(texte)
  const avecCategorie = type === 'depense' || type === 'revenu'
  const pret = montant > 0 && !!de && (avecCategorie ? categorieValide : !!vers)

  const toucher = (t: string) => {
    if (t === '⌫') return setTexte(texte.slice(0, -1))
    if (t === ',') return setTexte(texte.includes(',') ? texte : `${texte || '0'},`)
    if (/,\d\d$/.test(texte) || texte.replace(',', '').length >= 8) return
    setTexte(texte === '0' ? t : texte + t)
  }

  const valider = async () => {
    if (!pret || occupe) return
    setOccupe(true)
    const m: Mouvement = {
      id: initial?.id ?? nouvelId(), type, montant, date, compteId: de!,
      ...(avecCategorie ? { categorieId } : { versCompteId: vers }),
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    const alerte = await enregistrerMouvement(m)
    onFermer(alerte ?? (initial?.id ? 'Mouvement modifié ✓' : `${formatEuros(montant)} enregistré ✓`))
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => onFermer()}>
      <div className="pb-sur max-h-[96vh] w-full overflow-y-auto rounded-t-3xl border-t border-bordure bg-surface px-4 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold">{initial?.id ? 'Modifier' : 'Nouveau mouvement'}</p>
          <button type="button" onClick={() => onFermer()} aria-label="Fermer" className="px-2 text-2xl text-texte-3">×</button>
        </div>

        {/* Montant */}
        <p className={`py-1 text-center text-5xl font-bold tabular-nums ${texte ? '' : 'text-texte-3'}`}>{texte || '0'} €</p>
        <div className="grid grid-cols-3 gap-1.5">
          {TOUCHES.map((t) => (
            <button key={t} type="button" onClick={() => toucher(t)}
              className="rounded-xl bg-surface-2 py-2.5 text-2xl font-semibold active:scale-95 active:bg-bordure">{t}</button>
          ))}
        </div>

        {/* Type */}
        <div className="mt-3 flex rounded-xl bg-surface-2 p-1">
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => setType(t.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${type === t.id ? 'bg-accent text-fond' : 'text-texte-2'}`}>{t.nom}</button>
          ))}
        </div>

        {/* Catégorie (dépense, revenu) ou comptes (virement, investissement) */}
        {avecCategorie ? (
          <>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {principales.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategorieId(c.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 active:scale-95 ${principale === c.id ? 'border-accent bg-accent/15' : 'border-bordure bg-surface-2'}`}>
                  <span className="text-2xl leading-none">{c.emoji}</span>
                  <span className="w-full truncate text-center text-[11px] text-texte-2">{c.nom}</span>
                </button>
              ))}
            </div>
            {sousCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sousCategories.map((s) => (
                  <button key={s.id} type="button" onClick={() => setCategorieId(categorieId === s.id ? s.parentId : s.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${categorieId === s.id ? 'border-accent bg-accent text-fond' : 'border-bordure bg-surface-2 text-texte-2'}`}>{s.emoji} {s.nom}</button>
                ))}
              </div>
            )}
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-texte-2">{type === 'revenu' ? 'Sur le compte' : 'Payé avec'}</span>
              <select value={de} onChange={(e) => setCompteId(e.target.value)} className={`${champ} w-auto`}>
                {sources.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
          </>
        ) : (
          <div className="mt-3 flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-texte-3">De
              <select value={de} onChange={(e) => setCompteId(e.target.value)} className={`${champ} mt-1 text-base font-normal normal-case tracking-normal text-texte`}>
                {sources.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
            <span className="pb-3 text-texte-3">→</span>
            <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-texte-3">Vers
              <select value={vers} onChange={(e) => setVersCompteId(e.target.value)} className={`${champ} mt-1 text-base font-normal normal-case tracking-normal text-texte`}>
                {destinations.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${champ} w-auto`} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" className={champ} />
        </div>

        <button type="button" disabled={!pret || occupe} onClick={valider}
          className="mt-3 mb-2 w-full rounded-xl bg-accent py-3.5 text-lg font-bold text-fond active:scale-[0.98] disabled:opacity-40">
          {pret ? 'Enregistrer' : !montant ? 'Tape le montant' : avecCategorie ? 'Choisis une catégorie' : 'Choisis les comptes'}
        </button>
      </div>
    </div>
  )
}
