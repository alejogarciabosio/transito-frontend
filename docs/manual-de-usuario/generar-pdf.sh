#!/usr/bin/env bash
# Genera manual.pdf a partir de manual.md: pandoc (Docker, pandoc/core:3.5) -> HTML con estilo.css -> Chrome headless.
# Uso: ./docs/manual-de-usuario/generar-pdf.sh   (requiere Docker y Google Chrome)
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

docker run --rm -v "$PWD:/data" -u "$(id -u):$(id -g)" pandoc/core:3.5 \
  manual.md -f markdown -t html5 --standalone --css estilo.css --metadata lang=es-AR -o manual.html

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
  --print-to-pdf="$PWD/manual.pdf" "file://$PWD/manual.html"

rm -f manual.html
echo "PDF generado: $PWD/manual.pdf"
