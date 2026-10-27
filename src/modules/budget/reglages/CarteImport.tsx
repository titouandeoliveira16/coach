import { useState } from 'react'
import { formatEuros } from '../../../core/format'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { importer, lireImport, resumeImport, type FichierImport } from '../importer'

/** Importer un fichier de mouvements (ex. un mois passé préparé par Claude). Il reste sur le téléphone. */
export function CarteImport() {
  const [fichier, setFichier] = useState<FichierImport>()
  const [message, setMessage] = useState<string>()
  const [texte, setTexte] = useState('')
  const lire = (t: string) => {
    setMessage(undefined)
    try {
      setFichier(lireImport(t))
    } catch (e) {
      setFichier(undefined)
      setMessage((e as Error).message)
    }
  }
  const r = fichier && resumeImport(fichier)

  return (
    <Carte titre="Importer des mouvements">
      <p className="text-sm text-texte-2">Un fichier préparé pour toi (ex. un mois passé). Réimporter le même fichier n'ajoute rien en double.</p>
      <input type="file" accept=".json,application/json,text/plain" className="mt-2 w-full text-sm text-texte-2"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) lire(await f.text()) }} />
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} onBlur={() => texte.trim() && lire(texte)} rows={2}
        placeholder="… ou colle le texte du fichier ici" className="mt-2 w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-sm outline-none" />
      {r && (
        <div className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">
          <p>{r.lignes} mouvements · dépenses {formatEuros(r.depenses)} · revenus {formatEuros(r.revenus)}</p>
          {Object.entries(fichier!.soldes ?? {}).map(([id, e]) => <p key={id} className="text-texte-2">Solde du compte « {id} » réglé à {formatEuros(Math.round(e * 100))} aujourd'hui</p>)}
          <Bouton className="mt-2" onClick={async () => {
            const res = await importer(fichier!)
            setMessage(`✓ ${res.ajoutes} mouvement${res.ajoutes > 1 ? 's' : ''} ajouté${res.ajoutes > 1 ? 's' : ''}${res.deja ? ` (${res.deja} déjà présents)` : ''}.`)
            setFichier(undefined)
            setTexte('')
          }}>Importer</Bouton>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}
    </Carte>
  )
}
