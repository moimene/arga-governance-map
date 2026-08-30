#!/usr/bin/env bash
# Muta un fichero, COMPRUEBA que la mutación entró, corre el test y restaura
# SOLO ese fichero. La comprobación de entrada es la forma nº8: sin ella, una
# mutación que no se aplica devuelve un verde que parece legítimo.
set -uo pipefail
F="$1"; TEST="$2"; DESC="$3"; PY="$4"
cd /private/tmp/c3-grc
python3 -c "$PY" || { echo "  [$DESC] la sustitución NO se aplicó — ABORTA"; exit 1; }
if git diff --quiet -- "$F"; then
  echo "  [$DESC] ⚠️  la mutación NO entró en $F — resultado NO válido"
  git checkout -- "$F"; exit 1
fi
R=$(bun test $TEST 2>&1 | grep -aE "^ *[0-9]+ (pass|fail)" | tr '\n' ' ')
git checkout -- "$F"
git diff --quiet -- "$F" && echo "  [$DESC] mutación entró ✓ · $R · restaurado ✓" || echo "  [$DESC] ⚠️ NO restaurado"
