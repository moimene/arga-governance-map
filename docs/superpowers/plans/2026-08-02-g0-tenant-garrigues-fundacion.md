# G0 — Fundación del tenant Garrigues + theming total por tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el tenant Garrigues en `governance_OS` con theming completo por tenant (shell incluido), usuarios demo propios y aislamiento RLS probado bidireccionalmente — con ARGA pixel-idéntica.

**Architecture:** Columna `tenants.branding jsonb` (NULL = marca por defecto actual) + `TenantBrandProvider` que aplica tokens CSS sobre `document.documentElement` al resolver el tenant post-login. Los 3 hardcodes de marca (ShellLayout, SiiLayout, Login) pasan a leer branding con los strings actuales como default verbatim. Login es pre-auth (no hay tenant): usa un mapa estático local seleccionado por `?tenant=`. Seeds vía script service-role idempotente con dry-run.

**Tech Stack:** React 18 + TS relajado, TanStack Query v5, Supabase JS v2, bun, vitest (bajo `bun test`).

**Spec:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` (§4 G0).

## Global Constraints

- **Antes de CUALQUIER paso Supabase:** `bun run db:check-target` y confirmar `governance_OS` (`hzqwefkwsxopwrmtksbg`). Sin pass, no se sigue.
- **Canal Cloud:** MCP `apply_migration` / `execute_sql` (o Management API). **NUNCA** `supabase db push` ni `migration repair` (drift de junio, ver `[[project-migrations-drift-junio]]`).
- **Todo DDL con espejo** en `supabase/migrations/` con timestamp `202608021200XX_*.sql`.
- **ARGA intacta:** `tenants.branding` de ARGA queda `NULL`; todos los defaults de labels son los strings actuales **verbatim**. Criterio: cero cambio visual para el usuario ARGA.
- **IDs fijos:** tenant Garrigues = `00000000-0000-0000-0000-000000000002`. Tenant ARGA = `...0001` (no tocar).
- **Emails demo en dominio ficticio** `garrigues-demo.dev` — jamás el dominio real `garrigues.com`. Password demo: `TGMSdemo2026!` (paridad con ARGA).
- **`SUPABASE_SERVICE_ROLE_KEY` solo por variable de entorno.** Nunca en código ni commits. Script con dry-run por defecto y `--commit` explícito.
- **TypeScript relajado** (`noImplicitAny: false`, `strictNullChecks: false`): no añadir anotaciones donde no existían. Gate real: `bun run typecheck` (tsc -b), NO `bunx tsc --noEmit`.
- **`git add` de rutas específicas** — el árbol compartido tiene ~370 ficheros ajenos tocados. Jamás `git add -A`.
- Commits en castellano terminados en `Co-Authored-By: claude-flow <ruv@ruv.net>`.
- **No tocar el schema `sii.*`** (solo UI/labels). No escribir en `governance_module_events`/`governance_module_links`.
- Gestor de paquetes: **bun**. Tests de un fichero: `bun test <ruta>`.
- Los tipos generados de Supabase **no** se regeneran en G0 (ficheros enormes en árbol compartido): el acceso a `tenants.branding` desde el cliente tipado se hace con cast local vía `unknown` (patrón documentado en Task 3).

---

### Task 1: Migración `tenants.branding jsonb`

**Files:**
- Create: `supabase/migrations/20260802120000_tenants_branding.sql`

**Interfaces:**
- Produces: columna `public.tenants.branding jsonb` (NULL = defaults). Legible por `authenticated` vía policy existente `tenants_public_read` (SELECT USING true, `20260419173010_b1_rls_all_domain_tables.sql:235`); sin policy de escritura → escritura solo service-role. **No se crean policies nuevas.**

- [ ] **Step 1: Verificar target**

Run: `bun run db:check-target`
Expected: pass contra `governance_OS` (`hzqwefkwsxopwrmtksbg`). Si falla, STOP.

- [ ] **Step 2: Escribir la migración espejo**

```sql
-- 20260802120000_tenants_branding.sql
-- G0 tenant Garrigues (spec 2026-08-02-garrigues-tenant-gobernanza-design.md §4 G0).
-- Perfil de marca por tenant, leído por TenantBrandProvider tras el login.
-- NULL = marca por defecto del producto (ARGA/TGMS actual): cero cambio visual.
-- Lectura: cubierta por la policy existente tenants_public_read (SELECT USING true).
-- Escritura: sin policy → solo service-role. Forward-only.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS branding jsonb;

COMMENT ON COLUMN public.tenants.branding IS
  'Perfil de marca por tenant: {nombre, shell_label, scope_label, sii_org_label, tokens: {"--css-var": "valor"}}. NULL = defaults del producto (ARGA/TGMS).';
```

- [ ] **Step 3: Aplicar en Cloud**

Vía MCP: `apply_migration` con `name: "tenants_branding"` y el SQL del Step 2 como `query`. (Si `apply_migration` no está disponible, `execute_sql` con el mismo SQL + INSERT manual de la versión `20260802120000` en `supabase_migrations.schema_migrations`, patrón de julio.)

- [ ] **Step 4: Verificar columna y registro**

Vía MCP `execute_sql`:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'branding';
```

Expected: 1 fila, `jsonb`.

```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3;
```

