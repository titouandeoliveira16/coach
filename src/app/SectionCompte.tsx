import { useState } from 'react'
import { depuis } from '../core/format'
import { creerCompte, seConnecter, seDeconnecter, synchroniser, useSynchro } from '../core/synchro'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'

const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent'

/** Compte et synchronisation : connexion par email + mot de passe. */
export function SectionCompte() {
  const { session } = useSynchro()
  return <Carte titre="Compte et synchronisation">{session ? <Connecte /> : <Connexion />}</Carte>
}

function Connexion() {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  const pret = email.includes('@') && motDePasse.length >= 6 && !occupe

  const agir = async (action: (email: string, mdp: string) => Promise<void>) => {
    setOccupe(true)
    setMessage(undefined)
    try {
      await action(email.trim(), motDePasse)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (pret) agir(seConnecter) }}>
      <p className="text-sm text-texte-2">
        Connecte-toi pour sauvegarder tes données en ligne et les retrouver sur tous tes appareils. Sans compte,
        l'appli fonctionne quand même, uniquement sur cet appareil.
      </p>
      <input type="email" inputMode="email" autoComplete="username" placeholder="ton@email.fr" value={email}
        onChange={(e) => setEmail(e.target.value)} className={champ} />
      <input type="password" autoComplete="current-password" placeholder="Mot de passe (6 caractères min.)" value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)} className={champ} />
      <Bouton type="submit" disabled={!pret}>{occupe ? 'Connexion…' : 'Se connecter'}</Bouton>
      <Bouton variante="secondaire" disabled={!pret} onClick={() => agir(creerCompte)}>Créer mon compte</Bouton>
      {message && <p className="text-sm text-[#f87171]">{message}</p>}
    </form>
  )
}

function Connecte() {
  const { session, statut, derniereSynchro, erreur } = useSynchro()
  const libelles = {
    'en-cours': '⏳ Synchronisation…',
    ok: `✓ Synchronisé${derniereSynchro ? ` (${depuis(derniereSynchro)})` : ''}`,
    'hors-ligne': '📴 Hors ligne : tes saisies partiront au retour du réseau',
    erreur: `⚠️ Erreur : ${erreur}`,
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
