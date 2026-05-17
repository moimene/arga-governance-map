# TGMS Gaps Coverage — Plan v1 (post-concilio Codex)

**Fecha:** 2026-05-16
**Supersede:** [`2026-05-16-tgms-gaps-coverage-adversarial-plan.md`](./2026-05-16-tgms-gaps-coverage-adversarial-plan.md) (v0 + concilio codex)
**Fuente audit:** [`docs/audits/2026-05-16-tgms.md`](../../audits/2026-05-16-tgms.md)
**Carril:** `codex/secretaria-d6-e2e-debt` (HEAD `f598542`)

> **Diferencia clave vs v0.** El plan v0 atacaba 12 síntomas del audit. El concilio codex demostró que tres de esos síntomas (G1 RLS, G2 RPC scope, G3 storage URL) eran señales superficiales de problemas estructurales mayores. V1 reorganiza el trabajo alrededor de 20 gaps: 12 originales + 8 nuevos del concilio. **3 nuevos son P0** (G13 identity, G14 definer threat model, G15 evidence immutability).

---

## §0 Resumen ejecutivo

**Tesis post-concilio**: el trabajo productiva no es "cerrar 12 gaps". Es resolver 5 ejes estructurales — Identity, Surface, Storage, Plataforma, Garantía externa — donde cada uno depende del anterior.

| Fase | Eje | Gaps | Bloquea demo | Bloquea productiva |
|---|---|---|---|---|
| F0 — Estabilización gate | QA/docs sin riesgo | G4, G5, G6, G9 | No | No |
| F1 — Identity contract | Quién es quién | **G13 (P0), G1 (P0→P1 post-G13), G18 (P1)** | No | **Sí** |
| F2 — Surface hardening | Qué puede hacer cada quién | **G14 (P0), G2 (P0), G19 (P1)** | No | **Sí** |
| F3 — Evidence storage | Inmutabilidad + autorización | **G15 (P0), G3 (P0)** | No | **Sí** |
| F4 — Plataforma | Atomicidad, staging, build, observability | **G16 (P1), G17 (P1), G8 (P2), G10 (P2), G12 (P2), G20 (P2)** | No | Parcial |
| F5 — Garantía externa | Integraciones, retention | G11 (P1), G7 (P2) | No | **Sí** |

**Cambio de cantidad de trabajo vs v0**: ~2x estimado. V0 minimizaba el coste real.

**Veredicto productiva post-v1**: NO-GO con plan creíble. F1+F2+F3+F4 son aprox. 6-8 sprints (con 1 dev focal) o 3-4 sprints (con par + auditor externo).

---

## §1 Mapa de gaps (severidad real post-concilio)

| ID | Nombre | Severidad v0 | Severidad v1 | Fase | Origen |
|---|---|---|---|---|---|
| G1 | RLS hardcoded a tenant demo | P1 | **P1** (depende G13) | F1 | audit |
| G2 | `fn_crear_sociedad_legal_y_capital` EXECUTE a PUBLIC | P1 | **P0** (probe v0 era ciega) | F2 | audit + concilio |
| G3 | `getPublicUrl` sobre bucket privado | P1/P2 | **P0** (rompe inmutabilidad si se hace mal) | F3 | audit + concilio |
| G4 | 5 tests schema ENOENT | P2 | **P1** (cierre Goodhart) | F0 | audit + concilio |
| G5 | Probe §6.2 falso positivo | P3 | P3 | F0 | audit |
| G6 | ESTADO_INICIAL del prompt obsoleto | P3 | P3 | F0 | audit |
| G7 | `evidence_bundle_review_events` en hold | P2 | P2 condicional | F5 | audit |
| G8 | Drift histórico migraciones | P2 | P2 | F4 | audit |
| G9 | Carril sin PR abierto | P3 | P3 | F0 | audit |
| G10 | Chunk index 1.55 MB | P3 | **P2** (línea regulada 2Mbps) | F4 | audit + concilio |
| G11 | Integraciones externas reales | P1 | P1 | F5 | audit |
| G12 | E2E destructivos no ejecutados | P3 | **P2** (depende G17) | F4 | audit |
| **G13** | **Tenant Identity Contract Missing** | — | **P0** | F1 | concilio |
| **G14** | **SECURITY DEFINER / Trigger threat model** | — | **P0** | F2 | concilio |
| **G15** | **Evidence Immutability during storage migration** | — | **P0** | F3 | concilio |
| **G16** | **D6 Atomicity (promoción client-side)** | — | **P1** | F4 | concilio |
| **G17** | **No staging / preproduction isolation** | — | **P1** | F4 | concilio |
| **G18** | **Intra-tenant authorization (RBAC granular)** | — | **P1** | F1 | concilio |
| **G19** | **Future function default privileges (ALTER DEFAULT)** | — | **P1** | F2 | concilio |
| **G20** | **Production observability for security controls** | — | **P2** | F4 | concilio |

---

## §2 Fase 0 — Estabilización del gate

**Entry criteria:** rama actualizada, `bun run db:check-target` pass.

**Exit criteria:** Vitest JSON output con 0 ENOENT + 5 archivos descubiertos + assertions ejecutadas; prompt v2; PR del carril.

### G4 — 5 archivos schema-test ENOENT — P1 (Goodhart-aware)

**Acción v1 (incorpora K7 del concilio):**

1. Por cada test, ejecutar análisis:
   ```bash
   bunx vitest run --reporter=json src/test/schema/<archivo>.test.ts 2>&1 | tee /tmp/test-result.json
   ```
