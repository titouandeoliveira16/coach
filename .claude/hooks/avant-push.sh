#!/usr/bin/env bash
# Avant un « git push » : types et tests doivent passer, sinon le push est bloqué
# (chaque push part directement en production sur l'iPhone via GitHub Pages).
entree=$(cat)
commande=$(printf '%s' "$entree" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command??"")}catch{}})')
case "$commande" in
  *"git push"*) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! sortie=$(npx tsc -b 2>&1); then
  echo "Push bloqué : erreurs TypeScript." >&2
  echo "$sortie" | tail -20 >&2
  exit 2
fi
if ! sortie=$(npx vitest run 2>&1); then
  echo "Push bloqué : des tests échouent." >&2
  echo "$sortie" | grep -E "FAIL|AssertionError|Tests" | head -20 >&2
  exit 2
fi
exit 0
