# Política operativa Supabase — `governance_OS` como entorno activo de desarrollo-demo

**Fecha:** 2026-05-17
**Estado:** Requisito fundamental vigente hasta que el prototipo llegue a estabilidad pre-release.

## Decisión

Mientras TGMS/ARGA siga en fase de desarrollo-test-demo y no haya un prototipo estable congelable, el proyecto Supabase original:

`governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1)

es la **fuente de verdad operativa** para el desarrollo, la demo y la validación funcional.

## Implicaciones

- Las migraciones, seeds demo, fixes de datos, RPCs, RLS, storage y Edge Functions necesarios para evolucionar el prototipo se siguen aplicando sobre `governance_OS`.
- Staging no bloquea el desarrollo actual. Queda preparado para una fase posterior de pre-release o para E2E destructivos cuando el prototipo ya necesite aislamiento sistemático.
- No se debe interpretar G17 staging como requisito previo para seguir desarrollando Secretaría, GRC, AI Governance o el shell TGMS.
- Antes de tocar Supabase se mantiene obligatorio `bun run db:check-target` y confirmar que el target es `governance_OS`.
- Todo cambio Cloud debe quedar reflejado en migraciones del repo y verificarse con `supabase migration list --linked`, consulta MCP a `supabase_migrations.schema_migrations` o `supabase db push --linked --dry-run` cuando el rol temporal del CLI esté disponible.
- La estrategia de login/autenticación para staging queda deliberadamente flexible durante desarrollo-test-demo.

## Staging

El proyecto staging `governance-os-staging` sigue siendo válido como plan, pero queda en estado **deferred hasta pre-release** salvo decisión explícita:

- cuando los E2E destructivos empiecen a poner en riesgo la demo;
- cuando se congele `governance_OS` para presentaciones estables;
- o cuando se prepare una primera release productiva/preproductiva.

Hasta entonces, `governance_OS` no es productivo congelado: es el entorno vivo del prototipo.

## Verificación 2026-05-17

- `bun run db:check-target`: pass contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `supabase migration list --linked`: local/remoto alineados hasta `20260516120008`.
- MCP Supabase `get_project_url`: `https://hzqwefkwsxopwrmtksbg.supabase.co`.
- MCP Supabase `supabase_migrations.schema_migrations`: última versión remota `20260516120008`.
- `supabase db push --linked --dry-run`: no concluyente en la última ejecución por fallo de autenticación del rol temporal `cli_login_postgres`; no indica drift porque `migration list` y MCP confirman el ledger remoto.
