import { depuis } from '../core/format'
import { seDeconnecter, synchroniser, useSynchro } from '../core/synchro'
import { exporterToutesMesDonnees, supprimerMonCompte } from '../core/inscription'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'
import { FormulaireCompte } from './Entree'

/** Compte et synchronisation : connexion par email + mot de passe. */
export function SectionCompte() {
  const { session } = useSynchro()
  return <Carte titre="Compte et synchronisation">{session ? <Connecte /> : <FormulaireCompte />}</Carte>
}

function Connecte() {
  const { session, statut, derniereSynchro, erreur } = useSynchro()
  const libelles = {
    'en-cours': 'Synchronisation…',
    ok: `✓ Synchronisé${derniereSynchro ? ` (${depuis(derniereSynchro)})` : ''}`,
    'hors-ligne': 'Hors ligne : tes saisies partiront au retour du réseau',
    erreur: `Erreur : ${erreur}`,
    deconnecte: '',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-1">
        <span className="text-texte-2">Connecté</span>
        <span className="font-semibold">{session?.user.email}</span>
      </div>
      <p className={`text-sm ${statut === 'erreur' ? 'text-mauvais' : statut === 'ok' ? 'text-nutrition' : 'text-texte-2'}`}>
        {libelles[statut]}
      </p>
      <Bouton variante="secondaire" disabled={statut === 'en-cours'} onClick={() => synchroniser()}>
        Synchroniser maintenant
      </Bouton>
      <button type="button" className="w-full py-2 text-sm text-texte-3"
        onClick={async () => {
          if (!confirm('Se déconnecter ? Les données seront effacées de CET appareil (elles restent sur ton compte et reviendront à la reconnexion).')) return
          try {
            await seDeconnecter()
          } catch (e) {
            alert((e as Error).message)
          }
        }}>
        Se déconnecter
      </button>
      <div className="space-y-1 border-t border-bordure pt-3">
        <p className="text-xs text-texte-3">Tes données sont rangées sur ton compte (serveur Supabase) et sur ce téléphone. Personne d'autre ne peut les lire, elles ne sont ni vendues ni partagées.</p>
        <button type="button" className="w-full py-2 text-left text-sm font-semibold text-texte-2" onClick={() => exporterToutesMesDonnees()}>
          Exporter toutes mes données (fichier)
        </button>
        <button type="button" className="w-full py-2 text-left text-sm text-mauvais"
          onClick={async () => {
            if (!confirm('Supprimer ton compte et TOUTES tes données (séances, réglages, notes…) ? C’est définitif.')) return
            if (!confirm('Dernière confirmation : tout sera effacé, sur le serveur et sur ce téléphone.')) return
            try {
              await supprimerMonCompte()
            } catch (e) {
              alert((e as Error).message)
            }
          }}>
          Supprimer mon compte et mes données
        </button>
      </div>
    </div>
  )
}
