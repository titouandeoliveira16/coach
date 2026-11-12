import { useEffect, useState } from 'react'
import { creerCompteAvecCode } from '../core/inscription'
import { CLE_SESSION_FERMEE, seConnecter } from '../core/synchro'
import { RoueCycle } from './RoueCycle'

const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent'

/** Connexion, ou création du compte avec le code donné par Titouan (les inscriptions libres sont fermées). */
export function FormulaireCompte() {
  const [mode, setMode] = useState<'connexion' | 'code'>('connexion')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  const [oubli, setOubli] = useState(false)
  // Session fermée parce que le compte s'est connecté sur un autre appareil
  const [fermee] = useState(() => {
    try { return !!sessionStorage.getItem(CLE_SESSION_FERMEE) } catch { return false }
  })
  useEffect(() => {
    try { sessionStorage.removeItem(CLE_SESSION_FERMEE) } catch { /* stockage indisponible */ }
  }, [])
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
      <button type="submit" disabled={!pret} className="presse w-full rounded-xl bg-white py-3.5 text-[17px] font-bold text-black disabled:opacity-40">{occupe ? 'Un instant…' : avecCode ? 'Créer mon compte' : 'Me connecter'}</button>
      {message && <p className="text-sm text-mauvais">{message}</p>}
      {fermee && <p className="text-sm text-attention">Ton compte s’est connecté sur un autre appareil : cette session a été fermée (une seule à la fois).</p>}
      {!avecCode && (
        <button type="button" className="w-full py-1 text-sm text-texte-2 underline" onClick={() => setOubli(!oubli)}>Mot de passe oublié ?</button>
      )}
      {oubli && !avecCode && (
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-texte-2">Contacte le créateur de l’appli (la personne qui t’a donné ton code) : il te remet un nouveau mot de passe.</p>
      )}
      {avecCode && <p className="text-xs text-texte-3">Sans code, pas de compte : c'est ton entraîneur qui te le donne. Un code ne sert qu'une fois.</p>}
      <button type="button" className="w-full py-1.5 text-sm text-texte-2" onClick={() => { setMode(avecCode ? 'connexion' : 'code'); setMessage(undefined) }}>
        {avecCode ? <>J’ai déjà un compte · <b className="text-texte">Me connecter</b></> : <>J’ai reçu un code · <b className="text-texte">Créer mon compte</b></>}
      </button>
    </form>
  )
}

/** Premier écran quand personne n'est connecté (maquette « E1 + auréole + roue », validée le 12/11/2026). */
export function Entree() {
  const [pose, setPose] = useState(false)
  const [mentions, setMentions] = useState(false)
  const apparait = (delai: number) => ({
    className: `transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(.22,1,.36,1)] ${pose ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`,
    style: { transitionDelay: `${delai}ms` },
  })
  return (
    <div className="pt-sur flex min-h-[100dvh] flex-col bg-fond px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3.5 pt-[9vh]">
        <div className="relative flex h-[150px] w-full items-center justify-center">
          {/* L'auréole blanche s'allume quand la roue s'est posée en C */}
          <div aria-hidden className={`pointer-events-none absolute top-1/2 left-1/2 size-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[6px] transition-[opacity,scale] duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] ${pose ? 'scale-100 opacity-100' : 'scale-60 opacity-0'}`}
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,.30) 0%, rgba(255,255,255,.135) 35%, rgba(255,255,255,0) 70%)' }} />
          <div className="relative"><RoueCycle taille={130} onFini={() => setPose(true)} /></div>
        </div>
        <h1 {...apparait(250)} className={`${apparait(250).className} text-[38px] font-extrabold tracking-[.06em] [font-stretch:125%]`}>CYCLE</h1>
        <p {...apparait(400)} className={`${apparait(400).className} text-center text-[15px] leading-snug text-texte-2`}>Ton plan vélo, ajusté chaque matin<br />à ta forme.</p>
      </div>
      <div {...apparait(600)} className={`${apparait(600).className} mt-auto pt-10`}>
        <FormulaireCompte />
        <button type="button" onClick={() => setMentions(!mentions)} className="mt-3 w-full text-center text-xs text-texte-3">Santé et données {mentions ? '▴' : '›'}</button>
        {/* Mentions santé et données (audit du 11/11/2026) */}
        {mentions && (
          <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-texte-3">
            <p><b className="text-texte-2">Santé.</b> Cycle donne des repères d'entraînement, il ne remplace pas un avis médical : en cas de doute ou de douleur, consulte un médecin (un certificat d'aptitude est conseillé). Moins de 15 ans : avec l'accord d'un parent.</p>
            <p><b className="text-texte-2">Tes données.</b> Elles (santé comprise : sommeil, VFC, poids) servent seulement à calculer ton plan, restent sur ton compte et ton téléphone, ne sont ni vendues ni partagées. Tu peux les exporter ou tout supprimer à tout moment (Réglages → Compte).</p>
          </div>
        )}
      </div>
    </div>
  )
}
