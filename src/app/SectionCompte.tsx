import { useState } from 'react'
import { depuis } from '../core/format'
import { demanderCode, seDeconnecter, synchroniser, useSynchro, validerCode } from '../core/synchro'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'

const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent'

/** Compte et synchronisation : connexion par email + code à 6 chiffres. */
export function SectionCompte() {
  const { session } = useSynchro()
  return <Carte titre="Compte et synchronisation">{session ? <Connecte /> : <Connexion />}</Carte>
}

function Connexion() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeEnvoye, setCodeEnvoye] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()

  const agir = async (action: () => Promise<void>) => {
    setOccupe(true)
    setMessage(undefined)
    try {
      await action()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-texte-2">
        Connecte-toi pour sauvegarder tes données en ligne et les retrouver sur tous tes appareils. Sans compte,
        l'appli fonctionne quand même, uniquement sur cet appareil.
      </p>

      {!codeEnvoye ? (
        <>
          <input type="email" inputMode="email" autoComplete="email" placeholder="ton@email.fr" value={email}
            onChange={(e) => setEmail(e.target.value)} className={champ} />
          <Bouton disabled={occupe || !email.includes('@')}
            onClick={() => agir(async () => { await demanderCode(email.trim()); setCodeEnvoye(true) })}>
            {occupe ? 'Envoi…' : 'Recevoir un code'}
          </Bouton>
        </>
      ) : (
        <>
          <p className="text-sm">Code envoyé à <span className="font-semibold">{email}</span>. Regarde tes emails (et les spams).</p>
          <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={8} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${champ} text-center text-2xl font-bold tracking-[0.4em]`} />
          <Bouton disabled={occupe || code.length < 6} onClick={() => agir(() => validerCode(email.trim(), code))}>
            {occupe ? 'Vérification…' : 'Se connecter'}
          </Bouton>
          <button type="button" onClick={() => { setCodeEnvoye(false); setCode('') }} className="w-full py-1 text-sm text-texte-3">
            Changer d'email
          </button>
        </>
      )}
      {message && <p className="text-sm text-[#f87171]">{message}</p>}
    </div>
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
