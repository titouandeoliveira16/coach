// Copie le moteur de lecture de texte (Tesseract) et le français dans public/ocr :
// l'appli les sert elle-même, sans dépendre d'un site extérieur.
import { copyFileSync, mkdirSync } from 'node:fs'

const dest = 'public/ocr'
mkdirSync(dest, { recursive: true })
const fichiers = {
  'node_modules/tesseract.js/dist/worker.min.js': 'worker.min.js',
  'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js': 'tesseract-core-lstm.wasm.js',
  'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js': 'tesseract-core-simd-lstm.wasm.js',
  'node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz': 'fra.traineddata.gz',
}
for (const [de, vers] of Object.entries(fichiers)) copyFileSync(de, `${dest}/${vers}`)
