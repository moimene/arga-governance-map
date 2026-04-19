# Task 0 — Enterprise Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar el mockup funcional TGMS al estándar ETD enterprise — cerrando los 7 bloques críticos identificados en la auditoría de alineación de 2026-04-19.

**Architecture:** Hardening incremental sobre el Supabase existente + codebase React/TypeScript. Sin reescritura de UI. Cada milestone es independiente y no rompe el demo actual.

**Tech Stack:** Supabase (RLS, Vault, pg_audit), React 18, TypeScript, TanStack Query v5, shadcn/ui, Garrigues UX tokens.

**Prerrequisito:** Ejecutar migración `docs/superpowers/plans/2026-04-19-etd-stubs.sql` en Supabase antes de iniciar.

---

## Contexto y motivación

El análisis ETD de 2026-04-19 emitió veredicto **Aprobado-Condicionado**. Lo que existe es un mockup funcional de alta fidelidad. Para pasar a desarrollo enterprise sin reservas, deben cerrarse 7 bloques:

| # | Bloque | Tipo de brecha | Esfuerzo estimado |
|---|---|---|---|
| T0.1 | RLS real + pruebas cross-tenant | Arquitectónico crítico | Alto |
| T0.2 | RBAC / SoD enterprise | Arquitectónico crítico | Alto |
| T0.3 | Audit trail WORM | Seguridad crítica | Medio |
| T0.4 | Evidencias forenses SHA-512/QTSP | Seguridad crítica | Medio |
| T0.5 | Legal hold + retención global | Dato crítico | Medio |
| T0.6 | Board Pack E2E | Funcionalidad alta | Medio |
| T0.7 | Observabilidad base (OTel/SIEM) | NFR producción | Medio |

---

## T0.1 — Row Level Security Real

**Files:**
- Create: `supabase/migrations/20260419_001_rls_enable.sql`
- Create: `supabase/migrations/20260419_002_rls_policies.sql`
- Modify: `src/lib/supabase.ts` (añadir helper `requiresTenantContext`)
- Create: `src/tests/rls/cross-tenant.test.ts`

- [ ] **Step 1: Ejecutar migración — activar RLS en todas las tablas de dominio**

```sql
-- supabase/migrations/20260419_001_rls_enable.sql
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE governing_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hallazgos ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Definir función de tenant context**

```sql
-- supabase/migrations/20260419_002_rls_policies.sql
-- Función que extrae tenant_id del JWT claim
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Política base para todas las tablas: sólo ver registros del propio tenant
CREATE POLICY tenant_isolation ON entities
  FOR ALL USING (tenant_id = auth.tenant_id());

-- Repetir para cada tabla (ver lista completa en migración real)
-- ...
```

- [ ] **Step 3: Escribir test cross-tenant fallido**

```typescript
// src/tests/rls/cross-tenant.test.ts
// Usar dos clientes Supabase con diferentes JWTs (tenant A / tenant B)
// Insertar registro en tenant A, verificar que tenant B no puede leerlo
import { createClient } from '@supabase/supabase-js'

test('cross-tenant isolation: tenant B cannot read tenant A records', async () => {
  const clientA = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${JWT_TENANT_A}` } }
  })
  const clientB = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${JWT_TENANT_B}` } }
  })
  const { data: dataB } = await clientB.from('entities')
    .select('id')
    .eq('tenant_id', TENANT_A_ID)
  expect(dataB).toHaveLength(0)
})
```

- [ ] **Step 4: Ejecutar test — verificar que falla antes de activar RLS**

```bash
bun test src/tests/rls/cross-tenant.test.ts
# Esperado: FAIL (sin RLS, tenant B ve registros de A)
```

- [ ] **Step 5: Activar RLS, re-ejecutar — verificar que pasa**

```bash
# Ejecutar migración en Supabase SQL Editor
# Después:
bun test src/tests/rls/cross-tenant.test.ts
# Esperado: PASS
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ src/tests/rls/ src/lib/supabase.ts
git commit -m "security(rls): activar Row Level Security en todas las tablas de dominio"
```

---

## T0.2 — RBAC / SoD Enterprise

**Files:**
- Create: `supabase/migrations/20260419_003_roles_sod.sql`
- Create: `src/lib/rbac.ts`
- Create: `src/hooks/useUserRole.ts`
- Create: `src/components/guards/SodGuard.tsx`

- [ ] **Step 1: Definir schema de roles**

```sql
-- supabase/migrations/20260419_003_roles_sod.sql
CREATE TABLE IF NOT EXISTS user_roles (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  role_code    text NOT NULL, -- 'SECRETARIO'|'CONSEJERO'|'COMPLIANCE'|'ADMIN_TENANT'|'AUDITOR'
  entity_id    uuid REFERENCES entities(id), -- null = scope global del tenant
  granted_by   uuid REFERENCES auth.users(id),
  granted_at   timestamptz DEFAULT now(),
  expires_at   timestamptz,
  UNIQUE (tenant_id, user_id, role_code, entity_id)
);

