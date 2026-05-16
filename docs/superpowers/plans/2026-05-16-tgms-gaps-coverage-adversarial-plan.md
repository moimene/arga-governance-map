# TGMS Gaps Coverage — Plan adversarial v0

**Fecha:** 2026-05-16
**Auditor:** Claude (Opus 4.7)
**Fuente:** [docs/audits/2026-05-16-tgms.md](../../audits/2026-05-16-tgms.md)
**Carril:** `codex/secretaria-d6-e2e-debt` (HEAD `f598542`)
**Modo:** plan adversarial (auto-crítica embebida + concilio externo con Codex)

> **Aviso de modo adversarial.** Este plan se redacta con dos voces en tensión:
> - **Voz constructiva (V+):** propone la acción.
> - **Voz adversarial (V−):** ataca la propuesta antes de cerrarla.
>
> Las secciones marcadas `Yo vs Yo` exhiben la pelea explícitamente. La sección §6 "Concilio Codex" se rellena tras invocar `codex challenge`.

---

## §0 Resumen ejecutivo

12 gaps inventariados en el audit. Reordenados **por dependencia** en lugar de severidad pura:

| Fase | Foco | Gaps | Bloquea demo | Bloquea productiva |
|---|---|---|---|---|
| F0 — Estabilización gate | QA/docs sin riesgo | G4, G5, G6, G9 | No | No |
| F1 — Hardening productiva | RLS, RPC, storage, retention | **G1, G2, G3, G7** | No | **Sí** |
| F2 — Plataforma / operaciones | ledger, build, e2e | G8, G10, G12 | No | Parcial |
| F3 — Integraciones externas | QTSP / RM / CNMV / Sentinel | G11 | No | **Sí** |

Cierres mecánicos (probe SQL / test verde / commit con SHA esperable) por gap. Cada fase tiene **entry criteria** y **exit criteria** verificables.

**Tesis del plan**: la F1 es el bloqueante real para productiva; F0/F2 son higiene; F3 sale del scope técnico.

**Anti-tesis (V−)**: la F0 no es solo higiene — los 5 tests rotos enmascaran regresiones futuras del ledger. Y la F3 no es "fuera de scope" si en producción el cliente exige plan documentado de integración. Lo veremos en cada gap.

---

## §1 Fase 0 — Estabilización del gate

**Entry criteria:** rama `codex/secretaria-d6-e2e-debt` sincronizada con `origin/main`, `bun run db:check-target` pass.

**Exit criteria:** `bun run test src/lib/secretaria src/test/schema` con `5 fail → 0 fail`; `prompt-tgms-audit.md` actualizado; PR abierto o decisión documentada de mantener carril vivo.

### G4 — 5 archivos schema-test con ENOENT (deuda silenciosa post-rename ledger) — P2

**V+ (acción propuesta):**

1. Para cada uno de los 5 tests, decidir reactivar (reapuntar path) vs eliminar (duplicado consolidado).
   - `personas-cargos-security-followups.test.ts` → reapuntar `20260513_000069_personas_cargos_security_followups.sql` → `20260512190500_personas_cargos_security_followups.sql`
   - `personas-cargos-sprint2-core.test.ts` → `20260513_000066_*` → `20260512171059_*`
   - `personas-cargos-vacancia-scan-filters.test.ts` → `20260513_000067_*` → `20260512183903_*`
   - `secretaria-p0-meeting-resolutions-rpc.test.ts` → fichero `20260505093000_000056_secretaria_meeting_resolutions_transactional.sql` **no existe en `supabase/migrations/`** — investigar si fue absorbido por `20260514181001_secretaria_production_sprint_closeout.sql`.
   - `secretaria-p0-transactional-rpcs.test.ts` → `20260504_000051_*` idem.

2. Para los 2 últimos: leer el contenido del test y cross-checkear las aserciones contra el contenido actual de `20260514181001_secretaria_production_sprint_closeout.sql`. Si todas las aserciones están cubiertas por otro test verde → eliminar. Si no → reapuntar al fichero consolidado y ajustar las aserciones.

**Archivos:** `src/test/schema/personas-cargos-security-followups.test.ts`, `src/test/schema/personas-cargos-sprint2-core.test.ts`, `src/test/schema/personas-cargos-vacancia-scan-filters.test.ts`, `src/test/schema/secretaria-p0-meeting-resolutions-rpc.test.ts`, `src/test/schema/secretaria-p0-transactional-rpcs.test.ts`.

**Criterio mecánico de cierre:**
```bash
bun run test src/test/schema 2>&1 | grep -E "FAIL" | wc -l   # esperado: 0
```
Y commit con mensaje matching `^test\(schema\): reapunta.*ENOENT.*post-ledger`.

**Riesgo:** un test reapuntado puede revelar que la migración renombrada **no preserva** todas las aserciones del original (DDL drift entre versiones consolidadas). Hay que validar test-por-test.

**Rollback:** trivial — revertir el commit que cambia las rutas.

#### Yo vs Yo (G4)