2. Si discovery falla (ENOENT en `readFileSync`), abrir el test, listar sus aserciones (`expect(migration).toContain('FOO')`, `expect(migration).toMatch(/pattern/)`).
3. Cross-checkear cada aserción contra el contenido **literal** de las migraciones consolidadas candidatas:
   - `personas-cargos-*.sql` → migraciones `20260512*_personas_cargos_*.sql` reales.
   - `secretaria-p0-*.sql` → `20260514181001_secretaria_production_sprint_closeout.sql`.
4. Tabla por test:

   | Test | Aserción | Cubierta en | Decisión |
   |---|---|---|---|
   | `personas-cargos-security-followups.test.ts` | `…` | `20260512190500_…` | reapuntar |
   | … | … | NO CUBIERTA | escalar P1→P0, restaurar SQL en migración nueva |

5. Criterio mecánico v1:
   ```bash
   bunx vitest run --reporter=json src/test/schema 2>&1 | \
     jq '[.testResults[] | select(.status != "passed" and .status != "skipped")] | length'
   # Esperado: 0
   ```
   Y:
   ```bash
   bunx vitest run --reporter=json src/test/schema 2>&1 | \
     jq '.numTotalTestSuites'
   # Esperado: count_actual >= count_pre_fix (no se perdió ningún test)
   ```

**Riesgo v1:** una aserción no cubierta = regresión silenciosa de auditoría. Cierre incluye "tabla de cobertura por aserción" como entregable.

**Yo vs Codex (K7)**: Codex tenía razón. `grep FAIL | wc -l` pasa por skips, por crashes sin "FAIL", por superset. Vitest JSON + jq + count discovery es el cierre correcto.

### G5 — Probe §6.2 falso positivo — P3

Subir a Gate PRE como regla estructural. Migración:

```sql
-- gate-pre-semantic.ts: regla nueva
WHERE estado = 'ACTIVA'
  AND tipo IN ('MODELO_ACUERDO','ACTA','DECISION')
  AND (organo_tipo IS NULL OR adoption_mode IS NULL OR referencia_legal IS NULL);
```

Probe del prompt apunta al Gate PRE como fuente de verdad. Inventario de tipos antes:

```sql
SELECT DISTINCT tipo FROM plantillas_protegidas WHERE estado='ACTIVA' ORDER BY 1;
```

### G6 — Prompt obsoleto — P3

Editar `docs/audits/prompt-tgms-audit.md` ESTADO_INICIAL. Abrir TODO para introducir `docs/audits/state-snapshot.yaml` hidratado por wrapper (deferred).

### G9 — Carril sin PR — P3

PR abierto a `main` con link al audit. Antes del merge: cross-check de que los 5 tests ENOENT de G4 no son regresión del carril (probarlo en `main`).

---

## §3 Fase 1 — Identity contract

**Entry criteria:** F0 completa. Decisión owner sobre plan Supabase (Free vs Pro vs migración auth propio).

**Exit criteria:** `fn_current_tenant_id()` operativo con tests JWT vacío/sin-claim/válido; policies replicadas en 17 tablas; multi-tenant E2E pass entre 2 tenants sintéticos.

### G13 — Tenant Identity Contract Missing — **P0** (precondición de G1, G18)

**Concilio K1**: Custom Access Token hook es Pro-tier. Sin hook, claim no llega a JWT root. Plan v0 era hand-wave.

**Acción v1 — diseño de contrato de identidad:**

1. **Decisión owner**: cuál es el modelo de identidad productiva.
   - (a) Supabase Pro + Custom Access Token hook → claim `tenant_id` en root.
   - (b) Supabase Free/Pro + `app_metadata.tenant_id` + helper que parsea `app_metadata` de JWT.
   - (c) Backend propio (Edge Functions) que firma JWTs custom.
   - (d) Migración a auth propio (out of scope para v1).

2. **Schema de soporte (independiente de la decisión):**
   ```sql
   -- user_tenants table — single source of truth para membership.
   CREATE TABLE IF NOT EXISTS user_tenants (
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     tenant_id uuid NOT NULL,
     role text NOT NULL CHECK (role IN ('SECRETARIO','CONSEJERO','COMPLIANCE','ADMIN_TENANT','AUDITOR')),
     is_default boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, tenant_id, role)
   );
   ```

3. **Helper `fn_current_tenant_id()` (hardened):**
   ```sql
   CREATE OR REPLACE FUNCTION fn_current_tenant_id() RETURNS uuid
   LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
   DECLARE
     v_claims jsonb;
     v_tenant text;
   BEGIN
     -- Path A: JWT root claim (si hook activo).
     v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
     v_tenant := v_claims ->> 'tenant_id';
     IF v_tenant IS NOT NULL AND v_tenant != '' THEN
       BEGIN
         RETURN v_tenant::uuid;
       EXCEPTION WHEN invalid_text_representation THEN
         RAISE EXCEPTION 'invalid tenant_id in JWT root claim';
       END;
     END IF;
     -- Path B: app_metadata.tenant_id.
     v_tenant := v_claims #>> '{app_metadata,tenant_id}';
     IF v_tenant IS NOT NULL AND v_tenant != '' THEN
       BEGIN
         RETURN v_tenant::uuid;
       EXCEPTION WHEN invalid_text_representation THEN
         RAISE EXCEPTION 'invalid tenant_id in app_metadata';
       END;
     END IF;
     -- Path C: fallback a user_tenants (1 default por user).
     SELECT ut.tenant_id INTO v_tenant
     FROM user_tenants ut
     WHERE ut.user_id = auth.uid() AND ut.is_default
     LIMIT 1;
     IF v_tenant IS NULL THEN
       RAISE EXCEPTION 'no tenant_id resolved for user %', auth.uid();
     END IF;
     RETURN v_tenant::uuid;
   END;
   $$;

   REVOKE EXECUTE ON FUNCTION fn_current_tenant_id() FROM PUBLIC, anon;
   GRANT EXECUTE ON FUNCTION fn_current_tenant_id() TO authenticated;
   ```

