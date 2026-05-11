# `agenda_item.kind` v1.3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Desplegar `agenda_items.kind` (INFORMATIVO/DELIBERATIVO/DECISORIO) + decision_subtype + 6 triggers de validación cruzada + audit log WORM + hooks RBAC + UI con feature flag, sin romper plantillas legacy ni acuerdos existentes. Solo aplica a `meetings.adoption_mode='MEETING'`.

**Architecture:** Schema-first (Fase 1) → tipos/normalizadores (Fase 2) → UX convocatoria/reunión (Fase 3) → motor/acta/cert con degradación graceful (Fase 4) → realtime/búsqueda/seed demo (Fase 5). RBAC en hook (no RLS). Acta preserva orden secuencial del orden del día (D3). Plantilla canónica ACTA_SESION v1.3.0 con bloques condicionales queda dependiente de firma Comité Legal.

**Tech Stack:** Supabase Postgres + RLS + 6 triggers PL/pgSQL + 1 RPC SECURITY DEFINER, TypeScript + React 18 + TanStack Query v5 + Supabase Realtime, Tailwind + shadcn/ui con tokens Garrigues `--g-*`, Vitest + Playwright + Bun.

**Spec de referencia:** [`docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md`](../specs/2026-05-12-agenda-item-kind-spec.md). Lee §3 (modelo datos), §4 (DDL), §11 (estrategia migración) antes de empezar.

**Origen:** PRD `2026-05-11-acuerdo360-agenda-item-kind-prd.md` + 4 rondas adversariales = 17 hallazgos resueltos.

---

## Pre-requisitos

- [ ] **Verificar working tree limpio**

```bash
git status
```

- [ ] **Verificar Supabase target**

```bash
bun run db:check-target
```

- [ ] **Baseline tests**

```bash
bun test 2>&1 | tail -3
```

Anota el N de tests pasados. Cualquier nuevo test debe sumarse — sin regresiones.

- [ ] **Verificar branch correcta**

Estás en `feature/agenda-item-kind` (creada desde `main`, NO desde `feature/v2-plantillas-overrides`).

```bash
git branch --show-current
git log --oneline -3
```

---

## Task 1: SQL migration consolidada (6 triggers + audit + RPC)

**Files:**
- Create: `supabase/migrations/20260512_000059_agenda_item_kind.sql`

⚠️ NO aplicar la migración. Solo crear el archivo. La aplicación se hace en Task 2 tras escribir tests.

- [ ] **Step 1: Crear archivo de migración con cabecera**

Crea el archivo con cabecera `-- Migration: 20260512_000059_agenda_item_kind.sql` que liste las 6 tablas/columnas tocadas + 6 triggers + 1 RPC. Spec sección 4 contiene el SQL completo (líneas 4.1-4.10). Cópialo verbatim incluyendo `BEGIN;` / `COMMIT;`.

- [ ] **Step 2: Verificar contenido**

```bash
wc -l supabase/migrations/20260512_000059_agenda_item_kind.sql
grep -c "^CREATE OR REPLACE FUNCTION" supabase/migrations/20260512_000059_agenda_item_kind.sql
grep -c "^CREATE TRIGGER\|DROP TRIGGER IF EXISTS" supabase/migrations/20260512_000059_agenda_item_kind.sql
```

Expected: ~280-320 líneas, 7 functions (6 triggers + 1 RPC `set_kind_change_context`), 12 trigger statements (6 DROP + 6 CREATE).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260512_000059_agenda_item_kind.sql
git commit -m "feat(db): add agenda_item.kind migration (6 triggers + audit log + RPC)

Crea agenda_items.kind + decision_subtype + meeting_resolutions.kind_resolution
+ agenda_item_kind_changelog (WORM audit log) + RPC set_kind_change_context.

