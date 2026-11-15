#!/bin/bash
# Pasa todas las pruebas contra el modo demostración (sin NOTION_TOKEN: no toca datos reales).
# Uso: pruebas/pasar.sh            → todas
#      pruebas/pasar.sh lock plan  → solo esas
# Necesita Node y Playwright con Chromium. Cada prueba arranca con la demo recién iniciada.
cd "$(dirname "$0")/.." || exit 1
PORT=3100
OUT=pruebas/capturas
mkdir -p "$OUT"
[ -d .next ] || npm run build > /dev/null || { echo "No compila"; exit 1; }
TESTS=("$@")
[ ${#TESTS[@]} -eq 0 ] && TESTS=($(ls pruebas/*.js | xargs -n1 basename | sed 's/\.js$//'))
FAIL=0
for t in "${TESTS[@]}"; do
  pkill -f "next start -p $PORT" 2>/dev/null; pkill -f next-server 2>/dev/null; sleep 1
  env -u NOTION_TOKEN -u WHAPI_TOKEN npx next start -p $PORT > "$OUT/servidor.log" 2>&1 &
  for i in $(seq 1 40); do curl -s -o /dev/null "localhost:$PORT/login" && break; sleep 0.5; done
  if timeout 180 node "pruebas/$t.js" "$OUT" pruebas/ejemplo.pdf > "$OUT/$t.log" 2>&1 && ! grep -q "TimeoutError\|TypeError\|ReferenceError" "$OUT/$t.log"; then
    echo "OK     $t"
  else
    echo "FALLA  $t   (ver $OUT/$t.log)"; FAIL=1
  fi
done
pkill -f next-server 2>/dev/null
exit $FAIL