4. **Tests obligatorios** (`src/test/schema/identity-contract.test.ts`):
   - JWT vacío → exception "no tenant_id resolved".
   - JWT con `app_metadata.tenant_id` válido → tenant correcto.
   - JWT con `tenant_id` root claim → tenant correcto (path A preferido).
   - JWT con `tenant_id` inválido (no-uuid) → exception "invalid text representation".
   - user con 0 rows en `user_tenants` → exception.
   - user con 2 default rows → behavior definido (LIMIT 1, log warning).

**Criterio mecánico:**
```bash
bunx vitest run --reporter=json src/test/schema/identity-contract.test.ts 2>&1 | \
  jq '.numFailedTests'
# Esperado: 0 + numPassedTests >= 6
```

**Riesgo**: lockout total si productiva activa policies con `fn_current_tenant_id()` antes de poblar `user_tenants`. Mitigación: feature flag por tabla, rollout incremental.

**Rollback**: forward-only. Si rota productiva, migración nueva que desactiva policies v2 (no se vuelve al hardcoded).

### G1 — RLS hardcoded a tenant demo — P1 (degraded; depende G13)

**Concilio K2**: "backup policies disabled" es nonsense. Forward-only.

**Acción v1:**

Tras G13 OK, migración por **lote de 17 tablas**:

```sql
-- Para cada tabla T:
DROP POLICY IF EXISTS T_tenant_isolation ON T;
CREATE POLICY T_tenant_isolation_v2 ON T
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());
```

`audit_log` retiene sus 4 policies (insert / select / deny_delete / deny_update) — solo se ajustan USING/CHECK.

**Criterio mecánico:**
```sql
-- Probe v1: ninguna policy con UUID literal demo
SELECT polname, c.relname,
       pg_get_expr(p.polqual, p.polrelid) AS using_expr
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%00000000-0000-0000-0000-000000000001%';
-- Esperado: 0 filas
```

Y test multi-tenant E2E:

```typescript
// src/test/schema/rls-multitenant.test.ts
it('tenant A no ve entidades de tenant B', async () => {
  const tA = await createSyntheticTenant('A');
  const tB = await createSyntheticTenant('B');
  await seed.entities(tA, [{ legal_name: 'Sociedad A' }]);
  await seed.entities(tB, [{ legal_name: 'Sociedad B' }]);

  const clientA = supabaseClient(tA.jwt);
  const { data } = await clientA.from('entities').select('legal_name');
  expect(data.map(e => e.legal_name)).toEqual(['Sociedad A']);
});
```

### G18 — Intra-tenant authorization (RBAC granular) — P1

**Concilio K13**: tenant prefix RLS no modela comité confidencialidad, legal hold, body-level access.

**Acción v1:**

1. Extender `user_tenants.role` con scope:
   ```sql
   ALTER TABLE user_tenants ADD COLUMN scope_body_ids uuid[] DEFAULT NULL;
   -- NULL = todos los bodies; array = restringido.
   ```
2. Policy con check de body:
   ```sql
   CREATE POLICY meetings_intratenant ON meetings
     FOR SELECT TO authenticated
     USING (
       tenant_id = fn_current_tenant_id()
       AND (
         body_id = ANY(
           SELECT unnest(scope_body_ids) FROM user_tenants
           WHERE user_id = auth.uid()
             AND tenant_id = fn_current_tenant_id()
         )
         OR EXISTS (
           SELECT 1 FROM user_tenants
           WHERE user_id = auth.uid()
             AND tenant_id = fn_current_tenant_id()
             AND scope_body_ids IS NULL
         )
       )
     );
   ```
3. Legal hold: respetar `legal_hold_active` (G7 dependiente).

**Criterio mecánico:** test que un usuario con `scope_body_ids=[CdA]` no ve meetings de `Comisión Auditoría`.

**Riesgo**: complejidad RLS. Mitigación: hacer G18 **post-G1**, con un sprint dedicado.

---

## §4 Fase 2 — Surface hardening

**Entry criteria:** F1 completa.

**Exit criteria:** probe `pg_proc + aclexplode` devuelve 0 grants PUBLIC/anon a fn_*; `ALTER DEFAULT PRIVILEGES` aplicado; threat model DEFINER documentado.

### G14 — SECURITY DEFINER / Trigger threat model — **P0** (precondición de G2)

**Concilio K12**: G2 v0 cubría solo RPCs invocables. Triggers DEFINER son ruta de escalación independiente.

**Acción v1:**

1. Inventario completo:
   ```sql
   SELECT
     n.nspname AS schema,
     p.proname AS name,
     pg_get_function_identity_arguments(p.oid) AS args,
     CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' WHEN 't' THEN 'trigger' END AS kind,
     CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
     p.proowner::regrole::text AS owner,
     p.prosrc -- primeras N líneas para inspección
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.prosecdef = true
     AND n.nspname IN ('public', 'auth', 'storage')
   ORDER BY n.nspname, p.proname;
   ```

2. Para cada DEFINER function:
   - ¿Modifica datos? ¿De qué tablas?
   - ¿Verifica tenant? ¿Verifica role?
   - ¿Tiene `SET search_path`? (sin él, ruta de inyección de schema).
   - ¿Quién la puede invocar? (directly via EXECUTE / via trigger / via cascade?)

3. Tabla de riesgo: por cada DEFINER, decisión `KEEP|HARDEN|DROP`.