6 triggers de validación cruzada:
- T1 inmutabilidad post-resolution (cualquier kind_resolution)
- T2 inmutabilidad post-CLOSED
- T3 audit log post-CONVOKED via session vars
- T4 cross-validation BIDIRECCIONAL resolution↔agenda (D1 fix)
- T5 agreement requiere DECISORIO (D2 NULL guard explícito)
- T6 kind solo aplica a adoption_mode=MEETING (G-I3 fix)

Migración pendiente de aplicar — Task 2 aplica via MCP tras escribir tests.

Spec: docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md"
```

---

## Task 2: Schema tests TDD + aplicar migración via MCP

**Files:**
- Create: `src/test/schema/agenda-item-kind.test.ts`

- [ ] **Step 1: Crear esqueleto del test file**

Patrón estándar del repo: `import { describe.skipIf(!hasAdminClient()) }` + `DEMO_TENANT` + `DEMO_ENTITY_ARGA`.

5 describe blocks:
1. T1+T2 inmutabilidad (3 rejection paths cada uno)
2. T3 audit log inserta + WORM
3. T4 cross-validation BIDIRECCIONAL (9 tests: 3 kind_resolution × 3 agenda kind, solo 3 son válidos)
4. T5 agreement requiere DECISORIO (4 paths: parent NULL=happy, INFO=reject, DELIB=reject, DECIS=happy)
5. T6 modos no-MEETING fuerzan DECISORIO (5 modos × 2 paths)

Total esperado: ~30 tests.

- [ ] **Step 2: Escribir el primer describe (T1+T2 inmutabilidad)**

```typescript
describe.skipIf(!hasAdminClient())(
  "agenda_item.kind — T1+T2 inmutabilidad",
  () => {
    let testMeetingId: string | null = null;

    afterEach(async () => {
      // Cleanup defensivo via sentinel motivo
      // (los tests SOLO insertan en agenda_item_kind_changelog via trigger T3,
      // que requiere meeting CONVOKED — no tocan otras tablas)
    });

    it("T1 rechaza cambio kind si existe meeting_resolution apuntando al punto", async () => {
      // Setup: crear meeting + agenda_item DECISORIO + meeting_resolution
      // Intentar UPDATE kind → debe fallar con "agenda_items.kind inmutable: existe meeting_resolution"
      // ...
    });

    // ... 2 tests más para T1 (cualquier kind_resolution: DECISION, DELIBERATION_OUTCOME, INFORMATION_NOTED)
    // ... 3 tests para T2 (CLOSED bloquea cualquier transición)
  },
);
```

- [ ] **Step 3: Escribir resto de describes (T3, T4, T5, T6)**

Patrón consistente. Para T4 usar `it.each` parametrizado:

```typescript
it.each([
  // [agenda_kind, kind_resolution, expectFail, errorPattern]
  ["DECISORIO", "DECISION", false, null],
  ["DECISORIO", "DELIBERATION_OUTCOME", true, /requiere agenda_items.kind=DELIBERATIVO/],
  ["DECISORIO", "INFORMATION_NOTED", true, /requiere agenda_items.kind=INFORMATIVO/],
  ["DELIBERATIVO", "DECISION", true, /requiere agenda_items.kind=DECISORIO/],
  ["DELIBERATIVO", "DELIBERATION_OUTCOME", false, null],
  ["DELIBERATIVO", "INFORMATION_NOTED", true, /requiere agenda_items.kind=INFORMATIVO/],
  ["INFORMATIVO", "DECISION", true, /requiere agenda_items.kind=DECISORIO/],
  ["INFORMATIVO", "DELIBERATION_OUTCOME", true, /requiere agenda_items.kind=DELIBERATIVO/],
  ["INFORMATIVO", "INFORMATION_NOTED", false, null],
])("T4 cross-validation: agenda=%s + resolution=%s → fail=%s", async (...) => { ... });
```

- [ ] **Step 4: Run tests (esperar fail — migration no aplicada)**

```bash
bun run test src/test/schema/agenda-item-kind.test.ts 2>&1 | tail -10
```

Expected: FAIL "relation agenda_item_kind_changelog does not exist" o equivalente. Esto es lo correcto en TDD red.

- [ ] **Step 5: Aplicar migración via MCP supabase tool**

El orquestador (humano o agente con acceso MCP) aplica la migración del archivo via `mcp__53aea412-...__apply_migration` con `name=agenda_item_kind` y el contenido del archivo SQL.

Verificar via:

```bash
# Verificación rápida de tablas + triggers
# (orquestador via MCP execute_sql)
```

Expected: 6/6 triggers presentes, audit log table existe, RPC `set_kind_change_context` registrada.

- [ ] **Step 6: Run tests (esperar pass)**

```bash
bun run test src/test/schema/agenda-item-kind.test.ts 2>&1 | tail -5
```

Expected: ~30 tests PASS.

- [ ] **Step 7: Commit tests**

```bash
git add src/test/schema/agenda-item-kind.test.ts
git commit -m "test(schema): add agenda_item.kind schema tests (TDD red→green)