- **V−**: "Reapuntar paths es maquillaje. Los tests originalmente validaban migraciones discretas — al consolidarlas en `20260514181001`, las aserciones pueden quedar inválidas (ej. un constraint que existía y se removió en consolidación). Estás aceptando que el test sigue siendo verde sin entender qué prueba realmente."
- **V+**: cierto. La acción debe ser: leer cada test, listar sus aserciones (`expect(migration).toContain(...)`), y validar manualmente que el SQL consolidado contiene los mismos patrones. Si no, se ELIMINA el test (no se "arregla a la fuerza"), con comentario explicando qué cubría y dónde se cubre ahora.
- **V−**: "¿Y si nada lo cubre? Entonces ELIMINAR es regresión silenciosa."
- **V+**: en ese caso, restaurar el contenido SQL relevante en una migración nueva no destructiva o documentar el gap. Severidad sube de P2 a P1 si la aserción era de seguridad (RLS, GRANT/REVOKE).

**Decisión adversarial**: el cierre de G4 incluye un sub-deliverable: tabla "5 tests × {acción, evidencia de cobertura post-consolidación}". Si alguna fila marca "no cubierto", se escala a P1.

---

### G5 — Probe §6.2 produce falso positivo en plantillas no-acuerdo — P3

**V+:** editar `docs/audits/prompt-tgms-audit.md` §6.2:
```sql
-- ANTES
SELECT count(*) FROM plantillas_protegidas
WHERE estado = 'ACTIVA'
  AND (organo_tipo IS NULL OR adoption_mode IS NULL OR referencia_legal IS NULL);

-- DESPUÉS
SELECT count(*) FROM plantillas_protegidas
WHERE estado = 'ACTIVA'
  AND tipo IN ('MODELO_ACUERDO','ACTA','DECISION')
  AND (organo_tipo IS NULL OR adoption_mode IS NULL OR referencia_legal IS NULL);
```

**Criterio mecánico:** ejecutar probe corregida en Cloud y obtener `0` (esperado).

**Riesgo:** la lista `tipo IN ('MODELO_ACUERDO','ACTA','DECISION')` puede estar incompleta. Hay tipos que sí necesitan `adoption_mode` y no figuran.

#### Yo vs Yo (G5)

- **V−**: "¿De dónde sale esa lista? Inventario, no decreto."
- **V+**: probe inventario primero:
  ```sql
  SELECT DISTINCT tipo FROM plantillas_protegidas WHERE estado='ACTIVA' ORDER BY 1;
  ```
  → enumerar y clasificar manualmente cada `tipo` como "necesita adoption_mode" o no. La regla §6.2 debe codificar esa clasificación en un CASE o usar el CHECK de la tabla si existe.
- **V−**: "Y si llega un tipo nuevo, ¿cómo se mantiene la regla actualizada?"
- **V+**: la regla la mantiene el contrato de schema. Añadir test en `src/test/schema/plantillas-tipo-classification.test.ts` que falle si aparece un `tipo` desconocido para la clasificación. **Mejor**: en lugar de probe externa, añadir CHECK constraint que vincule `tipo` con campos requeridos (ya existe parcialmente en `gate-pre.ts`).

**Decisión adversarial**: G5 se eleva a "calibrar reglas del Gate PRE estructural" (in-schema, no en prompt). El prompt §6.2 se mantiene pero apunta al Gate PRE como fuente de verdad. Esto **aumenta el alcance** pero hace la regla autosostenible.

---

### G6 — §6 ESTADO_INICIAL del prompt obsoleto post-`f598542` — P3

**V+:** editar `docs/audits/prompt-tgms-audit.md` ESTADO_INICIAL:
- Marcar "Existen E2E legacy desactualizados sobre el flujo antiguo de 4 pasos" como **RESUELTO en `f598542`** y removerlo del bloque a contrastar.
- Conservar lista para el próximo run en modo `diff`.

**Criterio mecánico:** commit que toca solo `docs/audits/prompt-tgms-audit.md` con mensaje `chore(audit): retira E2E legacy del estado inicial`.

#### Yo vs Yo (G6)

- **V−**: "El prompt es plantilla, no historial. Tocarlo en cada run para retirar gaps cerrados convierte el archivo en log. Mala señal."
- **V+**: razón. La sección ESTADO_INICIAL en modo `full` debe llenarse a partir de un archivo separado `docs/audits/state-snapshot.yaml` que el wrapper inyecta. No tocar el prompt directamente.
- **V−**: "¿Y ahora?"
- **V+**: dos opciones:
  - (a) Aceptar la deuda y solo editar el prompt esta vez (rápido, futuro inestable).
  - (b) Refactor: introducir `state-snapshot.yaml` + ajustar `scripts/audit-tgms.sh` para hidratar el prompt en runtime. Coste: ~2h. Beneficio: ESTADO_INICIAL versionado de verdad.

**Decisión adversarial**: (a) para esta entrega + abrir issue/TODO para (b). G6 queda en P3 con anotación "deuda de proceso, no técnica".

---

### G9 — Carril `codex/secretaria-d6-e2e-debt` sin PR abierto — P3