4. Para `HARDEN`: añadir guards de tenant + role + `SET search_path = public` si falta.

**Criterio mecánico**: documento `docs/superpowers/specs/2026-XX-XX-definer-threat-model.md` con tabla de riesgo + commits que aplican guards faltantes.

### G2 — RPC EXECUTE a PUBLIC — **P0** (probe refinada post-K3)

**Concilio K3**: probe v0 era ciega. v1 usa `aclexplode`:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS func_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'aggregate' WHEN 'w' THEN 'window' END AS kind,
  r.grantee::regrole::text AS grantee,
  r.privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) r ON true
WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
  AND r.privilege_type = 'EXECUTE'
  AND r.grantee IN (0::oid, (SELECT oid FROM pg_roles WHERE rolname = 'anon'))
ORDER BY n.nspname, p.proname;
-- Nota: grantee=0 representa PUBLIC en pg_proc.proacl.
```

Acción:
1. Probe ejecutada → identifica universo real de leaks.
2. Para cada match: clasificar `EXPECTED_PUBLIC` (raro, ej. `pg_*` utilities) vs `MUST_REVOKE`.
3. Migración consolidada de REVOKE para todos los `MUST_REVOKE`.
4. **Además**: revisar grants a `authenticated` en funciones que deberían ser admin-only (concilio K3: "grants a `authenticated` que actúan como public"). Cross-check con `capability_matrix`.

**Criterio mecánico:**
```sql
-- después de migración:
SELECT count(*) FROM (
  -- probe completa de arriba
) sub WHERE grantee IN ('PUBLIC', 'anon');
-- Esperado: 0
```

### G19 — ALTER DEFAULT PRIVILEGES — P1

**Concilio K14**: futuras funciones siguen leaking sin esto.

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;  -- explicito, no default
```

Repetir para `auth`, `storage`, `extensions` si owner = `postgres`.

**Criterio mecánico:**
```sql
SELECT * FROM pg_default_acl
WHERE defaclnamespace IN ('public'::regnamespace);
-- Esperado: filas mostrando PUBLIC=revoked.
```

---

## §5 Fase 3 — Evidence storage (inmutabilidad + autorización)

**Entry criteria:** F2 completa. Decisión owner sobre Edge Function deployment.

**Exit criteria:** 0 `getPublicUrl` en `src/`, evidence_bundles legacy preservados, nuevos bundles con path tenant-scoped, server-side signing operativo.

### G15 — Evidence Immutability during storage migration — **P0** (precondición de G3)

**Concilio K4**: el manifest contiene `artifacts[].ref` que entra al SHA-256. Mover objetos invalida el hash.

**Acción v1 — append-only supersession:**

1. NO se tocan los 37 evidence_bundles existentes.
2. Añadir columna `supersedes_id` (nullable, FK a `evidence_bundles.id`).
3. Para flujos NUEVOS post-migración:
   - Nuevo path schema: `<tenant_id>/<agreement_id>/<filename>.docx`
   - Nuevo bundle con `storage_path` + `manifest` recalculado + `supersedes_id=NULL`.
4. Para flujos EXISTENTES que quieran re-archivar:
   - Crear NUEVO bundle con `supersedes_id=<old_id>` apuntando al viejo.
   - El viejo se queda inmutable.
5. UI muestra "última versión" pero permite ver historial supersession.

**Migración:**
```sql
ALTER TABLE evidence_bundles
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES evidence_bundles(id);

-- Backfill storage_path desde document_url legacy (extraer path solo, no validar).
UPDATE evidence_bundles
SET storage_path = regexp_replace(document_url, '^.*matter-documents/', '')
WHERE storage_path IS NULL AND document_url ILIKE '%matter-documents/%';

-- Trigger: prevenir UPDATE a storage_path o manifest después de insert.
CREATE OR REPLACE FUNCTION fn_evidence_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.manifest IS DISTINCT FROM NEW.manifest
     OR OLD.manifest_hash IS DISTINCT FROM NEW.manifest_hash
     OR OLD.hash_sha512 IS DISTINCT FROM NEW.hash_sha512
     OR OLD.storage_path IS DISTINCT FROM NEW.storage_path THEN
    RAISE EXCEPTION 'evidence_bundles is append-only; create supersession instead';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evidence_immutable
  BEFORE UPDATE ON evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION fn_evidence_immutable();
```

**Criterio mecánico:**
```sql
-- Probe: ningún UPDATE puede tocar manifest/hash/path.
UPDATE evidence_bundles SET storage_path = 'test' WHERE id = (SELECT id FROM evidence_bundles LIMIT 1);
-- Esperado: ERROR 'evidence_bundles is append-only'.
```

### G3 — `getPublicUrl` sobre bucket privado — **P0** (refactor completo)

**Concilio K5+K6**: client-side `createSignedUrl` no es authz; `getPublicUrl` vive en más sitios de los detectados.

**Acción v1 — refactor en 4 piezas:**

1. **Edge Function `sign-evidence-url`** (`supabase/functions/sign-evidence-url/index.ts`):
   - Recibe `bundle_id`.
   - Verifica auth JWT.
   - Resuelve `fn_current_tenant_id()`.
   - Lee `evidence_bundles` (RLS lo filtra por tenant).
   - Verifica `legal_hold_active=false` y `estado IN ('OPEN','PROMOTED')`.
   - Verifica capability del rol del caller para ver evidencia de este `body_id`.
   - Solo si todo OK: llama `supabase.storage.createSignedUrl(storage_path, 300)` con service_role.
   - Devuelve `{ url, expires_at }`.

