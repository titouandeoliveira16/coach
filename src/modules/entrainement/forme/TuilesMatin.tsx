import { useLiveQuery } from 'dexie-react-hooks'
import { Moon, Scale } from 'lucide-react'
import { useState } from 'react'
import { aujourdhui, decalerJour, depuisJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { formatNombre } from '../../../core/format'
import { analyserSommeil, enHeures, etatSommeil } from '../../../metrics/signal'
import { plagesForme } from '../../../metrics/plages'
import { mesureUtile, scoreRessenti } from './donnees'
import { lireSansPesee, peseesValides } from './pesees'

const VERT = 'var(--color-bon)'
const ORANGE = 'var(--color-attention)'

/** Petite courbe (tuile fermée) : la tuile nomme la série. */
function MiniCourbe({ valeurs }: { valeurs: number[] }) {
  if (valeurs.length < 2) return <div className="h-7" />
  const min = Math.min(...valeurs), max = Math.max(...valeurs)
  const y = (v: number) => (max === min ? 14 : 26 - ((v - min) / (max - min)) * 22)
  const pts = valeurs.map((v, i) => [(i / (valeurs.length - 1)) * 100, y(v)])
  const [dx, dy] = pts.at(-1)!
  return (
    <svg viewBox="-3 -3 106 36" preserveAspectRatio="none" className="trace mt-1.5 h-7 w-full overflow-visible" aria-hidden>
      <polyline points={pts.map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`).join(' ')} fill="none" stroke="var(--color-texte-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={dx} cy={dy} r="3" fill="var(--color-texte)" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const court = (h: number) => enHeures(h).replace(' h 00', ' h')
const ressentiMot = (r: number) => (r < 2.5 ? 'en baisse' : r >= 4 ? 'très bon' : 'bon')
const ecartKg = (kg: number) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${formatNombre(Math.abs(kg), 1)} kg`

function Chiffre({ titre, valeur, couleur }: { titre: string; valeur: string; couleur?: string }) {
  return (
    <span className="flex-1 rounded-[10px] bg-surface-2 px-2 py-2">
      <span className="block text-[11px] text-texte-3">{titre}</span>
      <b className="block text-[15px] leading-tight" style={{ color: couleur }}>{valeur}</b>
    </span>
  )
}

function EnTeteOuvert({ Icone, couleur, titre, onFermer }: { Icone: typeof Moon; couleur: string; titre: string; onFermer: () => void }) {
  return (
    <button type="button" onClick={onFermer} className="flex w-full items-center justify-between">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-texte-2"><Icone className="h-4 w-4" style={{ color: couleur }} strokeWidth={2} />{titre}</span>
      <span className="text-[13px] font-semibold text-accent">Réduire ▴</span>
    </button>
  )
}

/**
 * Sous « Ta forme » (maquette P, 12/11/2026) : deux cases, Nuit (en gros, avec le ressenti en petit) et Poids (avec sa
 * petite courbe). Toucher une case l'ouvre sur toute la largeur : 14 dernières nuits, ou 4 dernières semaines de pesées.
 */
export function TuilesMatin({ onPoids }: { onPoids?: () => void } = {}) {
  const jour = aujourdhui()
  const [ouverte, setOuverte] = useState<'nuit' | 'poids'>()
  const d = useLiveQuery(async () => {
    const mesures = (await db.mesures.where('date').between(decalerJour(jour, -40), jour, true, true).toArray()).map(mesureUtile)
    const pesees = (await peseesValides()).filter((p) => p.date >= decalerJour(jour, -28)).reverse()
    const sansPesee = (await lireSansPesee()).includes(jour)
    return { mesures, pesees, sansPesee }
  }, [jour])
  if (!d) return null

  // Nuit
  const nuits = d.mesures.map((m) => ({ date: m.date, h: m.sommeilH }))
  const sommeil = analyserSommeil(nuits, jour)
  const courte = etatSommeil(sommeil).nuitCourte
  const nuit = sommeil.nuit
  const matin = d.mesures.find((m) => m.date === jour)
  const ressenti = matin ? scoreRessenti(matin) : undefined
  const plage = plagesForme({ nBase: 0 }, sommeil)[2]

  // Poids
  const poids = d.pesees.at(-1)
  const ilYa = (n: number) => [...d.pesees].reverse().find((p) => p.date <= decalerJour(jour, -n))
  const sur2 = poids && ilYa(14) ? poids.poidsKg - ilYa(14)!.poidsKg : undefined
  const premier = d.pesees[0]
  const semaines = poids && premier && poids.date > premier.date ? (Date.parse(poids.date) - Date.parse(premier.date)) / (7 * 86_400_000) : 0

  if (ouverte === 'nuit') {
    const quatorze = Array.from({ length: 14 }, (_, i) => decalerJour(jour, i - 13))
    const h = (j: string) => nuits.find((n) => n.date === j)?.h
    const lo = Math.min(5, ...quatorze.map((j) => h(j) ?? 9)) - 0.2
    const hi = Math.max(9, ...quatorze.map((j) => h(j) ?? 0)) + 0.2
    const Y = (v: number) => 120 - ((v - lo) / (hi - lo)) * 120
    const bw = 320 / 14
    const moy7 = quatorze.map((j) => analyserSommeil(nuits, j).moyenne7)
    const ligne = moy7.map((m, i) => (m !== undefined ? `${(i * bw + bw / 2).toFixed(1)},${Y(m).toFixed(1)}` : '')).filter(Boolean).join(' ')
    return (
      <div className="entree shrink-0 rounded-[14px] border-[1.5px] border-accent bg-surface p-3.5">
        <EnTeteOuvert Icone={Moon} couleur="var(--color-sommeil)" titre="Nuit" onFermer={() => setOuverte(undefined)} />
        <p className="mt-1 flex items-baseline gap-2.5"><span className="chiffre text-[30px]" style={{ color: nuit === undefined ? undefined : courte ? ORANGE : VERT }}>{nuit !== undefined ? enHeures(nuit) : '—'}</span><span className="text-[13px] text-texte-2">cette nuit</span></p>
        <p className="mt-2.5 text-xs text-texte-2">14 dernières nuits · pointillés : moyenne sur 7 nuits</p>
        <svg viewBox="0 0 320 138" className="mt-1 w-full" aria-label="Durée de tes 14 dernières nuits">
          {plage.bas !== undefined && plage.haut !== undefined && <rect x="0" y={Y(plage.haut)} width="320" height={Y(plage.bas) - Y(plage.haut)} rx="3" fill="#2c2c2e" />}
          {quatorze.map((j, i) => {
            const v = h(j)
            if (v === undefined) return null
            const basse = plage.bas !== undefined && v < plage.bas
            return <rect key={j} x={i * bw + 3} y={Y(v)} width={bw - 6} height={120 - Y(v)} rx="3" fill={basse ? ORANGE : 'var(--color-sommeil)'} opacity={i === 13 ? 1 : 0.75} />
          })}
          {ligne && <polyline points={ligne} fill="none" stroke="var(--color-texte)" strokeWidth="2" strokeDasharray="4 3" />}
          {quatorze.map((j, i) => <text key={j} x={i * bw + bw / 2} y="134" textAnchor="middle" fontSize="10" fill="var(--color-texte-3)">{depuisJour(j).toLocaleDateString('fr-FR', { weekday: 'narrow' })}</text>)}
        </svg>
        <div className="mt-2.5 flex gap-1.5">
          <Chiffre titre="Moyenne 7 nuits" valeur={sommeil.moyenne7 !== undefined ? enHeures(sommeil.moyenne7) : '—'} couleur={sommeil.moyenne7 !== undefined && plage.bas !== undefined && sommeil.moyenne7 < plage.bas ? ORANGE : undefined} />
          <Chiffre titre="Ta normale" valeur={plage.bas !== undefined && plage.haut !== undefined ? `${court(plage.bas)} – ${court(plage.haut)}` : '—'} />
          <Chiffre titre="Ressenti" valeur={ressenti !== undefined ? `${formatNombre(ressenti, 1)} / 5` : '—'} couleur={ressenti !== undefined ? (ressenti < 2.5 ? ORANGE : VERT) : undefined} />
        </div>
      </div>
    )
  }

  if (ouverte === 'poids') {
    const p = d.pesees
    const kg = p.map((x) => x.poidsKg)
    const lo = Math.floor((Math.min(...kg, poids?.poidsKg ?? 70) - 0.3) * 2) / 2
    const hi = Math.ceil((Math.max(...kg, poids?.poidsKg ?? 70) + 0.3) * 2) / 2
    const X = (date: string) => ((28 - Math.round((Date.parse(jour) - Date.parse(date)) / 86_400_000)) / 28) * 316 + 2
    const Y = (v: number) => 110 - ((v - lo) / Math.max(0.5, hi - lo)) * 104
    const pts = p.map((x) => `${X(x.date).toFixed(1)},${Y(x.poidsKg).toFixed(1)}`).join(' ')
    const graduations = [Math.ceil(lo), Math.floor(hi)].filter((v, i, t) => t.indexOf(v) === i && v > lo && v < hi)
    return (
      <div className="entree shrink-0 rounded-[14px] border-[1.5px] border-accent bg-surface p-3.5">
        <EnTeteOuvert Icone={Scale} couleur="var(--color-texte-3)" titre="Poids" onFermer={() => setOuverte(undefined)} />
        <p className="mt-1 flex items-baseline gap-2.5">
          <span className="chiffre text-[30px]">{poids ? `${formatNombre(poids.poidsKg, 1)} kg` : '—'}</span>
          {poids && <span className="text-[13px] text-texte-2">{poids.date === jour ? 'pesé ce matin' : `pesé ${depuisJour(poids.date).toLocaleDateString('fr-FR', { weekday: 'long' })}`}</span>}
        </p>
        <p className="mt-2.5 text-xs text-texte-2">4 dernières semaines</p>
        {p.length >= 2 ? (
          <svg viewBox="0 0 320 128" className="mt-1 w-full" aria-label="Tes pesées des 4 dernières semaines">
            {graduations.map((v) => (
              <g key={v}><line x1="0" x2="320" y1={Y(v)} y2={Y(v)} stroke="var(--color-bordure)" /><text x="2" y={Y(v) - 3} fontSize="10" fill="var(--color-texte-3)">{v} kg</text></g>
            ))}
            <polygon points={`${X(p[0].date)},112 ${pts} ${X(p.at(-1)!.date)},112`} fill="rgba(161,161,166,0.12)" />
            <polyline points={pts} fill="none" stroke="var(--color-texte-2)" strokeWidth="2" strokeLinejoin="round" />
            {p.map((x, i) => <circle key={x.date} cx={X(x.date)} cy={Y(x.poidsKg)} r={i === p.length - 1 ? 4.5 : 2.5} fill={i === p.length - 1 ? 'var(--color-texte)' : 'var(--color-texte-2)'} />)}
            {[28, 14, 0].map((n) => <text key={n} x={n === 28 ? 2 : n === 0 ? 318 : 160} y="126" textAnchor={n === 28 ? 'start' : n === 0 ? 'end' : 'middle'} fontSize="10" fill="var(--color-texte-3)">{depuisJour(decalerJour(jour, -n)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>)}
          </svg>
        ) : <p className="mt-2 text-sm text-texte-3">Pèse-toi quelques matins pour voir ta courbe.</p>}
        <div className="mt-2.5 flex gap-1.5">
          <Chiffre titre="En 2 semaines" valeur={sur2 !== undefined ? ecartKg(sur2) : '—'} />
          <Chiffre titre="En 4 semaines" valeur={poids && premier && premier !== poids ? ecartKg(poids.poidsKg - premier.poidsKg) : '—'} />
          <Chiffre titre="Par semaine" valeur={poids && premier && semaines >= 1 ? ecartKg((poids.poidsKg - premier.poidsKg) / semaines) : '—'} />
        </div>
        {onPoids && <button type="button" onClick={onPoids} className="presse mt-2.5 min-h-11 w-full rounded-xl bg-accent text-[15px] font-bold text-fond">Nouvelle pesée</button>}
      </div>
    )
  }

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2">
      <button type="button" onClick={() => setOuverte('nuit')} className="presse entree rounded-[14px] border-[1.5px] border-transparent bg-surface p-3 text-left">
        <span className="flex items-center justify-between text-xs text-texte-2"><span className="flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" style={{ color: 'var(--color-sommeil)' }} strokeWidth={2} />Nuit</span><span className="text-texte-3">▾</span></span>
        <span className="chiffre mt-1 block text-[26px] leading-tight" style={{ color: nuit === undefined ? undefined : courte ? ORANGE : VERT }}>{nuit !== undefined ? enHeures(nuit) : '—'}</span>
        <span className="mt-1 block text-xs text-texte-2">
          {ressenti !== undefined ? <>Ressenti <b style={{ color: ressenti < 2.5 ? ORANGE : VERT }}>{ressentiMot(ressenti)} · {formatNombre(ressenti, 1)} / 5</b></> : 'Ressenti pas noté'}
        </span>
      </button>
      <button type="button" onClick={() => setOuverte('poids')} className="presse entree rounded-[14px] border-[1.5px] border-transparent bg-surface p-3 text-left">
        <span className="flex items-center justify-between text-xs text-texte-2"><span className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 text-texte-3" strokeWidth={2} />Poids</span><b className="text-base text-texte">{poids ? `${formatNombre(poids.poidsKg, 1)} kg` : '—'}</b></span>
        <MiniCourbe valeurs={d.pesees.slice(-7).map((p) => p.poidsKg)} />
        <span className={`mt-1 block text-[11px] ${poids?.date !== jour && !d.sansPesee ? 'text-accent' : 'text-texte-3'}`}>
          {poids?.date !== jour && !d.sansPesee ? 'à peser ce matin' : sur2 !== undefined ? `${ecartKg(sur2)} en 2 semaines` : ' '}
        </span>
      </button>
    </div>
  )
}
