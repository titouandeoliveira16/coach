import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { Bouton } from '../../../core/ui/Bouton'
import { Repliable } from '../../../core/ui/Repliable'
import { exporterCsv } from '../exporter'
import type { Donnees } from '../calculs'

/** Exporter ses mouvements en CSV (pour comparer avec un relevé de banque). Le fichier reste à toi. */
export function CarteExport({ d }: { d: Donnees }) {
  const [message, setMessage] = useState<string>()
  const exporter = async () => {
    const nom = `budget-${aujourdhui()}.csv`
    const fichier = new File([exporterCsv(d, aujourdhui())], nom, { type: 'text/csv' })
    try {
      // iPhone : feuille de partage (Fichiers, Mail…) ; sinon téléchargement
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: nom })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(fichier)
        a.download = nom
        a.click()
        URL.revokeObjectURL(a.href)
      }
      setMessage('Fichier prêt ✓')
    } catch {
      setMessage(undefined)
    }
  }
  return (
    <Repliable titre="Exporter mes mouvements" libelle="Ouvrir" resume="Un fichier pour comparer avec ta banque">
      <p className="text-sm text-texte-2">Un fichier CSV avec tes comptes (solde du jour), tes contrôles et tous tes mouvements : pour comparer avec le relevé de ta banque.</p>
      <Bouton className="mt-2" onClick={exporter}>Exporter (CSV)</Bouton>
      {message && <p className="mt-1 text-sm text-texte-3">{message}</p>}
    </Repliable>
  )
}