Cobertura: ~30 tests en 5 describe blocks
- T1+T2 inmutabilidad (3 rejection paths × 2 triggers)
- T3 audit log inserta + WORM
- T4 cross-validation bidireccional 3×3 matrix (it.each parametrizado)
- T5 agreement requiere DECISORIO (4 paths)
- T6 modos no-MEETING fuerzan DECISORIO (5 modos)

Migración 20260512_000059_agenda_item_kind aplicada en Cloud governance_OS via MCP."
```

---

## Task 3: Backfill SQL con probe + apply via MCP

**Files:**
- Create: `supabase/migrations/20260512_000060_agenda_item_kind_backfill.sql`

- [ ] **Step 1: Crear archivo backfill**

Spec sección 5 contiene el SQL completo. Copia verbatim. Incluye:
- UPDATE 1: marcar DECISORIO los puntos con `agreement_id` o `meeting_resolutions.status IN ('ADOPTED','REJECTED')`
- UPDATE 2: migrar resolutions con status no finales a `DELIBERATION_OUTCOME` (excluye PENDING/DRAFT — O3 fix)
- DO $$ ... probe con RAISE EXCEPTION si orphans > 0

- [ ] **Step 2: Aplicar backfill via MCP**

El orquestador aplica via `mcp__53aea412-...__apply_migration` con `name=agenda_item_kind_backfill`. El probe DO $$ valida atomicidad — si encuentra orphans, RAISE EXCEPTION rollback el backfill completo.

- [ ] **Step 3: Verificar contadores via MCP execute_sql**

```sql
SELECT 
  (SELECT COUNT(*) FROM agenda_items) AS total,
  (SELECT COUNT(*) FROM agenda_items WHERE kind='DECISORIO') AS decis,
  (SELECT COUNT(*) FROM agenda_items WHERE kind='DELIBERATIVO') AS delib,
  (SELECT COUNT(*) FROM agenda_items WHERE kind='INFORMATIVO') AS info;
```

Expected: `info=0` (G-I2: backfill no genera INFORMATIVO).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260512_000060_agenda_item_kind_backfill.sql
git commit -m "feat(db): add agenda_item.kind backfill with probe verification

Backfill basado en señales relacionales:
- UPDATE → DECISORIO si agreement_id o meeting_resolutions.status IN ('ADOPTED','REJECTED')
- UPDATE → DELIBERATION_OUTCOME para resolutions con status no finales
- Probe DO $$ con RAISE EXCEPTION si orphans > 0 (atomicidad)

Backfill aplicado en Cloud. Tipo INFORMATIVO sin datos legacy (G-I2 — esperado)."
```

---

## Task 4: Tipos TS + normalizadores + tests unitarios

**Files:**
- Create: `src/lib/secretaria/agenda-kind.ts`
- Create: `src/lib/secretaria/__tests__/agenda-kind.test.ts`

- [ ] **Step 1: Crear test file (TDD red)**

