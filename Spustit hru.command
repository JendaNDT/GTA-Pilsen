#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"

game_url='http://localhost:5173/'
game_ready() {
  /usr/bin/curl --noproxy localhost -fs --max-time 0.5 "$game_url" | /usr/bin/grep -Fq '<title>Plzeň naplno'
}
if game_ready; then
  exec /usr/bin/open "$game_url"
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node_bin=$(command -v node || true)
if [ -z "$node_bin" ]; then
  # Codex může mít vlastní Node.js mimo PATH Terminálu.
  node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$node_bin" ]; then
  printf 'Nainstaluj Node.js 24 z https://nodejs.org a spusť hru znovu.\n' >&2
  exit 1
fi

if [ ! -f node_modules/vite/bin/vite.js ]; then
  if ! command -v npm >/dev/null; then
    printf 'K prvnímu spuštění je potřeba Node.js s npm. Instalace je na https://nodejs.org.\n' >&2
    exit 1
  fi
  npm ci
fi

# Stejná místní adresa jako u npm run dev zachovává uložené hry.
(
  for ((attempt = 0; attempt < 50; attempt++)); do
    if game_ready; then
      exec /usr/bin/open "$game_url"
    fi
    sleep 0.1
  done
) &
exec "$node_bin" node_modules/vite/bin/vite.js --host localhost --port 5173 --strictPort