2. **Bucket policy storage**:
   ```sql
   CREATE POLICY matter_documents_tenant_isolation ON storage.objects
     FOR SELECT TO authenticated
     USING (
       bucket_id = 'matter-documents'
       AND (storage.foldername(name))[1] = fn_current_tenant_id()::text
     );
   -- Backup defense, no es el primary auth gate.
   ```
   Validación de path canónico (sin `..`, `%2F`, `%2E%2E`, etc.) lo hace la Edge Function.

3. **Hook frontend `useEvidenceBundleSignedUrl(bundleId)`**:
   ```typescript
   export function useEvidenceBundleSignedUrl(bundleId: string | null) {
     return useQuery({
       queryKey: ['evidence-signed-url', bundleId],
       enabled: !!bundleId,
       staleTime: 4 * 60 * 1000, // 4 min, refresh antes de TTL 5 min
       queryFn: async () => {
         const { data, error } = await supabase.functions.invoke('sign-evidence-url', {
           body: { bundle_id: bundleId },
         });
         if (error) throw error;
         return data.url as string;
       },
     });
   }
   ```

4. **Refactor sitios UI** (cobertura ampliada vs v0):
   - `src/lib/doc-gen/storage-archiver.ts:115-119` — quitar `getPublicUrl`. Almacenar solo `storage_path`. `document_url` queda como columna shadow para legacy.
   - `src/hooks/useConvocatorias.ts:420` — **detectado por codex**, quitar `getPublicUrl`, migrar a hook.
   - `src/components/EvidenceForenseSection.tsx:99-101` — consumir `useEvidenceBundleSignedUrl(b.id)` en vez de leer `b.document_url` directo.
   - `src/pages/secretaria/ExpedienteAcuerdo.tsx:222-225` — idem.

5. **Path schema nuevo**: `<tenant_id>/<agreement_id>/<filename>.docx`. Storage archiver actualizado.

**Criterio mecánico:**
```bash
# Cobertura completa (no solo doc-gen):
grep -rn "getPublicUrl" src/ | grep -v "\.test\." | wc -l
# Esperado: 0

# Verificación servidor-side signing:
grep -rn "createSignedUrl" src/ | grep -v "supabase/functions/sign-evidence-url" | wc -l
# Esperado: 0 (solo la Edge Function firma).

# Verificación UI:
grep -rn '\.document_url' src/components/ src/pages/ | wc -l
# Esperado: 0 (todo via hook).
```

**Riesgo**: la Edge Function necesita service_role secret. Mitigación: secret en Supabase Secrets, nunca en frontend.

**Rollback**: shadow column `document_url` se mantiene durante 1 sprint. UI lee `storage_path` first, fallback a `document_url`. Cleanup en sprint siguiente.

---

## §6 Fase 4 — Plataforma

### G16 — D6 Atomicity (promoción client-side) — P1

**Concilio K9**: `SociedadNuevaStepper.tsx:252-259` promueve a `OPERATIVA` con `.update()` cliente — no atómico con TX2.

**Acción v1:** mover a RPC server-side:

```sql
CREATE OR REPLACE FUNCTION fn_promover_sociedad_operativa(
  p_tenant_id uuid,
  p_entity_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_cargos_count integer;
  v_admin_minimo integer;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO','ADMIN_TENANT']);

  SELECT onboarding_status INTO v_status FROM entities WHERE id = p_entity_id AND tenant_id = p_tenant_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'entity not found';
  END IF;
  IF v_status = 'OPERATIVA' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  -- Invariantes server-side:
  SELECT count(*) INTO v_cargos_count
  FROM condiciones_persona
  WHERE entity_id = p_entity_id AND estado = 'VIGENTE';

  IF v_cargos_count < 2 THEN -- al menos PRESIDENTE + SECRETARIO
    RAISE EXCEPTION 'cargos minimos no satisfechos (%)', v_cargos_count;
  END IF;

  -- Más checks...

  UPDATE entities SET onboarding_status = 'OPERATIVA' WHERE id = p_entity_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_promover_sociedad_operativa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_promover_sociedad_operativa(uuid, uuid) TO authenticated;
```

Frontend: `SociedadNuevaStepper.tsx` llama RPC en vez de `.update()`.

### G17 — No staging / preproduction — P1

**Concilio K10**: E2E destructivos contra `governance_OS` demo.

**Acción v1:** crear proyecto Supabase `governance_OS_staging` (eu-central-1, mismo schema, datos sintéticos). Redirigir `SECRETARIA_E2E_DESTRUCTIVE=1` a este project via `EXPECTED_PROJECT_REF` env override.

**Criterio mecánico:** `e2e/43-…-b7-…` con `EXPECTED_PROJECT_REF=<staging-ref>` pass, y dataset demo de `governance_OS` no cambia (diff de count entidades antes/después).

### G8 — Drift histórico migraciones — P2

Ejecutar plan ya documentado en `docs/superpowers/plans/2026-05-15-secretaria360-migration-ledger-repair-plan.md`. Cierre: `supabase migration list --linked` sin filas locales-only ni remote-only. **Sub-tarea v1**: probe drift bidireccional (concilio implícito: tests ENOENT eran síntoma).

### G10 — Chunk size — P2 (subido de P3)

**Concilio K8**: línea regulada española 2 Mbps = 6s transfer.

**Acción v1:**
1. `bun add -D rollup-plugin-visualizer`.
2. Analizar bundle. Identificar candidatos `manualChunks`:
   ```ts
   // vite.config.ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor-react': ['react', 'react-dom', 'react-router-dom'],
           'vendor-supabase': ['@supabase/supabase-js', '@tanstack/react-query'],
           'vendor-handlebars': ['handlebars'],
           'vendor-xlsx': ['xlsx'],
         },
       },
     },
     chunkSizeWarningLimit: 500,
   },
   ```
