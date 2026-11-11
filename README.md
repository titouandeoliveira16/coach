# Coach

Application (PWA, en français) de coaching vélo : plan calculé depuis ta course, feu du jour selon ta récupération,
séances envoyées à Zwift / Intervals.icu. Modules annexes réservés au compte de l'auteur : révision d'un concours, budget.

- Données « local d'abord » sur l'appareil (IndexedDB), synchronisées avec Supabase (une ligne par donnée, RLS par compte).
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
