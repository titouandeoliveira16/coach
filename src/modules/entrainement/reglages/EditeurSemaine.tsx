import { verifierSemaineType, type Role } from '../../../metrics/programme'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
/** Ordre des flèches et couleur de chaque choix (dur orange, long bleu, Z2 vert, muscu violet). */
const ROLES: { role: Role; nom: string; couleur: string }[] = [
  { role: 'libre', nom: 'repos', couleur: 'text-texte-3' },
  { role: 'velo-z2', nom: 'endurance', couleur: 'text-z2' },
  { role: 'velo-dur', nom: 'intensité', couleur: 'text-accent' },
  { role: 'velo-long', nom: 'sortie longue', couleur: 'text-z3' },
  { role: 'renfo', nom: 'muscu', couleur: 'text-muscu' },
]
const fleche = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xl text-texte disabled:opacity-30'

/** Un choix qu'on fait défiler avec ‹ › (au lieu de toucher plusieurs fois). */
export function Defileur<T>({ options, valeur, onChoisir, couleur, etiquette }: {
  options: [string, T][]; valeur?: T; onChoisir: (v: T) => void; couleur?: string; etiquette?: string
}) {
  const i = options.findIndex(([, v]) => v === valeur)
  const aller = (pas: number) => onChoisir(options[(i + pas + options.length) % options.length][1])
  return (
    <span className="flex items-center gap-2">
      <button type="button" className={fleche} aria-label={`${etiquette ?? 'Choix'} : précédent`} onClick={() => aller(-1)}>‹</button>
      <span className={`min-w-28 text-center chiffre ${couleur ?? ''}`}>{i < 0 ? '—' : options[i][0]}</span>
      <button type="button" className={fleche} aria-label={`${etiquette ?? 'Choix'} : suivant`} onClick={() => aller(1)}>›</button>
    </span>
  )
}

/** Semaine type : une ligne par jour avec ‹ ›, et une phrase qui dit ce qui manque. */
export function EditeurSemaine({ semaine, onChanger, debutant }: { semaine: Role[]; onChanger: (t: Role[]) => void; debutant?: boolean }) {
  const verif = verifierSemaineType(semaine, debutant)
  return (
    <div>
      {JOURS.map((j, i) => {
        const x = ROLES.find((y) => y.role === semaine[i]) ?? ROLES[0]
        return (
          <div key={j} className="flex items-center justify-between py-1">
            <span className="text-texte-2">{j}</span>
            <Defileur etiquette={j} options={ROLES.map((y) => [y.nom, y.role])} valeur={x.role} couleur={x.couleur}
              onChoisir={(role) => onChanger(semaine.map((v, k) => (k === i ? role : v)))} />
          </div>
        )
      })}
      <p className={`mt-2 text-sm font-semibold ${verif.ok ? 'text-emerald-400' : 'text-accent'}`}>{verif.message}</p>
      <p className="mt-1 text-xs text-texte-3">intensité = séance dure · endurance = Z2 · repos = repos ou autre sport</p>
    </div>
  )
}
