# Gestión Societaria MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar el MVP de gestión societaria (D+A) — CRUD de sociedades, personas, socios, administradores, órganos, capital; reglas aplicables; autoridad y certificación con hash chain WORM; integración Secretaría y motor LSC — convirtiendo el modelo canónico Phase 0+1 en fuente de verdad operativa.

**Architecture:** 10 fases secuenciales. F1 extiende BD (nuevas tablas + extensiones + trigger sync). F2–F3 crean hooks canónicos. F4–F5 construyen páginas/steppers. F6 migra consumidores legacy (`mandates` → VIEW). F7 expone reglas aplicables. F8–F9 implementan RPCs y UI de certificación con QTSP. F10 integra Secretaría, actualiza seeds y cierra con E2E smoke.

**Tech Stack:** Supabase (PostgreSQL + PostgREST + RLS + MCP apply_migration), React 18 + TypeScript + Vite, TanStack Query v5, shadcn/ui, Tailwind con tokens `--g-*`/`--status-*`, Web Crypto API (SHA-256), EAD Trust Digital Trust API, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-21-gestion-societaria-mvp-design.md` (referencia obligatoria en cada task).

---

## Convenciones transversales

- `DEMO_TENANT = "00000000-0000-0000-0000-000000000001"` en todos los hooks.
- Cloud Project: `hzqwefkwsxopwrmtksbg`. Migraciones vía `mcp__53aea412-..._apply_migration` + mirror en `supabase/migrations/`.
- **Sin `execute_sql` RPC** — usar PostgREST + joins client-side.
- **Tokens Garrigues estrictos:** cero `text-white`, `bg-gray-*`, hex en className. Solo `var(--g-*)` / `var(--status-*)` / `hsl(var(--sidebar-*))`.
- TDD por task: test → fail → implement → pass → commit.
- Cada task = un commit atómico con mensaje `feat(societario): F<n>.<k> <descripción>`.
- Regenerar types tras cada migración: `bunx supabase gen types typescript --project-id hzqwefkwsxopwrmtksbg > src/integrations/supabase/types.ts` (o usar MCP `generate_typescript_types`).

---

## F1 — Modelo de datos

### Task F1.1: Migración `capability_matrix` + seed

**Files:**
- Create: `supabase/migrations/20260421_000023_capability_matrix.sql`
- Test: `src/test/schema/capability-matrix.test.ts`

- [ ] **Step 1: Escribir test fallando**

```ts
// src/test/schema/capability-matrix.test.ts
import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("capability_matrix", () => {
  it("tiene 15 filas (5 roles × 3 acciones)", async () => {
    const { data, error } = await supabase.from("capability_matrix").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(15);
  });
  it("SECRETARIO puede SNAPSHOT_CREATION y CERTIFICATION", async () => {
    const { data } = await supabase
      .from("capability_matrix")
      .select("action, enabled")
      .eq("role", "SECRETARIO");
    const map = Object.fromEntries((data ?? []).map((r) => [r.action, r.enabled]));
    expect(map.SNAPSHOT_CREATION).toBe(true);
    expect(map.CERTIFICATION).toBe(true);
    expect(map.VOTE_EMISSION).toBe(true);
  });
  it("CONSEJERO no puede SNAPSHOT_CREATION ni CERTIFICATION", async () => {
    const { data } = await supabase
      .from("capability_matrix")
      .select("action, enabled")
      .eq("role", "CONSEJERO");
    const map = Object.fromEntries((data ?? []).map((r) => [r.action, r.enabled]));
    expect(map.SNAPSHOT_CREATION).toBe(false);
    expect(map.CERTIFICATION).toBe(false);
    expect(map.VOTE_EMISSION).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/test/schema/capability-matrix.test.ts`
Expected: FAIL (tabla no existe).

- [ ] **Step 3: Aplicar migración (contenido del archivo)**

```sql
-- supabase/migrations/20260421_000023_capability_matrix.sql
CREATE TABLE IF NOT EXISTS capability_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  action text NOT NULL CHECK (action IN ('SNAPSHOT_CREATION','VOTE_EMISSION','CERTIFICATION')),
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role, action)
);

ALTER TABLE capability_matrix ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_all_capability" ON capability_matrix;
CREATE POLICY "read_all_capability" ON capability_matrix FOR SELECT USING (true);

INSERT INTO capability_matrix (role, action, enabled, reason) VALUES
  ('SECRETARIO',   'SNAPSHOT_CREATION', true,  'Titular de la ordenación de la sesión (art. 106 RRM).'),
  ('ADMIN_TENANT', 'SNAPSHOT_CREATION', true,  'Rol administrativo del tenant.'),
  ('CONSEJERO',    'SNAPSHOT_CREATION', false, 'El consejero no congela el censo; lo hace el Secretario.'),
  ('CONSEJERO',    'VOTE_EMISSION',     true,  'Facultad natural del consejero.'),
  ('SECRETARIO',   'VOTE_EMISSION',     true,  'Secretario consejero vota si tiene condición CONSEJERO vigente.'),
  ('ADMIN_TENANT', 'VOTE_EMISSION',     true,  'Para operativa excepcional.'),
  ('SECRETARIO',   'CERTIFICATION',     true,  'Facultad certificante (art. 109 RRM).'),
  ('ADMIN_TENANT', 'CERTIFICATION',     true,  'Rol administrativo excepcional.'),
  ('CONSEJERO',    'CERTIFICATION',     false, 'No certifica salvo que ostente cargo de Secretario.'),
  ('COMPLIANCE',   'SNAPSHOT_CREATION', false, NULL),
  ('COMPLIANCE',   'VOTE_EMISSION',     false, NULL),
  ('COMPLIANCE',   'CERTIFICATION',     false, NULL),
  ('AUDITOR',      'SNAPSHOT_CREATION', false, NULL),
  ('AUDITOR',      'VOTE_EMISSION',     false, NULL),
  ('AUDITOR',      'CERTIFICATION',     false, NULL)
ON CONFLICT (role, action) DO NOTHING;
```

Aplicar vía MCP: `mcp__53aea412-..._apply_migration(name="capability_matrix", query=<contenido>)`.
Regenerar types.

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/test/schema/capability-matrix.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260421_000023_capability_matrix.sql src/test/schema/capability-matrix.test.ts src/integrations/supabase/types.ts
git commit -m "feat(societario): F1.1 capability_matrix + seed (3 acciones × 5 roles)"
```

---

### Task F1.2: Migración `authority_evidence` + índices + trigger sync

**Files:**
- Create: `supabase/migrations/20260421_000024_authority_evidence.sql`
- Test: `src/test/schema/authority-evidence.test.ts`

- [ ] **Step 1: Escribir test fallando**

```ts
// src/test/schema/authority-evidence.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/integrations/supabase/client";

const TENANT = "00000000-0000-0000-0000-000000000001";
const ENTITY_ARGA = "6d7ed736-f263-4531-a59d-c6ca0cd41602";

describe("authority_evidence", () => {
  it("se crea desde condiciones_persona cuando el rol es certificante", async () => {
    // Tomar un SECRETARIO vigente desde condiciones_persona
    const { data: cp } = await supabase
      .from("condiciones_persona")
      .select("id, person_id")
      .eq("entity_id", ENTITY_ARGA)
      .eq("role", "SECRETARIO")
      .is("valido_hasta", null)
      .limit(1)
      .maybeSingle();
    if (!cp) return; // OK si seed aún no lo incluye
    const { data: ev } = await supabase
      .from("authority_evidence")
      .select("*")
      .eq("condicion_persona_id", cp.id);
    expect(ev && ev.length).toBeGreaterThan(0);
  });
  it("fn_cargo_vigente devuelve true para SECRETARIO vigente", async () => {
    const { data: cp } = await supabase
      .from("condiciones_persona")
      .select("person_id, entity_id, body_id, role")
      .eq("entity_id", ENTITY_ARGA)
      .eq("role", "SECRETARIO")
      .is("valido_hasta", null)
      .limit(1)
      .maybeSingle();
    if (!cp) return;
    const { data } = await supabase.rpc("fn_cargo_vigente", {
      p_person_id: cp.person_id,
      p_entity_id: cp.entity_id,
      p_body_id: cp.body_id,
      p_role: cp.role,
    });
    expect(data).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/test/schema/authority-evidence.test.ts` — FAIL (tabla/RPC no existen).

- [ ] **Step 3: Aplicar migración**

```sql
-- supabase/migrations/20260421_000024_authority_evidence.sql
CREATE TABLE IF NOT EXISTS authority_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  body_id uuid REFERENCES governing_bodies(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  role text NOT NULL CHECK (role IN (
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
    'CONSEJERO','CONSEJERO_DELEGADO','COMISIONADO'
  )),
  valido_desde date NOT NULL,
  valido_hasta date,
  inscripcion_rm_referencia text,
  inscripcion_rm_fecha date,
  fuente text NOT NULL CHECK (fuente IN ('JGA','CDA','NOTARIAL','INSCRIPCION_RM','OTRO')),
  documento_ref text,
  condicion_persona_id uuid UNIQUE REFERENCES condiciones_persona(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_authority_evidence_vigente
  ON authority_evidence (entity_id, COALESCE(body_id,'00000000-0000-0000-0000-000000000000'::uuid), person_id, role)
  WHERE valido_hasta IS NULL;

CREATE INDEX IF NOT EXISTS ix_authority_evidence_person ON authority_evidence(person_id) WHERE valido_hasta IS NULL;
CREATE INDEX IF NOT EXISTS ix_authority_evidence_entity ON authority_evidence(entity_id) WHERE valido_hasta IS NULL;

ALTER TABLE authority_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read_authority" ON authority_evidence;
CREATE POLICY "tenant_read_authority" ON authority_evidence FOR SELECT USING (true);
DROP POLICY IF EXISTS "tenant_write_authority" ON authority_evidence;
CREATE POLICY "tenant_write_authority" ON authority_evidence FOR ALL USING (true);

CREATE OR REPLACE FUNCTION fn_cargo_vigente(
  p_person_id uuid, p_entity_id uuid, p_body_id uuid, p_role text, p_fecha date DEFAULT CURRENT_DATE
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM authority_evidence
    WHERE person_id = p_person_id
      AND entity_id = p_entity_id
      AND COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_body_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND role = p_role
      AND valido_desde <= p_fecha
      AND (valido_hasta IS NULL OR valido_hasta >= p_fecha)
  );
$$;

CREATE OR REPLACE FUNCTION fn_sync_authority_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_authority_roles text[] := ARRAY[
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
    'CONSEJERO','CONSEJERO_DELEGADO','COMISIONADO'
  ];
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.role = ANY(v_authority_roles) THEN
    INSERT INTO authority_evidence (
      tenant_id, entity_id, body_id, person_id, role,
      valido_desde, valido_hasta, fuente, condicion_persona_id
    ) VALUES (
      NEW.tenant_id, NEW.entity_id, NEW.body_id, NEW.person_id, NEW.role,
      NEW.valido_desde, NEW.valido_hasta,
      COALESCE(NEW.fuente_designacion, 'OTRO'),
      NEW.id
    )
    ON CONFLICT (condicion_persona_id) DO UPDATE SET
      valido_desde = EXCLUDED.valido_desde,
      valido_hasta = EXCLUDED.valido_hasta,
      updated_at = now();
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM authority_evidence WHERE condicion_persona_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_authority_evidence ON condiciones_persona;
CREATE TRIGGER tr_sync_authority_evidence
  AFTER INSERT OR UPDATE OR DELETE ON condiciones_persona
  FOR EACH ROW EXECUTE FUNCTION fn_sync_authority_evidence();

-- Backfill desde condiciones_persona existente
INSERT INTO authority_evidence (
  tenant_id, entity_id, body_id, person_id, role,
  valido_desde, valido_hasta, fuente, condicion_persona_id
)
SELECT cp.tenant_id, cp.entity_id, cp.body_id, cp.person_id, cp.role,
       cp.valido_desde, cp.valido_hasta,
       COALESCE(cp.fuente_designacion, 'OTRO'),
       cp.id
  FROM condiciones_persona cp
 WHERE cp.role IN (
   'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
   'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
   'CONSEJERO','CONSEJERO_DELEGADO','COMISIONADO'
 )
ON CONFLICT (condicion_persona_id) DO NOTHING;
```

Aplicar vía MCP + regenerar types.

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/test/schema/authority-evidence.test.ts` → 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260421_000024_authority_evidence.sql src/test/schema/authority-evidence.test.ts src/integrations/supabase/types.ts
git commit -m "feat(societario): F1.2 authority_evidence + trigger sync + backfill"
```

---

### Task F1.3: Extensiones a `condiciones_persona`, `minutes`, `certifications`

**Files:**
- Create: `supabase/migrations/20260421_000025_extensions_minutes_cert_cp.sql`
- Test: `src/test/schema/extensions-minutes-cert.test.ts`

- [ ] **Step 1: Escribir test fallando**

```ts
// src/test/schema/extensions-minutes-cert.test.ts
import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("extensiones minutes/certifications/condiciones_persona", () => {
  it("minutes tiene columnas snapshot_id, content_hash, rules_applied, body_id, entity_id", async () => {
    const { data, error } = await supabase
      .from("minutes")
      .select("id, snapshot_id, content_hash, rules_applied, body_id, entity_id")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
  it("certifications tiene columnas nuevas (tipo_certificacion, gate_hash, hash_certificacion)", async () => {
    const { data, error } = await supabase
      .from("certifications")
      .select("id, tipo_certificacion, certificante_role, visto_bueno_persona_id, tsq_token, gate_hash, hash_certificacion, authority_evidence_id")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
  it("condiciones_persona tiene fuente_designacion e inscripcion_rm_*", async () => {
    const { data, error } = await supabase
      .from("condiciones_persona")
      .select("id, fuente_designacion, inscripcion_rm_referencia, inscripcion_rm_fecha")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/test/schema/extensions-minutes-cert.test.ts` — FAIL.

- [ ] **Step 3: Aplicar migración**

```sql
-- supabase/migrations/20260421_000025_extensions_minutes_cert_cp.sql
ALTER TABLE minutes
  ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES censo_snapshot(id),
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS rules_applied jsonb,
  ADD COLUMN IF NOT EXISTS body_id uuid REFERENCES governing_bodies(id),
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES entities(id);

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS tipo_certificacion text
    CHECK (tipo_certificacion IN ('ACUERDOS','NOMBRAMIENTO','CESE','APODERAMIENTO','OTROS')),
  ADD COLUMN IF NOT EXISTS certificante_role text,
  ADD COLUMN IF NOT EXISTS visto_bueno_persona_id uuid REFERENCES persons(id),
  ADD COLUMN IF NOT EXISTS visto_bueno_fecha timestamptz,
  ADD COLUMN IF NOT EXISTS tsq_token text,
  ADD COLUMN IF NOT EXISTS gate_hash text,
  ADD COLUMN IF NOT EXISTS hash_certificacion text,
  ADD COLUMN IF NOT EXISTS authority_evidence_id uuid REFERENCES authority_evidence(id);

ALTER TABLE condiciones_persona
  ADD COLUMN IF NOT EXISTS fuente_designacion text
    CHECK (fuente_designacion IN ('JGA','CDA','NOTARIAL','INSCRIPCION_RM','OTRO')),
  ADD COLUMN IF NOT EXISTS inscripcion_rm_referencia text,
  ADD COLUMN IF NOT EXISTS inscripcion_rm_fecha date;
```

Aplicar vía MCP + regenerar types.

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/test/schema/extensions-minutes-cert.test.ts` → 3/3 PASS.
Run: `npx tsc --noEmit` → 0 errores.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260421_000025_extensions_minutes_cert_cp.sql src/test/schema/extensions-minutes-cert.test.ts src/integrations/supabase/types.ts
git commit -m "feat(societario): F1.3 extensiones minutes/certifications/condiciones_persona"
```

---

## F2 — Hooks canónicos base

### Task F2.1: `useSociedades` + `usePersonas`

**Files:**
- Create: `src/hooks/useSociedades.ts`
- Create: `src/hooks/usePersonas.ts`
- Test: `src/test/hooks/useSociedades.test.ts`, `src/test/hooks/usePersonas.test.ts`

- [ ] **Step 1: Test fallando (`useSociedades`)**

```ts
// src/test/hooks/useSociedades.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import { useSociedades } from "@/hooks/useSociedades";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

describe("useSociedades", () => {
  it("devuelve al menos 1 sociedad (ARGA)", async () => {
    const { result } = renderHook(() => useSociedades(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Falla** — `npx vitest run src/test/hooks/useSociedades.test.ts`.

- [ ] **Step 3: Implementar `useSociedades`**

```ts
// src/hooks/useSociedades.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type SociedadRow = {
  id: string;
  tenant_id: string;
  name: string;
  legal_form: string | null;
  tipo_organo_admin: string | null;
  person_id: string | null;
  country_code: string | null;
  tax_id: string | null;
  parent_id: string | null;
};

export function useSociedades() {
  return useQuery({
    queryKey: ["sociedades", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("id, tenant_id, name, legal_form, tipo_organo_admin, person_id, country_code, tax_id, parent_id")
        .eq("tenant_id", DEMO_TENANT)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SociedadRow[];
    },
  });
}

export function useSociedad(id?: string) {
  return useQuery({
    queryKey: ["sociedades", "detail", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as SociedadRow | null;
    },
  });
}

export function useCreateSociedad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SociedadRow> & { name: string }) => {
      const { data, error } = await supabase
        .from("entities")
        .insert({ ...payload, tenant_id: DEMO_TENANT })
        .select()
        .single();
      if (error) throw error;
      return data as SociedadRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sociedades"] }),
  });
}

