import { useState } from 'react'
import { creerCompteAvecCode } from '../core/inscription'
import { seConnecter } from '../core/synchro'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'

const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent'

/** Connexion, ou création du compte avec le code donné par Titouan (les inscriptions libres sont fermées). */
export function FormulaireCompte() {
  const [mode, setMode] = useState<'connexion' | 'code'>('connexion')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  const avecCode = mode === 'code'
  const pret = email.includes('@') && motDePasse.length >= 6 && (!avecCode || code.replace(/[^a-z0-9]/gi, '').length === 6) && !occupe

  const valider = async () => {
    setOccupe(true)
    setMessage(undefined)
    try {
      if (avecCode) await creerCompteAvecCode(code, email.trim(), motDePasse)
      else await seConnecter(email.trim(), motDePasse)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (pret) valider() }}>
      {avecCode && (
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code reçu (ex. K7Q-2MX)" autoCapitalize="characters"
          autoComplete="off" className={`${champ} tracking-widest`} />
      )}
      <input type="email" inputMode="email" autoComplete="username" placeholder="ton@email.fr" value={email}
        onChange={(e) => setEmail(e.target.value)} className={champ} />
      <input type="password" autoComplete={avecCode ? 'new-password' : 'current-password'} placeholder="Mot de passe (6 caractères min.)" value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)} className={champ} />
      <Bouton type="submit" disabled={!pret}>{occupe ? 'Un instant…' : avecCode ? 'Créer mon compte' : 'Me connecter'}</Bouton>
      {message && <p className="text-sm text-[#f87171]">{message}</p>}
      {avecCode && <p className="text-xs text-texte-3">Sans code, pas de compte : c'est Titouan qui te le donne. Un code ne sert qu'une fois.</p>}
      <button type="button" className="w-full py-2 text-sm font-semibold text-accent" onClick={() => { setMode(avecCode ? 'connexion' : 'code'); setMessage(undefined) }}>
        {avecCode ? 'J’ai déjà un compte · Me connecter' : 'J’ai reçu un code · Créer mon compte'}
      </button>
    </form>
  )
}

/** Premier écran quand personne n'est connecté sur cet appareil. */
export function Entree() {
  return (
    <div className="pt-sur flex min-h-[100dvh] flex-col justify-center gap-5 px-4 pb-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold">Coach</h1>
        <p className="mt-1 text-sm text-texte-2">Ton entraînement vélo, réglé pour toi</p>
      </div>
      <Carte titre="Ton compte">
        <FormulaireCompte />
      </Carte>
    </div>
  )
}