**V+:** abrir PR a `main` con descripción que incluya:
- Diff vs `origin/main`.
- Referencia al commit `f598542`.
- Link al audit 2026-05-16.

**Criterio mecánico:** `gh pr list --state open --head codex/secretaria-d6-e2e-debt | wc -l` = 1.

#### Yo vs Yo (G9)

- **V−**: "Abrir PR de un carril cuyo único commit es alinear tests E2E parece churn. ¿Por qué no se mergeó directamente?"
- **V+**: porque CLAUDE.md dice "merge con --no-ff para preservar atribución de agente" y porque la rama está en convención `codex/`. Una vez auditada (este informe), debería mergearse.
- **V−**: "¿Auditar una rama merge-ready y luego dejarla sin merger no contradice la disciplina?"
- **V+**: ✓. La acción correcta es PR + auto-merge tras CI verde + cleanup. Si no hay CI configurado para este repo, ejecutar `bun run typecheck && bun run test src/lib/secretaria src/test/schema && bun run build` localmente y mergear con `--no-ff`.

**Decisión adversarial**: G9 incluye además **verificar si los 5 tests ENOENT** (G4) son regresiones del carril o pre-existentes en `main`. Si pre-existentes en main, no bloquean el merge del carril.

```bash
git switch main && bun run test src/test/schema 2>&1 | grep -c "FAIL"
git switch codex/secretaria-d6-e2e-debt
```

---

## §2 Fase 1 — Hardening productiva (bloqueantes)

**Entry criteria:** F0 completa. `bun run db:check-target` pass. Decisión owner de aceptar trabajo productiva (no es para demo).

**Exit criteria:** las 4 probes de G1/G2/G3/G7 con resultado esperado. Tests E2E B7 destructivo opt-in pass sin regresión.

### G1 — RLS hardcoded a tenant demo — P1 productiva

**V+ (acción propuesta):**

Migración no destructiva que **replica** las policies actuales con versión JWT-aware, y **mantiene** las hardcoded como backup deshabilitado. Patrón:

```sql
-- 1. Helper SECURITY DEFINER para resolver tenant_id del usuario.
CREATE OR REPLACE FUNCTION fn_current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'tenant_id',
    NULLIF(current_setting('app.tenant_id', true), '')
  )::uuid;
$$;

-- 2. Reemplazar policies por entidad. Ejemplo entities:
DROP POLICY IF EXISTS entities_tenant_isolation ON entities;
CREATE POLICY entities_tenant_isolation_v2 ON entities
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());
```

Aplicar a las **17 tablas** críticas. Cada policy: USING + WITH CHECK separados.

**Pre-requisito frontend:** el JWT emitido por Supabase Auth debe contener `tenant_id` en `app_metadata`. Camino:
- Pilot: usar `app.tenant_id` por sesión vía `supabase.rpc('fn_set_tenant_id', { p_tenant_id: ... })` antes de cualquier query.
- Productiva real: custom JWT hook (`auth.hook_token_template`) que inyecta `tenant_id` desde `user_tenants` table.

**Archivos:**
- Nueva migración `supabase/migrations/<timestamp>_rls_jwt_aware_policies.sql`.
- Frontend: `src/integrations/supabase/client.ts` con hook post-login que set tenant.
- Nuevo test `src/test/schema/rls-multitenant.test.ts` que prueba que dos tenants sintéticos no se ven mutuamente.

**Criterio mecánico:**
```sql
SELECT polname, pg_get_expr(polqual, polrelid) FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relnamespace = 'public'::regnamespace
  AND pg_get_expr(polqual, polrelid) ILIKE '%00000000-0000-0000-0000-000000000001%';
-- Esperado: 0 filas
```
Y: `bun run test src/test/schema/rls-multitenant.test.ts` pass para 2 tenants sintéticos.

**Riesgo:** si el JWT no tiene `tenant_id`, `fn_current_tenant_id()` devuelve `NULL` → todas las queries fallan. Mitigación: feature flag `RLS_JWT_AWARE=true|false` durante migración.

**Rollback:** restaurar policies hardcoded desde backup migración. Demo no toca este código.

#### Yo vs Yo (G1)

- **V−**: "Estás introduciendo `fn_current_tenant_id()` SECURITY DEFINER que **bypasea RLS** para leer JWT. Eso es exactamente el patrón que causa CVEs en proyectos Supabase mal configurados (`SECURITY DEFINER` mal escopado → privilege escalation). ¿Cómo te aseguras de que el helper no se puede abusar?"
- **V+**: la función no toca tablas — solo lee `current_setting`. No hay forma de abusarla más allá de pasar un JWT inválido (lo cual ya está protegido por Supabase Auth). `STABLE` + `SET search_path = public` mitigan inyección de schema. Aun así, **escopear el GRANT**: `REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated`.
- **V−**: "¿Y los pilots? Si demo sigue corriendo con la entidad hardcoded, y productiva con JWT, tienes dos modos. ¿Quién mantiene la doble vía?"
- **V+**: la migración mantiene SOLO la versión JWT. En demo, el seed setea `app_metadata.tenant_id = '00000000-...-0001'` para el usuario `demo@arga-seguros.com`, y `fn_current_tenant_id()` lo lee → semánticamente equivalente al hardcoded. No hay doble vía.
- **V−**: "Pero `app.tenant_id` setting es por-conexión. Supabase usa connection pooling. Si la sesión cambia de conexión, pierdes el setting. ¿Cómo lo manejas?"
- **V+**: prefiere JWT claim sobre `current_setting` por exactamente esa razón. La pool-safe variant es JWT. El `current_setting` solo aplica a service-role scripts. **Refinar**: `fn_current_tenant_id()` debe priorizar JWT y caer a `current_setting` solo si JWT vacío (caso script).