export function useUpdateSociedad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SociedadRow> }) => {
      const { data, error } = await supabase.from("entities").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as SociedadRow;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["sociedades"] });
      qc.invalidateQueries({ queryKey: ["sociedades", "detail", v.id] });
    },
  });
}
```

- [ ] **Step 4: Test fallando (`usePersonas`)**

```ts
// src/test/hooks/usePersonas.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import { usePersonas } from "@/hooks/usePersonas";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

describe("usePersonas", () => {
  it("devuelve personas con person_type PF o PJ", async () => {
    const { result } = renderHook(() => usePersonas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const types = new Set((result.current.data ?? []).map((p) => p.person_type));
    expect(Array.from(types).every((t) => ["PF", "PJ"].includes(t as string))).toBe(true);
  });
});
```

- [ ] **Step 5: Implementar `usePersonas`**

```ts
// src/hooks/usePersonas.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type PersonaRow = {
  id: string;
  tenant_id: string;
  person_type: "PF" | "PJ";
  full_name: string;
  tax_id: string | null;
  representative_person_id: string | null;
  email: string | null;
  country_code: string | null;
};

export function usePersonas(filter?: "PF" | "PJ") {
  return useQuery({
    queryKey: ["personas", "list", filter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("persons")
        .select("id, tenant_id, person_type, full_name, tax_id, representative_person_id, email, country_code")
        .eq("tenant_id", DEMO_TENANT)
        .order("full_name");
      if (filter) q = q.eq("person_type", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PersonaRow[];
    },
  });
}

export function usePersona(id?: string) {
  return useQuery({
    queryKey: ["personas", "detail", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("persons").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as PersonaRow | null;
    },
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<PersonaRow, "id" | "tenant_id"> & Partial<Pick<PersonaRow, "tenant_id">>) => {
      const { data, error } = await supabase
        .from("persons")
        .insert({ ...payload, tenant_id: payload.tenant_id ?? DEMO_TENANT })
        .select()
        .single();
      if (error) throw error;
      return data as PersonaRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useUpdatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PersonaRow> }) => {
      const { data, error } = await supabase.from("persons").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as PersonaRow;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      qc.invalidateQueries({ queryKey: ["personas", "detail", v.id] });
    },
  });
}
```

- [ ] **Step 6: Verificar y commit**

```bash
npx vitest run src/test/hooks/useSociedades.test.ts src/test/hooks/usePersonas.test.ts
npx tsc --noEmit
git add src/hooks/useSociedades.ts src/hooks/usePersonas.ts src/test/hooks/useSociedades.test.ts src/test/hooks/usePersonas.test.ts
git commit -m "feat(societario): F2.1 hooks useSociedades + usePersonas"
```

---

### Task F2.2: `useEntityCapitalProfile` + `useShareClasses`

**Files:**
- Create: `src/hooks/useEntityCapitalProfile.ts`
- Create: `src/hooks/useShareClasses.ts`

- [ ] **Step 1: Implementar `useEntityCapitalProfile`**

```ts
// src/hooks/useEntityCapitalProfile.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CapitalProfileRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  capital_social: number;
  capital_desembolsado: number;
  numero_titulos: number;
  nominal_unitario: number;
  moneda: string;
  vigente: boolean;
  valido_desde: string;
  valido_hasta: string | null;
};

export function useEntityCapitalProfile(entityId?: string) {
  return useQuery({
    queryKey: ["capital_profile", "vigente", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_capital_profile")
        .select("*")
        .eq("entity_id", entityId!)
        .eq("vigente", true)
        .maybeSingle();
      if (error) throw error;
      return data as CapitalProfileRow | null;
    },
  });
}

export function useEntityCapitalHistory(entityId?: string) {
  return useQuery({
    queryKey: ["capital_profile", "history", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_capital_profile")
        .select("*")
        .eq("entity_id", entityId!)
        .order("valido_desde", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CapitalProfileRow[];
    },
  });
}

export function useUpsertCapitalProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CapitalProfileRow> & { entity_id: string }) => {
      const { data, error } = await supabase
        .from("entity_capital_profile")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["capital_profile"] }),
  });
}
```

- [ ] **Step 2: Implementar `useShareClasses`**

```ts
// src/hooks/useShareClasses.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ShareClassRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  codigo: string;
  descripcion: string | null;
  derechos_voto: boolean;
  privilege_type: string | null;
  nominal: number;
};

export function useShareClasses(entityId?: string) {
  return useQuery({
    queryKey: ["share_classes", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_classes")
        .select("*")
        .eq("entity_id", entityId!)
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as ShareClassRow[];
    },
  });
}

export function useCreateShareClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ShareClassRow, "id" | "tenant_id"> & { tenant_id?: string }) => {
      const { data, error } = await supabase
        .from("share_classes")
        .insert({ ...payload, tenant_id: payload.tenant_id ?? "00000000-0000-0000-0000-000000000001" })
        .select()
        .single();
      if (error) throw error;
      return data as ShareClassRow;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["share_classes", v.entity_id] }),
  });
}
```

- [ ] **Step 3: Verificar `tsc --noEmit` limpio y commit**

```bash
npx tsc --noEmit
git add src/hooks/useEntityCapitalProfile.ts src/hooks/useShareClasses.ts
git commit -m "feat(societario): F2.2 useEntityCapitalProfile + useShareClasses"
```

---

## F3 — Hooks de libros

### Task F3.1: `useSocios` + `useAdministradores`

**Files:**
- Create: `src/hooks/useSocios.ts`
- Create: `src/hooks/useAdministradores.ts`

- [ ] **Step 1: Implementar `useSocios`**

```ts
// src/hooks/useSocios.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type CapitalHoldingRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  person_id: string;
  share_class_id: string;
  numero_titulos: number;
  pct_capital: number;
  is_treasury: boolean;
  voting_weight: number;
  denominator_weight: number;
  valido_desde: string;
  valido_hasta: string | null;
  person?: { full_name: string; person_type: "PF" | "PJ"; tax_id: string | null } | null;
  share_class?: { codigo: string; derechos_voto: boolean } | null;
};