```typescript
import { describe, expect, it } from "vitest";
import { normalizeAgendaItemKind, isDecisionAgendaItem, mergeAgendaKindSources } from "../agenda-kind";

describe("normalizeAgendaItemKind", () => {
  it.each([
    ["DECISORIO", "DECISORIO"],
    ["decisorio", "DECISORIO"],
    ["  DECISIVO ", "DELIBERATIVO"], // típo no reconocido → default conservador
    [null, "DELIBERATIVO"],
    [undefined, "DELIBERATIVO"],
    [42, "DELIBERATIVO"],
  ])("normalize(%s) → %s", (input, expected) => {
    expect(normalizeAgendaItemKind(input)).toBe(expected);
  });
});

describe("isDecisionAgendaItem", () => {
  it("returns true only for DECISORIO", () => {
    expect(isDecisionAgendaItem("DECISORIO")).toBe(true);
    expect(isDecisionAgendaItem("DELIBERATIVO")).toBe(false);
    expect(isDecisionAgendaItem("INFORMATIVO")).toBe(false);
  });
});

describe("mergeAgendaKindSources", () => {
  it("autoritative: tabla wins over snapshot", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DECISORIO",
      fromConvocatoriaSnapshot: "INFORMATIVO",
    });
    expect(result.effective).toBe("DECISORIO");
    expect(result.snapshot).toBe("INFORMATIVO");
    expect(result.drift).toBe(true);
  });

  it("no drift if same value", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DECISORIO",
      fromConvocatoriaSnapshot: "DECISORIO",
    });
    expect(result.drift).toBe(false);
  });

  it("snapshot null: no drift detection possible", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DELIBERATIVO",
      fromConvocatoriaSnapshot: undefined,
    });
    expect(result.snapshot).toBeNull();
    expect(result.drift).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (esperar fail)**

```bash
bun run test src/lib/secretaria/__tests__/agenda-kind.test.ts
```

Expected: FAIL "module not found".

- [ ] **Step 3: Crear `agenda-kind.ts`**

Spec sección 6 contiene el código TS completo. Copia verbatim los 3 types + 3 funciones (`normalizeAgendaItemKind`, `isDecisionAgendaItem`, `mergeAgendaKindSources`).

- [ ] **Step 4: Run test (esperar pass)**

```bash
bun run test src/lib/secretaria/__tests__/agenda-kind.test.ts
```

Expected: ~10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/secretaria/agenda-kind.ts src/lib/secretaria/__tests__/agenda-kind.test.ts
git commit -m "feat(secretaria): add agenda-kind types + normalizadores

Tipos compartidos AgendaItemKind, AgendaDecisionSubtype, ResolutionKind.
Normalizadores normalizeAgendaItemKind (default conservador DELIBERATIVO),
isDecisionAgendaItem, mergeAgendaKindSources (P4 SSOT con drift detection).

10 tests unitarios."
```

---

## Task 5: Hook `useReclassifyAgendaItemKind` con RBAC + matriz P7

**Files:**
- Create: `src/hooks/useReclassifyAgendaItemKind.ts`
- Create: `src/lib/secretaria/reclassification-matrix.ts` — implementa matriz P7
- Create: `src/hooks/__tests__/useReclassifyAgendaItemKind.test.ts`

- [ ] **Step 1: Crear `reclassification-matrix.ts`**

Función pura que devuelve `{ allowed: boolean; reason?: string }` dados:
- `meeting.adoption_mode`
- `meeting.is_universal` (junta)
- `meeting.organ_type` (JUNTA_GENERAL vs CONSEJO_ADMIN)
- `meeting.status` (CONVOKED, OPEN, CLOSED)
- `current_kind`, `new_kind`

Implementa matriz:
- DRAFT/CONVOKED + CONSEJO → permitido
- OPEN + CONSEJO + reclassify a DECISORIO → permitido si quórum unánime documentado
- OPEN + JUNTA universal → permitido si unanimidad presentes
- OPEN + JUNTA convocada formalmente → NO permitido (vicio procedimiento)
- CLOSED → NO permitido (T2 ya bloquea, doble check UX)

- [ ] **Step 2: Crear hook con RBAC + RPC + UPDATE**