3. Budget: main bundle <500KB gzipped.
4. Lighthouse slow-3G obligatorio: FCP <2.5s.

**Criterio mecánico:**
```bash
bun run build 2>&1 | grep -c "larger than 500 kB"
# Esperado: 0

# Lighthouse:
bunx lighthouse-ci autorun --collect.staticDistDir=dist --collect.settings.preset=slow-3g
# Esperado: FCP <2.5s, LCP <4s, TTI <5s.
```

### G12 — E2E destructivos no ejecutados — P2

**Dependencia: G17 staging**. Crear job GitHub Action o cron:

```yaml
# .github/workflows/e2e-destructive.yml
on:
  schedule: [{ cron: '0 6 * * 1' }]  # lunes 06:00
jobs:
  e2e-destructive:
    env:
      SECRETARIA_E2E_PHASE_B1: '1'
      SECRETARIA_E2E_DESTRUCTIVE: '1'
      SECRETARIA_E2E_ISOLATED_TENANT: '1'
      EXPECTED_PROJECT_REF: ${{ secrets.SUPABASE_STAGING_REF }}
    steps:
      - run: bunx playwright test e2e/43-*.spec.ts e2e/45-*.spec.ts --project=chromium
```

### G20 — Production observability — P2

**Concilio K15**: sin alertas, ningún control de seguridad sirve.

**Acción v1:** OTel events específicos:
- `rls.denied` con `{table, policy, user_id, tenant_id}`.
- `service_role.usage` con `{caller_function, source}`.
- `signed_url.failure` con `{bundle_id, reason}`.
- `audit_chain.drift` con `{detected_at, last_valid_id}`.
- `storage.403` con `{bucket, path, user_id}`.

Dashboard (Supabase logs UI o Microsoft Sentinel) con alert thresholds.

---

## §7 Fase 5 — Garantía externa

### G11 — Integraciones reales — P1 (refinado por concilio)

**Concilio K11**: risk register no prueba nada productivo. Sub-deliverable: contract tests stub-vs-producción.

**Acción v1:**

1. **Risk register** por integración (QTSP, RM, CNMV, Sentinel):
   - Estado actual (stub).
   - Capability productiva esperada.
   - Riesgo si NO se contrata.
   - Owner / ETA.

2. **Contract tests stub**: tests Vitest que validan el shape del wire protocol del stub contra una spec OpenAPI/JSON Schema, de modo que cuando llegue el endpoint productivo, el switch sea solo de URL+credenciales.

   Ejemplo EAD Trust QES:
   ```typescript
   // src/test/contracts/ead-trust-qes.test.ts
   import { z } from 'zod';
   import { signDocument } from '@/lib/qtsp/ead-trust-client';

   const QESResponseSchema = z.object({
     signature_request_id: z.string().uuid(),
     status: z.enum(['SIGNED','PENDING','REJECTED']),
     signed_document_url: z.string().url().optional(),
     timestamp_iso: z.string().datetime(),
     signatory_ids: z.array(z.string()),
   });

   it('stub returns QES-compliant response shape', async () => {
     const result = await signDocument({ /* ... */ });
     expect(() => QESResponseSchema.parse(result)).not.toThrow();
   });
   ```

   El día que se contrate EAD Trust productivo, este mismo test valida que el endpoint real cumple el shape.

3. **Failure mode handling**: tests de qué pasa si la integración devuelve 4xx/5xx/timeout. Para stub: simular el error. Para productiva: same code path.

### G7 — `evidence_bundle_review_events` — P2 condicional

Esperar decisión Comité Legal. Si APROBADO: aplicar migración + integrar workflow en `GestorPlantillas` y `ExpedienteAcuerdo`.

---

## §8 Matriz de cierre mecánico (consolidada)

| Gap | Probe / test / commit | Resultado esperado |
|---|---|---|
| G4 | `bunx vitest --reporter=json src/test/schema | jq '.numFailedTests'` | 0 + tabla cobertura por aserción |
| G5 | `gate-pre.ts` test rechaza tipo desconocido | test pass |
| G6 | Commit toca `prompt-tgms-audit.md` ESTADO_INICIAL | SHA con regex `chore\(audit\):` |
| G9 | `gh pr list --head codex/secretaria-d6-e2e-debt` | 1 fila |
| G13 | `bunx vitest src/test/schema/identity-contract.test.ts` | 6+ tests pass |
| G1 | Probe `pg_policy` con literal demo UUID | 0 filas |
| G1 | Test multi-tenant E2E entre 2 tenants sintéticos | pass |
| G18 | Test `scope_body_ids` restringe meetings visibles | pass |
| G14 | Doc `definer-threat-model.md` + commits guards | existe + push |
| G2 | Probe `pg_proc + aclexplode` PUBLIC/anon = 0 | 0 filas |
| G19 | `pg_default_acl` PUBLIC=revoked | filas con default revoke |
| G15 | UPDATE evidence_bundles fail con append-only | exception |
| G3 | `grep getPublicUrl src/` (no solo doc-gen) | 0 |
| G3 | `grep createSignedUrl src/` fuera de Edge Function | 0 |
| G3 | `grep '\.document_url' src/components src/pages` | 0 |
| G3 | E2E descarga evidence_bundle via UI | pass |
| G16 | RPC `fn_promover_sociedad_operativa` existe | `to_regprocedure` = true |
| G16 | E2E B7 destructivo + verifica promoción server-side | pass |
| G17 | `governance_OS_staging` proyecto creado | listado |
| G8 | `supabase migration list --linked` consistente | 0 drift filas |
| G10 | Build sin warning >500K | 0 grep matches |
| G10 | Lighthouse slow-3G | FCP<2.5s |
| G12 | CI workflow E2E destructivo | 1 run/semana |
| G20 | Dashboard observability + 5 alert rules activas | OTel events emit + alert config |
| G11 | Risk register + contract tests pass para 4 integraciones | doc + tests verde |
| G7 | Decisión legal documentada (apply / reject) | doc + acción |