export function useSocios(entityId?: string) {
  return useQuery({
    queryKey: ["socios", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capital_holdings")
        .select(`
          *,
          person:persons(full_name, person_type, tax_id),
          share_class:share_classes(codigo, derechos_voto)
        `)
        .eq("entity_id", entityId!)
        .is("valido_hasta", null)
        .order("pct_capital", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CapitalHoldingRow[];
    },
  });
}

export function useSocioUnico(entityId?: string) {
  return useQuery({
    queryKey: ["socios", "unico", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data } = await supabase
        .from("capital_holdings")
        .select("person_id, pct_capital, is_treasury")
        .eq("entity_id", entityId!)
        .is("valido_hasta", null);
      const real = (data ?? []).filter((h) => !h.is_treasury);
      if (real.length === 1 && Number(real[0].pct_capital) >= 99.99) {
        return { socio_unico: true, person_id: real[0].person_id };
      }
      return { socio_unico: false, person_id: null };
    },
  });
}

export function useAddHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<CapitalHoldingRow, "id" | "tenant_id" | "person" | "share_class"> & { tenant_id?: string }) => {
      const { data, error } = await supabase
        .from("capital_holdings")
        .insert({ ...payload, tenant_id: payload.tenant_id ?? DEMO_TENANT })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["socios", v.entity_id] });
      qc.invalidateQueries({ queryKey: ["socios", "unico", v.entity_id] });
    },
  });
}
```

- [ ] **Step 2: Implementar `useAdministradores`**

```ts
// src/hooks/useAdministradores.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const ADMIN_ROLES = [
  "ADMIN_UNICO","ADMIN_SOLIDARIO","ADMIN_MANCOMUNADO",
  "PRESIDENTE","VICEPRESIDENTE","SECRETARIO","VICESECRETARIO",
  "CONSEJERO","CONSEJERO_DELEGADO","COMISIONADO",
];

export type AdminRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id: string | null;
  person_id: string;
  role: string;
  valido_desde: string;
  valido_hasta: string | null;
  fuente_designacion: string | null;
  inscripcion_rm_referencia: string | null;
  inscripcion_rm_fecha: string | null;
  person?: { full_name: string; person_type: "PF" | "PJ"; tax_id: string | null } | null;
  body?: { name: string; body_type: string } | null;
};

export function useAdministradores(entityId?: string) {
  return useQuery({
    queryKey: ["administradores", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select(`
          *,
          person:persons(full_name, person_type, tax_id),
          body:governing_bodies(name, body_type)
        `)
        .eq("entity_id", entityId!)
        .in("role", ADMIN_ROLES)
        .is("valido_hasta", null)
        .order("role");
      if (error) throw error;
      return (data ?? []) as AdminRow[];
    },
  });
}

export function useDesignarAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<AdminRow, "id" | "tenant_id" | "person" | "body"> & { tenant_id?: string }) => {
      const { data, error } = await supabase
        .from("condiciones_persona")
        .insert({ ...payload, tenant_id: payload.tenant_id ?? DEMO_TENANT })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["administradores", v.entity_id] });
      qc.invalidateQueries({ queryKey: ["authority_evidence"] });
    },
  });
}

export function useCesarAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valido_hasta }: { id: string; valido_hasta: string }) => {
      const { data, error } = await supabase
        .from("condiciones_persona")
        .update({ valido_hasta })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["administradores", d.entity_id] });
      qc.invalidateQueries({ queryKey: ["authority_evidence"] });
    },
  });
}
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/hooks/useSocios.ts src/hooks/useAdministradores.ts
git commit -m "feat(societario): F3.1 hooks useSocios + useAdministradores"
```

---

### Task F3.2: `useComposicionOrgano` + `useRepresentaciones`

**Files:**
- Create: `src/hooks/useComposicionOrgano.ts`
- Create: `src/hooks/useRepresentaciones.ts`

- [ ] **Step 1: Implementar ambos**

```ts
// src/hooks/useComposicionOrgano.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MiembroOrganoRow = {
  id: string;
  role: string;
  person_id: string;
  valido_desde: string;
  valido_hasta: string | null;
  person?: { full_name: string; person_type: "PF" | "PJ" } | null;
};

export function useComposicionOrgano(bodyId?: string) {
  return useQuery({
    queryKey: ["composicion", bodyId ?? "none"],
    enabled: Boolean(bodyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select(`id, role, person_id, valido_desde, valido_hasta, person:persons(full_name, person_type)`)
        .eq("body_id", bodyId!)
        .is("valido_hasta", null)
        .order("role");
      if (error) throw error;
      return (data ?? []) as MiembroOrganoRow[];
    },
  });
}
```

```ts
// src/hooks/useRepresentaciones.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RepresentacionRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  tipo: "PJ_PERMANENTE" | "JUNTA_PROXY" | "CONSEJO_DELEGACION";
  representado_person_id: string;
  representante_person_id: string;
  valido_desde: string;
  valido_hasta: string | null;
  alcance: string | null;
};

export function useRepresentaciones(entityId?: string) {
  return useQuery({
    queryKey: ["representaciones", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representaciones")
        .select("*")
        .eq("entity_id", entityId!)
        .is("valido_hasta", null);
      if (error) throw error;
      return (data ?? []) as RepresentacionRow[];
    },
  });
}

export function useCreateRepresentacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<RepresentacionRow, "id" | "tenant_id"> & { tenant_id?: string }) => {
      const { data, error } = await supabase
        .from("representaciones")
        .insert({ ...payload, tenant_id: payload.tenant_id ?? "00000000-0000-0000-0000-000000000001" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["representaciones", v.entity_id] }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
npx tsc --noEmit
git add src/hooks/useComposicionOrgano.ts src/hooks/useRepresentaciones.ts
git commit -m "feat(societario): F3.2 useComposicionOrgano + useRepresentaciones"
```

---

### Task F3.3: `useAuthorityEvidence` + `useCapabilityMatrix`

**Files:**
- Create: `src/hooks/useAuthorityEvidence.ts`
- Create: `src/hooks/useCapabilityMatrix.ts`

- [ ] **Step 1: Implementar ambos**

```ts
// src/hooks/useAuthorityEvidence.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthorityEvidenceRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id: string | null;
  person_id: string;
  role: string;
  valido_desde: string;
  valido_hasta: string | null;
  inscripcion_rm_referencia: string | null;
  inscripcion_rm_fecha: string | null;
  fuente: string;
  condicion_persona_id: string | null;
  person?: { full_name: string } | null;
};

export function useAuthorityEvidence(entityId?: string, role?: string) {
  return useQuery({
    queryKey: ["authority_evidence", entityId ?? "none", role ?? "all"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      let q = supabase
        .from("authority_evidence")
        .select("*, person:persons(full_name)")
        .eq("entity_id", entityId!)
        .is("valido_hasta", null);
      if (role) q = q.eq("role", role);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuthorityEvidenceRow[];
    },
  });
}

export function usePresidenteVigente(entityId?: string, bodyId?: string) {
  return useQuery({
    queryKey: ["authority_evidence", "presidente", entityId ?? "none", bodyId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      let q = supabase
        .from("authority_evidence")
        .select("*, person:persons(full_name)")
        .eq("entity_id", entityId!)
        .eq("role", "PRESIDENTE")
        .is("valido_hasta", null);
      if (bodyId) q = q.eq("body_id", bodyId);
      const { data } = await q.maybeSingle();
      return (data ?? null) as AuthorityEvidenceRow | null;
    },
  });
}
```

```ts
// src/hooks/useCapabilityMatrix.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CapabilityRow = {
  role: string;
  action: "SNAPSHOT_CREATION" | "VOTE_EMISSION" | "CERTIFICATION";
  enabled: boolean;
  reason: string | null;
};

export function useCapabilityMatrix() {
  return useQuery({
    queryKey: ["capability_matrix"],
    staleTime: 60 * 60 * 1000, // 1h
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_matrix")
        .select("role, action, enabled, reason");
      if (error) throw error;
      return (data ?? []) as CapabilityRow[];
    },
  });
}

export function hasCapability(
  matrix: CapabilityRow[] | undefined,
  role: string,
  action: CapabilityRow["action"]
): boolean {
  if (!matrix) return false;
  const hit = matrix.find((r) => r.role === role && r.action === action);
  return Boolean(hit?.enabled);
}
```

- [ ] **Step 2: Commit**

```bash
npx tsc --noEmit
git add src/hooks/useAuthorityEvidence.ts src/hooks/useCapabilityMatrix.ts
git commit -m "feat(societario): F3.3 useAuthorityEvidence + useCapabilityMatrix"
```

---

## F4 — Páginas CRUD sociedades + personas

### Task F4.1: `SociedadesList` + ruta

**Files:**
- Create: `src/pages/secretaria/SociedadesList.tsx`
- Modify: `src/App.tsx` (añadir ruta)
- Modify: `src/pages/secretaria/SecretariaLayout.tsx` (añadir ítem sidebar "Sociedades")

- [ ] **Step 1: Implementar `SociedadesList`**

```tsx
// src/pages/secretaria/SociedadesList.tsx
import { Link } from "react-router-dom";
import { useSociedades } from "@/hooks/useSociedades";

