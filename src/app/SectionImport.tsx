import { useState } from 'react'
import { Carte } from '../core/ui/Carte'
import { importerDonnees, lireFichierDonnees } from './importDonnees'

/** Importer un fichier de données personnelles (profil, records, soldes de départ) gardé sur le téléphone. */
export function SectionImport() {
  const [message, setMessage] = useState<string>()
  const importer = async (texte: string) => {
    try {
      const fait = await importerDonnees(lireFichierDonnees(texte))
      setMessage(fait.length ? `✓ Importé : ${fait.join(', ')}.` : 'Rien de nouveau à importer.')
    } catch (e) {
      setMessage((e as Error).message)
    }
  }
  return (
    <Carte titre="Importer mes données">
      <p className="text-sm text-texte-2">Un fichier préparé pour toi (profil, records, soldes de départ). Il reste sur ton téléphone et dans tes données privées, jamais dans le code de l'appli.</p>
      <label className="presse mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-surface-2 py-3 font-semibold">
        Choisir le fichier
        <input type="file" accept=".json,application/json,text/plain" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) importer(await f.text()); e.target.value = '' }} />
      </label>
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}
    </Carte>
  )
}