-- Librería de roles tóxicos (combinaciones bloqueadas por SoD)
CREATE TABLE IF NOT EXISTS toxic_role_pairs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  uuid, -- null = global para todos los tenants
  role_a     text NOT NULL,
  role_b     text NOT NULL,
  reason     text
);

-- Seed inicial de roles tóxicos ETD
INSERT INTO toxic_role_pairs (role_a, role_b, reason) VALUES
  ('SECRETARIO', 'AUDITOR',    'No puede certificar y auditar el mismo acuerdo'),
  ('COMPLIANCE', 'ADMIN_TENANT', 'Conflicto supervisión/administración');
```

- [ ] **Step 2: Implementar hook de rol**

```typescript
// src/hooks/useUserRole.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useUserRole() {
  return useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('user_roles')
        .select('role_code, entity_id, expires_at')
        .eq('user_id', user.id)
        .is('expires_at', null)  // sólo roles vigentes
      return data ?? []
    }
  })
}
```

- [ ] **Step 3: Implementar SodGuard**

```tsx
// src/components/guards/SodGuard.tsx
// Wrapper que bloquea UI si el usuario tiene dos roles tóxicos simultáneos
// Lanza error a Sentry/OTel cuando detecta violación
import { useUserRole } from '@/hooks/useUserRole'
import { TOXIC_PAIRS } from '@/lib/rbac'

export function SodGuard({ children }: { children: React.ReactNode }) {
  const { data: roles } = useUserRole()
  const roleCodes = (roles ?? []).map(r => r.role_code)
  const violation = TOXIC_PAIRS.find(([a, b]) =>
    roleCodes.includes(a) && roleCodes.includes(b)
  )
  if (violation) {
    return (
      <div className="p-6 text-[var(--status-error)]">
        Conflicto SoD detectado: roles {violation[0]} + {violation[1]} no pueden coexistir.
        Contactar con el administrador del tenant.
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260419_003_roles_sod.sql src/lib/rbac.ts src/hooks/useUserRole.ts src/components/guards/SodGuard.tsx
git commit -m "security(sod): schema RBAC + librería roles tóxicos + SodGuard"
```

---

## T0.3 — Audit Trail WORM

**Files:**
- Create: `supabase/migrations/20260419_004_audit_triggers.sql`
- Create: `src/hooks/useAuditLog.ts`
- Modify: `src/pages/admin/AuditLogPage.tsx` (nuevo)

- [ ] **Step 1: Crear función y triggers de audit**

```sql
-- supabase/migrations/20260419_004_audit_triggers.sql
-- Función de audit con hash encadenado
CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS trigger AS $$
DECLARE
  _prev_hash text;
  _delta jsonb;
  _new_hash text;
BEGIN
  -- Obtener hash del último registro (cadena Merkle-style)
  SELECT hash_sha512 INTO _prev_hash
  FROM audit_log
  ORDER BY created_at DESC LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    _delta := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    _delta := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    _delta := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  -- Hash encadenado: sha512(prev_hash || table || record_id || action || delta)
  _new_hash := encode(
    digest(
      coalesce(_prev_hash, '') || TG_TABLE_NAME || NEW.id::text || TG_OP || _delta::text,
      'sha512'
    ),
    'hex'
  );

  INSERT INTO audit_log (tenant_id, table_name, record_id, action, delta, hash_sha512)
  VALUES (
    NEW.tenant_id,
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    _delta,
    _new_hash
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger a tablas de hechos
CREATE TRIGGER trg_audit_agreements
  AFTER INSERT OR UPDATE OR DELETE ON agreements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_certifications
  AFTER INSERT OR UPDATE OR DELETE ON certifications
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
-- Añadir para: meetings, hallazgos, regulatory_notifications, policies
```

- [ ] **Step 2: Hook de consulta del audit log**

```typescript
// src/hooks/useAuditLog.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useAuditLog(recordId: string) {
  return useQuery({
    queryKey: ['audit-log', recordId],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: true })
      return data ?? []
    }
  })
}
```

- [ ] **Step 3: Verificar que la cadena de hashes no se rompe**

```sql
-- Verificación de integridad de la cadena en SQL Editor
WITH ordered AS (
  SELECT id, hash_sha512,
         LAG(hash_sha512) OVER (ORDER BY created_at) AS prev_hash
  FROM audit_log
)
SELECT COUNT(*) AS broken_links
FROM ordered
WHERE prev_hash IS NOT NULL
  AND NOT hash_sha512 LIKE '%' || substr(prev_hash, 1, 16) || '%';