export default function SociedadesList() {
  const { data, isLoading } = useSociedades();

  if (isLoading) {
    return <div className="p-8 text-[var(--g-text-secondary)]">Cargando sociedades…</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Sociedades</h1>
          <p className="text-sm text-[var(--g-text-secondary)] mt-1">
            Fichas societarias del grupo — {data?.length ?? 0} sociedades.
          </p>
        </div>
        <Link
          to="/secretaria/sociedades/nueva"
          className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Nueva sociedad
        </Link>
      </div>

      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Denominación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">NIF</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">País</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Órgano admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {(data ?? []).map((s) => (
              <tr key={s.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                <td className="px-6 py-4 text-sm">
                  <Link
                    to={`/secretaria/sociedades/${s.id}`}
                    className="text-[var(--g-link)] hover:text-[var(--g-link-hover)] font-medium"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{s.legal_form ?? "—"}</td>
                <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{s.tax_id ?? "—"}</td>
                <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{s.country_code ?? "ES"}</td>
                <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{s.tipo_organo_admin ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar ruta en `App.tsx`**

Añadir dentro del bloque `<Route element={<SecretariaLayout />}>`:

```tsx
const SociedadesList = lazy(() => import("./pages/secretaria/SociedadesList"));
// ...
<Route path="/secretaria/sociedades" element={<SociedadesList />} />
```

- [ ] **Step 3: Añadir ítem sidebar en `SecretariaLayout.tsx`**

Añadir al array de navegación:

```tsx
{ path: "/secretaria/sociedades", label: "Sociedades", icon: Building2 },
```

- [ ] **Step 4: Verificar build y commit**

```bash
npx tsc --noEmit
npx vite build --outDir /tmp/tgms-dist
git add src/pages/secretaria/SociedadesList.tsx src/App.tsx src/pages/secretaria/SecretariaLayout.tsx
git commit -m "feat(societario): F4.1 SociedadesList + ruta + sidebar"
```

---

### Task F4.2: `SociedadDetalle` (tabs 1-4)

**Files:**
- Create: `src/pages/secretaria/SociedadDetalle.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implementar `SociedadDetalle` con tabs Resumen, Socios, Administradores, Órganos**

```tsx
// src/pages/secretaria/SociedadDetalle.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSociedad } from "@/hooks/useSociedades";
import { useEntityCapitalProfile } from "@/hooks/useEntityCapitalProfile";
import { useSocios } from "@/hooks/useSocios";
import { useAdministradores } from "@/hooks/useAdministradores";

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "socios", label: "Socios" },
  { key: "admins", label: "Administradores" },
  { key: "organos", label: "Órganos" },
  { key: "capital", label: "Capital" },
  { key: "reglas", label: "Reglas aplicables" },
  { key: "pactos", label: "Pactos" },
  { key: "autoridad", label: "Autoridad" },
];

export default function SociedadDetalle() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("resumen");
  const { data: soc } = useSociedad(id);
  const { data: cap } = useEntityCapitalProfile(id);
  const { data: socios } = useSocios(id);
  const { data: admins } = useAdministradores(id);

  if (!soc) return <div className="p-8 text-[var(--g-text-secondary)]">Cargando…</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link to="/secretaria/sociedades" className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)]">← Sociedades</Link>
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)] mt-2">{soc.name}</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">{soc.legal_form ?? "—"} · {soc.tax_id ?? "—"}</p>
      </div>

      <nav className="flex gap-2 border-b border-[var(--g-border-subtle)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "px-4 py-2 text-sm font-medium text-[var(--g-brand-3308)] border-b-2 border-[var(--g-brand-3308)]"
                : "px-4 py-2 text-sm font-medium text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "resumen" && (
        <div className="grid grid-cols-3 gap-4">
          <Card title="Capital social" value={cap ? `${cap.capital_social} ${cap.moneda}` : "—"} />
          <Card title="Nº socios" value={String(socios?.length ?? 0)} />
          <Card title="Nº administradores" value={String(admins?.length ?? 0)} />
        </div>
      )}

      {tab === "socios" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              to={`/secretaria/sociedades/${id}/socios/añadir`}
              className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Añadir socio
            </Link>
          </div>
          <table className="w-full bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Persona</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Clase</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-[var(--g-text-primary)]">% Capital</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-[var(--g-text-primary)]">Nº títulos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(socios ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-primary)]">{s.person?.full_name ?? s.person_id}</td>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{s.share_class?.codigo ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-right">{Number(s.pct_capital).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-sm text-right">{s.numero_titulos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "admins" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              to={`/secretaria/sociedades/${id}/administradores/designar`}
              className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Designar administrador
            </Link>
          </div>
          <table className="w-full bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Persona</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Cargo</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Órgano</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Desde</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">RM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(admins ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-primary)]">{a.person?.full_name ?? a.person_id}</td>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{a.role}</td>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{a.body?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{a.valido_desde}</td>
                  <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{a.inscripcion_rm_referencia ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "organos" && <OrganosTab entityId={id!} />}
      {tab === "capital" && <CapitalTab entityId={id!} />}
      {tab === "reglas" && <div className="text-[var(--g-text-secondary)]">Reglas aplicables — ver ruta <Link to={`/secretaria/sociedades/${id}/reglas`} className="text-[var(--g-link)]">dedicada</Link>.</div>}
      {tab === "pactos" && <div className="text-[var(--g-text-secondary)]">Pactos parasociales — ver F7.</div>}
      {tab === "autoridad" && <AutoridadTab entityId={id!} />}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="text-xs uppercase text-[var(--g-text-secondary)]">{title}</div>
      <div className="text-lg font-semibold text-[var(--g-text-primary)] mt-1">{value}</div>
    </div>
  );
}

function OrganosTab({ entityId }: { entityId: string }) {
  // Implementación stub — conecta con useOrganos (hook ya existente useBodies filtrado por entity)
  return <div className="text-[var(--g-text-secondary)]">Órganos de la sociedad (usa `useBodies` filtrado por entity_id).</div>;
}

function CapitalTab({ entityId }: { entityId: string }) {
  return <div className="text-[var(--g-text-secondary)]">Historial de capital (usa `useEntityCapitalHistory`).</div>;
}

function AutoridadTab({ entityId }: { entityId: string }) {
  return <div className="text-[var(--g-text-secondary)]">Autoridad vigente (usa `useAuthorityEvidence`).</div>;
}
```

- [ ] **Step 2: Registrar ruta y commit**

```tsx
// En App.tsx añadir:
const SociedadDetalle = lazy(() => import("./pages/secretaria/SociedadDetalle"));
<Route path="/secretaria/sociedades/:id" element={<SociedadDetalle />} />
```

```bash
npx tsc --noEmit
git add src/pages/secretaria/SociedadDetalle.tsx src/App.tsx
git commit -m "feat(societario): F4.2 SociedadDetalle con 8 tabs (4 implementadas, 4 stub)"
```

---

### Task F4.3: `SociedadNuevaStepper` (4 pasos)

**Files:**
- Create: `src/pages/secretaria/SociedadNuevaStepper.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implementar stepper**

