# 2026-04-26 — Cierre seguro Secretaría antes de revisar DB

## Estado Supabase

- Repo local enlazado a Supabase proyecto `hzqwefkwsxopwrmtksbg` (`governance_OS`, eu-central-1).
- Confirmación CLI: `supabase/.temp/project-ref = hzqwefkwsxopwrmtksbg`; `supabase projects list` marca `governance_OS` como `linked=True` y `ACTIVE_HEALTHY`.
- Confirmación app runtime: `src/integrations/supabase/client.ts` apunta a `https://hzqwefkwsxopwrmtksbg.supabase.co` y la anon key incluye el mismo `ref`.
- Riesgo MCP global detectado y corregido: `mcp_servers.supabase` apuntaba a `/Users/moisesmenendez/.codex/bin/supabase-mcp-knara.sh`, cuyo `--project-ref` era `knaraqlcucbubbccpnuo`. Se creó `/Users/moisesmenendez/.codex/bin/supabase-mcp-governance-os.sh` y se actualizó `~/.codex/config.toml` para que `mcp_servers.supabase` apunte a `hzqwefkwsxopwrmtksbg`. `mcp_servers.supabase_nda` sigue apuntando a `gjehynkasiqtmpqqoktf` y no debe usarse en este repo.
- Token Supabase guardado en macOS Keychain bajo `Supabase CLI` / cuenta `supabase`. Validado contra Supabase Management API: `governance_OS|hzqwefkwsxopwrmtksbg|eu-central-1|ACTIVE_HEALTHY`.
- Nota operativa: si una sesión Codex ya tenía cargado el MCP antiguo, puede quedar el transporte cerrado tras matar el proceso viejo. En ese caso usar CLI/API o reiniciar/recargar MCP antes de usar `mcp__supabase__`.
- La app y los planes recientes apuntan a continuar con el tenant demo `00000000-0000-0000-0000-000000000001`.
- No se ha ejecutado DDL, `db push`, `migration repair` ni cambios directos de base en este cierre.

## Divergencia de migraciones

Hay una divergencia de ledger, no una duda de proyecto:

- Local: `43` archivos en `supabase/migrations`.
- Remoto: `83` migraciones aplicadas.
- Intersección efectiva: `0`, porque las migraciones locales se versionan como `YYYYMMDD_0000xx_...sql` y la CLI toma como versión lo anterior al primer `_` (`20260419`, `20260420`, etc.), mientras que remoto usa timestamps de 14 dígitos (`20260417121410`, `20260426151300`, etc.).

Migraciones locales nuevas que deben tratarse como **pendientes de reconciliación** antes de tocar Cloud:

- `20260426_000042_group_campaigns.sql`
- `20260426_000043_rule_lifecycle_governance.sql`
- `20260426_000044_convocatoria_rule_trace.sql`
- `20260426_000045_documental_process_templates.sql`

Riesgo: el historial remoto no coincide con el orden o identidad local. No asumir que estas migraciones están aplicadas ni que pueden empujarse tal cual.

## Regla de seguridad DB

No usar `supabase db push`, `supabase migration repair`, DDL manual ni `execute_sql` hasta reconciliar:

1. Historial remoto de migraciones.
2. Estado real de tablas/columnas/RPCs en Cloud.
3. Diferencias entre migraciones locales no versionadas y schema efectivo.
4. Dependencias de UI/tests que ya consumen esas columnas o RPCs.

Antes de cualquier operación DB, ejecutar:

```bash
bun run db:check-target
```

Este guardarraíl verifica CLI, cliente de app y MCP global. En modo estricto debe aprobar solo si el MCP `supabase` apunta a `hzqwefkwsxopwrmtksbg`.

## Checklist de cierre demo

- Congelar cambios de schema hasta terminar revisión DB.
- Mantener el trabajo en código separado de la reconciliación de migraciones.
- Verificar que el demo sigue navegable con datos existentes antes de aplicar nuevas migraciones.
- Priorizar flujos Secretaría visibles: Dashboard, Convocatorias, Reuniones, Actas, Certificaciones, Plantillas, Acuerdos sin sesión y Campañas.
- Documentar cualquier columna/RPC usada por UI que no exista en Cloud antes de arreglarla.
- Si hace falta aplicar schema, preparar un plan de migración único y revisado, no reparación ad hoc.

## Queda por validar

- Qué migraciones `000042`-`000045` existen realmente en Cloud, si alguna.
- Si `group_campaigns`, lifecycle de reglas, trazas de convocatoria y plantillas documentales están presentes en DB remota.
- Si las rutas nuevas de Secretaría fallan por schema ausente o solo por datos demo incompletos.
- Si los tests e2e recientes dependen de migraciones no aplicadas.
- Si Ruflo debe registrar esta divergencia como bloqueo operativo antes de nuevos agentes.

## Validación código/UI

- `bunx tsc --noEmit --pretty false`: OK.
- Vitest focalizado documental/reglas: `69` tests OK.
- Playwright contra `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174`: `8/8` OK para `e2e/13-secretaria-lote2-qa.spec.ts` y `e2e/14-secretaria-documentos.spec.ts`.
- Nota: Playwright sin `PLAYWRIGHT_BASE_URL` usa `5173`; en esta máquina ese puerto puede servir otra app (`NDA Platform`). Para Secretaría/TGMS en esta sesión usar `5174`.

## Archivo cambiado

- `docs/superpowers/plans/2026-04-26-secretaria-db-safe-closure.md`