Expected: incluye `20260802120000`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260802120000_tenants_branding.sql
git commit -m "feat(g0): columna tenants.branding para theming por tenant

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 2: Seed service-role — tenant Garrigues + usuarios demo + RBAC

**Files:**
- Create: `scripts/seed-garrigues-tenant.ts`
- Modify: `scripts/README-seed.md` (añadir sección al final)

**Interfaces:**
- Consumes: columna `tenants.branding` (Task 1); `rbac_roles.code` existentes (`SECRETARIO`, `ADMIN_TENANT`).
- Produces: fila `tenants` id `00000000-0000-0000-0000-000000000002` con `branding` poblado; auth users `demo@garrigues-demo.dev` (SECRETARIO) y `admin@garrigues-demo.dev` (ADMIN_TENANT) con `user_profiles` (tenant Garrigues, `entity_id` NULL — aún no hay entidades) y `rbac_user_roles` activos. **Los tests de Task 6 y el login de Task 5 dependen de estos emails/IDs exactos.**

- [ ] **Step 1: Escribir el script**

```typescript
#!/usr/bin/env bun
/**
 * Seed G0 — Tenant Garrigues: fila `tenants` + branding + usuarios demo + RBAC.
 * Spec: docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md §4 G0.
 *
 * Uso:
 *   bun run scripts/seed-garrigues-tenant.ts            # dry-run (imprime plan, no escribe)
 *   bun run scripts/seed-garrigues-tenant.ts --commit   # ejecuta
 *
 * - Service-role: usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS). Solo CLI, nunca UI.
 * - Idempotente: re-ejecutar con --commit no duplica nada (upsert/select-then-insert).
 * - Guard de target: aborta si la URL no es governance_OS.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COMMIT = process.argv.includes("--commit");

const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";
export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";

const DEMO_PASSWORD = "TGMSdemo2026!";
const USERS = [
  { email: "demo@garrigues-demo.dev", role: "SECRETARIO" },
  { email: "admin@garrigues-demo.dev", role: "ADMIN_TENANT" },
];

// Paleta Garrigues (CLAUDE.md §Design Systems, valores verbatim) mapeada a los
// tokens --t-* del shell + overrides shadcn/sidebar de :root (src/index.css).
const BRANDING = {
  nombre: "Garrigues",
  shell_label: "GARRIGUES GOBERNANZA",
  scope_label: "Grupo Garrigues",
  sii_org_label: "Garrigues",
  tokens: {
    "--t-brand": "#004438",
    "--t-brand-hover": "#007362",
    "--t-brand-bright": "#009a77",
    "--t-surface-subtle": "#d8ece7",
    "--t-sec-primary": "#6dc1b0",
    "--t-surface-page": "#f0f0f0",
    "--t-surface-card": "#ffffff",
    "--t-surface-muted": "hsl(60, 1%, 88%)",
    "--t-text-primary": "#4a4a49",
    "--t-text-secondary": "#50564f",
    "--t-text-inverse": "#ffffff",
    "--t-border-default": "#b7bfb0",
    "--t-border-subtle": "#b9babb",
    "--t-border-focus": "#004438",
    "--t-status-success": "#009a77",
    "--t-status-warning": "#878989",
    "--t-status-error": "hsl(0, 84%, 60%)",
    "--t-status-info": "#596f7b",
    "--t-sidebar-bg": "#004438",
    "--t-sidebar-fg": "#FFFFFF",
    "--t-sidebar-active": "rgba(255,255,255,0.20)",
    "--t-sidebar-hover": "rgba(255,255,255,0.12)",
    "--t-sidebar-label": "rgba(255,255,255,0.55)",
    "--t-sidebar-scope-bg": "rgba(255,255,255,0.12)",
    "--primary": "168 100% 13%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "165 34% 89%",
    "--accent-foreground": "168 100% 13%",
    "--ring": "168 100% 13%",
    "--sidebar-background": "168 100% 13%",
    "--sidebar-foreground": "0 0% 100%",
  },
};

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) {
  fail(`Target inesperado (${SUPABASE_URL}) — este seed solo corre contra governance_OS.`);
}
if (!SERVICE_KEY) fail("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  // 1) Referencia ARGA: el schema manda (tenant_type se copia, no se inventa).
  const { data: arga, error: eArga } = await admin
    .from("tenants").select("*").eq("id", ARGA_TENANT).maybeSingle();
  if (eArga) fail(`Leyendo tenant ARGA: ${eArga.message}`);
  if (!arga) fail("No existe el tenant ARGA de referencia — target equivocado.");

  // 2) Roles RBAC por code.
  const roleCodes = USERS.map((u) => u.role);
  const { data: roles, error: eRoles } = await admin
    .from("rbac_roles").select("id, code").in("code", roleCodes);
  if (eRoles) fail(`Leyendo rbac_roles: ${eRoles.message}`);
  const roleByCode = new Map((roles ?? []).map((r) => [r.code, r.id]));
  for (const code of roleCodes) {
    if (!roleByCode.has(code)) fail(`rbac_roles sin code=${code}`);
  }

  // 3) Plan (dry-run visible siempre).
  const { data: existingTenant } = await admin
    .from("tenants").select("id").eq("id", GARRIGUES_TENANT).maybeSingle();
  const plan = [
    {
      accion: existingTenant
        ? "tenants: UPDATE branding (fila ya existe)"
        : "tenants: INSERT fila Garrigues + branding",
    },
  ];
  for (const u of USERS) {
    const existing = await findUserByEmail(u.email);
    plan.push({
      accion: `${u.email}: ${existing ? "reutiliza auth user" : "crea auth user"} + perfil ${u.role} + rbac_user_roles`,
    });
  }
  console.table(plan);
  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar.");
    return;
  }

  // 4) Tenant + branding.
  const { error: eUp } = await admin.from("tenants").upsert(
    {
      id: GARRIGUES_TENANT,
      name: "Garrigues",
      tenant_type: arga.tenant_type,
      country_code: "ES",
      is_active: true,
      branding: BRANDING,
    },
    { onConflict: "id" },
  );
  if (eUp) fail(`Upsert tenant: ${eUp.message}`);
  console.log(`✓ tenants ${GARRIGUES_TENANT} (branding poblado)`);

  // 5) Usuarios + perfiles + roles.
  for (const u of USERS) {
    let userId = await findUserByEmail(u.email);
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) fail(`createUser ${u.email}: ${error.message}`);
      userId = data.user.id;
    }

    const { data: prof, error: eProf } = await admin
      .from("user_profiles").select("id").eq("user_id", userId).maybeSingle();
    if (eProf) fail(`Leyendo user_profiles ${u.email}: ${eProf.message}`);
    if (prof) {
      const { error } = await admin
        .from("user_profiles")
        .update({ tenant_id: GARRIGUES_TENANT, role_code: u.role })
        .eq("user_id", userId);
      if (error) fail(`update user_profiles ${u.email}: ${error.message}`);
    } else {
      const { error } = await admin
        .from("user_profiles")
        .insert({ user_id: userId, tenant_id: GARRIGUES_TENANT, role_code: u.role });
      if (error) fail(`insert user_profiles ${u.email}: ${error.message}`);
    }

    const roleId = roleByCode.get(u.role);
    const { data: link, error: eLink } = await admin
      .from("rbac_user_roles").select("id")
      .eq("user_id", userId).eq("role_id", roleId).eq("tenant_id", GARRIGUES_TENANT)
      .maybeSingle();
    if (eLink) fail(`Leyendo rbac_user_roles ${u.email}: ${eLink.message}`);
    if (!link) {
      const { error } = await admin.from("rbac_user_roles").insert({
        user_id: userId,
        role_id: roleId,
        tenant_id: GARRIGUES_TENANT,
        is_active: true,
      });
      if (error) fail(`insert rbac_user_roles ${u.email}: ${error.message}`);
    }
    console.log(`✓ ${u.email} → ${u.role}`);
  }

  console.log("✓ Seed G0 completado (idempotente: re-ejecutar es seguro).");
}

main();
```

