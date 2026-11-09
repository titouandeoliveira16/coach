import { useEffect, useState, type ReactNode } from 'react'
import { aujourdhui } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { db } from '../../../core/db'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ANCIENNETES, DISCIPLINES_PROPOSEES, HEURES_RECENTES, NOMS_DISCIPLINES, NOMS_PHASES, type Role } from '../../../metrics/programme'
import { AIDES } from '../aides'
import { importerIntervals, relierIntervals } from '../import/intervals'
import { enregistrerArrivee, preparerArrivee, reponsesExistantes, SEMAINE_TYPE_DEPART, semaineDepuisJours, type EtatArrivee, type ReponsesArrivee } from './donnees'

const HEURES = ['Moins de 4 h', '4 à 6 h', '6 à 8 h', '8 à 10 h', '10 à 12 h', 'Plus de 12 h']
const MUSCU = ['Pas pour l’instant', '1 séance par semaine', '2 séances par semaine']
const ARRETS: [string, number][] = [['Non', 0], ['2 à 3 semaines', 2], ['1 mois ou plus', 4]]
const ROLES: { role: Role; court: string }[] = [
  { role: 'libre', court: '—' }, { role: 'velo-z2', court: 'Z2' }, { role: 'velo-dur', court: 'dur' }, { role: 'velo-long', court: 'long' }, { role: 'renfo', court: 'renfo' },
]
const LONGUES: [string, number, number][] = [['1 h à 1 h 30', 60, 90], ['1 h 30 à 2 h', 90, 120], ['2 h à 3 h', 120, 180], ['2 h 30 à 4 h', 150, 240]]
const COULEURS_PHASES: Record<string, string> = {
  reprise: '#60a5fa', entretien: '#34d399', vo2: '#4ade80', seuil: '#facc15', 'seuil-tirage': '#4ade80', 'seuil-maintien': '#facc15', 'fin-prepa': '#c084fc', specifique: '#fb923c', affutage: '#f87171',
}
const champ = 'block h-12 w-full min-w-0 rounded-xl border border-bordure bg-surface-2 px-3 text-base outline-none focus:border-accent'
const puce = (actif: boolean) => `rounded-full border px-3 py-1.5 text-sm ${actif ? 'border-accent bg-accent text-fond font-semibold' : 'border-bordure text-texte-2'}`

function Choix<T extends string | number | boolean>({ options, valeur, onChoisir }: { options: [string, T][]; valeur?: T; onChoisir: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([nom, v]) => <button key={nom} type="button" className={puce(valeur === v)} onClick={() => onChoisir(v)}>{nom}</button>)}
    </div>
  )
}
function Question({ libelle, aide, children }: { libelle: string; aide?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 border-b border-bordure pb-3 last:border-0 last:pb-0">
      <p className="text-sm text-texte-2">{libelle}</p>
      {aide && <p className="text-xs text-texte-3">{aide}</p>}
      {children}
    </div>
  )
}
/** « 2/11 » */
const jm = (d: string) => `${Number(d.slice(8, 10))}/${d.slice(5, 7)}`
const COURTS: Record<string, string> = { reprise: 'Base', entretien: 'Entretien', vo2: 'VO2', seuil: 'Seuil', 'seuil-tirage': 'Seuil +', 'seuil-maintien': 'Seuil', 'fin-prepa': 'SS + VO2', specifique: 'Course', affutage: 'Aff.' }
const nombre = (t: string) => (t.trim() === '' ? undefined : Number(t.replace(',', '.')) || undefined)

