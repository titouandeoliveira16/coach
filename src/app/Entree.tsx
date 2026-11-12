import { useState } from 'react'
import { creerCompteAvecCode } from '../core/inscription'
import { seConnecter } from '../core/synchro'
import { changerAvecCode, envoyerLienMotDePasse } from '../core/motDePasse'
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
  const [info, setInfo] = useState<string>()
  // Mot de passe oublié : code reçu par e-mail + nouveau mot de passe
  const [oubli, setOubli] = useState(false)
  const [codeOubli, setCodeOubli] = useState('')
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
      {message && <p className="text-sm text-mauvais">{message}</p>}
      {!avecCode && (
        <button type="button" className="w-full py-1 text-sm text-texte-2 underline" onClick={async () => {
          if (!email.includes('@')) { setMessage('Écris d’abord ton e-mail ci-dessus, puis touche « Mot de passe oublié ».'); return }
          try {
            await envoyerLienMotDePasse(email.trim())
            setMessage(undefined)
            setInfo(`E-mail envoyé à ${email.trim()} (regarde aussi les indésirables). Tape le code qu’il contient ci-dessous, avec ton nouveau mot de passe.`)
            setOubli(true)
          } catch (e) { setMessage((e as Error).message) }
        }}>Mot de passe oublié ?</button>
      )}
      {info && <p className="text-sm text-bon">{info}</p>}
      {oubli && !avecCode && (
        <div className="space-y-2 rounded-xl border border-accent p-3">
          <input value={codeOubli} onChange={(e) => setCodeOubli(e.target.value)} placeholder="Code reçu par e-mail" inputMode="numeric" autoComplete="one-time-code"
            className={`${champ} tracking-widest`} />
          <p className="text-xs text-texte-3">Écris ton nouveau mot de passe dans le champ « Mot de passe » au-dessus.</p>
          <Bouton type="button" disabled={codeOubli.replace(/\D/g, '').length < 6 || motDePasse.length < 6 || occupe} onClick={async () => {
            setOccupe(true)
            setMessage(undefined)
            try {
              await changerAvecCode(email.trim(), codeOubli, motDePasse)
              setInfo(undefined)
              setOubli(false)
            } catch (e) { setMessage((e as Error).message) } finally { setOccupe(false) }
          }}>{occupe ? 'Un instant…' : 'Changer mon mot de passe'}</Bouton>
        </div>
      )}
      {avecCode && <p className="text-xs text-texte-3">Sans code, pas de compte : c'est ton entraîneur qui te le donne. Un code ne sert qu'une fois.</p>}
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
        <p className="mt-1 text-sm text-texte-2">Ton plan vélo calculé depuis ta course, ajusté chaque matin à ta récupération</p>
      </div>
      <Carte titre="Ton compte">
        <FormulaireCompte />
      </Carte>
      {/* Mentions santé et données (audit du 11/11/2026) */}
      <div className="space-y-1.5 px-1 text-xs leading-relaxed text-texte-3">
        <p><b className="text-texte-2">Santé.</b> Coach donne des repères d'entraînement, il ne remplace pas un avis médical : en cas de doute ou de douleur, consulte un médecin (un certificat d'aptitude est conseillé). Moins de 15 ans : avec l'accord d'un parent.</p>
        <p><b className="text-texte-2">Tes données.</b> Elles (santé comprise : sommeil, VFC, poids) servent seulement à calculer ton plan, restent sur ton compte et ton téléphone, ne sont ni vendues ni partagées. Tu peux les exporter ou tout supprimer à tout moment (Réglages → Compte).</p>
      </div>
    </div>
  )
}