- [ ] **Step 2: Dry-run**

Run: `bun run db:check-target && bun run scripts/seed-garrigues-tenant.ts`
Expected: tabla de plan con 3 acciones, mensaje "Dry-run", exit 0, **cero escrituras**. (Requiere `SUPABASE_SERVICE_ROLE_KEY` exportada; si no está, el script aborta con mensaje claro — pedirla al usuario, nunca hardcodearla.)

- [ ] **Step 3: Ejecutar**

Run: `bun run scripts/seed-garrigues-tenant.ts --commit`
Expected: `✓ tenants …0002`, `✓ demo@garrigues-demo.dev → SECRETARIO`, `✓ admin@garrigues-demo.dev → ADMIN_TENANT`.

- [ ] **Step 4: Verificar idempotencia**

Run: `bun run scripts/seed-garrigues-tenant.ts --commit` (segunda vez)
Expected: mismo resultado sin errores ni duplicados (plan dice "reutiliza"/"UPDATE").

- [ ] **Step 5: Verificación en Cloud**

Vía MCP `execute_sql`:

```sql
SELECT t.id, t.name, (t.branding IS NOT NULL) AS con_branding,
       (SELECT count(*) FROM user_profiles p WHERE p.tenant_id = t.id) AS perfiles,
       (SELECT count(*) FROM rbac_user_roles r WHERE r.tenant_id = t.id AND r.is_active) AS roles_activos
FROM tenants t WHERE t.id = '00000000-0000-0000-0000-000000000002';
```

Expected: 1 fila — `con_branding = true`, `perfiles = 2`, `roles_activos = 2`.

- [ ] **Step 6: Documentar en README-seed y commit**

Añadir al final de `scripts/README-seed.md`:

```markdown
## seed-garrigues-tenant.ts (G0 — 2026-08-02)

Tenant Garrigues (`…0002`) + branding + 2 usuarios demo (`demo@garrigues-demo.dev`
SECRETARIO, `admin@garrigues-demo.dev` ADMIN_TENANT, password demo TGMS).
Service-role, dry-run por defecto, idempotente. Requiere `SUPABASE_SERVICE_ROLE_KEY`.
```