**Decisión adversarial**: G1 se reordena así:
1. Hook JWT primero (custom claims en `app_metadata`).
2. `fn_current_tenant_id()` con prioridad JWT > setting.
3. Migración policies después.
4. Tests multi-tenant últimos.

Si paso 1 falla (no se puede modificar el hook auth sin contrato Supabase), G1 queda **bloqueado en productiva** hasta migración a Supabase Auth con custom claims o backend propio.

---

### G2 — `fn_crear_sociedad_legal_y_capital` con `EXECUTE` a PUBLIC/anon — P1 productiva

**V+:** migración no destructiva:

```sql
REVOKE EXECUTE ON FUNCTION public.fn_crear_sociedad_legal_y_capital(uuid, jsonb)
  FROM PUBLIC, anon;
```

**Archivos:** `supabase/migrations/<timestamp>_revoke_d6_rpc_public.sql`.

**Criterio mecánico:**
```sql
SELECT grantee FROM information_schema.routine_privileges
WHERE routine_name = 'fn_crear_sociedad_legal_y_capital';
-- Esperado: ['authenticated','service_role','postgres'] — sin PUBLIC ni anon.
```

Y E2E B7 destructivo pasa con `SECRETARIA_E2E_PHASE_B1=1`.

**Riesgo:** ninguno técnico. El caller real (`SociedadNuevaStepper.tsx:222`) usa sesión autenticada.

**Rollback:** trivial — `GRANT EXECUTE ... TO PUBLIC, anon`.

#### Yo vs Yo (G2)

- **V−**: "¿Has verificado que NO HAY caller anon legítimo? Has visto un caller. Eso no excluye que el bundle frontend ejecute esto sin auth en algún edge case (renderizado SSR, prefetch, etc.)."
- **V+**: `grep -rn fn_crear_sociedad_legal_y_capital src/` debería listar todos los callers. Verificar antes de cerrar.
- **V−**: "¿Y hooks SSR o Edge Functions?"
- **V+**: `grep -rn fn_crear_sociedad_legal_y_capital supabase/functions/` también. Si Edge Function la llama, usa `service_role` (no anon) → seguro.
- **V−**: "¿Y todas las RPCs de Secretaría tienen el mismo problema? El Sprint 5 closeout dice que se revocaron muchas — pero ¿cuántas se omitieron?"
- **V+**: **éste es el verdadero gap**. La pregunta correcta no es "revocar D6" — es "auditar todas las RPCs públicas". Acción correcta: probe inventario:
  ```sql
  SELECT routine_name, grantee FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE'
    AND routine_name LIKE 'fn_%'
  ORDER BY routine_name;
  ```
  → si hay > 1 fila, ampliar G2 a "revoke todas".

**Decisión adversarial**: G2 se expande a **"audit + revoke RPCs públicas Secretaría"**. Mantiene severidad P1 productiva. Demo no afectado.

---

### G3 — `storage-archiver.ts` con `getPublicUrl` sobre bucket privado — P1 productiva / P2 demo

**V+:** refactor del archiver:

1. Almacenar `evidence_bundles.storage_path` (text) en vez de `document_url`.
2. Hook `useEvidenceBundleSignedUrl(bundleId)` que llama `createSignedUrl(path, 900)` bajo demanda.
3. UI consume el hook al renderizar enlaces de descarga.
4. Backfill: para `evidence_bundles` existentes con `document_url` poblado, extraer path y poblar `storage_path`.

**Archivos:**
- `src/lib/doc-gen/storage-archiver.ts` — quitar `getPublicUrl`.
- Nueva migración `<timestamp>_evidence_bundles_storage_path.sql` con `ALTER TABLE evidence_bundles ADD COLUMN storage_path text` + backfill.
- Nuevo hook `src/hooks/useEvidenceBundleSignedUrl.ts`.
- UI: `ExpedienteAcuerdo.tsx`, `ActaDetalle.tsx`, otros que rendericen `document_url`.

**Criterio mecánico:**
```bash
grep -rn "getPublicUrl" src/lib/doc-gen/ | wc -l   # esperado: 0
```
Y:
```sql
SELECT count(*) FROM evidence_bundles WHERE storage_path IS NULL;  -- 0
```
Y E2E que descargue un evidence_bundle desde UI con usuario auth normal pasa.

**Riesgo:** UI breakage si algún componente lee `document_url` directamente.