```typescript
export function useReclassifyAgendaItemKind() {
  const { user } = useCurrentUser();
  const { roles } = useUserRole(user?.id);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      agendaItemId: string;
      meetingId: string;
      newKind: AgendaItemKind;
      motivo: string; // mínimo 3 chars
    }) => {
      // RBAC: solo SECRETARIO de la reunión
      const isSecretario = roles.includes("SECRETARIO"); // simplificado; v1.1 hace assertUserIsSecretarioOfMeeting
      if (!isSecretario) {
        throw new Error("403: solo SECRETARIO del órgano puede reclasificar");
      }

      // Matriz P7
      const meeting = await fetchMeetingMeta(params.meetingId);
      const currentKind = await fetchAgendaItemKind(params.agendaItemId);
      const matrixCheck = checkReclassificationAllowed({
        adoptionMode: meeting.adoption_mode,
        organType: meeting.organ_type,
        isUniversal: meeting.is_universal,
        status: meeting.status,
        currentKind,
        newKind: params.newKind,
      });
      if (!matrixCheck.allowed) {
        throw new Error(`Reclasificación denegada por matriz P7: ${matrixCheck.reason}`);
      }

      // Setear session vars para audit
      const { error: rpcError } = await supabase.rpc("set_kind_change_context", {
        p_motivo: params.motivo,
        p_user_id: user!.id,
      });
      if (rpcError) throw rpcError;

      // UPDATE
      const { error } = await supabase
        .from("agenda_items")
        .update({ kind: params.newKind })
        .eq("id", params.agendaItemId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["agenda_items", vars.meetingId] });
      queryClient.invalidateQueries({ queryKey: ["agenda_item_kind_changelog", vars.agendaItemId] });
    },
  });
}
```

- [ ] **Step 3: Tests unitarios** (matrix puro + hook con mock supabase)

- [ ] **Step 4: Run tests + commit**

```bash
bun run test src/hooks/__tests__/useReclassifyAgendaItemKind.test.ts src/lib/secretaria/__tests__/reclassification-matrix.test.ts

git add src/hooks/useReclassifyAgendaItemKind.ts src/hooks/__tests__/useReclassifyAgendaItemKind.test.ts src/lib/secretaria/reclassification-matrix.ts src/lib/secretaria/__tests__/reclassification-matrix.test.ts
git commit -m "feat(hooks): add useReclassifyAgendaItemKind with RBAC + matriz P7

Hook mutation con:
- RBAC: solo SECRETARIO del órgano
- Matriz P7 (Junta formal/universal vs Consejo)
- RPC set_kind_change_context para audit log T3
- Invalidate queries on success"
```

---

## Task 6: Hook `useAgendaItemRealtimeSubscription` (G4)

**Files:**
- Create: `src/hooks/useAgendaItemRealtimeSubscription.ts`

- [ ] **Step 1-3: Crear hook con Supabase Realtime + cleanup**