-- Esperado: 0
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260419_004_audit_triggers.sql src/hooks/useAuditLog.ts
git commit -m "security(audit): triggers WORM con hash encadenado en tablas de hechos"
```

---

## T0.4 — Evidencias Forenses SHA-512 / QTSP stub

**Files:**
- Create: `src/lib/evidence.ts`
- Create: `src/hooks/useEvidenceBundle.ts`
- Modify: `src/pages/secretaria/CertificacionDetalle.tsx`

- [ ] **Step 1: Implementar generador de evidence bundle**

```typescript
// src/lib/evidence.ts
// Genera hash SHA-512 de un documento y crea un evidence_bundle
// En producción: integrar con proveedor QTSP/QES real

export async function hashDocument(content: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createEvidenceBundle(params: {
  tenantId: string
  documentContent: string
  referenceCode: string
  custodian: string
}): Promise<string> {
  const hash = await hashDocument(params.documentContent)
  const { data, error } = await supabase.from('evidence_bundles').insert({
    tenant_id: params.tenantId,
    reference_code: params.referenceCode,
    hash_sha512: hash,
    signed_by: 'STUB — pendiente integración QTSP',
    chain_of_custody: [{ custodian: params.custodian, timestamp: new Date().toISOString() }]
  }).select('id').single()
  if (error) throw error
  return data.id
}
```

- [ ] **Step 2: Añadir bloque "Evidencia forense" en CertificacionDetalle**

Añadir sección que muestra:
- Hash SHA-512 del documento certificado
- Estado: "STUB — pendiente QTSP" con badge `--status-warning`
- Enlace a `evidence_bundles` cuando `evidence_id` no es null

- [ ] **Step 3: Commit**

```bash
git add src/lib/evidence.ts src/hooks/useEvidenceBundle.ts src/pages/secretaria/CertificacionDetalle.tsx
git commit -m "security(evidence): hash SHA-512 + evidence_bundles stub (QTSP pendiente)"
```

---

## T0.5 — Legal Hold + Retención Global

**Files:**
- Create: `supabase/migrations/20260419_005_retention_policies_seed.sql`
- Create: `src/hooks/useRetentionPolicies.ts`
- Create: `supabase/functions/purge-job/index.ts` (Edge Function stub)

- [ ] **Step 1: Seed de retention_policies**

```sql
-- supabase/migrations/20260419_005_retention_policies_seed.sql
INSERT INTO retention_policies (tenant_id, name, retention_days, legal_basis, applies_to)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acuerdos societarios LSC',    3650, 'LSC Art 26', 'agreements'),
  ('00000000-0000-0000-0000-000000000001', 'Incidentes DORA',             2555, 'DORA Art 17', 'incidents'),
  ('00000000-0000-0000-0000-000000000001', 'Notificaciones regulatorias', 2555, 'DORA/GDPR',   'regulatory_notifications'),
  ('00000000-0000-0000-0000-000000000001', 'Políticas corporativas',      1825, 'LOPD',        'policies');
```

- [ ] **Step 2: Edge Function purge-job (stub)**

```typescript
// supabase/functions/purge-job/index.ts
// Stub del job de purga. En producción: schedulear con pg_cron o Supabase cron.
// NUNCA purgar registros con legal_hold = true.
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Purga de agreements expirados SIN legal hold
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3650) // 10 años (LSC)

  const { count } = await supabase
    .from('agreements')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff.toISOString())
    .eq('legal_hold', false)

  return new Response(JSON.stringify({ purged: count, table: 'agreements' }))
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260419_005_retention_policies_seed.sql supabase/functions/purge-job/
git commit -m "data(retention): seed retention_policies + purge-job stub (legal hold respetado)"
```

---

## T0.6 — Board Pack E2E

**Files:**
- Create: `src/pages/board-pack/BoardPackPage.tsx`
- Create: `src/hooks/useBoardPack.ts`
- Modify: `src/App.tsx` (añadir ruta `/board-pack`)

- [ ] **Step 1: Hook useBoardPack**

```typescript
// src/hooks/useBoardPack.ts
// Agrega: actas recientes + KPIs GRC + políticas pendientes + hallazgos críticos
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useBoardPack(tenantId: string) {
  return useQuery({
    queryKey: ['board-pack', tenantId],
    queryFn: async () => {
      const [actasRes, incidentsRes, hallazgosRes, politicasRes] = await Promise.all([
        supabase.from('meetings').select('id, slug, meeting_type, fecha_1, status')
          .eq('tenant_id', tenantId).eq('status', 'CERRADA').order('fecha_1', { ascending: false }).limit(3),
        supabase.from('incidents').select('code, incident_type, severity, status')
          .eq('tenant_id', tenantId).eq('status', 'OPEN').limit(5),
        supabase.from('hallazgos').select('code, titulo, severity, status')
          .eq('tenant_id', tenantId).in('severity', ['CRITICO','ALTO']).limit(5),
        supabase.from('policies').select('code, name, status, review_date')
          .eq('tenant_id', tenantId).eq('status', 'PENDING_REVIEW').limit(5)
      ])
      return {
        actas: actasRes.data ?? [],
        incidents: incidentsRes.data ?? [],
        hallazgos: hallazgosRes.data ?? [],
        politicas: politicasRes.data ?? []
      }
    }
  })
}
```

- [ ] **Step 2: Página BoardPack — navegación ≤ 3 clics**

Estructura de la página:
1. **Sección "Actas recientes"** — 3 últimas actas con link a detalle
2. **Sección "KPIs GRC"** — incidentes abiertos, hallazgos críticos, deadlines próximos
3. **Sección "Políticas pendientes de revisión"** — lista con CTA "Revisar"
4. **Sección "Evidencias recientes"** — últimas certifications con hash SHA-512

Cada fila debe ser un enlace a la ficha completa (criterio ETD: acta → KPI → evidencia en ≤ 3 clics).

- [ ] **Step 3: Añadir ruta y nav item**

```typescript
// src/App.tsx — añadir dentro de Shell routes
<Route path="/board-pack" element={<Suspense fallback={<div>...</div>}><BoardPackPage /></Suspense>} />
```

Añadir "Board Pack" al sidebar del Shell con icono `LayoutDashboard`.

- [ ] **Step 4: Verificar flujo ≤ 3 clics**

Recorrido verificado: `/ → /board-pack (1 clic) → /secretaria/actas/ACTA-CDA-001 (2 clics) → certificación (3 clics)`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/board-pack/ src/hooks/useBoardPack.ts src/App.tsx
git commit -m "feat(board-pack): vista agregada actas+KPIs+hallazgos+evidencias (ETD ≤3 clics)"
```