**Rollback:** mantener `document_url` como columna shadow durante 1 sprint. La UI lee `storage_path` si existe, cae a `document_url` si no.

#### Yo vs Yo (G3)

- **V−**: "Patch desde 'broken' a 'TTL signed URL'. Pero el TTL fijo de 900s asume que el usuario abre el link inmediatamente. ¿Qué pasa con previews/cache/CDN?"
- **V+**: la decisión correcta de TTL depende del caso de uso:
  - Descarga inmediata desde UI → 900s.
  - Compartir enlace con tercero (cliente, auditor) → TTL del lado del flujo de compartir, no del archiver.
  - Long-lived (auditoría a 7 años) → no se firma; se re-firma al abrir.
  
  → arquitectura: **never store signed URLs in DB**. Almacenar `storage_path` + RBAC en la tabla; UI/Edge Function firma en demand.
- **V−**: "Bucket privado más signed URL doesn't equal access control. Si dos tenants escriben a `matter-documents/`, ambos pueden firmar paths del otro."
- **V+**: razón. **Storage policy** sobre el bucket necesita filtrar por tenant_id en el path:
  ```sql
  CREATE POLICY matter_documents_tenant ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'matter-documents'
           AND (storage.foldername(name))[1] = fn_current_tenant_id()::text);
  ```
  Esto exige cambiar el storage path a `<tenant_id>/<agreement_id>/<filename>.docx`.
- **V−**: "Migrar el storage path requiere mover ficheros existentes. ¿Backfill seguro?"
- **V+**: 37 evidence_bundles actuales. Script: para cada uno, `storage.move(old_path, new_path)` + update DB. Ventana de mantenimiento corta.

**Decisión adversarial**: G3 se expande a **"refactor evidence storage layer"**:
1. Bucket policy por tenant (path-prefix-based).
2. Storage path = `<tenant_id>/<agreement_id>/<filename>`.
3. DB: `storage_path` + opcional `signed_url_ttl_hint`.
4. Hook `useEvidenceBundleSignedUrl()`.
5. Backfill 37 bundles con script controlado.
6. UI consume hook.

Coste: ~6-10h. P1 productiva confirmado. Demo no afectado (URLs actuales siguen "rotas" pero archivado funciona).

---

### G7 — Migración `evidence_bundle_review_events` en `proposed/` — P2

**V+:** activar la migración tras pronunciamiento Comité Legal:
1. Solicitar review legal del catálogo de estados y eventos.
2. Si APROBADO: aplicar via MCP, registrar en ledger, mover de `proposed/` a `migrations/` con timestamp válido.
3. Si MODIFICADO: actualizar SQL en `proposed/` antes de aplicar.
4. Si RECHAZADO: archivar a `proposed/rejected/` con justificación.

**Criterio mecánico:**
- APROBADO: tabla `evidence_bundle_review_events` existe en Cloud + `supabase_migrations.schema_migrations` contiene la versión + fichero ya no está en `proposed/`.
- RECHAZADO: fichero en `proposed/rejected/<date>-<reason>.sql` + nota en CLAUDE.md.

#### Yo vs Yo (G7)

- **V−**: "Dependes de un pronunciamiento legal externo. ¿Qué haces si nadie responde?"
- **V+**: poner deadline. Si pasados N días sin respuesta, escalar a "decisión por defecto: archivar a rejected" + retomar cuando haya capacity legal.
- **V−**: "Eso es passive-aggressive contra el comité legal. La realidad es que esta migración NO bloquea demo. ¿Por qué urgir?"
- **V+**: correcto. G7 baja a P3 si demo es el horizonte. Vuelve a P2 cuando se decida productiva.

**Decisión adversarial**: G7 es **fase 1 condicional** — solo si la fase 1 incluye workflow review/promote como deliverable. Si no, baja a P3 y queda en backlog.

---

## §3 Fase 2 — Plataforma / operaciones

### G8 — Drift histórico migraciones — P2

**V+:** ya documentado en `docs/superpowers/plans/2026-05-15-secretaria360-migration-ledger-repair-plan.md`. Ejecutar ese plan. Cierre: `supabase migration list --linked` sin filas locales-only ni remote-only.

**Riesgo:** reparaciones con `--status applied` sin verificar que el SQL está en Cloud → ledger miente. Mitigar: verificar cada migración antes del repair.

#### Yo vs Yo (G8)

- **V−**: "Has identificado 5 tests ENOENT (G4) que sugieren que la consolidación del ledger no fue completa. ¿Y si el ledger Cloud también tiene migraciones que el repo no?"
- **V+**: probe:
  ```bash
  comm -23 <(supabase migration list --linked | awk '{print $1}' | sort -u) \
           <(ls supabase/migrations/*.sql | xargs -I {} basename {} .sql | awk -F_ '{print $1}' | sort -u)
  ```
  → filas en remoto sin contraparte local = ledger drift.
- **V−**: "Ese comando puede no funcionar por formato. Mejor pedir al plan de reparación que lo incluya."
- **V+**: ✓. G8 incluye sub-tarea "validar drift bidireccional antes de cualquier repair".

---

