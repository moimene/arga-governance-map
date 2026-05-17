# TGMS Gaps Coverage — Pendientes y Handoffs Post-Implementación

**Fecha:** 2026-05-17
**Origen:** Plan v1 [`2026-05-16-tgms-gaps-coverage-plan-v1.md`](./2026-05-16-tgms-gaps-coverage-plan-v1.md) §13
**PR del carril:** [`#36`](https://github.com/moimene/arga-governance-map/pull/36) en `codex/secretaria-d6-e2e-debt` → `main`
**Política superior 2026-05-17:** `governance_OS` sigue siendo el entorno activo de desarrollo-test-demo. Staging queda diferido y no bloquea la evolución del prototipo.

> Inventario completo de lo que queda pendiente tras la implementación de F0–F6 y la corrección técnica posterior de P1 #11.
> Cada item incluye categoría, qué bloquea, quién es owner, plazo y referencias.

---

## §1 Resumen ejecutivo

| Categoría | Items | Bloquea productiva | Bloquea demo |
|---|---:|---|---|
| Handoffs humanos/técnicos pendientes | 3 | Sí (G17, G19) | No |
| Decisiones colegiadas pendientes | 1 | Parcial (G7) | No |
| Deuda intencional documentada | 7 | No (todos deferred con razón) | No |
| Drift histórico identificado | 2 | No | No |
| **Total pendientes** | **13** | **2** | **0** |

**Veredicto desarrollo-test-demo:** GO. `governance_OS` continúa como fuente de verdad y se puede seguir evolucionando.
**Veredicto productiva/pre-release:** NO-GO hasta cerrar G17 + G19 (supabase_admin). P1 #11 queda corregido a nivel código/workflow; la estrategia de login de staging queda deliberadamente flexible durante desarrollo-test-demo.

---

## §2 Handoffs y cierres técnicos

### H1 — G17 Staging Supabase provisioning

| Campo | Valor |
|---|---|
| **Categoría** | Handoff humano (dashboard Supabase) |
| **Bloquea** | Productiva + workflow `e2e-destructive.yml` (no puede correr sin staging real) |
| **Owner** | Operaciones / DevOps del proyecto (acceso al dashboard Supabase organizacional) |
| **Plazo sugerido** | Diferido hasta pre-release o antes del primer release a producción real |
| **Coste** | $0/mes (Free tier alcanza para E2E semanales) |
| **Runbook** | `docs/superpowers/specs/2026-05-16-g17-staging-provisioning.md` |

**Tareas concretas que necesita ejecutar el owner cuando se active pre-release**:

1. Crear proyecto Supabase `governance-os-staging` (eu-central-1, Free tier).
2. Anotar `project_ref`, URL, anon key, service_role key.
3. Ejecutar `supabase link --project-ref <staging-ref>` + `supabase db push --linked` para clonar el schema.
4. Crear script `scripts/seed-staging-synthetic.ts` con un tenant sintético (UUID aleatorio, NO el demo `00000000-…-0001`).
5. Configurar 4 secrets en GitHub Actions:
   - `SUPABASE_STAGING_REF`
   - `SUPABASE_STAGING_URL`
   - `SUPABASE_STAGING_ANON_KEY`
   - `SUPABASE_STAGING_SERVICE_ROLE_KEY`
6. Disparo manual del workflow `e2e-destructive.yml` para validar.

**Validación de cierre**: workflow ejecutado verde con `EXPECTED_PROJECT_REF != hzqwefkwsxopwrmtksbg`.

---

### H2 — G19 ALTER DEFAULT PRIVILEGES para `supabase_admin`

| Campo | Valor |
|---|---|
| **Categoría** | Handoff externo (Supabase support) |
| **Bloquea** | Productiva (hardening completo de defaults futuros) |
| **Owner** | Account owner del proyecto Supabase con acceso a soporte |
| **Plazo sugerido** | Antes del primer release a producción real |
| **Razón del handoff** | El rol `postgres` que ejecuta nuestras migraciones no tiene privilegio para alterar defaults de `supabase_admin`. Solo el equipo de Supabase puede hacerlo. |
| **Migración que documenta el estado** | `20260516120004_f2_g2_g19_revoke_public_execute.sql` líneas 140-145 |

**Tareas**:

1. Abrir ticket en Supabase support solicitando:
   ```sql
   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
     REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
     GRANT EXECUTE ON FUNCTIONS TO authenticated;
   ```
2. Anotar referencia del ticket aquí cuando se abra.
3. Verificar con `SELECT * FROM pg_default_acl WHERE defaclrole = 'supabase_admin'::regrole;`

**Validación de cierre**: probe en Cloud devuelve `PUBLIC=revoked` en defaults de `supabase_admin`.

---

### H3 — P1 #11 Cliente Supabase env-driven — ✅ cerrado post-review

| Campo | Valor |
|---|---|
| **Categoría** | Cierre técnico |
| **Bloquea** | Nada pendiente tras corrección; se validará end-to-end cuando H1 exista |
| **Owner** | Dev |
| **Archivo principal** | `src/integrations/supabase/client.ts` |
| **Archivos de guard** | `.github/workflows/e2e-destructive.yml`, `e2e/43-secretaria-phase-b7-sociedad-nueva-ui-driving.spec.ts`, `e2e/fixtures/secretaria-isolated-tenant.ts` |

**Estado corregido**:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEMO_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEMO_SUPABASE_ANON_KEY;
```

Además, los guards de Playwright leen `process.env.EXPECTED_PROJECT_REF` con fallback al demo, y el workflow mapea `SUPABASE_STAGING_SERVICE_ROLE_KEY` a `SUPABASE_SERVICE_ROLE_KEY` porque los fixtures destructivos usan service role para preparar/limpiar datos.

**Queda fuera por decisión owner**: estrategia de login/autenticación staging. Durante desarrollo-test-demo se mantiene flexible y no bloquea este cierre técnico.

**Validación de cierre**: tests F4 comprueban cliente env-driven, guards `EXPECTED_PROJECT_REF` y service role secret de staging. El workflow real se validará cuando H1 esté provisionado.

---

### H4 — P2 #12 Sentinel feed wiring

| Campo | Valor |
|---|---|
| **Categoría** | Handoff técnico (sprint siguiente) |
| **Bloquea** | Observability productiva (G20) |
| **Owner** | Cualquier dev con acceso a Microsoft Sentinel workspace del cliente |
| **Plazo sugerido** | Cuando se contrate Sentinel productivo |
| **Estado** | Módulo `src/lib/telemetry/observability.ts` emite eventos a `console.warn`; falta Edge Function que los reciba y los envíe a Sentinel Data Collection Rule. |

**Tareas**:

1. Crear `supabase/functions/sentinel-log-feed/index.ts` que:
   - Recibe batch de eventos POST.
   - Valida shape contra Zod schema (ya existe en `src/test/contracts/sentinel-log-ingestion.test.ts`).
   - POST a `https://<dce>.eastus-1.ingest.monitor.azure.com/dataCollectionRules/<dcr>/streams/Custom-ARGAGovernance_CL?api-version=2023-01-01`.
2. En frontend: `setObservabilitySink(...)` que envía a la Edge Function en batches de 30s.
3. Configurar reglas de alerta en Sentinel (umbrales sugeridos están en `observability.ts` línea 171).

**Validación de cierre**: evento sintético `rls.denied` emitido en frontend → aparece en Log Analytics workspace `ARGAGovernance_CL` table.

---

## §3 Decisión colegiada pendiente

### D1 — G7 `evidence_bundle_review_events` decisión Comité Legal

| Campo | Valor |
|---|---|
| **Categoría** | Decisión legal externa |
| **Bloquea** | Workflow de revisión legal estructurado en `GestorPlantillas` / `ExpedienteAcuerdo` |
| **No bloquea** | Auditoría general (sigue funcionando vía `audit_log` WORM existente) |
| **Owner** | SECRETARIO o COMPLIANCE del cliente productivo + Comité Legal Garrigues |
| **Plazo de cierre** | 2026-07-15 (60 días desde 2026-05-16; pasada esa fecha sin respuesta se considera RECHAZADO por silencio) |
| **Documento** | `docs/superpowers/specs/2026-05-16-g7-evidence-review-events-decision.md` |

**Tareas concretas**:

1. **Enviar a Comité Legal**: documento `2026-05-16-g7-evidence-review-events-decision.md` por canal interno (Slack `#legal`, ticket o email).
2. **Anotar fecha de envío** en el documento §6 cuando se haga.
3. **Decisión esperada** una de:
   - **APROBADO sin cambios** → aplicar migración propuesta en §1 del doc + integrar workflow UI.
   - **APROBADO con cambios** → iterar schema + aplicar.
   - **RECHAZADO** → mover doc a `docs/superpowers/specs/rejected/` con motivación.
4. Si pasan 60 días sin respuesta, escalar a owner operativo del tenant; si pasan otros 30 días sin escalado, marcar RECHAZADO por silencio.

**Validación de cierre**: doc del §1 movido a archivo correspondiente (active migration `20260520_g7_*.sql` aplicada, o `rejected/` con motivación).

---

## §4 Deuda intencional documentada (codex follow-ups)

Estos 5 hallazgos del adversarial review codex se aceptaron como deuda con razón documentada. Ninguno bloquea productiva inmediata, pero los 3 P1 deberían cerrarse antes del segundo release.

### DI1 — P1 #6 G1 dynamic policy rewrite no preserva `polpermissive`/`polroles`

| Campo | Valor |
|---|---|
| **Migración afectada** | `20260516120002_f1_g1_replace_hardcoded_policies.sql` |
| **Riesgo** | Bajo en el contexto actual (todas las policies eran `FOR ALL TO authenticated` permissive). Si en el futuro alguien añade policy `AS RESTRICTIVE` o con role-list custom, esa policy podría ser sobrescrita por una más permisiva si contiene el literal demo UUID. |
| **Fix propuesto** | Reescribir el DO loop preservando `polpermissive` + `polroles` desde `pg_policy`. Añadir test que falla si una policy con literal demo se reescribe con semántica menor. |
| **Sprint sugerido** | Siguiente refactor RLS |

### DI2 — P1 #7 G2 scope solo schema `public`

| Campo | Valor |
|---|---|
| **Migración afectada** | `20260516120004_f2_g2_g19_revoke_public_execute.sql` |
| **Riesgo** | Bajo. El commit message decía "público + auth + storage" pero el loop solo escanea `public`. Funciones leaky en `auth.*` o `storage.*` con grant a PUBLIC no se detectan. Casi todas las funciones de esos schemas son managed por Supabase. |
| **Fix propuesto** | Probe ampliado a `('public', 'auth', 'storage', 'extensions')` con allowlist explícita de funciones managed esperadas. |
| **Sprint sugerido** | Siguiente sprint hardening |

### DI3 — P2 #13 Contract tests validan stubs locales, no proveedores reales

| Campo | Valor |
|---|---|
| **Archivos afectados** | `src/test/contracts/*.test.ts` (4 archivos) |
| **Riesgo** | Si EAD Trust / RM / CNMV / Sentinel cambian su wire protocol, los stubs locales siguen verdes pero producción rompe. |
| **Fix propuesto** | Tests opt-in con `LIVE_CONTRACT_TESTS=1` que hacen llamadas reales a sandboxes proveedores con secrets. |
| **Bloqueante** | Requiere acceso a sandbox de cada proveedor — depende de G11 §1 (Garrigues) |
| **Sprint sugerido** | Cuando se contrate sandbox EAD Trust |

### DI4 — G14 cleanup migración duplicada `000052`

| Campo | Valor |
|---|---|
| **Migraciones afectadas** | `20260504193000_000052_secretaria_p0_rpc_hardening.sql` y `20260504201000_000053_*` |
| **Riesgo** | Bajo (cosmético). Ambas redefinen `fn_secretaria_current_tenant_id()`. `CREATE OR REPLACE` hace que la última gana, pero el repo tiene 3 copias funcionalmente idénticas. Confusión audit. |
| **Fix propuesto** | Mover `000052` a `docs/superpowers/retired-migrations/` con nota explicativa. |
| **Sprint sugerido** | Sprint cleanup generales |
| **Documento referencia** | `docs/superpowers/specs/2026-05-16-definer-threat-model.md` §5 |

### DI5 — G6 `state-snapshot.yaml` para audit prompt

| Campo | Valor |
|---|---|
| **Archivo afectado** | `docs/audits/prompt-tgms-audit.md` |
| **Riesgo** | Operacional (no funcional). Cada run del audit edita el prompt directamente para retirar items resueltos. El prompt es plantilla y se contamina con historial. |
| **Fix propuesto** | Introducir `docs/audits/state-snapshot.yaml` hidratado por `scripts/audit-tgms.sh` antes de invocar el modelo. El prompt deja de tener ESTADO_INICIAL hardcoded. |
| **Sprint sugerido** | Sprint mejora tooling audit |

### DI6 — G18 RBAC intra-tenant feature flag

| Campo | Valor |
|---|---|
| **Migración afectada** | `20260516120003_f1_g18_intra_tenant_scope.sql` |
| **Estado** | Schema + helpers creados, pero el flag `tenant_features.intra_tenant_scope_enabled` está por defecto false. Las policies que filtran por `body_id` están escritas pero no aplicadas. |
| **Riesgo** | No es deuda en sí: es un feature flag intencional para no romper demo single-tenant. Cuando un cliente productivo necesite comité confidencialidad / body-level scope, se activa con un UPDATE en `tenant_features`. |
| **Activación** | `UPDATE tenant_features SET intra_tenant_scope_enabled = true WHERE tenant_id = '<tenant>'` + crear policies adicionales con `fn_user_has_body_access()` en tablas relevantes (`meetings`, `agreements`, `convocatorias`, etc.). |
| **Sprint sugerido** | Cuando se requiera por contrato cliente |

### DI7 — G15 trigger redundante con WORM Cloud

| Campo | Valor |
|---|---|
| **Migración afectada** | `20260516120006_f3_g15_evidence_immutability.sql` |
| **Estado** | Plan v1 proponía trigger `fn_evidence_immutable`; descubrimos durante deploy que Cloud tiene WORM trigger más estricto que bloquea TODO UPDATE en `evidence_bundles`. Trigger propio omitido por redundancia. Drift G8 documentado. |
| **Riesgo** | Drift visible: la WORM trigger NO está en el repo. Si se restaura Cloud desde zero, el trigger se pierde. |
| **Fix propuesto** | Restaurar la migración WORM en el repo (read-only del Cloud actual + crear archivo SQL equivalente). |
| **Sprint sugerido** | Sprint reconciliación drift completa |

---

## §5 Drift histórico identificado

### DR1 — `fn_save_meeting_resolutions` retirada del ledger activo

| Campo | Valor |
|---|---|
| **Ubicación actual en repo** | `docs/superpowers/retired-migrations/historical-baseline-pre-20260514/20260505093000_000056_secretaria_meeting_resolutions_transactional.sql` |
| **Estado Cloud** | Aplicada (hook `useReunionSecretaria.ts:927` la invoca con éxito) |
| **Estado repo activo** | NO presente en `supabase/migrations/` consolidadas (no fue reabsorbida en `20260514181001_secretaria_production_sprint_closeout.sql`) |
| **Test que lo audita** | `src/test/schema/secretaria-p0-meeting-resolutions-rpc.test.ts` (apunta al retired) |
| **Fix propuesto** | Crear migración nueva `2026XXXX_restaurar_fn_save_meeting_resolutions.sql` con la DDL de la retired idempotente (`CREATE OR REPLACE`). |
| **Sprint sugerido** | Sprint reconciliación drift completa |

### DR2 — WORM trigger sobre `evidence_bundles`

| Campo | Valor |
|---|---|
| **Ubicación actual en repo** | NO presente |
| **Estado Cloud** | Activo (raises P0001 "WORM protection: UPDATE operations are not allowed on evidence_bundles") |
| **Cómo se descubrió** | F3.G15 intentó hacer UPDATE backfill de `storage_path` y falló por este trigger |
| **Fix propuesto** | Probe Cloud para extraer la DDL del trigger + función subyacente + restaurar en repo. |
| **Sprint sugerido** | Sprint reconciliación drift completa (junto con DR1) |

---

## §6 Cronograma sugerido por prioridad

| Prioridad | Items | Plazo sugerido | Bloquea |
|---|---|---|---|
| **P0 productiva/pre-release** | H1 (G17 staging), H2 (G19 supabase_admin) | Antes del 1er release real | Sí |
| **P0 desarrollo-test-demo** | Mantener `governance_OS` como entorno activo, con `db:check-target` antes de tocar Cloud | Vigente hasta estabilidad pre-release | Sí |
| **Cierre técnico validado** | H3 (P1 #11 client/env/E2E guards env-driven) | Cerrado post-review; revalidar cuando H1 exista | No |
| **P1 producto** | D1 (G7 decisión legal) | 2026-07-15 | Workflow revisión legal |
| **P2 hardening** | DI1 (G1 polpermissive), DI2 (G2 scope), DI3 (live contract tests) | 2do release | Robustez productiva |
| **P3 cleanup** | DI4 (000052 retire), DI5 (state-snapshot.yaml), DR1+DR2 (drift restore) | Sprints cleanup | Higiene operativa |
| **Feature flag** | DI6 (G18 intra-tenant activation), DI7 (WORM trigger restore) | Demanda cliente | Capability productiva |
| **Plataforma** | H4 (Sentinel feed) | Cuando se contrate Sentinel | Observability productiva |

---

## §7 Owners sugeridos

| Owner | Responsabilidades |
|---|---|
| **Operaciones / DevOps** | H1 (G17 dashboard), H2 (G19 supabase support ticket), H4 (Sentinel workspace) |
| **Desarrollador** | DI1, DI2, DI3, DI4, DI5, DR1, DR2; H3 solo revalidación cuando H1 exista |
| **SECRETARIO / COMPLIANCE / Comité Legal Garrigues** | D1 (G7 decisión) |
| **Product / Comercial** | Activación DI6 (G18 intra-tenant scope) cuando un cliente lo requiera contractualmente |

---

## §8 Estado final del plan v1

- **20 gaps del plan v1**: 16 cerrados, 4 con dependencia externa/owner (G7, G17, G19 supabase_admin, G12 staging). P1 #11 se cerró como corrección técnica posterior.
- **13 hallazgos adversariales codex**: 12 correctos (7 cerrados + 5 deferred originalmente), 1 rechazado con evidencia; P1 #11 ya no queda deferred.
- **1 hallazgo codex rechazado con evidencia** (P1 #8 audit delta).
- **2 drift históricos identificados** (DR1, DR2): no bloqueantes, restauración en sprint cleanup.

**Desarrollo-test-demo: GO sobre `governance_OS`. Productiva/pre-release: NO-GO hasta cerrar §6 P0 productiva (H1+H2).**

---

*v1 — 2026-05-17. Inventario completo de pendientes post-implementación plan TGMS gaps v1.*
