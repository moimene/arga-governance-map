#!/usr/bin/env bash
# scripts/garrigues/medicion-cierre.sh
#
# Mide la suite sobre el HEAD INMUTABLE, no sobre el árbol de trabajo.
#
# Por qué: el árbol de trabajo puede tener cambios sin commitear, ficheros
# untracked de otro carril, o un backup a medio restaurar. Una cifra medida ahí
# no describe lo que se va a mergear. `git archive HEAD` materializa
# exactamente el commit.
#
# El comparador también necesita su canario, así que antes de medir comprueba
# que la copia es la del commit: si el árbol está sucio, lo DICE, y si el
# recuento de ficheros no cuadra, aborta.
set -euo pipefail

ORIGEN="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINO="${1:-/tmp/c3-medicion-$$}"
# modo A = con las carpetas fuente enlazadas (por defecto)
# modo B = SIN ellas, que es como se ve el repo en un arbol limpio o en CI
MODO="${2:-A}"

# `|| true` obligatorio: con `pipefail`, `grep -v` devuelve 1 cuando no
# selecciona ninguna linea —o sea, cuando el arbol esta LIMPIO— y `set -e`
# abortaba el script entero sin imprimir nada. El arnes de medicion fallaba en
# silencio precisamente en el caso bueno.
sucio="$(git -C "$ORIGEN" status --porcelain | grep -cv '^??' || true)"
if [ "$sucio" != "0" ]; then
  echo "AVISO: el árbol tiene $sucio cambios sin commitear. Se mide HEAD, NO el árbol."
fi
echo "HEAD: $(git -C "$ORIGEN" log --oneline -1)"

mkdir -p "$DESTINO"
git -C "$ORIGEN" archive HEAD | tar -x -C "$DESTINO"

# Canario del comparador: si el archive saliera vacío o a medias, las cifras
# de abajo serían de una suite que no existe.
n="$(find "$DESTINO/src" -name '*.test.ts' -o -name '*.test.tsx' | wc -l | tr -d ' ')"
if [ "$n" -lt 100 ]; then
  echo "ABORTA: solo $n ficheros de test en la copia. El archive no es completo."
  exit 1
fi
echo "copia verificada: $n ficheros de test"

# node_modules y .env no viajan en `git archive` (uno es enorme, el otro está
# en .gitignore por buenas razones). Se enlazan y se copia.
ln -sfn "$ORIGEN/node_modules" "$DESTINO/node_modules"
[ -f "$ORIGEN/.env" ] && cp "$ORIGEN/.env" "$DESTINO/.env"
# Las carpetas fuente son symlinks fuera del repo: se replican para poder medir
# en el modo "con carpetas fuente".
if [ "$MODO" = "A" ]; then
  for enlace in "version garrigues" "DOC GRC"; do
    [ -e "$ORIGEN/$enlace" ] && ln -sfn "$(readlink "$ORIGEN/$enlace" || echo "$ORIGEN/$enlace")" "$DESTINO/$enlace"
  done
  echo "modo A: con carpetas fuente"
else
  echo "modo B: SIN carpetas fuente (arbol limpio / CI)"
fi

cd "$DESTINO"
echo "=== typecheck ===" && { bun run typecheck 2>&1 | grep -c "error TS" || true; }
echo "=== lint ==="      && bun run lint 2>&1 | tail -2
echo "=== test ==="      && bun test 2>&1 | tail -5
echo
echo "medido en: $DESTINO"
