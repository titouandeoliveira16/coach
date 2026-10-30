// Fonction serveur Supabase « agenda » (Deno) : tes séances prévues en calendrier iCal, à suivre dans Google Agenda
// (Autres agendas → + → À partir de l'URL). « Verify JWT » désactivé : Google ne peut pas se connecter.
//
//   GET /agenda?cle=…   → fichier .ics (journées entières), de 14 jours avant à 90 jours après aujourd'hui.
//
// La clé est créée dans l'appli (Entraînement → Réglages → Google Agenda) et rangée dans le réglage synchronisé
// « agenda » ; sans clé valide, rien n'est renvoyé. Google relit le lien toutes les quelques heures.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type Prevue = {
  id: string; date: string; sport: string; titre: string; detail?: string; dureeMin?: number; kjPrevu?: number
  statut: string; homeTrainer?: boolean
}

const ICONES: Record<string, string> = { velo: '🚴', course: '🏃', natation: '🏊', renfo: '🏋️' }
const AFFICHES = new Set(['prevue', 'faite'])

/** Texte iCal : antislash, virgule, point-virgule et retours à la ligne échappés. */
const echapper = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Lignes de 75 octets au plus (RFC 5545), coupées sans casser un caractère. */
function plier(ligne: string) {
  const enc = new TextEncoder()
  const morceaux: string[] = []
  let courant = ''
  for (const c of ligne) {
    if (enc.encode(courant + c).length > (morceaux.length ? 74 : 75)) {
      morceaux.push(courant)
      courant = ''
    }
    courant += c
  }
  morceaux.push(courant)
  return morceaux.join('\r\n ')
}

const jourIcal = (d: string) => d.replaceAll('-', '')
const lendemain = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
const horodatage = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

function evenement(p: Prevue, modifieLe: string) {
  const faite = p.statut === 'faite'
  const titre = `${faite ? '✓ ' : ''}${ICONES[p.sport] ?? '🤸'} ${p.titre}`
  const infos = [p.dureeMin ? `${p.dureeMin} min` : '', p.kjPrevu ? `${p.kjPrevu} kJ` : ''].filter(Boolean).join(' · ')
  const description = [infos, p.detail ?? '', 'Coach : https://titouandeoliveira16.github.io/coach/'].filter(Boolean).join('\n')
  return [
    'BEGIN:VEVENT',
    `UID:${p.id}@coach`,
    `DTSTAMP:${horodatage(modifieLe)}`,
    `LAST-MODIFIED:${horodatage(modifieLe)}`,
    `DTSTART;VALUE=DATE:${jourIcal(p.date)}`,
    `DTEND;VALUE=DATE:${jourIcal(lendemain(p.date))}`,
    `SUMMARY:${echapper(titre)}`,
    `DESCRIPTION:${echapper(description)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].map(plier)
}

Deno.serve(async (req) => {
  const cle = new URL(req.url).searchParams.get('cle') ?? ''
  if (!/^[0-9a-f]{32,64}$/.test(cle)) return new Response('Lien invalide', { status: 404 })
  const { data: proprio } = await admin.from('donnees').select('user_id').eq('table_nom', 'reglages').eq('cle', 'agenda')
    .eq('supprime', false).eq('valeur->>cle', cle).maybeSingle()
  if (!proprio) return new Response('Lien invalide', { status: 404 })

  const aujourdhui = new Date().toISOString().slice(0, 10)
  const debut = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)
  const fin = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await admin.from('donnees').select('valeur, modifie_le').eq('user_id', proprio.user_id)
    .eq('table_nom', 'prevues').eq('supprime', false).gte('valeur->>date', debut).lte('valeur->>date', fin)
  const lignes = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Coach//Seances//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Coach · séances', 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ]
  for (const d of data ?? []) {
    const p = d.valeur as Prevue
    // Les séances passées non faites, abandonnées ou « à reporter » (sans date) disparaissent
    if (!AFFICHES.has(p.statut) || (p.statut !== 'faite' && p.date < aujourdhui)) continue
    lignes.push(...evenement(p, d.modifie_le))
  }
  lignes.push('END:VCALENDAR')
  return new Response(lignes.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
})
