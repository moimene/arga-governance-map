#!/usr/bin/env bash
# Muta un fichero, COMPRUEBA que la mutación entró, corre el test y restaura
# SOLO ese fichero. La comprobación de entrada es la forma nº8: sin ella, una
# mutación que no se aplica devuelve un verde que parece legítimo.
set -uo pipefail
F="$1"; TEST="$2"; DESC="$3"; PY="$4"
cd /private/tmp/c3-grc
# El fichero a mutar DEBE estar commiteado. La restauracion es `git checkout --`,
# asi que cualquier cambio sin commitear se PIERDE — y se pierde en silencio,
# porque el arnes sigue funcionando y da un veredicto que parece legitimo.
# Me paso: borro una entrada del catalogo que acababa de escribir y el gate
# fallo por su ausencia, no por el defecto que buscaba.
#
# Esto estaba en un comentario y no en el codigo. Un comentario no impide nada.
if ! git diff --quiet -- "$F" || ! git diff --cached --quiet -- "$F"; then
  echo "  [$DESC] ⚠️  $F tiene cambios SIN COMMITEAR. La restauracion los borraria."
  echo "            Commitea primero. ABORTA sin tocar nada."
  exit 1
fi
python3 -c "$PY" || { echo "  [$DESC] la sustitución NO se aplicó — ABORTA"; exit 1; }
if git diff --quiet -- "$F"; then
  echo "  [$DESC] ⚠️  la mutación NO entró en $F — resultado NO válido"
  git checkout -- "$F"; exit 1
fi
R=$(bun test $TEST 2>&1 | grep -aE "^ *[0-9]+ (pass|fail)" | tr '\n' ' ')
git checkout -- "$F"
git diff --quiet -- "$F" && echo "  [$DESC] mutación entró ✓ · $R · restaurado ✓" || echo "  [$DESC] ⚠️ NO restaurado"
