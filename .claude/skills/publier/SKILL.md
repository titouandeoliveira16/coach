---
name: publier
description: Publier une nouvelle version de l'appli Coach (numéro de version, vérifications, commit, push, déploiement GitHub Pages, contrôle à l'écran). À utiliser après chaque modification validée par Titouan.
---

# Publier une version de Coach

Toujours dans cet ordre, sans sauter d'étape :

1. **Numéro de version** : dans `package.json`, monter la version (`0.x.y`) :
   - nouvelle fonction → `0.(x+1).0` ;
   - correction ou petit changement de texte → `0.x.(y+1)`.
2. **Vérifier** : `npx tsc -b`, puis `npm test`, puis `npm run build`. Tout doit passer.
3. **Contrôler à l'écran** les écrans touchés : lancer `npx vite preview --port 4173 --strictPort` en arrière-plan,
   puis ouvrir les pages avec Playwright (Chromium est dans `/opt/pw-browsers`, Playwright dans
   `/opt/node22/lib/node_modules/playwright`), en 390 × 844, et vérifier qu'il n'y a aucune erreur de page.
   Le sous-agent `testeur-mobile` peut s'en charger.
4. **Commit** : message en français, une ligne de titre puis le détail en puces ; terminer par les lignes
   d'attribution demandées par la session.
5. **Push** : `git push -q origin main` (le hook bloque le push si les types ou les tests échouent).
6. **Attendre le déploiement** :
   `timeout 300 bash -c 'sleep 15; until gh run list --limit 1 --json status -q ".[0].status" | grep -q completed; do sleep 10; done'; gh run list --limit 1`
   → il doit finir en `success`.
7. **Message à Titouan** : la version, ce qui change concrètement pour lui (en français simple, sans jargon),
   et « ferme puis rouvre l'appli » pour charger la mise à jour.

Si une fonction serveur (`supabase/functions/*`) ou un script SQL change : le déploiement GitHub ne suffit pas.
Avec le serveur MCP `supabase` : déployer la fonction / appliquer le SQL soi-même et le dire.
Sinon : donner à Titouan les étapes exactes (où cliquer, quoi coller) dans le message.