/** Questionnaire d'arrivée d'un compte créé avec un code : 4 étapes, la saison calculée, puis la montre (Intervals.icu). */
export function QuestionnaireArrivee({ montreSeulement = false }: { montreSeulement?: boolean }) {
  const [etape, setEtape] = useState(montreSeulement ? 4 : 0)
  const [r, setR] = useState<Partial<ReponsesArrivee>>({ sexe: 'homme', discipline: 'route', arretSemaines: 0, semaineType: SEMAINE_TYPE_DEPART, nutrition: false, maxSemaineMin: 75, minLongMin: 90, maxLongMin: 120 })
  const [textes, setTextes] = useState({ taille: '', poids: '', cp: '', fc: '' })
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  const maj = (c: Partial<ReponsesArrivee>) => setR({ ...r, ...c })
  // Compte déjà utilisé (ex. Titouan, passé au questionnaire) : réponses préremplies avec ce que l'appli sait déjà
  useEffect(() => {
    if (montreSeulement) return
    reponsesExistantes().then((x) => {
      if (!x) return
      setR((avant) => ({ ...avant, ...x.reponses }))
      setTextes((avant) => ({ ...avant, ...x.textes }))
    })
  }, [montreSeulement])
  const jour = aujourdhui()

  const reponses = (): ReponsesArrivee => ({
    ...(r as ReponsesArrivee), tailleCm: nombre(textes.taille), poidsKg: nombre(textes.poids), cpW: nombre(textes.cp), fcMax: nombre(textes.fc),
  })
  const pret = [
    !!r.naissance && !!nombre(textes.taille) && !!nombre(textes.poids),
    !!r.anciennete && !!r.heuresRecentes && r.intervalles !== undefined && !!r.heuresSemaine,
    !!r.semaineType?.includes('velo-long') && !!r.semaineType?.includes('velo-dur'),
    !!r.course?.date && r.course.date > jour,
  ]
  const apercu = etape === 3 && pret[3] ? preparerArrivee(reponses(), jour) : undefined

  const titres = ['Faisons connaissance', 'Ton profil', 'Ta semaine', 'Ton objectif', 'Relie ta montre']
  return (
    <div className="pt-sur mx-auto flex min-h-[100dvh] max-w-lg flex-col gap-3 px-4 pb-8">
      <div className="mt-4 flex gap-1.5">{titres.map((t, i) => <div key={t} className={`h-1 flex-1 rounded ${i <= etape ? 'bg-accent' : 'bg-bordure'}`} />)}</div>
      <h1 className="text-2xl font-bold">{titres[etape]}</h1>
      {etape === 0 && <p className="-mt-2 text-sm text-texte-2">5 étapes courtes. Tout se change ensuite dans Réglages.</p>}

      {etape === 0 && (
        <>
          <Carte titre="Toi">
            <div className="space-y-3">
              <Question libelle="Date de naissance"><input type="date" value={r.naissance ?? ''} onChange={(e) => maj({ naissance: e.target.value })} className={champ} /></Question>
              <Question libelle="Sexe" aide="Pour tes besoins en énergie (formule de Mifflin-St Jeor).">
                <Choix options={[['Homme', 'homme'], ['Femme', 'femme']]} valeur={r.sexe} onChoisir={(sexe) => maj({ sexe })} />
              </Question>
              <div className="grid grid-cols-2 gap-2 [&>div]:border-0">
                <Question libelle="Taille (cm)"><input inputMode="numeric" value={textes.taille} onChange={(e) => setTextes({ ...textes, taille: e.target.value })} className={champ} /></Question>
                <Question libelle="Poids (kg)"><input inputMode="decimal" value={textes.poids} onChange={(e) => setTextes({ ...textes, poids: e.target.value })} className={champ} /></Question>
              </div>
            </div>
          </Carte>
          <Carte titre="Ton vélo">
            <div className="space-y-3">
              <Question libelle="Ta CP ou ta FTP (W), si tu la connais" aide={AIDES.testDepart}>
                <input inputMode="numeric" placeholder="Vide si tu ne sais pas" value={textes.cp} onChange={(e) => setTextes({ ...textes, cp: e.target.value })} className={champ} />
              </Question>
              <Question libelle="Ta FC max (bpm), si tu la connais" aide="Vide : on part d'une estimation selon ton âge, remplacée par la plus haute vue dans tes sorties.">
                <input inputMode="numeric" placeholder="Vide si tu ne sais pas" value={textes.fc} onChange={(e) => setTextes({ ...textes, fc: e.target.value })} className={champ} />
              </Question>
              <p className="text-xs text-texte-3">L'appli demande un capteur de puissance (ou un home trainer connecté) : tes séances sont réglées en watts.</p>
            </div>
          </Carte>
        </>
      )}

      {etape === 1 && (
        <Carte>
          <div className="space-y-3">
            <Question libelle="Discipline visée">
              <Choix options={DISCIPLINES_PROPOSEES.map((d) => [NOMS_DISCIPLINES[d], d])} valeur={r.discipline} onChoisir={(discipline) => maj({ discipline })} />
            </Question>
            <Question libelle="Tu roules au moins 2 fois par semaine depuis…" aide="Sans arrêt de plus de 2 mois.">
              <Choix options={ANCIENNETES.map((x) => [x, x])} valeur={r.anciennete} onChoisir={(anciennete) => maj({ anciennete })} />
            </Question>
            <Question libelle="Heures de vélo par semaine ces 3 derniers mois">
              <Choix options={HEURES_RECENTES.map((x) => [x, x])} valeur={r.heuresRecentes} onChoisir={(heuresRecentes) => maj({ heuresRecentes })} />
            </Question>
            <Question libelle="Déjà suivi un plan avec des intervalles pendant au moins 6 semaines ?">
              <Choix options={[['Oui', true], ['Non', false]]} valeur={r.intervalles} onChoisir={(intervalles) => maj({ intervalles })} />
            </Question>
            <Question libelle="Arrêté le vélo ces dernières semaines ?" aide="Après un arrêt, la reprise est plus longue.">
              <Choix options={ARRETS} valeur={r.arretSemaines} onChoisir={(arretSemaines) => maj({ arretSemaines })} />
            </Question>
            <Question libelle="Temps disponible par semaine, à partir de maintenant">
              <Choix options={HEURES.map((x) => [x, x])} valeur={r.heuresSemaine} onChoisir={(heuresSemaine) => maj({ heuresSemaine })} />
            </Question>
            <Question libelle="Points sensibles (facultatif)">
              <input value={r.pointsSensibles ?? ''} placeholder="Ex. genoux, dos…" onChange={(e) => maj({ pointsSensibles: e.target.value })} className={champ} />
            </Question>
            <Question libelle="Conseil nutrition ?" aide="Tes besoins du jour selon tes séances, le repas du soir et un bilan le dimanche. Sans, le module n'apparaît pas : tu pourras l'activer plus tard dans Réglages → Mon profil sportif → Module nutrition.">
              <Choix options={[['Oui', true], ['Non', false]]} valeur={r.nutrition} onChoisir={(nutrition) => maj({ nutrition })} />
            </Question>
            <Question libelle="Musculation">
              <Choix options={MUSCU.map((x) => [x, x])} valeur={r.muscu} onChoisir={(muscu) => maj({ muscu })} />
            </Question>
          </div>
        </Carte>
      )}

      {etape === 2 && (
        <Carte titre="Ta semaine type : touche un jour">
          <div className="mb-3">
            <Question libelle="Jours de vélo par semaine" aide="À partir de 4 jours, 2 séances intensives par semaine (sauf en débutant) ; avec 3, une seule et ta sortie longue avec des blocs au 1er seuil.">
              <Choix options={[3, 4, 5, 6].map((n) => [`${n} jours`, n])} valeur={r.semaineType?.filter((x) => x.startsWith('velo')).length}
                onChoisir={(n) => maj({ semaineType: semaineDepuisJours(n) })} />
            </Question>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {(r.semaineType ?? SEMAINE_TYPE_DEPART).map((role, i) => {
              const x = ROLES.find((y) => y.role === role) ?? ROLES[0]
              return (
                <button key={i} type="button" className={`rounded-lg border py-2 ${role === 'velo-dur' ? 'border-accent text-accent' : 'border-bordure'} ${role === 'libre' ? 'text-texte-3' : ''}`}
                  onClick={() => {
                    const suivant = ROLES[(ROLES.indexOf(x) + 1) % ROLES.length].role
                    // Un seul jour dur et une seule sortie longue : l'ancien jour devient une Z2
                    const t = (r.semaineType ?? SEMAINE_TYPE_DEPART).map((v, j) => (j === i ? suivant : (suivant === 'velo-dur' || suivant === 'velo-long') && v === suivant ? 'velo-z2' : v))
                    maj({ semaineType: t })
                  }}>
                  <span className="block text-texte-3">{'LMMJVSD'[i]}</span>{x.court}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-texte-3">1 jour dur, 1 sortie longue, le reste en Z2 (endurance) ; — = repos ou autre sport. La 2e séance intensive se place toute seule sur une Z2, au moins 48 h après la première.</p>
          <div className="mt-3 space-y-3">
            <Question libelle="Vélo en semaine, au plus">
              <Choix options={[45, 60, 75, 90, 120].map((m) => [`${m} min`, m])} valeur={r.maxSemaineMin} onChoisir={(maxSemaineMin) => maj({ maxSemaineMin })} />
            </Question>
            <Question libelle="Sortie longue">
              <Choix options={LONGUES.map(([nom, a]) => [nom, a])} valeur={r.minLongMin}
                onChoisir={(minLongMin) => maj({ minLongMin, maxLongMin: LONGUES.find((x) => x[1] === minLongMin)![2] })} />
            </Question>
          </div>
        </Carte>
      )}

      {etape === 3 && (
        <>
          <Carte titre="Ta course principale">
            <div className="space-y-3">
              <Question libelle="Nom"><input value={r.course?.nom ?? ''} placeholder="Ex. cyclosportive, manche XCO…" onChange={(e) => maj({ course: { date: r.course?.date ?? '', nom: e.target.value } })} className={champ} /></Question>
              <Question libelle="Date"><input type="date" min={jour} value={r.course?.date ?? ''} onChange={(e) => maj({ course: { nom: r.course?.nom ?? '', date: e.target.value } })} className={champ} /></Question>
              {r.discipline === 'route' && (
                <Question libelle="Type de course" aide="On ne prépare pas une course FFC comme une cyclosportive : les 3 dernières semaines changent.">
                  <Choix options={[['Course en ligne (FFC, UFOLEP…)', 'en-ligne'], ['Cyclosportive, longue distance', 'cyclo']]} valeur={r.typeCourse ?? 'cyclo'} onChoisir={(typeCourse) => maj({ typeCourse })} />
                </Question>
              )}
            </div>
          </Carte>
          {apercu && (
            <Carte titre="Ta saison, calculée pour toi" className="border-accent!">
              <div className="flex h-7 overflow-hidden rounded-lg text-[10px] font-bold text-fond">
                {apercu.saison.phases.filter((p) => p.type !== 'recuperation' && p.type !== 'entretien' || p.debut < r.course!.date).map((p, i, l) => {
                  const fin = l[i + 1]?.debut ?? r.course!.date
                  const n = Math.max(1, Math.round((Date.parse(fin) - Date.parse(p.debut)) / (7 * 86_400_000)))
                  return <div key={p.debut} style={{ flex: n, background: COULEURS_PHASES[p.type] ?? '#9ca3af' }} className="flex items-center justify-center overflow-hidden whitespace-nowrap">{n >= 2 ? COURTS[p.type] : ''}</div>
                })}
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-texte-2">
                {apercu.saison.phases.filter((p) => p.debut <= r.course!.date).map((p) => <li key={p.debut}>{jm(p.debut)} · {NOMS_PHASES[p.type]}</li>)}
                <li>{jm(r.course!.date)} · 🏁 {r.course!.nom || 'ta course'}</li>
              </ul>
              <p className="mt-2 text-xs text-texte-3">
                {apercu.saison.semaines} semaines · tests CP : {apercu.saison.testsCp.map(jm).join(', ') || 'aucun (course trop proche)'}.
                {!apercu.cpConnue && ` Sans CP connue, on part de ${apercu.entrainement.cpW} W en attendant ton 1er test.`} {AIDES.saisonCalculee}
              </p>
            </Carte>
          )}
        </>
      )}

      {etape === 4 && <Montre />}

      {message && <p className="text-sm text-[#f87171]">{message}</p>}
      {etape < 4 && (
        <div className="mt-auto flex gap-2 pt-2">
          {etape > 0 && <Bouton variante="secondaire" className="flex-1" onClick={() => setEtape(etape - 1)}>Retour</Bouton>}
          <Bouton className="flex-[2]" disabled={!pret[etape] || occupe} onClick={async () => {
            if (etape < 3) return setEtape(etape + 1)
            setOccupe(true)
            setMessage(undefined)
            try {
              await enregistrerArrivee(reponses())
              setEtape(4)
            } catch (e) {
              setMessage((e as Error).message)
            } finally {
              setOccupe(false)
            }
          }}>{etape < 3 ? 'Suivant' : occupe ? 'Un instant…' : 'C’est parti'}</Bouton>
        </div>
      )}
    </div>
  )
}

const ETAPES_MONTRE: { titre: string; points: string[]; lien?: [string, string] }[] = [
  {
    titre: 'Crée ton compte Intervals.icu',
    points: ['C’est gratuit : inscris-toi avec ton email (ou ton compte Google).', 'Intervals.icu récupère les sorties de presque toutes les montres et compteurs, et les transmet à l’appli.'],
    lien: ['Ouvrir intervals.icu', 'https://intervals.icu'],
  },
  {
    titre: 'Relie ta montre et ton compteur',
    points: [
      'Sur Intervals : menu ☰ → Settings → rubrique « Connections ».',
      'Touche « Connect » à côté de chacun de tes appareils : Garmin Connect, COROS, Wahoo, Polar, Suunto ou Zwift, et accepte le partage.',
      'Ne passe pas par Strava : Strava interdit de transmettre tes sorties à d’autres applis.',
    ],
    lien: ['Ouvrir les réglages Intervals', 'https://intervals.icu/settings'],
  },
  {
    titre: 'Copie ta clé',
    points: ['Toujours dans Settings, tout en bas : « Developer Settings ».', 'À la ligne « API Key », touche « View » (ou « Generate »), puis copie la clé.'],
  },
  {
    titre: 'Colle-la ici',
    points: ['Elle est gardée chiffrée sur le serveur et sert seulement à lire tes sorties (durée, puissance, fréquence cardiaque) et ta VFC de la nuit. Jamais ta trace GPS.'],
  },
]

/** Dernière étape : relier sa montre via Intervals.icu (indispensable pour que l'appli voie tes séances). */
function Montre() {
  const [cle, setCle] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  const finir = (montre: EtatArrivee['montre']) => db.reglages.get('arrivee').then((a) => enregistrer(db.reglages, { id: 'arrivee', valeur: { ...(a?.valeur as EtatArrivee), montre } }))
  return (
    <>
      <p className="-mt-2 text-sm text-texte-2">Ta saison est prête. Dernière étape : relier ta montre, pour que l'appli voie tes séances toute seule.</p>
      {ETAPES_MONTRE.map((e, i) => (
        <Carte key={e.titre} titre={`${i + 1}. ${e.titre}`}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-texte-2">{e.points.map((p) => <li key={p}>{p}</li>)}</ul>
          {e.lien && <a href={e.lien[1]} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-surface-2 px-4 py-3 text-center text-sm font-semibold text-accent">{e.lien[0]} ↗</a>}
          {i === ETAPES_MONTRE.length - 1 && (
            <div className="mt-3 space-y-2">
              <input value={cle} onChange={(x) => setCle(x.target.value)} placeholder="Ta clé API Intervals.icu" autoComplete="off" autoCapitalize="off" spellCheck={false} className={champ} />
              <Bouton disabled={occupe || cle.trim().length < 10} onClick={async () => {
                setOccupe(true)
                setMessage(undefined)
                try {
                  await relierIntervals(cle.trim())
                  await importerIntervals().catch(() => {})
                  await finir('reliee')
                } catch (err) {
                  setMessage((err as Error).message)
                } finally {
                  setOccupe(false)
                }
              }}>{occupe ? 'Vérification…' : 'Relier ma montre'}</Bouton>
            </div>
          )}
        </Carte>
      ))}
      {message && <p className="text-sm text-[#f87171]">{message}</p>}
      <button type="button" className="py-2 text-sm text-texte-3" onClick={() => finir('plus-tard')}>Plus tard (Entraînement → Réglages → Intervals.icu)</button>
    </>
  )
}