---

## T0.7 — Observabilidad Base (OpenTelemetry / SIEM stub)

**Files:**
- Create: `src/lib/telemetry.ts`
- Create: `supabase/functions/siem-feed/index.ts`
- Modify: `src/main.tsx` (inicializar OTel)

- [ ] **Step 1: Configurar OTel en frontend**

```typescript
// src/lib/telemetry.ts
// Stub de OpenTelemetry — en producción conectar a Datadog/Grafana/Azure Monitor
export function trackEvent(name: string, attributes: Record<string, string | number> = {}) {
  if (import.meta.env.DEV) {
    console.log('[OTel]', name, attributes)
    return
  }
  // TODO: enviar a endpoint OTel configurado en env
  // fetch(OTEL_ENDPOINT, { method: 'POST', body: JSON.stringify({ name, attributes, timestamp: Date.now() }) })
}

export function trackPageView(path: string) {
  trackEvent('page_view', { path })
}

export function trackSodViolation(userId: string, roles: string[]) {
  trackEvent('sod_violation_detected', { userId, roles: roles.join(',') })
}
```

- [ ] **Step 2: SIEM feed Edge Function (stub)**

```typescript
// supabase/functions/siem-feed/index.ts
// Exporta últimos N eventos del audit_log al SIEM configurado
// En producción: autenticar con API key del SIEM, usar formato CEF o LEEF
Deno.serve(async (req) => {
  const { since } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .gte('created_at', since ?? new Date(Date.now() - 3600000).toISOString())
    .order('created_at', { ascending: true })
  // TODO: formatear como CEF y enviar a SIEM_ENDPOINT
  return new Response(JSON.stringify({ events: data?.length ?? 0, payload: data }))
})
```