---

## §9 Dependencias entre fases

```
F0 ─────────────────────────────────────────────────────────┐
                                                              │ (gate verde)
F1: G13 ──→ G1 ──→ G18                                      ──┤
              │                                               │
F2: G14 ──→ G2 ──→ G19                                      ──┤
              │                                               │
F3: G15 ──→ G3                                              ──┤
              │                                               │
F4: G16, G17, G8, G10, G12, G20  (paralelos)                ──┤
              │                                               │
F5: G11, G7                                                 ──┴── productiva GO
```

F1 antes de F2: el threat model DEFINER necesita conocer el modelo de identidad.
F2 antes de F3: la Edge Function de G3 depende de RPCs hardened.
F3 antes de F4: G16 (D6 atomicity) puede depender de Edge Function pattern.
F5 paralelo a F4.

---

## §10 Riesgos transversales y rollback

| Riesgo | Mitigación | Rollback |
|---|---|---|
| F1 lockout productiva | Feature flag por tabla + canary | Forward-only migration que desactiva policies v2 (incidente registrado) |
| F2 break de RPC esperada por anon | Inventario exhaustivo antes de revoke + dry run | Selective re-grant si se identifica un caller anon legítimo |
| F3 Edge Function down | Hook UI con retry + fallback "no preview" | UI muestra "regenerar enlace" |
| F4 staging contamina demo | Probe diff de dataset demo antes/después | Restaurar desde dump pre-staging |
| F5 risk register sin acción | Deadline + escalation a owner | Archivar como `out-of-scope` |

---

## §11 Estimación de coste (orden de magnitud)

| Fase | Sprints (1 dev) | Sprints (par) |
|---|---:|---:|
| F0 | 0.5 | 0.5 |
| F1 (G13 + G1 + G18) | 2-3 | 1.5 |
| F2 (G14 + G2 + G19) | 1.5-2 | 1 |
| F3 (G15 + G3 con Edge Function) | 2 | 1.5 |
| F4 (G16, G17, G8, G10, G12, G20) | 2-3 | 1.5-2 |
| F5 (G11 + G7) | 1 | 0.5-1 |
| **Total** | **9-11** | **6-7** |

**Caveat**: F0 puede ejecutarse paralelo a F1.

---

## §12 Open questions post-v1 — resueltas 2026-05-16

| # | Pregunta | Decisión owner |
|---|---|---|
| 1 | G13 plan Supabase | **Path B** (`app_metadata.tenant_id`, Free tier; sin Pro hook) |
| 2 | G14 owner threat model | Plataforma + seguridad interna (firma documento `docs/superpowers/specs/2026-05-16-definer-threat-model.md`) |
| 3 | G17 presupuesto staging | **Autorizado** (Free tier, ~$0/mes) |
| 4 | G11 sandbox QTSP/RM/CNMV/Sentinel | Sin acceso confirmado todavía. Contract tests viven contra stubs locales con shapes Zod (sprint siguiente activa live tests cuando se firme acceso). |
| 5 | F1 sequencing | **Forward-only** sin rollback operativo; mitigación = feature flag por tabla si se detecta lockout en monitoring |

---

## §13 Estado de implementación — 2026-05-17