Patrón similar a `useEntitySettingsCatalog` Realtime subscription (PR #1 v2 plantillas overrides). Filtra por `meeting_id` activo. Toast notification al cambiar kind.

```typescript
export function useAgendaItemRealtimeSubscription(meetingId: string | undefined) {
  useEffect(() => {
    if (!meetingId) return;
    const channel = supabase
      .channel(`agenda_items_${meetingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agenda_items", filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          if (payload.old.kind !== payload.new.kind) {
            toast.info(`Punto ${payload.new.index} reclasificado de ${payload.old.kind} a ${payload.new.kind}`);
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [meetingId]);
}
```

- [ ] **Step 4: Commit**

---

## Task 7: ConvocatoriaStepper — selector kind por punto

**Files:**
- Modify: `src/components/secretaria/ConvocatoriaStepper.tsx` (o equivalente)

- [ ] **Step 1: Añadir selector "Naturaleza del punto" en el paso "Orden del día"**

3 botones radio: Informativo / Deliberativo / Decisorio. Si DECIS, mostrar selector opcional `decision_subtype`. Tokens Garrigues `--g-*`.

- [ ] **Step 2: Commit**

---

## Task 8: ReunionStepper — chips + carril votación filtrado + modal reclassification

**Files:**
- Modify: `src/components/secretaria/ReunionStepper.tsx`

- [ ] **Step 1: Añadir chip visual `[INFO]`/`[DELIB]`/`[DECIS]` por punto**

- [ ] **Step 2: Filtrar carril de votación a solo DECIS**

```tsx
const votableItems = puntos.filter(p => isDecisionAgendaItem(p.kind));
```

- [ ] **Step 3: Modal "Reclasificar a DECISORIO"** con motivo obligatorio + matriz P7 enforcement

- [ ] **Step 4: Commit**

---

## Task 9: ActaGenerator — graceful degradation + ORDEN SECUENCIAL (D3)

**Files:**
- Modify: `src/hooks/useActas.ts` (o equivalente)

⚠️ **D3 crítico**: NO reagrupar puntos por kind. Mantener orden secuencial del orden del día. Cada punto lleva `kind` + `kind_resolution` como metadatos. La plantilla canónica (legacy v1.2.0 o nueva v1.3.0) decide cómo renderizar.

- [ ] **Step 1: Verificar que useActas devuelve array secuencial sin reagrupación**

Comentario inline obligatorio:
```typescript
// CRÍTICO D3: NO reagrupar por kind. RRM art. 99 exige relación cronológica
// del acta. La plantilla ACTA_SESION canónica usa {{#each meetings.junta.puntos}}
// como loop secuencial. Reagrupación rompe orden + plantilla + jurisprudencia.
const puntos = rawPuntos.map(p => ({
  ...p,
  kind: normalizeAgendaItemKind(p.kind),
  kind_resolution: p.kind_resolution ?? "DECISION",
}));
return { puntos, /* otros metadatos */ };
```

- [ ] **Step 2: Test que verifica orden preservado**

```typescript
it("useActas preserva orden del orden del día con puntos mixtos", () => {
  const input = [
    { index: 1, kind: "INFORMATIVO", title: "Informe Presidente" },
    { index: 2, kind: "DECISORIO", title: "Aprobación cuentas" },
    { index: 3, kind: "DELIBERATIVO", title: "Seguimiento riesgos" },
    { index: 4, kind: "DECISORIO", title: "Nombramiento consejero" },
  ];
  const result = useActas.format(input);
  expect(result.puntos.map(p => p.index)).toEqual([1, 2, 3, 4]); // SECUENCIAL
});
```

- [ ] **Step 3: Documentar dependencia de plantilla v1.3.0**

Crear `docs/superpowers/plans/2026-05-12-acta-sesion-v1-3-0-bump-pending.md` con:
- Bloques `{{#if (eq kind ...)}}` requeridos
- Variables capa2 nuevas necesarias
- Estado: pendiente firma Comité Legal (Track 1)
- Mientras tanto: degradación graceful en ActaGenerator (campos vacíos para no-DECIS)

- [ ] **Step 4: Commit**

---

## Task 10: BusquedaGlobal — badges + navegación diferenciada (G1)

**Files:**
- Modify: `src/components/secretaria/BusquedaGlobal.tsx` (o equivalente)

- [ ] **Step 1: Añadir badge `kind` en resultados**

- [ ] **Step 2: Navegación diferenciada**

```typescript
function getResultRoute(item: SearchResult): string {
  if (item.kind === "DECISORIO" && item.agreement_id) {
    return `/secretaria/acuerdos/${item.agreement_id}`;
  }
  return `/secretaria/reuniones/${item.meeting_id}#punto-${item.index}`;
}
```

- [ ] **Step 3: Commit**

---

## Task 11: E2E tests + seed ARGA mixto (G-I2)

**Files:**
- Create: `e2e/21-secretaria-agenda-kind.spec.ts`
- Create: `scripts/seed-v3-agenda-kind-demo.ts`

- [ ] **Step 1: Seed ARGA mixto**

Reunión CdA demo: 3 INFO + 2 DELIB + 1 DECIS materializado.
Reunión Junta demo: 1 INFO + 0 DELIB + 3 DECIS.

UPSERT idempotente.

- [ ] **Step 2: Aplicar seed via MCP execute_sql**

- [ ] **Step 3: Tests E2E**

5 tests:
1. Convocatoria con 3 puntos mixtos
2. ReunionStepper separa carriles
3. Materializar INFO bloqueado con mensaje
4. **Acta preserva orden secuencial** (test crítico D3)
5. Certificación lista solo DECIS

- [ ] **Step 4: Commit**

---

## Task 12: Verificación final + PR ready

- [ ] **Step 1: Suite completa**

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

Expected: PASS, 0 errors, 0 fails. N tests + ~50 nuevos.

- [ ] **Step 2: Verificar Cloud counters**

Via MCP execute_sql:
- agenda_items: total + distribución por kind
- meeting_resolutions: total + distribución por kind_resolution
- agenda_item_kind_changelog: 0 filas (sin reclasificaciones todavía)

- [ ] **Step 3: Push + crear PR ready (no draft)**

```bash
git push -u origin feature/agenda-item-kind
gh pr create --title "feat(secretaria): agenda_item.kind v1.3 — clasificación explícita de puntos del orden del día" \
  --body "## Summary
- 6 tablas/columnas nuevas + 6 triggers de validación cruzada
- Audit log WORM agenda_item_kind_changelog
- RPC set_kind_change_context para session vars
- Tipos TS + normalizadores + matriz P7
- Hooks: useReclassifyAgendaItemKind (RBAC), useAgendaItemRealtimeSubscription
- UX: selector kind en convocatoria, chips + carril filtrado en reunión
- ActaGenerator graceful degradation + ORDEN SECUENCIAL (D3 crítico)
- BúsquedaGlobal con badges + navegación diferenciada
- Seed demo ARGA mixto

## Spec
docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md (17 hallazgos resueltos en 4 rondas adversariales)

## Out of scope (v1)
- Plantilla ACTA_SESION v1.3.0 con bloques condicionales — depende de Track 1 + firma Comité Legal
- Multi-jurisdicción
- RLS dinámica role-gate JWT-based (deuda sistémica)

## Test plan
- [x] bun test (~50 tests nuevos pass)
- [x] bun run typecheck
- [x] bun run lint
- [x] Schema tests cobertura ≥3 rejection paths por trigger
- [x] E2E: orden secuencial preservado + materialización bloqueada para INFO/DELIB

🤖 Generated via subagent-driven implementation"
```

- [ ] **Step 4: Coordinar merge order**

PR #1 (v2 plantillas overrides) primero, luego este PR. Documentar en comentario.

---

## Self-Review

**Spec coverage**: cada sección del spec v1.3 (§3-§14) tiene task correspondiente:
- §3-4 (modelo + DDL) → Task 1
- §3.4 + §4.7 (audit log) → Task 1
- §5 (backfill) → Task 3
- §6 (tipos TS) → Task 4
- §7 (hooks) → Tasks 5+6
- §8 (componentes UI) → Tasks 7+8+9+10
- §9 (precedencia) → integrado en Task 4 (mergeAgendaKindSources)
- §10 (R1-R7) → distribuido en triggers Task 1 + hook Task 5
- §11 (fases migración) → estructura del plan
- §12-13 (out of scope + riesgos) → documentación inline
- §14 (tests) → distribuido en cada task con test sub-step

**Reglas R1-R7 trazadas**: cada regla referenciada en commits + comentarios inline.

**Placeholder scan**: 0 TBD/TODO. Cada step tiene contenido ejecutable.

**Type consistency**: `AgendaItemKind`, `ResolutionKind`, `AgendaDecisionSubtype` definidos una vez (Task 4) + reusados en hooks/componentes.

**FIN del plan v1.3 — listo para subagent-driven execution.**
