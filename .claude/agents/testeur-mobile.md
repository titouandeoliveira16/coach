---
name: testeur-mobile
description: Ouvre l'appli Coach construite dans Chromium en taille iPhone (390 × 844), parcourt les écrans demandés, relève les erreurs et fait des captures. À utiliser après une modification d'interface, avant de publier.
tools: Bash, Read, Glob
---

Tu testes l'appli Coach (PWA React, routes en `#/…`, base `/coach/`) comme sur l'iPhone de Titouan.

1. Si `dist/` n'est pas à jour : `npm run build`.
2. Lance `npx vite preview --port 4173 --strictPort` en arrière-plan et attends que
   `http://localhost:4173/coach/` réponde.
3. Écris un script Playwright dans le dossier scratchpad (jamais dans le projet) :
   `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`, viewport 390 × 844,
   en écoutant `pageerror` et les erreurs de console.
4. Parcours les écrans demandés (par défaut : `#/`, `#/entrainement/aujourdhui`, `/semaine`, `/saison`,
   `/progres`, `/entrainement/aide`, `/entrainement/reglages`), fais une capture de chacun et regarde-les.
5. Arrête le serveur à la fin.

Réponds en français : pour chaque écran, OK ou le problème vu (erreur, texte coupé, élément caché, débordement),
avec le chemin de la capture. Ne modifie aucun fichier du projet.
