import { useNavigate } from 'react-router-dom'
import { Carte } from '../../../core/ui/Carte'

/** « Comment récupérer mon .FIT ? » */
export function AideFit() {
  const navigate = useNavigate()
  return (
    <div className="pt-sur space-y-3 px-4 pb-8">
      <button type="button" onClick={() => navigate(-1)} className="py-2 text-accent">‹ Retour</button>
      <h1 className="text-2xl font-bold">Récupérer un fichier .FIT</h1>

      <Carte titre="a. Le plus simple : Intervals.icu (automatique)">
        <p className="text-texte-2">
          Si Garmin Connect et Zwift sont reliés directement à Intervals.icu, relie Intervals.icu dans Réglages :
          tes séances arrivent seules, sans fichier. (Les activités arrivées dans Intervals via Strava ne sont pas transmises.)
        </p>
      </Carte>

      <Carte titre="b. Zwift (home trainer)">
        <ol className="list-decimal space-y-1 pl-5 text-texte-2">
          <li>Sur ordinateur, va sur zwift.com et connecte-toi.</li>
          <li>Menu de ton profil → Activités.</li>
          <li>Ouvre l'activité, puis la roue dentée → Télécharger le fichier .fit.</li>
          <li>Envoie le fichier sur ton iPhone (AirDrop, iCloud Drive), puis « + » → Importer un .FIT.</li>
        </ol>
        <p className="mt-2 text-xs text-texte-3">Le site de Zwift change souvent : si le menu a bougé, cherche « Download » ou « Télécharger ».</p>
      </Carte>

      <Carte titre="c. Garmin Connect (montre)">
        <ol className="list-decimal space-y-1 pl-5 text-texte-2">
          <li>Sur connect.garmin.com (ordinateur), ouvre l'activité.</li>
          <li>Roue dentée en haut à droite → Exporter l'original (fichier .zip contenant le .fit).</li>
          <li>Ouvre le .zip, puis importe le .fit.</li>
        </ol>
      </Carte>

      <Carte titre="d. iGPSPORT">
        <p className="text-texte-2">À compléter : indique-moi où se trouve l'export dans l'appli iGPSPORT et je l'ajouterai ici.</p>
      </Carte>
    </div>
  )
}
