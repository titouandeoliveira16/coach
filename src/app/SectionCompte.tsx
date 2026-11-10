import { depuis } from '../core/format'
import { seDeconnecter, synchroniser, useSynchro } from '../core/synchro'
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
    'en-cours': '⏳ Synchronisation…',
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
      <p className={`text-sm ${statut === 'erreur' ? 'text-[#f87171]' : statut === 'ok' ? 'text-nutrition' : 'text-texte-2'}`}>
        {libelles[statut]}
      </p>
      <Bouton variante="secondaire" disabled={statut === 'en-cours'} onClick={() => synchroniser()}>
        Synchroniser maintenant
      </Bouton>
      <button type="button" className="w-full py-2 text-sm text-texte-3"
        onClick={() => {
          if (confirm('Se déconnecter ? Les données seront effacées de CET appareil (elles restent sur ton compte et reviendront à la reconnexion).')) seDeconnecter()
        }}>
        Se déconnecter
      </button>
    </div>
  )
}