```bash
git add scripts/seed-garrigues-tenant.ts scripts/README-seed.md
git commit -m "feat(g0): seed service-role del tenant Garrigues, branding y usuarios demo

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 3: `TenantBrandProvider` + `useTenantBranding` (TDD)

**Files:**
- Create: `src/context/TenantBrandContext.tsx`
- Test: `src/context/__tests__/tenant-brand-tokens.test.ts`
- Modify: `src/App.tsx` (montar provider)

**Interfaces:**
- Consumes: `useTenantContext()` (`src/context/TenantContext.tsx` — expone `tenantId`); tabla `tenants` con `branding` (Task 1/2).
- Produces (para Tasks 4 y 5):
  - `export interface TenantBranding { nombre?: string; shell_label?: string; scope_label?: string; sii_org_label?: string; tokens?: Record<string, string> }`
  - `export function applyBrandTokens(el: HTMLElement, tokens?: Record<string, string> | null): () => void` — aplica y devuelve cleanup.
  - `export function TenantBrandProvider({ children })` — componente.
  - `export function useTenantBranding(): TenantBranding | null` — `null` = sin branding = defaults.

- [ ] **Step 1: Escribir el test que falla (helper puro)**

```typescript
// src/context/__tests__/tenant-brand-tokens.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyBrandTokens } from "@/context/TenantBrandContext";

describe("applyBrandTokens", () => {
  it("aplica solo claves --var y devuelve cleanup que las retira", () => {
    const el = document.createElement("div");
    const cleanup = applyBrandTokens(el, {
      "--t-brand": "#004438",
      "--primary": "168 100% 13%",
      "no-es-var": "ignorada",
    });
    expect(el.style.getPropertyValue("--t-brand")).toBe("#004438");
    expect(el.style.getPropertyValue("--primary")).toBe("168 100% 13%");
    expect(el.style.getPropertyValue("no-es-var")).toBe("");
    cleanup();
    expect(el.style.getPropertyValue("--t-brand")).toBe("");
    expect(el.style.getPropertyValue("--primary")).toBe("");
  });

  it("tokens null/undefined → no-op con cleanup inofensivo", () => {
    const el = document.createElement("div");
    const cleanup = applyBrandTokens(el, null);
    expect(el.getAttribute("style")).toBeFalsy();
    cleanup(); // no lanza
  });
});
```

- [ ] **Step 2: Ejecutar y ver el fallo**

Run: `bun test src/context/__tests__/tenant-brand-tokens.test.ts`
Expected: FAIL — módulo `@/context/TenantBrandContext` no existe.

- [ ] **Step 3: Implementar el contexto**

```tsx
// src/context/TenantBrandContext.tsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

// Perfil de marca por tenant (tenants.branding). null = marca por defecto
// del producto (ARGA/TGMS): el provider no escribe ningún token y los
// consumidores usan sus strings default — cero cambio visual.
export interface TenantBranding {
  nombre?: string;
  shell_label?: string;
  scope_label?: string;
  sii_org_label?: string;
  tokens?: Record<string, string>;
}

const TenantBrandContext = createContext<TenantBranding | null>(null);

/** Aplica tokens CSS custom (--*) sobre `el` y devuelve el cleanup exacto. */
export function applyBrandTokens(
  el: HTMLElement,
  tokens?: Record<string, string> | null,
): () => void {
  if (!tokens) return () => {};
  const applied: string[] = [];
  for (const [k, v] of Object.entries(tokens)) {
    if (!k.startsWith("--") || typeof v !== "string") continue;
    el.style.setProperty(k, v);
    applied.push(k);
  }
  return () => {
    for (const k of applied) el.style.removeProperty(k);
  };
}

export function TenantBrandProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenantContext();

  const { data } = useQuery({
    queryKey: ["tenant-branding", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      // Los tipos generados no incluyen `branding` (regeneración diferida, G0):
      // cast local vía unknown, mismo patrón que useSii con vistas no tipadas.
      const row = data as unknown as { branding?: TenantBranding | null } | null;
      return row?.branding ?? null;
    },
  });

  const branding = data ?? null;

  useEffect(
    () => applyBrandTokens(document.documentElement, branding?.tokens),
    [branding],
  );

  return (
    <TenantBrandContext.Provider value={branding}>
      {children}
    </TenantBrandContext.Provider>
  );
}

export function useTenantBranding(): TenantBranding | null {
  return useContext(TenantBrandContext) ?? null;
}
```

- [ ] **Step 4: Ejecutar y ver verde**

Run: `bun test src/context/__tests__/tenant-brand-tokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Montar en App.tsx**

Localizar el árbol de providers: `grep -n "TenantProvider" src/App.tsx src/main.tsx`. Envolver los children **inmediatamente dentro** de `<TenantProvider>` (necesita `useTenantContext`):

```tsx
<TenantProvider>
  <TenantBrandProvider>
    {/* …resto del árbol existente sin cambios… */}
  </TenantBrandProvider>
</TenantProvider>
```

(Import: `import { TenantBrandProvider } from "@/context/TenantBrandContext";`.)

- [ ] **Step 6: Gates y commit**

Run: `bun run typecheck && bun test src/context`
Expected: verde ambos.

