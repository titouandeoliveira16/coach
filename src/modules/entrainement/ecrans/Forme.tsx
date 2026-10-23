import { Carte } from '../../../core/ui/Carte'

/** Forme du jour : VFC, FC de repos, ressenti. Contenu à l'étape 3. */
export function Forme() {
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-3">
      <p className="text-lg capitalize text-texte-2">{aujourdhui}</p>
      <Carte titre="Forme du jour">
        <p className="text-texte-2">Ici, chaque matin : VFC, FC de repos et ressenti, puis ton signal 🟢 🟠 🔴.</p>
        <p className="mt-2 text-sm text-texte-3">Arrive à l'étape 3.</p>
      </Carte>
    </div>
  )
}
