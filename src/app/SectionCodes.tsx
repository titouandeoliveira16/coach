import { useEffect, useState } from 'react'
import { mesCodes, nouveauCode, type CodeInvitation } from '../core/inscription'
import { Repliable } from '../core/ui/Repliable'

/** Pour Titouan seulement (comptes « coach » sur le serveur) : créer un code d'inscription pour un élève, son frère… */
export function SectionCodes() {
  const [codes, setCodes] = useState<CodeInvitation[]>()
  const [pour, setPour] = useState('')
  const [message, setMessage] = useState<string>()
  useEffect(() => {
    mesCodes().then((r) => setCodes(r.codes)).catch(() => setCodes(undefined))
  }, [])
  // Pas coach (ou fonction pas encore installée) : rien à afficher
  if (!codes) return null
  const libres = codes.filter((c) => !c.utilise_le).length
  return (
    <Repliable titre="Inviter quelqu'un" resume={`${codes.length} code${codes.length > 1 ? 's' : ''} créé${codes.length > 1 ? 's' : ''}, ${libres} pas encore utilisé${libres > 1 ? 's' : ''}`}>
      <p className="text-sm text-texte-2">Un code par personne, à usage unique. Elle le saisit sur le premier écran de l'appli (« J'ai reçu un code »).</p>
      <div className="mt-2 flex gap-2">
        <input value={pour} onChange={(e) => setPour(e.target.value)} placeholder="Pour qui ? (facultatif)" className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-sm" />
        <button type="button" className="rounded-lg bg-accent px-3 text-sm font-bold text-fond"
          onClick={async () => {
            try {
              const { code } = await nouveauCode(pour.trim() || undefined)
              setMessage(`Code créé : ${code}`)
              setPour('')
              setCodes((await mesCodes()).codes)
            } catch (e) {
              setMessage((e as Error).message)
            }
          }}>Créer un code</button>
      </div>
      {message && <p className="mt-2 text-sm font-semibold text-accent">{message}</p>}
      <ul className="mt-2 divide-y divide-bordure text-sm">
        {codes.map((c) => (
          <li key={c.code} className="flex justify-between py-2">
            <span className="font-mono tracking-widest">{c.code}{c.pour && <span className="ml-2 font-sans tracking-normal text-texte-3">{c.pour}</span>}</span>
            <span className={c.utilise_le ? 'text-texte-3' : 'text-nutrition'}>{c.utilise_le ? 'utilisé' : 'libre'}</span>
          </li>
        ))}
      </ul>
    </Repliable>
  )
}