### G10 — Chunk `index-*.js` 1.55 MB — P3

**V+:** code-split via `build.rollupOptions.output.manualChunks` en `vite.config.ts`. Targets típicos: `handlebars` (450K), `xlsx` (430K), `react/react-dom`, módulos Secretaría/GRC/AIMS.

**Criterio mecánico:** `bun run build` no emite warning de chunks > 500K para el bundle principal.

#### Yo vs Yo (G10)

- **V−**: "Code-split puede empeorar TTI si hay route-level dynamic imports mal configurados. ¿Mediste antes de tocar?"
- **V+**: no. Acción prerequisito: `lighthouse` o `web-vitals` baseline antes del refactor.
- **V−**: "Y ¿esto es prioridad? El audit dijo P3, eso es porque demo no se queja. ¿Por qué incluirlo en F2?"
- **V+**: para no recargar la deuda. Pero si demo no se queja, puede dejarse en backlog hasta que llegue feedback de performance.

**Decisión adversarial**: G10 sale de F2 → backlog. Re-entra a un sprint cuando haya queja medida.

---

### G12 — E2E destructivos no ejecutados — P3

**V+:** crear job CI (o cron manual) que ejecute:
```bash
SECRETARIA_E2E_PHASE_B1=1 SECRETARIA_E2E_DESTRUCTIVE=1 SECRETARIA_E2E_ISOLATED_TENANT=1 \
  bunx playwright test e2e/43-secretaria-phase-b7-sociedad-nueva-ui-driving.spec.ts e2e/45-secretaria-isolated-fixture.spec.ts --project=chromium
```

**Criterio mecánico:** registro en `docs/audits/e2e-runs.log` con resultado y SHA del commit. Mínimo 1 ejecución por sprint.

#### Yo vs Yo (G12)

- **V−**: "Sin CI configurado, esto depende de disciplina humana. ¿Realista?"
- **V+**: no del todo. La forma robusta es CI con GitHub Actions / Vercel. Si no existe pipeline, la deuda es estructural (no de E2E sino de DevOps).
- **V−**: "Entonces este gap encubre uno mayor: no hay pipeline."
- **V+**: ✓. G12 promueve la deuda real: "configurar CI/CD productivo" — sube a P2 si productiva sigue como objetivo.

---

## §4 Fase 3 — Integraciones externas (out of technical scope)

### G11 — QTSP real, RM real, CNMV/IBEX, SIEM Sentinel — P1 productiva

**V+:** documento "Plan de integración productiva" con secciones por integración:
- QTSP EAD Trust: contrato, credenciales, endpoint, autenticación, payload contract.
- Registro Mercantil: API/EDI, ventana operativa, fallback manual.
- CNMV/IBEX: feed regulatorio, frecuencia, parsing.
- SIEM Microsoft Sentinel: OTel feed, schema events, retention.

Para cada uno: stub actual, requisitos productiva, ETA, owner.

**Criterio mecánico:** `docs/superpowers/specs/2026-XX-XX-integraciones-productiva.md` existe + decisión owner por integración.

#### Yo vs Yo (G11)

- **V−**: "Esto no es 'integración', es marketing. Estás escribiendo un brochure."
- **V+**: razón. El deliverable correcto es un **risk register** por integración, no un plan operativo (no se puede planear sin contrato). Estructura:
  - Lo que se hace hoy (stub).
  - Lo que el cliente productivo verá si activa la integración.
  - Riesgo cierto si no se contrata (e.g., "QES no válida → certificaciones no admisibles ante RM").

**Decisión adversarial**: G11 produce un **risk register**, no un plan. Sale de F3 y entra en docs/specs como referencia continua.

---

## §5 Síntesis de prioridades post-adversarial

Después de la auto-crítica, el plan refinado:

| Gap | Acción real | Severidad real | Fase | Cierre verificable |
|---|---|---|---|---|
| G4 | Reapuntar O eliminar tests ENOENT, sub-deliverable "qué cubría cada uno" | P1 si cobertura no migrada | F0 | 0 FAIL + tabla cobertura |
| G5 | Inventario `tipo` plantillas + reglas Gate PRE estructurales (no probe) | P3 | F0 | Gate PRE rechaza tipo desconocido |
| G6 | Editar prompt + abrir issue para snapshot.yaml | P3 + deuda proceso | F0 | Commit prompt + issue |
| G9 | Verificar tests ENOENT pre-existen en main; abrir PR | P3 | F0 | PR abierto + tests ENOENT clasificados |
| G1 | JWT custom claims + helper SECURITY DEFINER bien escopado + policies v2 + 17 tablas | P1 productiva | F1 | 0 filas policy hardcoded + test multi-tenant verde |
| G2 | Audit + revoke TODAS las RPCs públicas (no solo D6) | P1 productiva (ampliado) | F1 | 0 filas grantee=PUBLIC/anon en `fn_*` |
| G3 | Refactor evidence storage layer completo (path con tenant + signed URL hook + bucket policy + backfill) | P1 productiva | F1 | 0 getPublicUrl + 0 storage_path NULL + bucket policy aplicada |
| G7 | Decisión legal binaria (apply/reject) | P3 demo / P2 productiva | F1 condicional | Migración aplicada O rechazada formalmente |
| G8 | Plan ledger repair existente + probe drift bidireccional | P2 | F2 | `supabase migration list` consistente |
| G10 | Backlog hasta queja medida | P3 → backlog | — | — |
| G12 | Promover a "configurar CI/CD productivo" | P2 productiva | F2 | Pipeline CI ejecutando E2E destructivos |
| G11 | Risk register por integración (no plan) | P1 productiva | F3 | Risk register publicado |

