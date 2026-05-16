#!/usr/bin/env bash
# ==============================================================================
# audit-tgms.sh
#
# Runner del prompt docs/audits/prompt-tgms-audit.md.
# Diseñado para ejecutarse desde cron (semanal en modo diff) o a mano (full).
#
# Uso:
#   AUDIT_MODE=full ./scripts/audit-tgms.sh            # primera vez / trimestral
#   AUDIT_MODE=diff ./scripts/audit-tgms.sh            # semanal (cron)
#
# Variables:
#   AUDIT_MODE          full|diff (default: diff si LATEST.md existe, full si no)
#   AUDIT_OUT_DIR       docs/audits (default)
#   AUDIT_CLAUDE_BIN    binario de Claude Code CLI (default: claude). Para usar
#                       codex/cursor-cli adaptar también la línea de invocación
#                       más abajo: cambia `-p "..."` por el flag equivalente.
#   AUDIT_INCLUDE_E2E             =1 para incluir e2e/secretaria en pre-flight
#   AUDIT_INCLUDE_E2E_DESTRUCTIVE =1 para incluir e2e destructivos
#
# Invocación real al CLI (Claude Code):
#   claude -p "<prompt>" --dangerously-skip-permissions
#     -p / --print:                     modo no interactivo, devuelve stdout y sale.
#     --dangerously-skip-permissions:   requerido en cron — el agente necesita
#                                       Bash y Read sin prompts humanos. Seguro
#                                       aquí porque el audit es read-only.
#
# Exit codes (parseados desde la línea AUDIT_VERDICT del informe):
#   0  ok / sin cambios críticos
#   1  prod flip o nuevos P1
#   2  demo=NO-GO o nuevos P0
#   3  error de runner (binario ausente, pre-flight crítico falla)
#
# Cron sugerido (lunes 06:00, modo diff):
#   0 6 * * 1 cd /path/to/arga-governance-map \
#     && AUDIT_MODE=diff scripts/audit-tgms.sh \
#     >> docs/audits/cron.log 2>&1 \
#     || /path/to/notify.sh "TGMS audit exit=$?"
# ==============================================================================
set -euo pipefail

# --- Configuración ------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

AUDIT_OUT_DIR="${AUDIT_OUT_DIR:-docs/audits}"
AUDIT_CLAUDE_BIN="${AUDIT_CLAUDE_BIN:-claude}"
AUDIT_DATE="$(date +%Y-%m-%d)"
PROMPT_FILE="${AUDIT_OUT_DIR}/prompt-tgms-audit.md"
LATEST_LINK="${AUDIT_OUT_DIR}/LATEST.md"
OUT_FILE="${AUDIT_OUT_DIR}/${AUDIT_DATE}-tgms.md"

# Default mode: diff si LATEST existe, full si no
if [[ -z "${AUDIT_MODE:-}" ]]; then
  if [[ -L "$LATEST_LINK" || -f "$LATEST_LINK" ]]; then
    AUDIT_MODE="diff"
  else
    AUDIT_MODE="full"
  fi
fi
export AUDIT_MODE AUDIT_DATE AUDIT_INCLUDE_E2E AUDIT_INCLUDE_E2E_DESTRUCTIVE

# --- Validaciones -------------------------------------------------------------
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: prompt file not found at $PROMPT_FILE" >&2
  exit 3
fi

if ! command -v "$AUDIT_CLAUDE_BIN" >/dev/null 2>&1; then
  echo "ERROR: runner '$AUDIT_CLAUDE_BIN' not found in PATH" >&2
  echo "Set AUDIT_CLAUDE_BIN=<path-to-cli> or install Claude Code CLI." >&2
  exit 3
fi

# Pre-flight crítico: el prompt se apoya en bun run db:check-target.
# Si falla, no ejecutamos contra una Cloud equivocada.
if ! bun run db:check-target >/tmp/audit-dbcheck.log 2>&1; then
  echo "ERROR: db:check-target falló. Cloud target equivocada o credenciales rotas." >&2
  cat /tmp/audit-dbcheck.log >&2
  exit 3
fi

mkdir -p "$AUDIT_OUT_DIR"

# --- Ejecución ----------------------------------------------------------------
echo "[$(date -Iseconds)] audit-tgms mode=$AUDIT_MODE out=$OUT_FILE"