- [ ] **Step 3: Definir SLOs base**

Crear `docs/SLOs.md` con:
- Disponibilidad: ≥ 99.5% mensual
- P95 latencia queries de lista: ≤ 800ms
- P95 latencia detalle: ≤ 500ms
- RPO objetivo: ≤ 1h (Supabase backup)
- RTO objetivo: ≤ 2h

- [ ] **Step 4: Commit**

```bash
git add src/lib/telemetry.ts supabase/functions/siem-feed/ docs/SLOs.md
git commit -m "ops(observability): OTel stub + SIEM feed edge function + SLOs definidos"
```

---

## Criterio de salida del Milestone Task 0

Task 0 está cerrado cuando:

- [ ] Test cross-tenant RLS pasa en CI
- [ ] SodGuard bloquea combinaciones tóxicas en demo
- [ ] `audit_log` tiene triggers activos en agreements, incidents, certifications
- [ ] `evidence_bundles` tiene al menos 1 registro con hash SHA-512 real
- [ ] `retention_policies` seed aplicado + purge-job deployed (modo dry-run)
- [ ] `/board-pack` accesible con flujo ≤ 3 clics a evidencia
- [ ] `telemetry.ts` inicializado en main.tsx + SIEM feed deployed
- [ ] `docs/DEMO_SCOPE.md` actualizado: quitar ❌ de ítems cerrados

**Una vez cerrado Task 0:** El producto puede presentarse al equipo técnico de MAPFRE como "implementación alineada con ETD" y no solo como "mockup funcional".

---

## Notas de implementación

- **Supabase Vault**: Para BYOK/CMK real (T0.1 extended) — requiere plan Supabase Pro. Fuera del alcance de Task 0 pero incluir como tarea en Sprint 2 del desarrollo real.
- **SCIM 2.0**: Requiere IdP externo (Entra ID / Okta). Incluir en Sprint 3 (integración enterprise).
- **WCAG 2.2 AA**: Auditoría formal con axe-core o Deque. Incluir en Sprint 2 junto a pruebas de carga.
- **Particionado temporal**: En Supabase (PostgreSQL 17) — `PARTITION BY RANGE (created_at)` en `audit_log` e `incidents`. Incluir en Sprint 2 cuando el volumen de datos sea real.