**Resúmenes adversariales clave:**
- G2 se amplía: no es D6 puntual, es auditoría general de RPCs públicas.
- G3 se amplía: no es comentario engañoso, es ausencia de capa de storage productiva.
- G5 se amplía: la regla del probe debe vivir en el motor, no en el prompt.
- G10 baja a backlog.
- G12 sube a P2 por dependencia de CI/CD.
- G11 transforma "plan" en "risk register".

---

## §6 Concilio Codex (ejecutado 2026-05-16)

Codex CLI 0.130.0, modo Consult con framing adversarial, 562K tokens, sesión `019e313b-6b7d-78e3-8c7d-eb4e82f5aaae`.

Codex leyó: plan v0 completo, audit, CLAUDE.md, migración D6, storage-archiver, SociedadNuevaStepper, vite.config, migraciones secretaria-p0, tests ENOENT, e hizo grep cross-repo de `getPublicUrl|createSignedUrl|document_url`.

**Veredicto Codex:** *"Rewrite it; the plan closes visible audit symptoms while leaving identity, definer functions, evidence immutability, storage authorization, and production test isolation structurally unresolved."*

### Decisiones del concilio (yo vs codex)

| # | Crítica Codex | Mi respuesta | Acción en v1 |
|---|---|---|---|
| K1 | **G1 P0**: `request.jwt.claims ->> 'tenant_id'` no funciona si el claim vive en `app_metadata` (default Supabase). El Custom Access Token hook es feature **Pro-tier**. Sin hook, `fn_current_tenant_id()` devuelve NULL → lockout total. | **ACCEPT**. Hand-wave confirmado. G1 v0 asumía el hook sin probarlo. | G1 v1: precondiciones explícitas (plan Pro O hook custom O migración a auth propio); fallback a `app_metadata` parsing con CAST guards; tests con JWT vacío y JWT sin claim. |
| K2 | **G1 P0**: "Policies hardcoded como backup deshabilitado" es nonsense — Postgres RLS es permisivo por defecto, las policies OR-combinan. No hay backup safe. | **ACCEPT**. Mi propuesta de rollback era errónea. | G1 v1: forward-only deployment. Sin policies de backup. Rollback = nuevo migration que vuelve a literal (incidente productiva si se llega ahí). |
| K3 | **G2 P0**: Probe `information_schema.routine_privileges WHERE routine_name LIKE 'fn_%'` falla en: signatures overloaded, schemas no-public (`auth.*`, `storage.*`, `extensions.*`), procedures, trigger functions, default PUBLIC EXECUTE vía `acldefault`, grants a `authenticated` que actúan como public. | **ACCEPT 100%**. Probe v1 con `pg_proc + pg_namespace + aclexplode(COALESCE(proacl, acldefault('f', proowner)))`. | G2 v1: probe nuevo + `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (G19 codex). |
| K4 | **G3 P0**: Movimiento de objetos + update `evidence_bundles.storage_path` invalida `manifest_hash` (el manifest contiene `artifacts[].ref` que entra al SHA-256). Rompe inmutabilidad de evidencia. | **PARTIAL ACCEPT**. Codex tiene razón sobre el hash. Mi `rollback con shadow column` no salva el manifest. La fix correcta: append-only supersession (registro nuevo en `evidence_bundles` con `supersedes_id` apuntando al viejo + storage_path nuevo + manifest nuevo + hash recalculado), legacy no se toca. | G3 v1: rediseño completo de migración storage. NO update in-place. Append-only. |
| K5 | **G3 P1**: Client-side `createSignedUrl` no es authorization — cualquiera en el mismo tenant que conozca el path puede firmarlo. Necesita server-side gating con check de `evidence_bundles` RBAC + legal hold + body confidentiality. | **ACCEPT**. Edge Function para firmar, con check de capability + tenant + estado evidence_bundle (no legal hold). | G3 v1: Edge Function `sign-evidence-url` + UI consume Edge Function, no `createSignedUrl` directo. |
| K6 | **G3 — falso negativo en cobertura**: `getPublicUrl` también vive en `src/hooks/useConvocatorias.ts:420`; `document_url` se renderiza directamente en `ExpedienteAcuerdo.tsx:222-225` y `EvidenceForenseSection.tsx:99-101`. Mi grep solo cubría `src/lib/doc-gen/`. | **ACCEPT — bochornoso**. Cierre v0 era ciego. Verificado con grep: 1 caller adicional + 2 UI sites. | G3 v1: scope ampliado a "TODA referencia a getPublicUrl + TODO render directo de document_url". |
| K7 | **G4 P1**: `bun run test … | grep FAIL | wc -l` pasa si tests están skipped/no descubiertos/crash sin "FAIL"/apuntan a superset que contiene todos los strings trivialmente. Goodhart. | **ACCEPT**. Cambio criterio: Vitest JSON output con: (a) 5 archivos descubiertos, (b) assertion count esperado por archivo ejecutado, (c) cero skips no nombrados, (d) evidencia de aserción mapeada a bloque SQL específico. | G4 v1: Vitest `--reporter=json` + script de validación de cobertura. |
| K8 | **G10 P1**: 1.55 MB en línea regulada española (oficina sucursal a 2 Mbps) = 6s transfer + parse/compile. "Demo no se queja" contradice anti-pattern propio del plan. | **ACCEPT**. Subo de P3-backlog a P2-F2. Bundle analyzer + Lighthouse slow-3G obligatorios. | G10 v1: F2 con budget de transferencia <500K main bundle + Lighthouse score |
| K9 | **NEW G13/G16 P1**: D6 promoción a OPERATIVA es client-side (`SociedadNuevaStepper.tsx:252-259`). Network fail o usuario malicioso = sociedad medio-promovida o promovida sin invariante server-side. | **ACCEPT**. No estaba en mi inventario. | NEW G16: mover promoción a una RPC `fn_promover_sociedad_operativa` con guards de invariantes (TX2 completo, cargos mínimos, etc.). |
| K10 | **G12 + NEW G17 P1**: E2E destructivos contra `governance_OS` Cloud demo, no contra staging. Bad fixture o env flag mal = contaminación dataset demo. Plan v0 propone "log en docs/" — paper closure. | **ACCEPT**. Audit ya advierte esto en §10 preguntas. v1 incluye creación de proyecto Supabase staging separado. | NEW G17: staging Supabase project + redirect E2E destructivos a staging. |
| K11 | **G11 — paper closure**: risk register no prueba nada. EAD Trust QES productivo necesita sandbox contract tests, callback validation, idempotency, timestamp evidence, failure-mode handling, secret rotation. | **ACCEPT con matiz**. Risk register sigue siendo entregable (decisión legal/producto), pero ahora con sub-entregable: "contract tests stub-vs-producción" que valida el shape del wire antes de tener contrato. | G11 v1: risk register + contract tests stub (testeable hoy sin contrato real). |
| K12 | **NEW G14 P0**: Threat model de SECURITY DEFINER y trigger functions. Mi G2 solo cubre RPCs invocables; los triggers DEFINER son ruta de escalación independiente. | **ACCEPT**. | NEW G14: inventario completo de DEFINER + triggers + verificación de invariantes. |
| K13 | **NEW G18 P1**: Tenant prefix en storage/RLS no modela: comité confidencialidad, legal hold, auditor-only access, body-level restrictions. | **ACCEPT**. Intra-tenant authz es deuda real que G1 no resuelve. | NEW G18: modelado de RBAC intra-tenant con `body_id` + `capability_matrix` + `legal_hold_active`. |
| K14 | **NEW G19 P1**: G2 no incluye `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` — futuras funciones siguen leaky. | **ACCEPT**. | NEW G19: default privileges como parte de G2 v1. |
| K15 | **NEW G20 P2**: No hay observability para RLS denials, service-role usage anómalo, signed URL failures, audit chain drift, storage 403 spikes. | **ACCEPT**. Si productiva, observability no es opcional. | NEW G20: OTel events específicos + dashboard. |

### Comentario de cierre del concilio

Plan v0 sufría de "audit-symptom myopia" — atacaba lo visible (5 ENOENT, 1 comentario engañoso, 1 RPC con PUBLIC) sin reconocer que esos síntomas vivían encima de fallos estructurales mayores. Codex hizo el trabajo: forzó la separación entre **lo que el audit dijo** y **lo que el audit no podía ver**.

V1 incorpora 8 gaps nuevos (G13-G20), 3 de ellos P0. La superficie de trabajo crece. La severidad real del estado productiva sube.

Plan v1 vive en archivo separado: [`2026-05-16-tgms-gaps-coverage-plan-v1.md`](./2026-05-16-tgms-gaps-coverage-plan-v1.md).

---

## §7 Anti-patrones a evitar (recordatorio)

- ❌ "Esto cierra la deuda" sin probe SQL que lo confirme.
- ❌ "Demo no se queja" como justificación para no abordar productiva.
- ❌ Patches superficiales (G3 con TTL fijo) sin entender la capa que se está parcheando.
- ❌ Asumir que un test verde valida lo que se cree que valida (G4).
- ❌ Mezclar entregables (plan vs risk register para G11).
- ❌ **(nuevo post-concilio)** Atacar síntomas del audit en lugar de causas estructurales.
- ❌ **(nuevo post-concilio)** Probe que cubre "lo que pensé revisar" en lugar de "todo el universo del problema" (G2 falso negativo).

---

*v0 — concilio codex completado 2026-05-16. Plan v1 supersede.*
