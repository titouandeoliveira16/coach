#!/usr/bin/env bash
# Début de session : installe les dépendances si besoin (conteneur cloud tout neuf),
# pour que les tests, le linter et le build marchent tout de suite.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "npm ci a échoué : lance-le à la main." >&2
fi
exit 0
