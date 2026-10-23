import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db } from '../core/db'
import { depuis } from '../core/format'
import { CLE_DERNIERE_SAUVEGARDE, exporterDonnees, importerDonnees } from '../core/sauvegarde'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'

/** Au-delà de ce nombre de jours sans sauvegarde, on affiche un rappel. */
const JOURS_AVANT_RAPPEL = 7

/** Export / import de toutes les données en un fichier JSON. */
export function SectionSauvegarde() {
  const derniere = useLiveQuery(() => db.reglages.get(CLE_DERNIERE_SAUVEGARDE))
  const le = (derniere?.valeur as { le?: string } | undefined)?.le
  const enRetard = !le || Date.now() - new Date(le).getTime() > JOURS_AVANT_RAPPEL * 86_400_000

  const [message, setMessage] = useState<string>()
  const champFichier = useRef<HTMLInputElement>(null)

  const exporter = async () => {
    try {
      if (await exporterDonnees()) setMessage('Sauvegarde exportée ✓')
    } catch (e) {
      setMessage(`Erreur : ${(e as Error).message}`)
    }
  }

  const importer = async (fichier?: File) => {
    if (!fichier) return
    if (!confirm('Remplacer TOUTES les données actuelles par celles de ce fichier ?')) return
    try {
      await importerDonnees(fichier)
      setMessage('Données restaurées ✓')
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <Carte titre="Sauvegarde">
      <p className={`mb-3 text-sm ${enRetard ? 'text-argent' : 'text-texte-2'}`}>
        {le ? `Dernière sauvegarde : ${depuis(le)}` : 'Aucune sauvegarde pour l’instant'}
        {enRetard && ' — pense à exporter tes données.'}
      </p>
      <div className="space-y-2">
        <Bouton onClick={exporter}>Exporter mes données</Bouton>
        <Bouton variante="secondaire" onClick={() => champFichier.current?.click()}>
          Restaurer une sauvegarde
        </Bouton>
      </div>
      <input
        ref={champFichier}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          importer(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {message && <p className="mt-3 text-center text-sm text-texte-2">{message}</p>}
      <p className="mt-3 text-xs text-texte-3">
        Sur iPhone, choisis « Enregistrer dans Fichiers » (iCloud Drive) pour garder ta sauvegarde à l'abri.
      </p>
    </Carte>
  )
}