```bash
git add src/context/TenantBrandContext.tsx src/context/__tests__/tenant-brand-tokens.test.ts src/App.tsx
git commit -m "feat(g0): TenantBrandProvider — tokens y labels de marca por tenant

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 4: Labels por tenant en ShellLayout y SiiLayout (TDD)

**Files:**
- Create: `src/lib/tenant-brand-labels.ts`
- Test: `src/lib/__tests__/tenant-brand-labels.test.ts`
- Modify: `src/components/shell/ShellLayout.tsx:144` ("TGMS PLATFORM"), `:162` ("Grupo ARGA ▾"), `:252` (fallback de título "TGMS")
- Modify: `src/pages/sii/SiiLayout.tsx:60` ("Grupo ARGA Seguros")

**Interfaces:**
- Consumes: `TenantBranding` + `useTenantBranding()` (Task 3).
- Produces: `shellLabel(b)`, `scopeLabel(b)`, `siiOrgLabel(b)`, `brandName(b)` — strings con defaults ARGA/TGMS verbatim.

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/tenant-brand-labels.test.ts
import { describe, expect, it } from "vitest";
import {
  brandName,
  scopeLabel,
  shellLabel,
  siiOrgLabel,
} from "@/lib/tenant-brand-labels";

describe("tenant-brand-labels — defaults ARGA verbatim con branding null", () => {
  it("null → strings actuales exactos (contrato: cero cambio visual ARGA)", () => {
    expect(shellLabel(null)).toBe("TGMS PLATFORM");
    expect(scopeLabel(null)).toBe("Grupo ARGA");
    expect(siiOrgLabel(null)).toBe("Grupo ARGA Seguros");
    expect(brandName(null)).toBe("TGMS");
  });

  it("branding poblado → labels del tenant", () => {
    const b = {
      nombre: "Garrigues",
      shell_label: "GARRIGUES GOBERNANZA",
      scope_label: "Grupo Garrigues",
      sii_org_label: "Garrigues",
    };
    expect(shellLabel(b)).toBe("GARRIGUES GOBERNANZA");
    expect(scopeLabel(b)).toBe("Grupo Garrigues");
    expect(siiOrgLabel(b)).toBe("Garrigues");
    expect(brandName(b)).toBe("Garrigues");
  });

  it("strings vacíos o de espacios caen al default", () => {
    expect(shellLabel({ shell_label: "  " })).toBe("TGMS PLATFORM");
    expect(scopeLabel({ scope_label: "" })).toBe("Grupo ARGA");
  });
});
```

- [ ] **Step 2: Ver el fallo**

Run: `bun test src/lib/__tests__/tenant-brand-labels.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/tenant-brand-labels.ts
// Labels de marca con defaults ARGA/TGMS VERBATIM: son contrato (Task 4 G0).
// Cambiar un default rompe la promesa "cero cambio visual para ARGA".
import type { TenantBranding } from "@/context/TenantBrandContext";

export const DEFAULT_SHELL_LABEL = "TGMS PLATFORM";
export const DEFAULT_SCOPE_LABEL = "Grupo ARGA";
export const DEFAULT_SII_ORG_LABEL = "Grupo ARGA Seguros";
export const DEFAULT_BRAND_NAME = "TGMS";

function pick(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : fallback;
}

export function shellLabel(b: TenantBranding | null): string {
  return pick(b?.shell_label, DEFAULT_SHELL_LABEL);
}

export function scopeLabel(b: TenantBranding | null): string {
  return pick(b?.scope_label, DEFAULT_SCOPE_LABEL);
}

export function siiOrgLabel(b: TenantBranding | null): string {
  return pick(b?.sii_org_label, DEFAULT_SII_ORG_LABEL);
}

export function brandName(b: TenantBranding | null): string {
  return pick(b?.nombre, DEFAULT_BRAND_NAME);
}
```

- [ ] **Step 4: Ver verde**

Run: `bun test src/lib/__tests__/tenant-brand-labels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Cablear ShellLayout**

En `src/components/shell/ShellLayout.tsx`, en el componente que renderiza el bloque del logo (línea ~144), obtener `const branding = useTenantBranding();` y sustituir:

- El texto literal `TGMS PLATFORM` → `{shellLabel(branding)}`
- `<span style={{ fontWeight: 700 }}>Grupo ARGA ▾</span>` → `<span style={{ fontWeight: 700 }}>{scopeLabel(branding)} ▾</span>`
- En el header (línea ~252), el fallback de título `?? "TGMS"` → `?? brandName(branding)` (el componente del header también necesita `const branding = useTenantBranding();`).

Imports: `import { useTenantBranding } from "@/context/TenantBrandContext";` y `import { brandName, scopeLabel, shellLabel } from "@/lib/tenant-brand-labels";`. Nota: si el bloque del logo es un componente sin acceso a hooks de contexto (función suelta), convertir la lectura en prop pasada desde el componente padre que sí es React component — no llamar hooks fuera de componentes.

- [ ] **Step 6: Cablear SiiLayout**

En `src/pages/sii/SiiLayout.tsx:60`, `const branding = useTenantBranding();` y:

```tsx
<div className="text-sm font-semibold">
  SII — Sistema Interno de Información · Canal de Denuncias Confidencial · {siiOrgLabel(branding)}
</div>
```

- [ ] **Step 7: Gates y commit**

Run: `bun run typecheck && bun test src/lib/__tests__/tenant-brand-labels.test.ts && bun run lint`
Expected: verde (lint limpio en lo tocado).

```bash
git add src/lib/tenant-brand-labels.ts src/lib/__tests__/tenant-brand-labels.test.ts src/components/shell/ShellLayout.tsx src/pages/sii/SiiLayout.tsx
git commit -m "feat(g0): shell y SII leen la marca del tenant con defaults ARGA verbatim

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 5: Login con variante `?tenant=garrigues` (TDD)