# Pasamos el prompt al CLI en modo no-interactivo.
#
# Claude Code:
#   claude -p "<prompt>" — modo print, devuelve respuesta por stdout y sale.
#   --dangerously-skip-permissions: necesario en cron porque el agente debe
#       poder ejecutar Bash (typecheck, git, bun) y Read sin prompt humano.
#       Solo seguro porque el audit es read-only.
#   --allowedTools opcional para whitelist más fina si quieres restringir.
#
# Codex CLI:    codex exec --prompt-file PATH
# Cursor CLI:   cursor-cli run --prompt PATH
#
# El binario debe leer AUDIT_MODE / AUDIT_DATE del entorno (las exporta este script).
PROMPT_CONTENT="$(cat "$PROMPT_FILE")"
"$AUDIT_CLAUDE_BIN" \
  -p "$PROMPT_CONTENT" \
  --dangerously-skip-permissions \
  > "$OUT_FILE.tmp" 2>"$AUDIT_OUT_DIR/cron.stderr"

if [[ ! -s "$OUT_FILE.tmp" ]]; then
  echo "ERROR: el runner no produjo salida." >&2
  cat "$AUDIT_OUT_DIR/cron.stderr" >&2 || true
  rm -f "$OUT_FILE.tmp"
  exit 3
fi

mv "$OUT_FILE.tmp" "$OUT_FILE"

# Actualizar symlink LATEST
ln -sfn "$(basename "$OUT_FILE")" "$LATEST_LINK"

# --- Parseo del veredicto y exit code -----------------------------------------
# El prompt instruye a emitir, en modo diff, una última línea:
#   AUDIT_VERDICT mode=diff demo=<GO|NO-GO> prod=<GO|NO-GO> p0=<n> p1=<n> deltas=<n>
VERDICT_LINE="$(grep -E '^AUDIT_VERDICT ' "$OUT_FILE" | tail -1 || true)"

if [[ -z "$VERDICT_LINE" ]]; then
  # Modo full no obliga a esta línea — exit 0.
  if [[ "$AUDIT_MODE" == "full" ]]; then
    echo "[$(date -Iseconds)] audit-tgms ok (modo full, sin AUDIT_VERDICT esperado)"
    exit 0
  fi
  echo "WARN: AUDIT_VERDICT line missing en modo diff. Revisar $OUT_FILE manualmente."
  exit 1
fi

DEMO="$(echo "$VERDICT_LINE" | sed -nE 's/.*demo=([A-Z-]+).*/\1/p')"
PROD="$(echo "$VERDICT_LINE" | sed -nE 's/.*prod=([A-Z-]+).*/\1/p')"
P0_COUNT="$(echo "$VERDICT_LINE" | sed -nE 's/.*p0=([0-9]+).*/\1/p')"
P1_COUNT="$(echo "$VERDICT_LINE" | sed -nE 's/.*p1=([0-9]+).*/\1/p')"

echo "[$(date -Iseconds)] verdict demo=$DEMO prod=$PROD p0=$P0_COUNT p1=$P1_COUNT"

# Detectar prod flip respecto al informe anterior (si existía).
PROD_FLIP="no"
if [[ -L "$LATEST_LINK.prev" || -f "$LATEST_LINK.prev" ]]; then
  PREV_PROD="$(grep -E '^AUDIT_VERDICT ' "$LATEST_LINK.prev" 2>/dev/null | sed -nE 's/.*prod=([A-Z-]+).*/\1/p' | tail -1 || echo "")"
  if [[ -n "$PREV_PROD" && "$PREV_PROD" != "$PROD" ]]; then
    PROD_FLIP="yes"
    echo "[$(date -Iseconds)] prod flip: $PREV_PROD -> $PROD"
  fi
fi

# Guardar referencia para próxima ejecución
ln -sfn "$(basename "$OUT_FILE")" "$LATEST_LINK.prev"

# Exit code policy
if [[ "$DEMO" == "NO-GO" || "${P0_COUNT:-0}" -gt 0 ]]; then
  exit 2
fi
if [[ "$PROD_FLIP" == "yes" || "${P1_COUNT:-0}" -gt 0 ]]; then
  exit 1
fi
exit 0
