import { useRef, useState } from 'react'
import { db } from '../../../core/db'
import { depuisJour } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { Feuille } from '../../../core/ui/Feuille'
import { lireCampus, type SeanceLue } from '../import/campus'
import { lireTexteImage } from '../import/ocr'
import { nouvelId } from '../seances/donnees'
import { TYPES_COURSE, type SeancePrevue, type TypeCourse } from '../types'
import { champsCourse, enregistrerPrevue } from './donnees'

const TYPES = Object.keys(TYPES_COURSE) as TypeCourse[]
const champ = 'rounded-lg border border-bordure bg-surface-2 px-2 py-2 text-sm'

type Ligne = SeanceLue & { garder: boolean; dejaPrevue: boolean }

/** Importe les séances Campus Coach d'une capture d'écran (texte lu sur le téléphone), à vérifier avant l'ajout. */
export function ImportCampus({ jours }: { jours: string[] }) {
  const champFichier = useRef<HTMLInputElement>(null)
  const [progression, setProgression] = useState<number>()
  const [lignes, setLignes] = useState<Ligne[]>()
  const [texte, setTexte] = useState('')
  const [voirTexte, setVoirTexte] = useState(false)
  const [message, setMessage] = useState<string>()

  const lire = async (fichier?: File) => {
    if (!fichier) return
    setMessage(undefined)
    setProgression(0)
    try {
      const t = await lireTexteImage(fichier, setProgression)
      setTexte(t)
      const prevues = await db.prevues.where('date').between(jours[0], jours[6], true, true).toArray()
      setLignes(lireCampus(t, jours).map((s) => {
        const dejaPrevue = prevues.some((p) => p.date === s.date && p.sport === s.sport && p.statut !== 'abandonnee')
        return { ...s, dejaPrevue, garder: !dejaPrevue }
      }))
    } catch (e) {
      setMessage(`Lecture impossible : ${(e as Error)?.message ?? String(e)}`)
    } finally {
      setProgression(undefined)
    }
  }

  const changer = (i: number, c: Partial<Ligne>) => setLignes((l) => l?.map((x, j) => (j === i ? { ...x, ...c } : x)))

  const ajouter = async () => {
    let n = 0
    for (const l of lignes ?? []) {
      if (!l.garder || !l.date) continue
      const base: SeancePrevue = {
        id: nouvelId(), date: l.date, sport: l.sport, titre: l.titre || (l.sport === 'renfo' ? 'Renfo' : l.typeCourse ?? 'Course'),
        intensite: 'basse', dureeMin: l.dureeMin ?? 45, priorite: 'normale', statut: 'prevue', origine: 'manuel',
      }
      await enregistrerPrevue(l.sport === 'course' && l.typeCourse
        ? { ...base, typeCourse: l.typeCourse, minutesCle: l.minutesCle, ...champsCourse(l.typeCourse) }
        : base)
      n++
    }
    setLignes(undefined)
    setMessage(`${n} séance(s) ajoutée(s). Pense à générer ou recalculer ton vélo.`)
  }

  return (
    <Carte titre="Importer une capture Campus Coach">
      <p className="text-sm text-texte-2">Fais une capture de ton plan Campus de la semaine : l'appli lit les séances (sur ton téléphone) et tu vérifies avant de les ajouter.</p>
      <Bouton variante="secondaire" className="mt-2" disabled={progression !== undefined} onClick={() => champFichier.current?.click()}>
        {progression !== undefined ? `Lecture… ${Math.round(progression * 100)} %` : '📷 Choisir une capture'}
      </Bouton>
      <input ref={champFichier} type="file" accept="image/*" className="hidden" onChange={(e) => { lire(e.target.files?.[0]); e.target.value = '' }} />
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}

      {lignes && (
        <Feuille titre="Séances lues" onFermer={() => setLignes(undefined)}>
          {lignes.length === 0 && <p className="text-sm text-texte-2">Aucune séance reconnue. Regarde le texte lu ci-dessous, et envoie-moi la capture pour que j'améliore la lecture.</p>}
          <div className="space-y-2">
            {lignes.map((l, i) => (
              <div key={i} className={`rounded-xl border p-2.5 ${l.garder ? 'border-accent' : 'border-bordure opacity-60'}`}>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={l.garder} onChange={(e) => changer(i, { garder: e.target.checked })} className="h-5 w-5 accent-[var(--color-accent)]" />
                  {l.sport === 'renfo' ? '🏋️ Renfo' : '🏃 Course'}
                  {l.dejaPrevue && <span className="text-xs font-normal text-[#fb923c]">déjà une séance ce jour-là</span>}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select value={l.date ?? ''} onChange={(e) => changer(i, { date: e.target.value || undefined })} className={`${champ} capitalize`}>
                    <option value="">Jour ?</option>
                    {jours.map((d) => <option key={d} value={d}>{depuisJour(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-sm">
                    <input inputMode="numeric" value={l.dureeMin ?? ''} placeholder="?" onChange={(e) => changer(i, { dureeMin: Number(e.target.value) || undefined })} className={`${champ} w-16 text-center`} />
                    min
                  </label>
                  {l.sport === 'course' && (
                    <select value={l.typeCourse ?? ''} onChange={(e) => changer(i, { typeCourse: (e.target.value || undefined) as TypeCourse | undefined })} className={`${champ} col-span-2`}>
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  <input value={l.titre} onChange={(e) => changer(i, { titre: e.target.value })} className={`${champ} col-span-2`} />
                </div>
              </div>
            ))}
          </div>
          <Bouton className="mt-3" disabled={!lignes.some((l) => l.garder && l.date)} onClick={ajouter}>
            Ajouter {lignes.filter((l) => l.garder && l.date).length} séance(s)
          </Bouton>
          <button type="button" onClick={() => setVoirTexte(!voirTexte)} className="mt-2 w-full py-2 text-xs text-texte-3">{voirTexte ? 'Masquer' : 'Voir'} le texte lu</button>
          {voirTexte && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-xs text-texte-3">{texte}</pre>}
        </Feuille>
      )}
    </Carte>
  )
}