**Files:**
- Create: `src/lib/login-brands.ts`
- Test: `src/lib/__tests__/login-brands.test.ts`
- Modify: `src/pages/Login.tsx`

**Interfaces:**
- Consumes: nada del provider (Login es pre-auth; mapa estático deliberado — duplicación mínima consciente, documentada en el fichero).
- Produces: `resolveLoginBrand(search: string): LoginBrand` con `LoginBrand = { key, nombre, sufijo, tagline, footer, panelBg?, demoEmail, demoPassword }`.

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/login-brands.test.ts
import { describe, expect, it } from "vitest";
import { resolveLoginBrand } from "@/lib/login-brands";

describe("resolveLoginBrand", () => {
  it("sin parámetro → ARGA con credenciales demo actuales", () => {
    const b = resolveLoginBrand("");
    expect(b.key).toBe("arga");
    expect(b.nombre).toBe("ARGA");
    expect(b.demoEmail).toBe("demo@arga-seguros.com");
  });

  it("?tenant=garrigues → marca y credenciales Garrigues", () => {
    const b = resolveLoginBrand("?tenant=garrigues");
    expect(b.key).toBe("garrigues");
    expect(b.nombre).toBe("Garrigues");
    expect(b.panelBg).toBe("#004438");
    expect(b.demoEmail).toBe("demo@garrigues-demo.dev");
  });

  it("valor desconocido o mayúsculas → fallback ARGA / case-insensitive", () => {
    expect(resolveLoginBrand("?tenant=acme").key).toBe("arga");
    expect(resolveLoginBrand("?tenant=GARRIGUES").key).toBe("garrigues");
  });
});
```

- [ ] **Step 2: Ver el fallo**

Run: `bun test src/lib/__tests__/login-brands.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/login-brands.ts
// Marca del Login por query param (?tenant=). Login es PRE-AUTH: no hay
// sesión ni tenant resuelto, así que no puede leer tenants.branding.
// Mapa estático mínimo y consciente (duplica 6 valores del branding Cloud);
// tras el login manda TenantBrandProvider. Emails demo SIEMPRE en dominio
// ficticio (garrigues-demo.dev), jamás el dominio real del despacho.
export interface LoginBrand {
  key: "arga" | "garrigues";
  nombre: string;
  sufijo: string;
  tagline: string;
  footer: string;
  panelBg?: string; // fondo inline del panel izquierdo (sin provider aún)
  demoEmail: string;
  demoPassword: string;
}

const LOGIN_BRANDS: Record<string, LoginBrand> = {
  arga: {
    key: "arga",
    nombre: "ARGA",
    sufijo: "Seguros",
    tagline: "Sistema de Gobernanza Corporativa",
    footer: "TGMS v1.0 · Entorno seguro",
    demoEmail: "demo@arga-seguros.com",
    demoPassword: "TGMSdemo2026!",
  },
  garrigues: {
    key: "garrigues",
    nombre: "Garrigues",
    sufijo: "Gobernanza",
    tagline: "Gobernanza del despacho y de su grupo",
    footer: "g-digital · Demo sin efecto jurídico",
    panelBg: "#004438",
    demoEmail: "demo@garrigues-demo.dev",
    demoPassword: "TGMSdemo2026!",
  },
};

export function resolveLoginBrand(search: string): LoginBrand {
  const t = (new URLSearchParams(search).get("tenant") ?? "").toLowerCase();
  return LOGIN_BRANDS[t] ?? LOGIN_BRANDS.arga;
}
```

- [ ] **Step 4: Ver verde**

Run: `bun test src/lib/__tests__/login-brands.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Cablear Login.tsx**

En `src/pages/Login.tsx`:

1. `import { useLocation } from "react-router-dom";` (junto al `useNavigate` existente) e `import { resolveLoginBrand } from "@/lib/login-brands";`
2. Dentro del componente: `const brand = resolveLoginBrand(useLocation().search);`
3. Sustituir las constantes: `const DEMO_EMAIL = brand.demoEmail;` y `const DEMO_PASSWORD = brand.demoPassword;` (el resto de `fillDemo`/`loginAsDemo` queda igual).
4. Panel izquierdo — el `div` con `className="relative hidden … bg-sidebar …"` recibe `style={brand.panelBg ? { background: brand.panelBg } : undefined}` (el inline pisa a `bg-sidebar` solo en Garrigues; ARGA sin cambio).
5. Bloque de marca:

```tsx
<span className="text-[32px] font-bold leading-none">{brand.nombre}</span>
<span className="text-xl font-medium text-sidebar-foreground">{brand.sufijo}</span>
```

6. Tagline: `<div className="mt-2 text-sm text-sidebar-muted">{brand.tagline}</div>`
7. Footer: `{brand.footer}` en lugar de `TGMS v1.0 · Entorno seguro`.

- [ ] **Step 6: Gates y commit**

Run: `bun run typecheck && bun test src/lib/__tests__ && bun run lint`
Expected: verde.

