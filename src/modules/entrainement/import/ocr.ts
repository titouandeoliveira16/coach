/**
 * Reconnaissance du texte d'une image (Tesseract, directement sur le téléphone : aucune image n'est envoyée).
 * Le moteur et le français sont servis par l'appli elle-même (dossier ocr/), sans site extérieur.
 */
const OCR = `${location.origin}${import.meta.env.BASE_URL}ocr/`

/** Niveaux de gris, et texte clair sur fond sombre inversé (mode sombre) : la reconnaissance est bien meilleure. */
async function preparer(fichier: File) {
  const image = await createImageBitmap(fichier)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const donnees = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const p = donnees.data
  let somme = 0
  for (let i = 0; i < p.length; i += 4) somme += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
  const sombre = somme / (p.length / 4) < 128
  for (let i = 0; i < p.length; i += 4) {
    let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
    if (sombre) g = 255 - g
    p[i] = p[i + 1] = p[i + 2] = g
  }
  ctx.putImageData(donnees, 0, 0)
  return canvas
}

export async function lireTexteImage(fichier: File, progression?: (part: number) => void) {
  const image = await preparer(fichier)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, {
    workerPath: `${OCR}worker.min.js`,
    corePath: OCR,
    langPath: OCR.slice(0, -1),
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => m.status === 'recognizing text' && progression?.(m.progress),
  })
  try {
    return (await worker.recognize(image)).data.text
  } finally {
    await worker.terminate()
  }
}
