#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REF="hzqwefkwsxopwrmtksbg"
EXPECTED_NAME="governance_OS"
EXPECTED_URL="https://${EXPECTED_REF}.supabase.co"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STRICT_MCP="false"

if [[ "${1:-}" == "--strict-mcp" ]]; then
  STRICT_MCP="true"
fi

cd "$ROOT_DIR"

failures=0

ok() {
  printf 'OK   %s\n' "$1"
}

warn() {
  printf 'WARN %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
  failures=$((failures + 1))
}

project_ref="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [[ "$project_ref" == "$EXPECTED_REF" ]]; then
  ok "Supabase CLI local link: ${project_ref}"
else
  fail "Supabase CLI local link expected ${EXPECTED_REF}, got ${project_ref:-<missing>}"
fi

if rg -q "$EXPECTED_URL" src/integrations/supabase/client.ts; then
  ok "App client URL points to ${EXPECTED_URL}"
else
  fail "App client URL does not point to ${EXPECTED_URL}"
fi

anon_ref="$(
  node -e 'const fs = require("node:fs"); const text = fs.readFileSync("src/integrations/supabase/client.ts", "utf8"); const token = (text.match(/SUPABASE_ANON_KEY\s*=\s*[\r\n\s]*"([^"]+)"/) || [])[1]; if (token) { try { const [, payload] = token.split("."); const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); if (decoded.ref) process.stdout.write(decoded.ref); } catch { process.exit(0); } }' 2>/dev/null || true
)"

if [[ "$anon_ref" == "$EXPECTED_REF" ]]; then
  ok "App anon key/client metadata contains ref ${EXPECTED_REF}"
else
  fail "App anon key/client metadata expected ref ${EXPECTED_REF}, got ${anon_ref:-<unreadable>}"
fi

if command -v supabase >/dev/null 2>&1; then
  projects_json="$(supabase projects list --output json 2>/tmp/tgms-supabase-projects.err || true)"
  linked_ref="$(
    printf '%s' "$projects_json" | node -e '
      let input = "";
      process.stdin.on("data", (chunk) => input += chunk);
      process.stdin.on("end", () => {
        try {
          const projects = JSON.parse(input || "[]");
          const linked = projects.find((project) => project.linked);
          if (linked) process.stdout.write(`${linked.ref}|${linked.name}|${linked.status}`);
        } catch {
          process.exit(2);
        }
      });
    ' 2>/dev/null || true
  )"

  if [[ "$linked_ref" == "${EXPECTED_REF}|${EXPECTED_NAME}|ACTIVE_HEALTHY" ]]; then
    ok "Supabase CLI linked project: ${EXPECTED_NAME} (${EXPECTED_REF})"
  else
    fail "Supabase CLI linked project expected ${EXPECTED_NAME} (${EXPECTED_REF}), got ${linked_ref:-<unreadable>}"
  fi
else
  fail "Supabase CLI is not available in PATH"
fi

codex_config="${HOME}/.codex/config.toml"
if [[ -f "$codex_config" ]]; then
  mcp_command="$(
    awk '
      /^\[mcp_servers\.supabase\]/ { in_section = 1; next }
      /^\[/ { in_section = 0 }
      in_section && $1 == "command" {
        line = $0
        sub(/^[^"]*"/, "", line)
        sub(/".*$/, "", line)
        print line
        exit
      }
    ' "$codex_config"
  )"

  if [[ -n "$mcp_command" && -f "$mcp_command" ]]; then
    mcp_ref="$(
      rg -o -- '--project-ref[[:space:]]+[a-z0-9]+' "$mcp_command" |
        sed -E 's/.*--project-ref[[:space:]]+([a-z0-9]+).*/\1/' |
        tail -n 1
    )"

    if [[ "$mcp_ref" == "$EXPECTED_REF" ]]; then
      ok "Codex MCP supabase wrapper points to ${EXPECTED_REF}"
    elif [[ "$STRICT_MCP" == "true" ]]; then
      fail "Codex MCP supabase wrapper points to ${mcp_ref:-<missing>}, not ${EXPECTED_REF}"
    else
      warn "Codex MCP supabase wrapper points to ${mcp_ref:-<missing>}, not ${EXPECTED_REF}"
    fi
  elif [[ "$STRICT_MCP" == "true" ]]; then
    fail "Codex MCP supabase wrapper not found in ${codex_config}"
  else
    warn "Codex MCP supabase wrapper not found in ${codex_config}"
  fi
else
  warn "Codex MCP config not found at ${codex_config}"
fi

if [[ "$failures" -gt 0 ]]; then
  printf '\nSupabase target check failed with %d issue(s). Do not run DB writes.\n' "$failures"
  exit 1
fi

printf '\nSupabase target check passed for %s (%s).\n' "$EXPECTED_NAME" "$EXPECTED_REF"
