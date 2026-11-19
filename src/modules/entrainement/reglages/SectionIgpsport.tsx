import { useEffect, useState } from 'react'
import { depuis, pluriel } from '../../../core/format'
import { useSynchro } from '../../../core/synchro'
import { Bouton } from '../../../core/ui/Bouton'
import { Repliable } from '../../../core/ui/Repliable'
import { delierIgpsport, etatIgpsport, relierIgpsport, synchroIgpsport, type EtatIgpsport } from '../import/igpsport'

const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 outline-none focus:border-accent'

/** Compteur iGPSPORT : ses sorties remontent toutes seules (via Intervals.icu), historique compris (16/11/2026). */
export function SectionIgpsport() {
  const { session } = useSynchro()
  const [etat, setEtat] = useState<EtatIgpsport>()
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()

  const rafraichir = () => etatIgpsport().then(setEtat).catch((e) => setMessage((e as Error).message))
  useEffect(() => { if (session) rafraichir() }, [session])

  const agir = async (action: () => Promise<string | void>) => {
    setOccupe(true)
    setMessage(undefined)
    try {
      const m = await action()
      if (m) setMessage(m)
      await rafraichir()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }
  const bilan = (r: { envoyees: number; reste: number; erreur?: string }) =>
    r.erreur ?? `✓ ${pluriel(r.envoyees, 'sortie envoyée', 'sorties envoyées')}${r.reste ? ` · encore ${r.reste} dans ton historique : elles arrivent toutes seules, par paquets, toutes les 15 min` : ''}.`

  const resume = !session ? 'Connecte-toi à ton compte'
    : etat?.relie ? (etat.erreur ? <span className="text-attention">⚠︎ {etat.erreur}</span>
      : <span className="text-nutrition">✓ Relié{etat.derniereSynchro ? ` · ${depuis(etat.derniereSynchro)}` : ''}{etat.reste ? ` · historique : encore ${etat.reste}` : ''}</span>)
    : etat ? 'Pas relié' : ''

  return (
    <Repliable titre="Compteur iGPSPORT" libelle="Gérer" resume={resume}>
      {!session ? (
        <p className="text-sm text-texte-2">Connecte-toi à ton compte (Accueil → Réglages).</p>
      ) : etat?.relie ? (
        <div className="space-y-2">
          <p className="text-sm text-texte-2">
            Compte {etat.identifiant} · {pluriel(etat.importees ?? 0, 'sortie envoyée', 'sorties envoyées')} dans Intervals.icu{etat.reste ? `, encore ${etat.reste} dans ton historique` : ''}.
            Les nouvelles arrivent toutes seules toutes les 15 minutes.
          </p>
          {etat.erreur && <p className="text-sm text-attention">{etat.erreur}</p>}
          <Bouton disabled={occupe} onClick={() => agir(async () => bilan(await synchroIgpsport()))}>{occupe ? 'Récupération…' : 'Récupérer maintenant'}</Bouton>
          <p className="mt-2 text-xs text-texte-3">Pour mettre une séance sur ton compteur : ouvre-la (Aujourd'hui ou Semaine) et touche « Envoyer à mon compteur ».</p>
          <button type="button" className="w-full py-2 text-sm text-texte-3" disabled={occupe}
            onClick={() => confirm('Délier ton compteur iGPSPORT ? Les sorties déjà envoyées restent.') && agir(async () => { await delierIgpsport() })}>
            Délier iGPSPORT
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-texte-2">
            Tes sorties enregistrées par ton compteur iGPSPORT remontent toutes seules, tout ton historique compris : l'appli les
            envoie dans ton Intervals.icu (relie-le d'abord, juste au-dessus), puis les importe.
          </p>
          <p className="text-xs text-texte-3">
            iGPSPORT n'a pas de lien officiel : l'appli se connecte à ton compte comme le site d'iGPSPORT. Ton mot de passe est
            gardé chiffré sur le serveur et sert seulement à lire tes sorties. Si iGPSPORT change son site, le lien peut s'arrêter :
            l'appli te le dira ici. Enregistre chaque sortie avec un seul appareil (sinon elle compte deux fois).
          </p>
          <input placeholder="Email du compte iGPSPORT" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} type="email" inputMode="email"
            autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Email du compte iGPSPORT" className={champ} />
          <input placeholder="Mot de passe iGPSPORT" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} type="password"
            autoComplete="off" aria-label="Mot de passe iGPSPORT" className={champ} />
          <Bouton disabled={occupe || !identifiant.includes('@') || !motDePasse} onClick={() => agir(async () => {
            const r = await relierIgpsport(identifiant.trim(), motDePasse)
            setMotDePasse('')
            return `Relié. ${bilan(r)}`
          })}>
            {occupe ? 'Connexion à iGPSPORT…' : 'Relier mon compteur iGPSPORT'}
          </Bouton>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}
    </Repliable>
  )
}
