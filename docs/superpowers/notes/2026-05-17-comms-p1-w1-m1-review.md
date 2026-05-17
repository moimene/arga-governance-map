---
title: P1 Week 1 — M1 Adversarial Review
date: 2026-05-17
phase: comms-p1-w1
status: PASS (with documented findings + 2 deferred items)
---

# M1 Adversarial Review — Comms P1 Week 1

## Hallazgos críticos que el modo adversarial evitó

### 1. `no_session_notificaciones` shape divergente — backfill diferido a P2

Plan asumía `no_session_resolution_id`, `cuerpo`, `cuerpo_hash`, `recipient_email`,
`fecha_envio`, `created_by`. Realidad descubierta por `information_schema`:

- FK real: `expediente_id` → `no_session_expedientes(id)` (no `no_session_resolutions`)
- Sin columnas `cuerpo`/`cuerpo_hash` (el cuerpo vive en `no_session_expedientes.propuesta_texto`)
- Columnas `evidencia_ref` y `evidencia_hash` separadas de los campos ERDS
- 16 filas legacy con datos reales

**Decisión adversarial:** diferir backfill a P2 sem 1. Legacy table queda intocable.
Hook `useERDSNotification` sigue funcionando contra tabla legacy sin VIEW.
Si hubiéramos ejecutado la migración 7 del plan tal cual:
**FK violation + pérdida potencial de 16 filas históricas.**

### 2. `pg_cron` y `pg_net` no instalados — habilitados antes de continuar

Plan asumía disponibles. Realidad: solo `pgcrypto`. Las extensiones estaban
*available* pero `installed_version` era `null`. Aplicado `CREATE EXTENSION`
con éxito. Sin este preflight, la migración 11 del plan habría fallado al final
de Week 3 con scope ya completado.

### 3. `rbac_user_roles.role` NO existe — schema real corregido

Plan referenciaba `WHERE role IN (...)`. Realidad: `rbac_user_roles` tiene `role_id`
FK a `rbac_roles(role_code)`. Primer intento de migración 10 falló con
`column "role" does not exist`. Re-aplicada con JOIN correcto:

```sql
auth.uid() IN (
  SELECT rur.user_id FROM rbac_user_roles rur
  JOIN rbac_roles r ON r.id = rur.role_id
  WHERE r.role_code IN (...) AND COALESCE(rur.is_active, true) = true
)
```

### 4. 96 plantillas, no 40

Plan/spec basado en inventario de 40 templates. Realidad: 96 filas en
`plantillas_protegidas` (cada materia tiene variantes SA/SL/etc.). Seed cubre
59 materias canónicas. 87/96 filas con config. 8 filas con `materia=NULL`
quedan sin config (pending Comité Legal). 1 fila adicional con
`requiere_comunicacion=false` pendiente de investigar (DECISION_SOCIO_UNICO
debería ser la única).

### 5. MCP `apply_migration` asigna timestamps automáticos

El `name` parameter pasa al `comment`, no al `version`. Causó drift entre
local files (`20260518xxx`) y remote (`20260517141xxx`). Renombrados los
archivos locales para alinearse. Sin esto, `db push` futuro habría re-intentado
aplicar las migraciones causando duplicación.

## Estado final post-M1

| Componente | Estado | Verificación |
|---|---|---|
| Tabla `communications` | ✓ | `information_schema.tables` confirma |
| Tabla `communication_recipients` | ✓ | idem |
| Tabla `communication_attachments` | ✓ | idem |
| Tabla `communication_delivery_events` (WORM) | ✓ | 2 triggers WORM verificados |
| Tabla `portal_memberships` | ✓ | UNIQUE constraint en (user_id, person_id, tenant_id) |
| Schema `portal` aislado | ✓ | Con `access_log` table |
| ALTER `plantillas_protegidas` | ✓ | `requiere_comunicacion` + `comunicacion_config` |
| ALTER `agreements.comunicacion_manual` | ✓ | default false |
| Triggers (6 funcionales + 2 WORM + 1 hash chain) | ✓ | 11 triggers visibles en `pg_trigger` |
| RLS policies (Secretaría scope) | ✓ | 16 policies en `pg_policies` |
| Seed `comunicacion_config` | ⚠ Parcial | 87/96 filas. 8 sin materia. 1 outlier requiere_comunicacion=false |
| pg_cron + pg_net | ✓ | Instalados (estaban available, ahora installed) |
| TypeScript types | ✓ | `supabase/functions/_types/database.ts` regenerado (11169 líneas) |

## Deudas anotadas

- **D1 [BLOQUEANTE P2]** Migración 7 (backfill `no_session_notificaciones`) diferida a P2 sem 1.
  Documento de seguimiento: este archivo.
- **D2 [TASK OPERATIVA]** 8 plantillas con `materia=NULL` requieren config (Comité Legal — OQ2).
- **D3 [INVESTIGAR]** 1 plantilla extra con `requiere_comunicacion=false`. Verificar identidad.
- **D4 [P1 W3]** GUCs `app.functions_url` y `app.service_role_key` deben configurarse cuando
  se deploye `validate-comm-plazo` Edge Function. Hasta entonces, trigger `validate_plazo`
  es permissive en modo dev.
- **D5 [P1 W3]** pg_cron job `comms-dispatch-tick` se programará cuando `comms-dispatcher`
  Edge Function esté deployed.

## Veredicto M1

**PASS.** Schema integrity verificada. Triggers funcionales. RLS aplicado. Seed
aplicado al 91% (87/96). Deudas documentadas. Procedemos a Week 2 (library
`src/lib/comms/` + plazo engine).