```bash
git add src/lib/login-brands.ts src/lib/__tests__/login-brands.test.ts src/pages/Login.tsx
git commit -m "feat(g0): login con variante de marca por tenant (?tenant=garrigues)

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 6: Sonda de aislamiento RLS bidireccional (gate de salida de G0)

**Files:**
- Modify: `src/test/helpers/supabase-test-client.ts` (añadir constantes)
- Test (create): `src/test/schema/tenant-isolation.test.ts`

**Interfaces:**
- Consumes: usuarios demo de Task 2 (emails exactos); constantes existentes `DEMO_TENANT`, `DEMO_ENTITY_ARGA` del helper.
- Produces: `export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";` y `export const GARRIGUES_DEMO_EMAIL = "demo@garrigues-demo.dev";` en el helper (los usarán las fases G1+).

- [ ] **Step 1: Añadir constantes al helper**

En `src/test/helpers/supabase-test-client.ts`, junto a `DEMO_TENANT`:

```typescript
export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";
export const GARRIGUES_DEMO_EMAIL = "demo@garrigues-demo.dev";
```

- [ ] **Step 2: Escribir la sonda (patrón `comms-rpc-hardening.test.ts`)**

```typescript
// src/test/schema/tenant-isolation.test.ts
// G0 gate de salida: aislamiento RLS bidireccional ARGA ⇄ Garrigues.
// Primera vez que governance_OS opera con 2 tenants activos reales.
// GOTCHA documentado (Oleada 3A): un write cross-tenant filtrado por RLS
// devuelve 0 filas SIN error — se asierta "no mutó", no "dio 42501".
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
  GARRIGUES_TENANT,
  GARRIGUES_DEMO_EMAIL,
} from "../helpers/supabase-test-client";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

// Tablas de dominio representativas de cada superficie (Secretaría, motor,
// plantillas, expedientes). Todas tienen tenant_id NOT NULL.
const DOMAIN_TABLES = ["entities", "document_templates", "rule_packs", "agreements"];

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

describe("G0 — aislamiento RLS bidireccional ARGA ⇄ Garrigues", () => {
  let arga: SupabaseClient | null = null;
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      arga = anonClient();
      garr = anonClient();
      const [a, g] = await Promise.all([
        arga.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD }),
        garr.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD }),
      ]);
      authed = !a.error && !g.error;
      if (a.error) console.warn(`[tenant-isolation] login ARGA falló: ${a.error.message}`);
      if (g.error) console.warn(`[tenant-isolation] login Garrigues falló: ${g.error.message}`);
    } catch {
      authed = false;
    }
  }, 30_000);

  afterAll(async () => {
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  it("el perfil del usuario Garrigues resuelve a su tenant", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("user_profiles").select("tenant_id, role_code").maybeSingle();
    expect(error).toBeNull();
    expect(data?.tenant_id).toBe(GARRIGUES_TENANT);
    expect(data?.role_code).toBe("SECRETARIO");
  });

  for (const table of DOMAIN_TABLES) {
    it(`Garrigues no ve filas ARGA en ${table}`, async () => {
      if (!authed || !garr) { expect(true).toBe(true); return; }
      const { data, error } = await garr.from(table).select("tenant_id").limit(500);
      expect(error).toBeNull();
      const foreign = (data ?? []).filter((r) => r.tenant_id !== GARRIGUES_TENANT);
      expect(foreign).toEqual([]);
    });

    it(`ARGA no ve filas Garrigues en ${table}`, async () => {
      if (!authed || !arga) { expect(true).toBe(true); return; }
      const { data, error } = await arga.from(table).select("tenant_id").limit(500);
      expect(error).toBeNull();
      const foreign = (data ?? []).filter((r) => r.tenant_id === GARRIGUES_TENANT);
      expect(foreign).toEqual([]);
    });
  }

  it("ARGA sí ve su propio dato (la sonda no pasa por lista vacía global)", async () => {
    if (!authed || !arga) { expect(true).toBe(true); return; }
    const { data, error } = await arga
      .from("entities").select("id, tenant_id").limit(500);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });

  it("write cross-tenant: Garrigues no muta una entity ARGA (0 filas, sin error)", async () => {
    if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
    const before = await arga
      .from("entities").select("common_name").eq("id", DEMO_ENTITY_ARGA).maybeSingle();
    expect(before.error).toBeNull();

    const attempt = await garr
      .from("entities")
      .update({ common_name: "PROBE-DENY-G0" })
      .eq("id", DEMO_ENTITY_ARGA)
      .select();
    // GOTCHA: RLS filtra → 0 filas afectadas, SIN 42501.
    expect(attempt.error).toBeNull();
    expect(attempt.data ?? []).toEqual([]);

    const after = await arga
      .from("entities").select("common_name").eq("id", DEMO_ENTITY_ARGA).maybeSingle();
    expect(after.error).toBeNull();
    expect(after.data?.common_name).toBe(before.data?.common_name);
  });

  it("excepción documentada: tenants es lectura pública (branding no es secreto)", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("tenants").select("id").limit(50);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(DEMO_TENANT);
    expect(ids).toContain(GARRIGUES_TENANT);
  });
});
```

- [ ] **Step 3: Ejecutar la sonda**

Run: `bun test src/test/schema/tenant-isolation.test.ts`
Expected: PASS con logins reales (ningún warn de login en la salida — si aparece un warn, la sonda pasó en vacío y NO cuenta como gate; arreglar credenciales/seed y repetir).

- [ ] **Step 4: Gate de salida**