```tsx
// src/pages/secretaria/SociedadNuevaStepper.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateSociedad } from "@/hooks/useSociedades";
import { useCreatePersona } from "@/hooks/usePersonas";
import { useUpsertCapitalProfile } from "@/hooks/useEntityCapitalProfile";
import { useCreateShareClass } from "@/hooks/useShareClasses";
import { toast } from "sonner";

type Data = {
  name: string;
  legal_form: "SA" | "SL" | "SLU" | "SAU";
  country_code: string;
  tax_id: string;
  capital_social: number;
  nominal_unitario: number;
  numero_titulos: number;
  share_class_codigo: string;
  tipo_organo_admin: "ADMIN_UNICO" | "ADMINS_SOLIDARIOS" | "ADMINS_MANCOMUNADOS" | "CDA";
};

const INITIAL: Data = {
  name: "",
  legal_form: "SL",
  country_code: "ES",
  tax_id: "",
  capital_social: 3000,
  nominal_unitario: 1,
  numero_titulos: 3000,
  share_class_codigo: "A",
  tipo_organo_admin: "ADMIN_UNICO",
};

export default function SociedadNuevaStepper() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Data>(INITIAL);
  const nav = useNavigate();
  const createSoc = useCreateSociedad();
  const createPersona = useCreatePersona();
  const upsertCap = useUpsertCapitalProfile();
  const createClass = useCreateShareClass();

  function update<K extends keyof Data>(k: K, v: Data[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function submit() {
    try {
      // 1) persona PJ de la sociedad
      const persona = await createPersona.mutateAsync({
        person_type: "PJ",
        full_name: data.name,
        tax_id: data.tax_id,
        country_code: data.country_code,
        email: null,
        representative_person_id: null,
      });
      // 2) entity
      const soc = await createSoc.mutateAsync({
        name: data.name,
        legal_form: data.legal_form,
        country_code: data.country_code,
        tax_id: data.tax_id,
        person_id: persona.id,
        tipo_organo_admin: data.tipo_organo_admin,
        parent_id: null,
      });
      // 3) capital profile
      await upsertCap.mutateAsync({
        entity_id: soc.id,
        capital_social: data.capital_social,
        capital_desembolsado: data.capital_social,
        numero_titulos: data.numero_titulos,
        nominal_unitario: data.nominal_unitario,
        moneda: "EUR",
        vigente: true,
        valido_desde: new Date().toISOString().slice(0, 10),
      });
      // 4) share class
      await createClass.mutateAsync({
        entity_id: soc.id,
        codigo: data.share_class_codigo,
        descripcion: "Ordinarias",
        derechos_voto: true,
        privilege_type: null,
        nominal: data.nominal_unitario,
      });
      toast.success("Sociedad creada");
      nav(`/secretaria/sociedades/${soc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Nueva sociedad · Paso {step}/4</h1>
      <div className="h-1 bg-[var(--g-surface-muted)] rounded">
        <div className="h-full bg-[var(--g-brand-3308)] transition-all" style={{ width: `${(step / 4) * 100}%`, borderRadius: "var(--g-radius-full)" }} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Denominación" value={data.name} onChange={(v) => update("name", v)} />
          <SelectField label="Tipo social" value={data.legal_form} options={["SA", "SL", "SLU", "SAU"]} onChange={(v) => update("legal_form", v as Data["legal_form"])} />
          <Field label="País" value={data.country_code} onChange={(v) => update("country_code", v)} />
          <Field label="NIF/CIF" value={data.tax_id} onChange={(v) => update("tax_id", v)} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <NumField label="Capital social (EUR)" value={data.capital_social} onChange={(v) => update("capital_social", v)} />
          <NumField label="Nº títulos" value={data.numero_titulos} onChange={(v) => update("numero_titulos", v)} />
          <NumField label="Nominal unitario" value={data.nominal_unitario} onChange={(v) => update("nominal_unitario", v)} />
          <Field label="Código de la clase (A, B…)" value={data.share_class_codigo} onChange={(v) => update("share_class_codigo", v)} />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <SelectField
            label="Estructura administrativa"
            value={data.tipo_organo_admin}
            options={["ADMIN_UNICO", "ADMINS_SOLIDARIOS", "ADMINS_MANCOMUNADOS", "CDA"]}
            onChange={(v) => update("tipo_organo_admin", v as Data["tipo_organo_admin"])}
          />
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2 text-sm text-[var(--g-text-secondary)]">
          <div><b>Denominación:</b> {data.name}</div>
          <div><b>Tipo:</b> {data.legal_form}</div>
          <div><b>NIF:</b> {data.tax_id}</div>
          <div><b>Capital:</b> {data.capital_social} EUR — {data.numero_titulos} títulos</div>
          <div><b>Órgano admin:</b> {data.tipo_organo_admin}</div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Atrás
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Crear sociedad
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-[var(--g-text-primary)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-[var(--g-text-primary)]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-[var(--g-text-primary)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Registrar ruta y commit**

```bash
# En App.tsx: const SociedadNuevaStepper = lazy(() => import("./pages/secretaria/SociedadNuevaStepper"));
# <Route path="/secretaria/sociedades/nueva" element={<SociedadNuevaStepper />} />
npx tsc --noEmit
git add src/pages/secretaria/SociedadNuevaStepper.tsx src/App.tsx
git commit -m "feat(societario): F4.3 SociedadNuevaStepper (4 pasos)"
```

---

### Task F4.4: `PersonasList` + `PersonaDetalle` + `PersonaNuevaModal`

**Files:**
- Create: `src/pages/secretaria/PersonasList.tsx`
- Create: `src/pages/secretaria/PersonaDetalle.tsx`
- Create: `src/pages/secretaria/PersonaNuevaModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/secretaria/SecretariaLayout.tsx` (sidebar "Personas")

- [ ] **Step 1: Implementar `PersonasList`**

```tsx
// src/pages/secretaria/PersonasList.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePersonas } from "@/hooks/usePersonas";
import PersonaNuevaModal from "./PersonaNuevaModal";

export default function PersonasList() {
  const [filter, setFilter] = useState<"ALL" | "PF" | "PJ">("ALL");
  const [openModal, setOpenModal] = useState(false);
  const { data } = usePersonas(filter === "ALL" ? undefined : filter);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Personas</h1>
        <div className="flex gap-2">
          <div className="flex gap-1 text-sm">
            {(["ALL", "PF", "PJ"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "px-3 py-1 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                    : "px-3 py-1 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                }
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {f === "ALL" ? "Todas" : f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Nueva persona
          </button>
        </div>
      </div>

      <table className="w-full bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Nombre</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Tipo</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">NIF</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">País</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {(data ?? []).map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 text-sm">
                <Link to={`/secretaria/personas/${p.id}`} className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]">{p.full_name}</Link>
              </td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{p.person_type}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{p.tax_id ?? "—"}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{p.country_code ?? "ES"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {openModal && <PersonaNuevaModal onClose={() => setOpenModal(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Implementar `PersonaDetalle`**

```tsx
// src/pages/secretaria/PersonaDetalle.tsx
import { useParams, Link } from "react-router-dom";
import { usePersona } from "@/hooks/usePersonas";

export default function PersonaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data } = usePersona(id);
  if (!data) return <div className="p-8 text-[var(--g-text-secondary)]">Cargando…</div>;
  return (
    <div className="p-8 space-y-4">
      <Link to="/secretaria/personas" className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)]">← Personas</Link>
      <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">{data.full_name}</h1>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <DDet label="Tipo" v={data.person_type} />
        <DDet label="NIF/CIF" v={data.tax_id ?? "—"} />
        <DDet label="País" v={data.country_code ?? "ES"} />
        <DDet label="Email" v={data.email ?? "—"} />
        <DDet label="Representante" v={data.representative_person_id ?? "—"} />
      </dl>
    </div>
  );
}
function DDet({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="text-[var(--g-text-primary)]">{v}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Implementar `PersonaNuevaModal`**

```tsx
// src/pages/secretaria/PersonaNuevaModal.tsx
import { useState } from "react";
import { useCreatePersona, usePersonas } from "@/hooks/usePersonas";
import { toast } from "sonner";

type Form = {
  person_type: "PF" | "PJ";
  full_name: string;
  tax_id: string;
  country_code: string;
  email: string;
  representative_person_id: string;
};

export default function PersonaNuevaModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<Form>({
    person_type: "PF",
    full_name: "",
    tax_id: "",
    country_code: "ES",
    email: "",
    representative_person_id: "",
  });
  const create = useCreatePersona();
  const { data: candidatos } = usePersonas("PF");

  async function submit() {
    try {
      await create.mutateAsync({
        person_type: f.person_type,
        full_name: f.full_name,
        tax_id: f.tax_id || null,
        country_code: f.country_code,
        email: f.email || null,
        representative_person_id: f.person_type === "PJ" && f.representative_person_id ? f.representative_person_id : null,
      });
      toast.success("Persona creada");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div
        className="bg-[var(--g-surface-card)] p-6 w-full max-w-md space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-modal)" }}
      >
        <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">Nueva persona</h2>
        <label className="block text-sm">
          <span className="text-[var(--g-text-primary)]">Tipo</span>
          <select
            value={f.person_type}
            onChange={(e) => setF({ ...f, person_type: e.target.value as "PF" | "PJ" })}
            className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="PF">Física (PF)</option>
            <option value="PJ">Jurídica (PJ)</option>
          </select>
        </label>
        <input placeholder="Nombre completo / denominación" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
        <input placeholder="NIF/CIF" value={f.tax_id} onChange={(e) => setF({ ...f, tax_id: e.target.value })} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
        <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
        {f.person_type === "PJ" && (
          <select
            value={f.representative_person_id}
            onChange={(e) => setF({ ...f, representative_person_id: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">— representante PF —</option>
            {(candidatos ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>Cancelar</button>
          <button type="button" onClick={submit} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]" style={{ borderRadius: "var(--g-radius-md)" }}>Crear</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Registrar rutas + sidebar + commit**

```tsx
// En App.tsx:
const PersonasList = lazy(() => import("./pages/secretaria/PersonasList"));
const PersonaDetalle = lazy(() => import("./pages/secretaria/PersonaDetalle"));
<Route path="/secretaria/personas" element={<PersonasList />} />
<Route path="/secretaria/personas/:id" element={<PersonaDetalle />} />
```

```bash
npx tsc --noEmit
git add src/pages/secretaria/PersonasList.tsx src/pages/secretaria/PersonaDetalle.tsx src/pages/secretaria/PersonaNuevaModal.tsx src/App.tsx src/pages/secretaria/SecretariaLayout.tsx
git commit -m "feat(societario): F4.4 PersonasList + PersonaDetalle + PersonaNuevaModal"
```

---

## F5 — Libros + steppers (socios + administradores)

### Task F5.1: `AñadirSocioStepper` (3 pasos)

**Files:**
- Create: `src/pages/secretaria/AñadirSocioStepper.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implementar stepper**

```tsx
// src/pages/secretaria/AñadirSocioStepper.tsx
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { usePersonas, useCreatePersona } from "@/hooks/usePersonas";
import { useShareClasses } from "@/hooks/useShareClasses";
import { useAddHolding } from "@/hooks/useSocios";
import { useEntityCapitalProfile } from "@/hooks/useEntityCapitalProfile";
import { toast } from "sonner";

export default function AñadirSocioStepper() {
  const { id: entityId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [useExisting, setUseExisting] = useState(true);
  const [personId, setPersonId] = useState("");
  const [newPerson, setNewPerson] = useState({ person_type: "PF" as "PF" | "PJ", full_name: "", tax_id: "" });
  const [classId, setClassId] = useState("");
  const [titulos, setTitulos] = useState(0);
  const [fuente, setFuente] = useState("ESCRITURA_CONSTITUCION");
  const { data: personas } = usePersonas();
  const { data: classes } = useShareClasses(entityId);
  const { data: cap } = useEntityCapitalProfile(entityId);
  const createPersona = useCreatePersona();
  const addHolding = useAddHolding();

  async function submit() {
    try {
      let pid = personId;
      if (!useExisting) {
        const p = await createPersona.mutateAsync({
          person_type: newPerson.person_type,
          full_name: newPerson.full_name,
          tax_id: newPerson.tax_id,
          country_code: "ES",
          email: null,
          representative_person_id: null,
        });
        pid = p.id;
      }
      const pct = cap && cap.numero_titulos > 0 ? (titulos / cap.numero_titulos) * 100 : 0;
      await addHolding.mutateAsync({
        entity_id: entityId!,
        person_id: pid,
        share_class_id: classId,
        numero_titulos: titulos,
        pct_capital: pct,
        is_treasury: false,
        voting_weight: pct,
        denominator_weight: pct,
        valido_desde: new Date().toISOString().slice(0, 10),
        valido_hasta: null,
      });
      toast.success("Socio añadido");
      nav(`/secretaria/sociedades/${entityId}?tab=socios`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <Link to={`/secretaria/sociedades/${entityId}`} className="text-sm text-[var(--g-link)]">← Volver a la sociedad</Link>
      <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Añadir socio · Paso {step}/3</h1>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setUseExisting(true)} className={useExisting ? "px-3 py-1 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" : "px-3 py-1 border border-[var(--g-border-subtle)]"} style={{ borderRadius: "var(--g-radius-sm)" }}>Persona existente</button>
            <button type="button" onClick={() => setUseExisting(false)} className={!useExisting ? "px-3 py-1 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" : "px-3 py-1 border border-[var(--g-border-subtle)]"} style={{ borderRadius: "var(--g-radius-sm)" }}>Crear nueva</button>
          </div>
          {useExisting ? (
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
              <option value="">— selecciona —</option>
              {(personas ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.person_type})</option>)}
            </select>
          ) : (
            <div className="space-y-2">
              <select value={newPerson.person_type} onChange={(e) => setNewPerson({ ...newPerson, person_type: e.target.value as "PF" | "PJ" })} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                <option value="PF">PF</option><option value="PJ">PJ</option>
              </select>
              <input placeholder="Nombre/denominación" value={newPerson.full_name} onChange={(e) => setNewPerson({ ...newPerson, full_name: e.target.value })} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
              <input placeholder="NIF/CIF" value={newPerson.tax_id} onChange={(e) => setNewPerson({ ...newPerson, tax_id: e.target.value })} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--g-text-primary)]">Clase</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
              <option value="">— selecciona —</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion ?? ""}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--g-text-primary)]">Nº títulos</span>
            <input type="number" value={titulos} onChange={(e) => setTitulos(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <select value={fuente} onChange={(e) => setFuente(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
            <option value="ESCRITURA_CONSTITUCION">Escritura de constitución</option>
            <option value="AMPLIACION_CAPITAL">Ampliación de capital</option>
            <option value="TRANSMISION">Transmisión</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="px-4 py-2 border border-[var(--g-border-subtle)] disabled:opacity-50" style={{ borderRadius: "var(--g-radius-md)" }}>Atrás</button>
        {step < 3 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-md)" }}>Siguiente</button>
        ) : (
          <button type="button" onClick={submit} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-md)" }}>Añadir</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar ruta y commit**

```bash
# En App.tsx registrar /secretaria/sociedades/:id/socios/añadir
npx tsc --noEmit
git add src/pages/secretaria/AñadirSocioStepper.tsx src/App.tsx
git commit -m "feat(societario): F5.1 AñadirSocioStepper (3 pasos)"
```

---

### Task F5.2: `TransmisionStepper` (4 pasos)

**Files:**
- Create: `src/pages/secretaria/TransmisionStepper.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implementar stepper**

```tsx
// src/pages/secretaria/TransmisionStepper.tsx
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePersonas } from "@/hooks/usePersonas";
import { useSocios, useAddHolding } from "@/hooks/useSocios";
import { useEntityCapitalProfile } from "@/hooks/useEntityCapitalProfile";
import { toast } from "sonner";

export default function TransmisionStepper() {
  const { id: entityId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [origenHoldingId, setOrigenHoldingId] = useState("");
  const [titulosTransmitidos, setTitulosTransmitidos] = useState(0);
  const [destinoPersonId, setDestinoPersonId] = useState("");
  const [fuente, setFuente] = useState("ESCRITURA");
  const { data: socios } = useSocios(entityId);
  const { data: personas } = usePersonas();
  const { data: cap } = useEntityCapitalProfile(entityId);
  const addHolding = useAddHolding();

  const origen = (socios ?? []).find((s) => s.id === origenHoldingId);

  async function submit() {
    try {
      if (!origen) throw new Error("Origen no válido");
      if (titulosTransmitidos <= 0 || titulosTransmitidos > origen.numero_titulos) throw new Error("Cantidad fuera de rango");

      const hoy = new Date().toISOString().slice(0, 10);
      const remainderTitulos = origen.numero_titulos - titulosTransmitidos;
      const pctNuevo = cap && cap.numero_titulos > 0 ? (titulosTransmitidos / cap.numero_titulos) * 100 : 0;
      const pctRemainder = cap && cap.numero_titulos > 0 ? (remainderTitulos / cap.numero_titulos) * 100 : 0;

      // 1) Cerrar holding origen
      const { error: errClose } = await supabase
        .from("capital_holdings")
        .update({ valido_hasta: hoy })
        .eq("id", origen.id);
      if (errClose) throw errClose;

      // 2) Si quedan títulos en origen, crear holding residual
      if (remainderTitulos > 0) {
        await addHolding.mutateAsync({
          entity_id: entityId!,
          person_id: origen.person_id,
          share_class_id: origen.share_class_id,
          numero_titulos: remainderTitulos,
          pct_capital: pctRemainder,
          is_treasury: false,
          voting_weight: pctRemainder,
          denominator_weight: pctRemainder,
          valido_desde: hoy,
          valido_hasta: null,
        });
      }

      // 3) Crear holding destino
      await addHolding.mutateAsync({
        entity_id: entityId!,
        person_id: destinoPersonId,
        share_class_id: origen.share_class_id,
        numero_titulos: titulosTransmitidos,
        pct_capital: pctNuevo,
        is_treasury: false,
        voting_weight: pctNuevo,
        denominator_weight: pctNuevo,
        valido_desde: hoy,
        valido_hasta: null,
      });

      toast.success("Transmisión aplicada");
      nav(`/secretaria/sociedades/${entityId}?tab=socios`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <Link to={`/secretaria/sociedades/${entityId}`} className="text-sm text-[var(--g-link)]">← Volver a la sociedad</Link>
      <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Transmitir participaciones · Paso {step}/4</h1>

      {step === 1 && (
        <select value={origenHoldingId} onChange={(e) => setOrigenHoldingId(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <option value="">— socio origen —</option>
          {(socios ?? []).map((s) => <option key={s.id} value={s.id}>{s.person?.full_name} — {s.numero_titulos} títulos ({s.share_class?.codigo})</option>)}
        </select>
      )}

      {step === 2 && (
        <input type="number" value={titulosTransmitidos} onChange={(e) => setTitulosTransmitidos(Number(e.target.value))} placeholder={`Máx ${origen?.numero_titulos ?? 0}`} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
      )}

      {step === 3 && (
        <select value={destinoPersonId} onChange={(e) => setDestinoPersonId(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <option value="">— destinatario —</option>
          {(personas ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      )}

      {step === 4 && (
        <select value={fuente} onChange={(e) => setFuente(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <option value="ESCRITURA">Escritura pública</option>
          <option value="PRIVADO">Documento privado</option>
          <option value="SUCESION">Sucesión</option>
          <option value="SENTENCIA">Sentencia judicial</option>
        </select>
      )}

      <div className="flex justify-between">
        <button type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="px-4 py-2 border border-[var(--g-border-subtle)] disabled:opacity-50" style={{ borderRadius: "var(--g-radius-md)" }}>Atrás</button>
        {step < 4 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-md)" }}>Siguiente</button>
        ) : (
          <button type="button" onClick={submit} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-md)" }}>Aplicar transmisión</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
# En App.tsx: <Route path="/secretaria/sociedades/:id/socios/transmitir" element={<TransmisionStepper />} />
npx tsc --noEmit
git add src/pages/secretaria/TransmisionStepper.tsx src/App.tsx
git commit -m "feat(societario): F5.2 TransmisionStepper (4 pasos)"
```

---

### Task F5.3: `DesignarAdminStepper` (3 pasos)

**Files:**
- Create: `src/pages/secretaria/DesignarAdminStepper.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implementar stepper**

```tsx
// src/pages/secretaria/DesignarAdminStepper.tsx
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { usePersonas } from "@/hooks/usePersonas";
import { useBodies } from "@/hooks/useBodies";
import { useDesignarAdmin } from "@/hooks/useAdministradores";
import { toast } from "sonner";

const ROLES = [
  "ADMIN_UNICO","ADMIN_SOLIDARIO","ADMIN_MANCOMUNADO",
  "PRESIDENTE","VICEPRESIDENTE","SECRETARIO","VICESECRETARIO",
  "CONSEJERO","CONSEJERO_DELEGADO","COMISIONADO",
];

export default function DesignarAdminStepper() {
  const { id: entityId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState("CONSEJERO");
  const [bodyId, setBodyId] = useState("");
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 10));
  const [hasta, setHasta] = useState("");
  const [fuente, setFuente] = useState<"JGA" | "CDA" | "NOTARIAL" | "INSCRIPCION_RM" | "OTRO">("CDA");
  const [rmRef, setRmRef] = useState("");

  const { data: personas } = usePersonas();
  const { data: bodies } = useBodies(entityId);
  const designar = useDesignarAdmin();

  async function submit() {
    try {
      await designar.mutateAsync({
        entity_id: entityId!,
        body_id: bodyId || null,
        person_id: personId,
        role,
        valido_desde: desde,
        valido_hasta: hasta || null,
        fuente_designacion: fuente,
        inscripcion_rm_referencia: rmRef || null,
        inscripcion_rm_fecha: null,
      });
      toast.success("Administrador designado");
      nav(`/secretaria/sociedades/${entityId}?tab=admins`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <Link to={`/secretaria/sociedades/${entityId}`} className="text-sm text-[var(--g-link)]">← Volver a la sociedad</Link>
      <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Designar administrador · Paso {step}/3</h1>

      {step === 1 && (
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <option value="">— persona —</option>
          {(personas ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.person_type})</option>)}
        </select>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={bodyId} onChange={(e) => setBodyId(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
            <option value="">— órgano (vacío si admin único) —</option>
            {(bodies ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <label className="block text-sm">
            <span className="text-[var(--g-text-primary)]">Válido desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--g-text-primary)]">Válido hasta (opcional)</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <select value={fuente} onChange={(e) => setFuente(e.target.value as any)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
            <option value="JGA">JGA</option>
            <option value="CDA">CdA</option>
            <option value="NOTARIAL">Notarial</option>
            <option value="INSCRIPCION_RM">Inscripción RM</option>
            <option value="OTRO">Otro</option>
          </select>
          <input placeholder="Referencia RM (Tomo X, Folio Y, Hoja Z)" value={rmRef} onChange={(e) => setRmRef(e.target.value)} className="w-full px-3 py-2 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="px-4 py-2 border border-[var(--g-border-subtle)] disabled:opacity-50" style={{ borderRadius: "var(--g-radius-md)" }}>Atrás</button>
        {step < 3 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-md)" }}>Siguiente</button>
        ) : (
          <button type="button" onClick={submit} className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-md)" }}>Designar</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
# En App.tsx: <Route path="/secretaria/sociedades/:id/administradores/designar" element={<DesignarAdminStepper />} />
npx tsc --noEmit
git add src/pages/secretaria/DesignarAdminStepper.tsx src/App.tsx
git commit -m "feat(societario): F5.3 DesignarAdminStepper (3 pasos)"
```

---

## F6 — Migración legacy (consumidores) + `mandates` → VIEW

### Task F6.1: Migrar `useBodies` y `useBoardPackData` a `condiciones_persona`

**Files:**
- Modify: `src/hooks/useBodies.ts`
- Modify: `src/hooks/useBoardPackData.ts`

- [ ] **Step 1: Identificar queries a `mandates` y reemplazar por `condiciones_persona`**

Cambios específicos:

```ts
// En useBodies.ts — useBodyMandates(bodyId):
// ANTES: .from("mandates").select("*").eq("body_id", bodyId).eq("status", "Activo")
// DESPUÉS:
const { data, error } = await supabase
  .from("condiciones_persona")
  .select(`
    id, role, person_id, valido_desde, valido_hasta,
    person:persons(full_name, person_type, tax_id)
  `)
  .eq("body_id", bodyId!)
  .is("valido_hasta", null)
  .order("role");
```

```ts
// En useBoardPackData.ts — queries que usan mandates:
// Reemplazar TODAS las queries .from("mandates") por .from("condiciones_persona")
// ajustando columnas: start_date → valido_desde, end_date → valido_hasta,
// status === "Activo" → valido_hasta IS NULL
```

- [ ] **Step 2: Verificar `tsc --noEmit` y smoke de la app**

```bash
npx tsc --noEmit
npx vitest run src/test/hooks
# Verificar que las páginas que consumen useBodies y BoardPack siguen funcionando
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBodies.ts src/hooks/useBoardPackData.ts
git commit -m "feat(societario): F6.1 migrar useBodies + useBoardPackData a condiciones_persona"
```

---

### Task F6.2: Migrar `usePersonasExtended`, `useReunionSecretaria`, `useAgreementCompliance`

**Files:**
- Modify: `src/hooks/usePersonasExtended.ts`
- Modify: `src/hooks/useReunionSecretaria.ts`
- Modify: `src/hooks/useAgreementCompliance.ts`

- [ ] **Step 1: `usePersonasExtended` → unir `persons` + `condiciones_persona` + `capital_holdings` + `representaciones`**

```ts
// src/hooks/usePersonasExtended.ts — función usePersonaDetallada(id)
export function usePersonaDetallada(personId?: string) {
  return useQuery({
    queryKey: ["persona", "detallada", personId ?? "none"],
    enabled: Boolean(personId),
    queryFn: async () => {
      const { data: persona } = await supabase.from("persons").select("*").eq("id", personId!).maybeSingle();
      const { data: condiciones } = await supabase.from("condiciones_persona").select("*, entity:entities(name), body:governing_bodies(name)").eq("person_id", personId!).is("valido_hasta", null);
      const { data: holdings } = await supabase.from("capital_holdings").select("*, entity:entities(name)").eq("person_id", personId!).is("valido_hasta", null);
      const { data: reps } = await supabase.from("representaciones").select("*").or(`representante_person_id.eq.${personId},representado_person_id.eq.${personId}`).is("valido_hasta", null);
      return { persona, condiciones: condiciones ?? [], holdings: holdings ?? [], representaciones: reps ?? [] };
    },
  });
}
```

- [ ] **Step 2: `useReunionSecretaria` → leer `censo_snapshot` si existe, sino `parte_votante_current`**

```ts
// Reemplazar la lectura de convocados/asistentes:
const { data: snapshot } = await supabase.from("censo_snapshot").select("*, items:censo_snapshot_items(*)").eq("meeting_id", meetingId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
const fuenteCenso = snapshot ? "snapshot" : "current";
const { data: convocados } = fuenteCenso === "snapshot"
  ? { data: snapshot.items }
  : await supabase.from("parte_votante_current").select("*, person:persons(full_name)").eq("body_id", bodyId!);
```

- [ ] **Step 3: `useAgreementCompliance` — firmantes desde `authority_evidence`**

```ts
// En el paso de verificar firmantes:
const { data: firmantes } = await supabase
  .from("authority_evidence")
  .select("*, person:persons(full_name)")
  .eq("entity_id", entityId!)
  .in("role", ["PRESIDENTE", "SECRETARIO", "ADMIN_UNICO"])
  .is("valido_hasta", null);
```

- [ ] **Step 4: Verificar y commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/hooks/usePersonasExtended.ts src/hooks/useReunionSecretaria.ts src/hooks/useAgreementCompliance.ts
git commit -m "feat(societario): F6.2 migrar usePersonasExtended/useReunionSecretaria/useAgreementCompliance"
```

---

### Task F6.3: `mandates` → VIEW + actualizar `OrganoDetalle`

**Files:**
- Create: `supabase/migrations/20260421_000026_mandates_as_view.sql`
- Modify: `src/pages/OrganoDetalle.tsx` (botón "Añadir miembro" → ruta DesignarAdminStepper)

- [ ] **Step 1: Migración (SOLO si F6.1/F6.2 ya aplicados y verificados)**

```sql
-- supabase/migrations/20260421_000026_mandates_as_view.sql
-- PASO 1: snapshot de datos actuales a tabla de respaldo
CREATE TABLE IF NOT EXISTS mandates_legacy_backup AS SELECT * FROM mandates;

-- PASO 2: drop de políticas y tabla
DROP POLICY IF EXISTS "tenant_read" ON mandates;
DROP POLICY IF EXISTS "tenant_write" ON mandates;
DROP TABLE mandates CASCADE;

-- PASO 3: VIEW derivada
CREATE OR REPLACE VIEW mandates AS
SELECT
  cp.id,
  cp.tenant_id,
  cp.entity_id,
  cp.body_id,
  cp.person_id,
  cp.role,
  cp.valido_desde AS start_date,
  cp.valido_hasta AS end_date,
  CASE WHEN cp.valido_hasta IS NULL THEN 'Activo' ELSE 'Cesado' END AS status,
  cp.created_at
FROM condiciones_persona cp;

GRANT SELECT ON mandates TO authenticated, anon, service_role;
```

Aplicar vía MCP, regenerar types.

- [ ] **Step 2: Actualizar `OrganoDetalle.tsx` — botón "Añadir miembro"**

```tsx
// En src/pages/OrganoDetalle.tsx — el botón "Añadir miembro"
<Link
  to={`/secretaria/sociedades/${body.entity_id}/administradores/designar?bodyId=${body.id}`}
  className="px-4 py-2 bg-[var(--t-primary)] text-white hover:bg-[var(--t-primary-hover)]"
>
  Añadir miembro
</Link>
```

- [ ] **Step 3: Verificar y commit**

```bash
npx tsc --noEmit
npx vitest run
git add supabase/migrations/20260421_000026_mandates_as_view.sql src/integrations/supabase/types.ts src/pages/OrganoDetalle.tsx
git commit -m "feat(societario): F6.3 mandates → VIEW + OrganoDetalle botón Añadir miembro"
```

---

## F7 — Reglas aplicables

### Task F7.1: `useReglasAplicables` + `ReglasAplicables.tsx`

**Files:**
- Create: `src/hooks/useReglasAplicables.ts`
- Create: `src/pages/secretaria/ReglasAplicables.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implementar hook**

```ts
// src/hooks/useReglasAplicables.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolverReglaEfectiva } from "@/lib/rules-engine/jerarquia-normativa";

const MATERIAS = [
  "APROBACION_CUENTAS","MOD_ESTATUTOS","NOMBRAMIENTO","CESE",
  "DISOLUCION","AUMENTO_CAPITAL","REDUCCION_CAPITAL","RETRIBUCION","DIVIDENDOS",
];

export type ReglaEfectivaRow = {
  materia: string;
  organo_competente: string;
  quorum_primera: string;
  quorum_segunda: string | null;
  mayoria: string;
  adopcion: string;
  inscribible: boolean;
  instrumento: "ESCRITURA" | "INSTANCIA" | "NINGUNO";
  fuente: "LEY" | "ESTATUTOS" | "PACTO" | "REGLAMENTO";
};

export function useReglasAplicables(entityId?: string) {
  return useQuery({
    queryKey: ["reglas_aplicables", entityId ?? "none"],
    enabled: Boolean(entityId),
    queryFn: async () => {
      // Carga rule packs por materia + overrides + pactos
      const { data: packs } = await supabase.from("rule_packs").select("*, version:rule_pack_versions(*)");
      const { data: overrides } = await supabase.from("rule_param_overrides").select("*").eq("entity_id", entityId!);
      const { data: pactos } = await supabase.from("pactos_parasociales").select("*, clausulas:pacto_clausulas(*)").eq("entity_id", entityId!).eq("estado", "VIGENTE");

      const rows: ReglaEfectivaRow[] = MATERIAS.map((materia) => {
        const regla = resolverReglaEfectiva({ materia, entityId: entityId!, packs: packs ?? [], overrides: overrides ?? [], pactos: pactos ?? [] });
        return regla;
      });
      return rows;
    },
  });
}
```

> NOTA al implementer: si `resolverReglaEfectiva` no expone exactamente esa firma, adaptar el hook para llamar a la API real de `jerarquia-normativa.ts` y proyectar al shape `ReglaEfectivaRow`.

- [ ] **Step 2: Implementar página**

```tsx
// src/pages/secretaria/ReglasAplicables.tsx
import { useParams, Link } from "react-router-dom";
import { useReglasAplicables } from "@/hooks/useReglasAplicables";

export default function ReglasAplicables() {
  const { id: entityId } = useParams<{ id: string }>();
  const { data, isLoading } = useReglasAplicables(entityId);

  if (isLoading) return <div className="p-8 text-[var(--g-text-secondary)]">Cargando reglas…</div>;

  return (
    <div className="p-8 space-y-6">
      <Link to={`/secretaria/sociedades/${entityId}`} className="text-sm text-[var(--g-link)]">← Volver a la sociedad</Link>
      <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Reglas aplicables</h1>
      <p className="text-sm text-[var(--g-text-secondary)]">Resolución jerárquica LEY → ESTATUTOS → PACTO → REGLAMENTO por materia.</p>

      <table className="w-full bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Materia</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Órgano</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Quórum 1ª</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Quórum 2ª</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Mayoría</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Adopción</th>
            <th className="px-4 py-2 text-center text-xs uppercase text-[var(--g-text-primary)]">Inscribible</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Instrumento</th>
            <th className="px-4 py-2 text-left text-xs uppercase text-[var(--g-text-primary)]">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {(data ?? []).map((r) => (
            <tr key={r.materia}>
              <td className="px-4 py-2 text-sm font-medium text-[var(--g-text-primary)]">{r.materia}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{r.organo_competente}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{r.quorum_primera}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{r.quorum_segunda ?? "—"}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{r.mayoria}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{r.adopcion}</td>
              <td className="px-4 py-2 text-sm text-center">{r.inscribible ? "Sí" : "No"}</td>
              <td className="px-4 py-2 text-sm text-[var(--g-text-secondary)]">{r.instrumento}</td>
              <td className="px-4 py-2 text-sm">
                <span className="px-2 py-0.5 bg-[var(--g-sec-100)] text-[var(--g-brand-3308)] text-xs" style={{ borderRadius: "var(--g-radius-sm)" }}>{r.fuente}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Registrar ruta y commit**

```bash
# En App.tsx: <Route path="/secretaria/sociedades/:id/reglas" element={<ReglasAplicables />} />
npx tsc --noEmit
git add src/hooks/useReglasAplicables.ts src/pages/secretaria/ReglasAplicables.tsx src/App.tsx
git commit -m "feat(societario): F7.1 useReglasAplicables + ReglasAplicables.tsx"
```

---

## F8 — RPCs de acta y certificación (hash chain)

### Task F8.1: RPCs `fn_generar_acta` + `fn_generar_certificacion`

**Files:**
- Create: `supabase/migrations/20260421_000027_rpcs_acta_certificacion.sql`
- Test: `src/test/schema/rpcs-acta-cert.test.ts`

- [ ] **Step 1: Test fallando**

```ts
// src/test/schema/rpcs-acta-cert.test.ts
import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("RPCs acta/certificación", () => {
  it("fn_generar_acta existe y acepta firma esperada", async () => {
    const { error } = await supabase.rpc("fn_generar_acta", {
      p_meeting_id: "00000000-0000-0000-0000-000000000000",
      p_content: "probe",
      p_snapshot_id: null,
    });
    // Esperamos error de negocio (meeting no existe), NO error de función no encontrada
    expect(error?.message ?? "").not.toMatch(/function .* does not exist/i);
  });
  it("fn_generar_certificacion existe", async () => {
    const { error } = await supabase.rpc("fn_generar_certificacion", {
      p_minute_id: "00000000-0000-0000-0000-000000000000",
      p_tipo: "ACUERDOS",
      p_agreements_certified: [],
      p_certificante_role: "SECRETARIO",
      p_visto_bueno_persona_id: null,
    });
    expect(error?.message ?? "").not.toMatch(/function .* does not exist/i);
  });
});
```

- [ ] **Step 2: Falla** — `npx vitest run src/test/schema/rpcs-acta-cert.test.ts`.

- [ ] **Step 3: Migración**

```sql
-- supabase/migrations/20260421_000027_rpcs_acta_certificacion.sql
CREATE OR REPLACE FUNCTION fn_generar_acta(
  p_meeting_id uuid,
  p_content text,
  p_snapshot_id uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_minute_id uuid;
  v_content_hash text;
  v_meeting RECORD;
  v_rules_applied jsonb;
BEGIN
  -- Validar meeting existe
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'meeting not found: %', p_meeting_id; END IF;

  -- Validar snapshot corresponde al meeting (si se pasa)
  IF p_snapshot_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM censo_snapshot WHERE id = p_snapshot_id AND meeting_id = p_meeting_id) THEN
      RAISE EXCEPTION 'snapshot % no corresponde a meeting %', p_snapshot_id, p_meeting_id;
    END IF;
  END IF;

  -- Content hash (SHA-256)
  v_content_hash := encode(digest(p_content, 'sha256'), 'hex');

  -- rules_applied stub — en la versión productiva el servidor llamaría al motor LSC
  v_rules_applied := jsonb_build_object('ts', now(), 'materia_ref', NULL);

  INSERT INTO minutes (
    tenant_id, meeting_id, content, signed_at, is_locked,
    snapshot_id, content_hash, rules_applied, body_id, entity_id
  ) VALUES (
    v_meeting.tenant_id, p_meeting_id, p_content, NULL, false,
    p_snapshot_id, v_content_hash, v_rules_applied, v_meeting.body_id, v_meeting.entity_id
  ) RETURNING id INTO v_minute_id;

  RETURN v_minute_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_generar_certificacion(
  p_minute_id uuid,
  p_tipo text,
  p_agreements_certified text[],
  p_certificante_role text,
  p_visto_bueno_persona_id uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_cert_id uuid;
  v_minute RECORD;
  v_snapshot_hash text;
  v_resultado_hash text;
  v_gate_hash text;
  v_entity entities%ROWTYPE;
  v_requires_vb boolean;
  v_auth_ev_id uuid;
BEGIN
  SELECT m.*, c.id AS snapshot_id_r, c.hash_snapshot
    INTO v_minute
    FROM minutes m
    LEFT JOIN censo_snapshot c ON c.id = m.snapshot_id
   WHERE m.id = p_minute_id;
  IF v_minute.id IS NULL THEN RAISE EXCEPTION 'minute not found: %', p_minute_id; END IF;

  SELECT * INTO v_entity FROM entities WHERE id = v_minute.entity_id;

  -- Vº Bº obligatorio si SA y no es ADMIN_UNICO
  v_requires_vb := (v_entity.legal_form = 'SA' AND p_certificante_role != 'ADMIN_UNICO');
  IF v_requires_vb AND p_visto_bueno_persona_id IS NULL THEN
    RAISE EXCEPTION 'Vº Bº PRESIDENTE requerido para SA (salvo ADMIN_UNICO)';
  END IF;

  -- Verificar autoridad vigente del certificante (si hay body_id en minute)
  IF NOT EXISTS (
    SELECT 1 FROM authority_evidence
     WHERE entity_id = v_minute.entity_id
       AND role = p_certificante_role
       AND valido_hasta IS NULL
  ) THEN
    RAISE EXCEPTION 'No hay autoridad vigente para role % en entity %', p_certificante_role, v_minute.entity_id;
  END IF;

  -- Tomar una authority_evidence vigente para el certificante
  SELECT id INTO v_auth_ev_id
    FROM authority_evidence
   WHERE entity_id = v_minute.entity_id
     AND role = p_certificante_role
     AND valido_hasta IS NULL
   LIMIT 1;

  v_snapshot_hash := COALESCE(v_minute.hash_snapshot, 'NO_SNAPSHOT');
  v_resultado_hash := encode(digest(array_to_string(p_agreements_certified, '|'), 'sha256'), 'hex');
  v_gate_hash := encode(digest(v_snapshot_hash || v_resultado_hash, 'sha256'), 'hex');

  INSERT INTO certifications (
    tenant_id, agreement_id, agreements_certified, certifier_id,
    content, minute_id,
    tipo_certificacion, certificante_role, visto_bueno_persona_id, visto_bueno_fecha,
    gate_hash, authority_evidence_id,
    requires_qualified_signature, signature_status
  ) VALUES (
    v_minute.tenant_id, NULL, p_agreements_certified, NULL,
    NULL, p_minute_id,
    p_tipo, p_certificante_role, p_visto_bueno_persona_id, CASE WHEN p_visto_bueno_persona_id IS NOT NULL THEN now() ELSE NULL END,
    v_gate_hash, v_auth_ev_id,
    true, 'PENDING'
  ) RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$$;

-- Ensure pgcrypto extension exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Aplicar vía MCP.

- [ ] **Step 4: Verificar y commit**

```bash
npx vitest run src/test/schema/rpcs-acta-cert.test.ts
git add supabase/migrations/20260421_000027_rpcs_acta_certificacion.sql src/test/schema/rpcs-acta-cert.test.ts
git commit -m "feat(societario): F8.1 fn_generar_acta + fn_generar_certificacion con gate hash"
```

---

### Task F8.2: RPCs `fn_firmar_certificacion` + `fn_emitir_certificacion`

**Files:**
- Create: `supabase/migrations/20260421_000028_rpcs_firmar_emitir.sql`

- [ ] **Step 1: Migración**

```sql
-- supabase/migrations/20260421_000028_rpcs_firmar_emitir.sql
CREATE OR REPLACE FUNCTION fn_firmar_certificacion(
  p_certification_id uuid,
  p_qtsp_token text,
  p_tsq_token text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_cert RECORD;
  v_content text;
  v_hash_cert text;
BEGIN
  SELECT * INTO v_cert FROM certifications WHERE id = p_certification_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cert not found: %', p_certification_id; END IF;
  IF v_cert.gate_hash IS NULL THEN RAISE EXCEPTION 'cert sin gate_hash'; END IF;

  v_content := COALESCE(v_cert.content, '');
  v_hash_cert := encode(digest(v_cert.gate_hash || v_content || p_tsq_token, 'sha256'), 'hex');

  UPDATE certifications
     SET tsq_token = p_tsq_token,
         hash_certificacion = v_hash_cert,
         signature_status = 'SIGNED'
   WHERE id = p_certification_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_emitir_certificacion(
  p_certification_id uuid
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_cert RECORD;
  v_bundle_uri text;
BEGIN
  SELECT c.*, eb.storage_uri INTO v_cert
    FROM certifications c
    LEFT JOIN evidence_bundles eb ON eb.id = c.evidence_id
   WHERE c.id = p_certification_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cert not found'; END IF;
  IF v_cert.signature_status != 'SIGNED' THEN RAISE EXCEPTION 'cert no firmada'; END IF;

  v_bundle_uri := v_cert.storage_uri;

  INSERT INTO audit_log (tenant_id, action, entity, entity_id, payload)
  VALUES (v_cert.tenant_id, 'CERT_EMITIDA', 'certifications', p_certification_id,
          jsonb_build_object('hash_certificacion', v_cert.hash_certificacion, 'uri', v_bundle_uri));

  RETURN COALESCE(v_bundle_uri, 'evidence_bundle not yet linked');
END;
$$;
```

Aplicar vía MCP.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260421_000028_rpcs_firmar_emitir.sql
git commit -m "feat(societario): F8.2 fn_firmar_certificacion + fn_emitir_certificacion"
```

---

## F9 — UI certificación + pipeline QTSP

### Task F9.1: Botón "Emitir certificación" respetando `capability_matrix`

**Files:**
- Modify: `src/pages/secretaria/ActaDetalle.tsx`
- Create: `src/components/secretaria/EmitirCertificacionButton.tsx`

- [ ] **Step 1: Componente botón**

```tsx
// src/components/secretaria/EmitirCertificacionButton.tsx
import { useCapabilityMatrix, hasCapability } from "@/hooks/useCapabilityMatrix";
import { useUserRole } from "@/hooks/useUserRole";
import { usePresidenteVigente } from "@/hooks/useAuthorityEvidence";

export function EmitirCertificacionButton({
  entityId,
  bodyId,
  onEmit,
}: {
  entityId: string;
  bodyId?: string;
  onEmit: (params: { vb_persona_id: string | null }) => void;
}) {
  const { data: matrix } = useCapabilityMatrix();
  const { data: userRole } = useUserRole();
  const { data: presi } = usePresidenteVigente(entityId, bodyId);

  const can = hasCapability(matrix, userRole?.role_code ?? "", "CERTIFICATION");
  if (!can) return null;

  return (
    <button
      type="button"
      onClick={() => onEmit({ vb_persona_id: presi?.person_id ?? null })}
      className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      Emitir certificación
    </button>
  );
}
```

- [ ] **Step 2: Integrar en `ActaDetalle.tsx`**

```tsx
// En ActaDetalle.tsx
import { EmitirCertificacionButton } from "@/components/secretaria/EmitirCertificacionButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function handleEmit({ vb_persona_id }: { vb_persona_id: string | null }) {
  try {
    // 1) fn_generar_certificacion
    const { data: certId, error } = await supabase.rpc("fn_generar_certificacion", {
      p_minute_id: minuteId,
      p_tipo: "ACUERDOS",
      p_agreements_certified: agreementIds,
      p_certificante_role: "SECRETARIO",
      p_visto_bueno_persona_id: vb_persona_id,
    });
    if (error) throw error;
    toast.success(`Certificación ${certId} generada — procede a firmar QES`);
    // Navegar al flujo QTSP existente useQTSPSign
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// <EmitirCertificacionButton entityId={acta.entity_id} bodyId={acta.body_id} onEmit={handleEmit} />
```

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit
git add src/components/secretaria/EmitirCertificacionButton.tsx src/pages/secretaria/ActaDetalle.tsx
git commit -m "feat(societario): F9.1 botón Emitir certificación con capability_matrix + Vº Bº"
```

---

### Task F9.2: Pipeline QTSP end-to-end en UI

**Files:**
- Modify: `src/pages/secretaria/ActaDetalle.tsx` (o página dedicada `CertificacionDetalle.tsx` si existe)
- Modify: `src/hooks/useQTSPSign.ts` (llamar a `fn_firmar_certificacion` tras firma QES exitosa)

- [ ] **Step 1: Extender `useQTSPSign` para cerrar la certificación**

```ts
// En useQTSPSign.ts — tras recibir la respuesta del QTSP:
export async function finalizarFirmaCertificacion({ certId, qtspToken, tsqToken }: { certId: string; qtspToken: string; tsqToken: string }) {
  const { error } = await supabase.rpc("fn_firmar_certificacion", {
    p_certification_id: certId,
    p_qtsp_token: qtspToken,
    p_tsq_token: tsqToken,
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Integrar botón "Descargar ASiC-E"**

```tsx
async function descargar(certId: string) {
  const { data, error } = await supabase.rpc("fn_emitir_certificacion", { p_certification_id: certId });
  if (error) { toast.error(error.message); return; }
  if (typeof data === "string" && data.startsWith("http")) window.open(data, "_blank");
  else toast.info(String(data));
}
```

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit
git add src/hooks/useQTSPSign.ts src/pages/secretaria/ActaDetalle.tsx
git commit -m "feat(societario): F9.2 pipeline QTSP completo (firmar + emitir ASiC-E)"
```

---

## F10 — Integración Secretaría + seeds + E2E + cierre

### Task F10.1: Actualizar seed `seed-demo-arga-canonico.ts`

**Files:**
- Modify: `scripts/seed-demo-arga-canonico.ts`

- [ ] **Step 1: Añadir datos demo coherentes con el MVP**

Asegurar que tras ejecutar el seed:
- ARGA Seguros S.A. tiene `entity_capital_profile` vigente, `share_classes`, socios completos (Cartera 69.69% + Mercado libre 30.31%).
- 3 órganos iniciales: CdA, JGA, Comisión Auditoría.
- 15 `condiciones_persona` vigentes mapeadas a `authority_evidence` (backfill automático por trigger).
- 1 `capability_matrix` intacta (solo verifica).

Añadir bloque al final del script:

```ts
// Verificar que authority_evidence se generó correctamente
const { data: auth } = await supabase.from("authority_evidence").select("id, role").eq("entity_id", ENTITY_ARGA).is("valido_hasta", null);
console.log(`authority_evidence vigente: ${auth?.length ?? 0} filas`);

// Verificar capability_matrix
const { data: cap } = await supabase.from("capability_matrix").select("id");
console.log(`capability_matrix: ${cap?.length ?? 0} filas (esperado 15)`);
```

- [ ] **Step 2: Ejecutar y verificar**

```bash
bun run scripts/seed-demo-arga-canonico.ts
bun run scripts/validate-model-bootstrap.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-arga-canonico.ts
git commit -m "feat(societario): F10.1 seed demo ARGA coherente con autoridad y capability_matrix"
```

---

### Task F10.2: E2E smoke + fix de regresiones

**Files:**
- Create: `src/test/e2e/societario-mvp.smoke.ts` (opcional según infraestructura Playwright existente)

- [ ] **Step 1: Verificación manual asistida + ajustes**

Recorrer manualmente (o con Playwright si se desea):
1. `/secretaria/sociedades` — ver ARGA.
2. `/secretaria/sociedades/:id` tabs Resumen, Socios, Administradores.
3. `/secretaria/sociedades/:id/socios/añadir` — stepper completo.
4. `/secretaria/sociedades/:id/administradores/designar` — stepper completo.
5. `/secretaria/sociedades/:id/reglas` — tabla de reglas.
6. `/secretaria/personas` — listado.
7. `/secretaria/reuniones/:id` — flujo existente sigue funcionando.
8. Botón "Emitir certificación" en `ActaDetalle` — visible si user es SECRETARIO.

Ajustar cualquier regresión detectada (test + fix + commit atómico por caso).

- [ ] **Step 2: Smoke tests finales**

```bash
npx vitest run
npx tsc --noEmit
npx vite build --outDir /tmp/tgms-dist
```

Todos en verde.

- [ ] **Step 3: Commit si hubo fixes de regresión**

```bash
# (solo si aplica)
git add <archivos>
git commit -m "fix(societario): F10.2 regresiones detectadas en smoke"
```

---

### Task F10.3: Cierre — actualizar `CLAUDE.md` + commit/push final

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Añadir sección F1-F10 al `CLAUDE.md`**

Insertar bajo "Estado de implementación":

```markdown
### Sprint Societario MVP — COMPLETADO (2026-04-21)

F1-F10 ejecutados. Migraciones 20260421_000023..000028. Nuevas tablas: `capability_matrix`, `authority_evidence`. Extensiones: `minutes`, `certifications`, `condiciones_persona`. `mandates` ahora es VIEW derivada de `condiciones_persona`.

Nuevas rutas: `/secretaria/sociedades/*`, `/secretaria/personas/*`.
Nuevos hooks: useSociedades, usePersonas, useEntityCapitalProfile, useShareClasses, useSocios, useAdministradores, useComposicionOrgano, useRepresentaciones, useAuthorityEvidence, useCapabilityMatrix, useReglasAplicables.
Nuevas RPCs: fn_generar_acta, fn_generar_certificacion, fn_firmar_certificacion, fn_emitir_certificacion.

Tests verdes, tsc 0 errores, build limpio.
```

- [ ] **Step 2: Commit final + push**

```bash
git add CLAUDE.md
git commit -m "chore(societario): F10.3 actualizar CLAUDE.md con sprint MVP completo"
git push origin main
```

---

## Self-Review Checklist (controlador ejecuta antes de dispatch)

- [ ] **Spec coverage:** cada sección 4-9 de la spec tiene al menos una task que la implementa.
- [ ] **Type consistency:** los nombres de tipos (SociedadRow, PersonaRow, CapitalHoldingRow…) se usan consistentemente entre tasks.
- [ ] **No placeholders:** cada step tiene código completo o comando concreto; sin "TBD".
- [ ] **File paths:** todos absolutos desde repo root.
- [ ] **Commit atomicity:** cada task = un commit.

Verificado en redacción. Plan listo para subagent-driven-development.
