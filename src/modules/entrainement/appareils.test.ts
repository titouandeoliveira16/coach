import { expect, it } from 'vitest'
import { avecZwift, conseilsConnexions, libelleEnvoiMontre } from './appareils'

it('appareils : boutons d’envoi et conseils de connexion selon le matériel (16/11/2026)', () => {
  expect(libelleEnvoiMontre(undefined)).toBe('Envoyer à Garmin')
  expect(libelleEnvoiMontre(['COROS', 'iGPSPORT'])).toBe('Envoyer à ma COROS')
  expect(libelleEnvoiMontre(['Polar'])).toBeUndefined()
  expect(avecZwift(['COROS'])).toBe(false)
  expect(avecZwift(['Zwift'])).toBe(true)
  const c = conseilsConnexions(['COROS', 'iGPSPORT'])
  expect(c.join(' ')).toMatch(/COROS/)
  expect(c.join(' ')).toMatch(/Compteur iGPSPORT/)
  expect(c.join(' ')).toMatch(/un seul des deux enregistre/)
  expect(conseilsConnexions(['Polar']).join(' ')).toMatch(/n’accepte pas/)
})
