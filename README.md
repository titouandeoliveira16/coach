# Coach

Application personnelle (PWA) de coaching : entraînement, puis nutrition, apprentissage et argent.

- Données stockées uniquement sur l'appareil (IndexedDB), sauvegarde en JSON.
- Stack : React + Vite + TypeScript + Tailwind, vite-plugin-pwa.
- Publiée automatiquement sur GitHub Pages à chaque envoi sur `main`.

## Développement

```bash
npm install
npm run dev      # serveur local
npm run build    # version de production dans dist/
```

## Ajouter un module

1. Créer `src/modules/<nom>/index.ts` qui exporte un `ModuleApp`.
2. L'ajouter à `MODULES` dans `src/app/modules.ts`.