Este test en verde **con sesiones autenticadas reales** es el gate de salida de G0 (spec §4 G0). Si cualquier aserción bidireccional falla → STOP, investigar RLS de la tabla afectada antes de continuar el programa.

- [ ] **Step 5: Commit**

```bash
git add src/test/helpers/supabase-test-client.ts src/test/schema/tenant-isolation.test.ts
git commit -m "test(g0): sonda de aislamiento RLS bidireccional ARGA-Garrigues

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 7: Verificación viva, barridos y cierre de fase

**Files:**
- Modify: `CLAUDE.md` (nota breve de estado G0)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: G0 verificada empíricamente; decisión SII (UI-only vs datos) registrada para G6.

- [ ] **Step 1: Gates completos**

Run: `bun test && bun run lint && bun run typecheck && bun run build`
Expected: todo verde; `bun test` sin fallos nuevos (baseline 2026-07-21: 3110 pass / 152 skip — los tests nuevos suman).

- [ ] **Step 2: Verificación viva — Garrigues**

Con el dev server del preview (launch.json), navegar a `/login?tenant=garrigues`, pulsar "Entrar como demo" (usa `demo@garrigues-demo.dev`):
- Panel izquierdo del login verde `#004438` con "Garrigues Gobernanza".
- Shell post-login: sidebar verde, logo "GARRIGUES GOBERNANZA", scope "Grupo Garrigues ▾".
- `/sii`: footer con "… · Garrigues" (no "Grupo ARGA Seguros").
- `/`, `/entidades`, `/secretaria`: cargan con **estados vacíos sin crash** (tenant sin datos aún) y consola del navegador sin errores nuevos.
- Capturar screenshot como evidencia.

- [ ] **Step 3: Verificación viva — ARGA pixel-idéntica**

Logout → `/login` (sin parámetro) → demo ARGA: login rojo idéntico, shell "TGMS PLATFORM"/"Grupo ARGA ▾" rojo, `/secretaria` operativa. Cualquier diferencia visual en ARGA = regresión, arreglar antes de cerrar.

- [ ] **Step 4: Barrido de hardcodes single-tenant**

```bash
grep -rn "00000000-0000-0000-0000-000000000001" src --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__
```

Expected: vacío (verificado en diseño: solo tests). Si aparece algo, evaluarlo y anotarlo.

```bash
grep -rn "arga-seguros.com" src --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__
```

Expected: solo `src/lib/login-brands.ts` (mapa estático documentado).

- [ ] **Step 5: Sonda SII para G6**

Vía MCP `execute_sql`:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name = 'tenant_id'
  AND (table_schema = 'sii' OR table_name LIKE 'sii_%');
```

Registrar el resultado en la nota de CLAUDE.md del Step 6: si las tablas/vistas SII **no** tienen `tenant_id` → G6 será UI-only con casos neutros (decisión de la spec queda resuelta con evidencia).

- [ ] **Step 6: Nota de estado en CLAUDE.md y commit final**

Añadir en CLAUDE.md, tras la sección "Convocatoria integral ARGA…", una sección breve:

```markdown
### Tenant Garrigues — G0 fundación (2026-08-02)

Segundo tenant activo en `governance_OS`: `00000000-0000-0000-0000-000000000002`
(spec `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md`).
Theming por tenant vía `tenants.branding` (migración `20260802120000`) +
`TenantBrandProvider` (`src/context/TenantBrandContext.tsx`); branding ARGA = NULL
= defaults verbatim (`src/lib/tenant-brand-labels.ts`, contrato "cero cambio
visual ARGA"). Login por parámetro `/login?tenant=garrigues`
(`src/lib/login-brands.ts`). Usuarios demo: `demo@garrigues-demo.dev`
(SECRETARIO) y `admin@garrigues-demo.dev` (ADMIN_TENANT), password demo TGMS;
seed idempotente `scripts/seed-garrigues-tenant.ts` (service-role, dry-run).
Aislamiento RLS bidireccional probado: `src/test/schema/tenant-isolation.test.ts`
(gotcha: write cross-tenant = 0 filas sin error). Sonda SII para G6: <resultado>.
```

```bash
git add CLAUDE.md
git commit -m "docs(g0): cierra la fundación del tenant Garrigues con verificación viva

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Self-review del plan (hecho)

- **Cobertura de spec G0:** migración branding (T1) ✓ · fila tenant + perfil de marca (T2) ✓ · TenantBrandProvider + tokens `--t-*` con ARGA default intacto (T3) ✓ · hardcodes ShellLayout/Login/SiiLayout (T4/T5) ✓ · usuarios SECRETARIO + ADMIN_TENANT (T2) ✓ · sondas RLS bidireccionales como gate de salida (T6) ✓ · barrido de hardcodes + estrategia SII + `document_templates` tenant-scoped (T6 lo asierta, T7 barre y sondea) ✓ · D-1 login `?tenant=` (T5) ✓.
- **Placeholders:** ninguno — todo código verbatim.
- **Consistencia de tipos:** `TenantBranding`/`applyBrandTokens`/`useTenantBranding` (T3) se consumen con esos nombres exactos en T4; `GARRIGUES_TENANT`/`GARRIGUES_DEMO_EMAIL` (T6 helper) coinciden con los valores sembrados en T2; `resolveLoginBrand` (T5) autocontenida.