Tras una sesión de implementación + ciclo adversarial codex (commits `6d1b63e..0cca276`, PR #36), el estado de cada gap es:

### Requisito fundamental operativo — 2026-05-17

Mientras TGMS/ARGA siga en fase desarrollo-test-demo y el prototipo no esté estable para pre-release, `governance_OS` (`hzqwefkwsxopwrmtksbg`) sigue siendo la fuente de verdad y el entorno activo para migraciones, seeds, fixes y validación funcional. G17 staging queda diferido: no bloquea el desarrollo actual, solo pre-release/productiva o E2E destructivos con aislamiento sistemático. Política canónica: `docs/superpowers/specs/2026-05-17-governance-os-active-dev-environment-policy.md`.

### F0 — Estabilización gate

| Gap | Estado | Commit | Evidencia |
|---|---|---|---|
| G4 — 5 tests ENOENT | ✅ CERRADO | `6d1b63e` | 31/31 tests pass + tabla cobertura por aserción + Test 4 documenta drift G8 |
| G5 — Probe §6.2 → Gate PRE | ✅ CERRADO | `6d1b63e` | Regla `SEM_ACTIVA_CAMPOS_REQUERIDOS` en `gate-pre-semantic.ts` + 10/10 tests |
| G6 — Prompt ESTADO_INICIAL | ✅ CERRADO con deuda | `9424e98` | Item "E2E legacy" retirado; refactor a `state-snapshot.yaml` deferred |
| G9 — PR carril | ✅ CERRADO | `9424e98` | PR #36 abierto a `main` |

### F1 — Identity contract

| Gap | Estado | Commit | Evidencia |
|---|---|---|---|
| G13 — `fn_current_tenant_id()` | ✅ CERRADO | `ff051af` | Función + helper assert en Cloud, REVOKE PUBLIC/anon, 16/16 tests |
| G1 — RLS hardcoded → JWT-aware | ✅ CERRADO | `ff051af` | 135 policies reescritas (vs 17 estimadas), 0 literales demo restantes |
| G18 — RBAC intra-tenant | ✅ CERRADO con activación diferida | `ff051af` | `scope_body_ids` + `fn_user_has_body_access()` + `tenant_features` feature flag, no activado por defecto para no romper demo single-tenant |

### F2 — Surface hardening

| Gap | Estado | Commit | Evidencia |
|---|---|---|---|
| G14 — DEFINER threat model | ✅ CERRADO P0 + doc + follow-up | `da3d2bc`, `0cca276` | Doc 20 funciones inventariadas, 3 P0 hardened, P2 cleanup de migración `000052` duplicada deferred |
| G2 — REVOKE `fn_*` PUBLIC/anon | ✅ CERRADO con regresión cazada | `da3d2bc`, `0cca276` | 88 grants revocados; F6 cerró regresión `fn_consolidate_person` reabierta accidentalmente |
| G19 — ALTER DEFAULT PRIVILEGES | ⚠️ PARCIAL | `da3d2bc` | `postgres` aplicado; `supabase_admin` requiere Supabase support ticket |

### F3 — Evidence storage

| Gap | Estado | Commit | Evidencia |
|---|---|---|---|
| G15 — Append-only supersession | ✅ CERRADO con adaptación | `7906004` | 4 columnas nuevas + view + chain helper; trigger propio omitido porque Cloud ya tiene WORM trigger más estricto (drift G8) |
| G3 — Edge Function + UI refactor | ✅ CERRADO con hardening F6 | `7906004`, `0cca276` | Edge Function v2 deployed + 5 sitios refactorizados + tenant path-binding + status gate + path traversal extendido |

### F4 — Plataforma

| Gap | Estado | Commit | Evidencia |
|---|---|---|---|
| G16 — RPC `fn_promover_sociedad_operativa` | ✅ CERRADO + TOCTOU cerrado en F6 | `14418a5`, `0cca276` | RPC + frontend refactor + `SELECT FOR UPDATE` + `pg_advisory_xact_lock` |
| G17 — Staging Supabase | ⚠️ DIFERIDO PRE-RELEASE | `14418a5` | Runbook completo en docs; no bloquea desarrollo-test-demo porque `governance_OS` sigue siendo entorno activo |
| G8 — Drift ledger histórico | ✅ VALIDADO ALINEADO | (n/a) | `supabase migration list --linked` 0 drift filas |
| G10 — Code splitting | ✅ CERRADO | `14418a5` | Vendor chunks split (handlebars/xlsx/docx/zod/supabase/react); Lighthouse pending |
| G12 — CI E2E destructivo | ⚠️ PARCIAL / DIFERIDO | `14418a5` + post-review | Workflow YAML configurado; P1 #11 cliente/env/E2E guards cerrado; ejecución real diferida hasta staging/pre-release |
| G20 — Observability | ⚠️ PARCIAL | `14418a5` | Módulo OTel + helpers + doc Sentinel rules; sink default `console.warn` (Edge Function feed siguiente sprint) |

### F5 — Garantía externa

| Gap | Estado | Commit | Evidencia |
|---|---|---|---|
| G11 — Risk register + contract tests | ✅ CERRADO con live tests deferred | `245e4c3` | Risk register 4 integraciones + 20/20 Zod contract tests; live tests opt-in deferred |
| G7 — `evidence_bundle_review_events` | ⚠️ PENDIENTE COMITÉ LEGAL | `245e4c3` | Propuesta schema + workflow documentado; plazo 60 días → 2026-07-15 |

### F6 — Ciclo adversarial (no en plan original)

| Hallazgo codex | Estado | Commit | Evidencia |
|---|---|---|---|
| P0 #1+#2 user_profiles cols mutables | ✅ CERRADO | `0cca276` | Trigger `trg_user_profiles_lock_critical_cols` |
| P0 #3 `evidence_bundles` RLS | ✅ CERRADO | `0cca276` | ENABLE RLS + policy + view `security_invoker=true` |
| P0 #4 path no bound a tenant | ✅ CERRADO | `0cca276` | Edge Function valida `storage_path.startsWith(tenant_id/)` |
| P0 #5 `fn_consolidate_person` regrant | ✅ CERRADO | `0cca276` | REVOKE explícito de authenticated |
| P1 #8 audit delta perdió campos | ❌ RECHAZADO con evidencia | (verificación) | Body original tiene mismos campos — codex alucinó |
| P1 #9 status gate goodhart | ✅ CERRADO | `0cca276` | Edge Function selecciona `status` y bloquea no-releasable |
| P1 #10 TOCTOU promoción | ✅ CERRADO | `0cca276` | `SELECT FOR UPDATE` + advisory xact lock |
| P1 #6, #7, P2 #12, #13 | ⚠️ DEFERRED | (doc) | Documentados como follow-up en migration header |
| P1 #11 staging env-driven | ✅ CERRADO post-review | post-review | Cliente Supabase, workflow y guards Playwright leen env vars con fallback demo |

### Cierre mecánico final

```
typecheck (tsc -b)                    pass
schema tests (Cloud-touching)         110/110 pass del plan
build (vite)                          pass — vendor chunks split
supabase migration list --linked      0 drift
supabase db push                      F0–F6 todas aplicadas a Cloud
codex challenge (174k tokens)         12/13 hallazgos correctos, 8 cerrados post-review, 4 deferred, 1 rechazado con evidencia
```

**Estimación real vs plan v1**: el plan v1 estimaba 9–11 sprints. La ejecución consumió 1 sesión continua porque codex como adversarial independiente comprimió el ciclo de feedback que normalmente requiere code review humano + iteración.

---

*v1 — post-concilio codex 2026-05-16. Estado §13 actualizado 2026-05-17 tras ejecución completa.*
