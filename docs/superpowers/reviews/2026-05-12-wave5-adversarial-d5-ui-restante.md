# Wave 5 Adversarial Review — UI restante (D5.1-D5.5)

**Reviewer:** Claude (adversarial mode)
**Date:** 2026-05-12
**Scope:** D5.1 PersonasList button, D5.2 DesignarAdminStepper refactor, D5.3 RepresentanteAdminPJStepper (NEW), D5.4 PersonaNuevaStepper block NIF, D5.5 EmitirCertificacionButton dual RM
**Commits reviewed:** `650db65`, `5f11315`, `6d4f2e1`, `dc91d33`, `8016065`
**Tooling state:** `bun run typecheck` 1 pre-existing error in `demo-backup` (out of scope), `bun run lint` 0 errors + 3 pre-existing warnings, `bun run build` ✓.

---

## Verdict

**APPROVE**

Builder delivered all 5 D5 sub-tasks with full Garrigues token compliance, correct legal mapping (L2, L15-L19, L23), well-implemented architectural decisions (single source `isAuthorityRole`, conditional dual-RM verification by certificante role), and proper accessibility primitives (role="alert", aria-busy, aria-label, keyboard handlers in mobile cards). Cross-coherence with D4 confirmed. No tokens drift, no dead arrays, no shortcuts.

The two non-trivial architectural decisions flagged in the brief are both correct:
- **D5.2 single-source:** the local `CARGOS_COLEGIADOS` (where `CONSEJERO_COORDINADOR` legitimately appears) is for the *cargo selector dropdown*, not for certificantes. `isAuthorityRole` from `cargo-validation.ts` is the only path that gates "Autoridad / certifica" — and that function does NOT include `CONSEJERO_COORDINADOR`. No drift.
- **D5.5 conditional dual-RM:** `flujoConVistoBueno = certificanteRole === "SECRETARIO"` is the correct legal trigger. ADMIN_UNICO / ADMIN_SOLIDARIO / ADMIN_MANCOMUNADO certify their own acts under LSC art. 210 (administradores certificantes terminales), no VºBº separado. Builder's interpretation matches RRM art. 109 + L9-L11.

---

## Critical findings

None.

---

## Notable strengths

- **[L] D5.1 PersonasList:** mobile card refactor to `<div role="link">` + `onKeyDown` is textbook accessibility — keyboard nav (`Enter` / `Space`) works, focus-visible ring uses `--g-border-focus`, action button has `onClick={(e) => e.stopPropagation()}` + `onKeyDown={(e) => e.stopPropagation()}` wrapped in a `role="presentation"` div to prevent event bubbling. No nested `<Link>` (no HTML invalidation).
- **[L] D5.2 DesignarAdminStepper:** dynamic `STEPS` builder + `stepIdx` mapper handle the 4-vs-5 step variant cleanly without conditional rendering hell. Uses `useAsignarCargo` mutation hook (no inline supabase INSERT). Toast message differentiates between certificante vs no-certificante to give the user immediate feedback about "Autoridad" tab visibility.
- **[M] D5.3 RepresentanteAdminPJStepper:** `sociedadesUnicas` dedup (lines 72-74) prevents double-listing the same entity when the PJ has multiple admin cargos (e.g. ADMIN_MANCOMUNADO + CONSEJERO). Empty case handled with helpful inline message (lines 199-202). Guard for `person_type !== "PJ"` is unambiguous.
- **[H] D5.5 EmitirCertificacionButton:** the conditional `flujoConVistoBueno` gate (line 91) means the dual-RM block is *completely inert* for ADMIN_UNICO/ADMIN_SOLIDARIO/ADMIN_MANCOMUNADO. The implementation pattern (all 4 derived flags early-return when `!flujoConVistoBueno`) is defense-in-depth. The error message UI granularity is excellent: distinguishes 4 distinct failure modes (certificanteFaltante, certificanteFaltaRM, vistoBuenoFaltante, vistoBuenoFaltaRM) and cites RRM art. 109 specifically.

---

## Garrigues tokens audit (verified independently)

| File | Native colors | Hex | Invalid tokens |
|---|---|---|---|
| PersonasList.tsx | 0/0 | 0/0 | 0/0 |
| DesignarAdminStepper.tsx | 0/0 | 0/0 | 0/0 |
| RepresentanteAdminPJStepper.tsx | 0/0 | 0/0 | 0/0 |
| PersonaNuevaStepper.tsx | 0/0 | 0/0 | 0/0 |
| EmitirCertificacionButton.tsx | 0/0 | 0/0 | 0/0 |
| App.tsx | 0/0 | 0/0 | 0/0 |

Greps run:
- Native: `\b(text|bg|border|ring)-(white|black|slate|gray|...)-[0-9]`
- Hex: `#[0-9a-fA-F]{6}\b`
- Invalid: `var(--g-status-` / `var(--g-brand)` / `var(--g-surface-secondary`

**0 hits across all categories on all 5 files + App.tsx.**

---

## D5.X feature audit

| D5.X | Status | Notes |
|---|---|---|
| D5.1 column Acciones + colSpan=7 | ✓ | Desktop (line 428-430); placeholders updated to colSpan={7} (lines 436, 442) |
| D5.1 per-row link `/secretaria/cargos/nuevo?personId=${p.id}` | ✓ | Desktop line 541, mobile line 395 |
| D5.1 onClick stopPropagation | ✓ | Desktop line 542, mobile wrapper line 390-391 |
| D5.1 mobile cards mirror desktop | ✓ | Lines 388-403 |
| D5.1 nested-Link fix | ✓ | Mobile card is `<div role="link" tabIndex={0}>` + `onClick` + `onKeyDown` (lines 298-310). Acciones button is inside but separated by a `role="presentation"` wrapper that stops both `onClick` and `onKeyDown` bubbling. No invalid HTML, full keyboard support. |
| D5.1 aria-label icon-only buttons | ✓ | Lines 398, 545 |
| D5.2 no local CARGOS_CERTIFICANTES | ✓ | Grep returns 0. Single source is `isAuthorityRole` (cargo-validation.ts L146) |
| D5.2 CC NOT certificante | ✓ | `isAuthorityRole` excludes CONSEJERO_COORDINADOR (cargo-validation.ts L83-91). CC appears in `CARGOS_COLEGIADOS` local (line 57) only as a designable role for the dropdown — legitimate. |
| D5.2 VICESECRETARIO en CARGOS_COLEGIADOS | ✓ | Line 56 |
| D5.2 accepts `?personId=` | ✓ | Line 65 |
| D5.2 accepts `?entityId=` alternative | ✓ | Line 64 (`searchParams.get("entityId")` as fallback to `params.id`) |
| D5.2 needsSociedadStep boolean | ✓ | Line 71 (`!entityIdFromUrl`) |
| D5.2 dynamic STEPS (5 vs 4) | ✓ | Lines 96-98 |
| D5.2 startStep skip Persona | ✓ | Line 73 (`personIdFromUrl ? 1 : 0`) |
| D5.2 Sociedad step conditional render | ✓ | Line 317 (`needsSociedadStep && step === stepIdx.sociedad`) |
| D5.2 useAsignarCargo (no direct INSERT) | ✓ | Line 93 + 172-183 |
| D5.2 nav post-success | ✓ | Lines 204-208: vuelve a persona si vino de personId, a sociedad si no |
| D5.2 useSociedades selector solo si needs | ✓ | Implicit — selector solo render dentro de `step === stepIdx.sociedad` que solo existe si `needsSociedadStep` |
| D5.2 backwards compat legacy route | ✓ | `/secretaria/sociedades/:id/admin/nuevo` (App.tsx L233) sigue funcionando: `params.id` se usa, sin `?personId` se mantiene flujo viejo |
| D5.3 3 pasos | ✓ | Line 48 |
| D5.3 carga usePersonaCanonical(id) | ✓ | Line 53 |
| D5.3 filter `requiresRepresentative` | ✓ | Lines 60-67 |
| D5.3 usePersonasCanonical PF selector | ✓ | Line 55 |
| D5.3 useUpsertRepresentanteAdminPJ | ✓ | Line 42 + 122-129 |
| D5.3 guard person_type !== "PJ" | ✓ | Lines 98-110 |
| D5.3 empty case mensaje | ✓ | Lines 199-202 |
| D5.3 LSC art. 214 explanatory text | ✓ | Lines 291-292 |
| D5.3 nav + toast.success | ✓ | Lines 130-131 |
| D5.4 canNext blocks `kind === "person"` | ✓ | Line 125 (`taxIdConflict?.kind === "entity" \|\| taxIdConflict?.kind === "person"`) |
| D5.4 UI error token | ✓ | `--status-error` lines 260, 263, 282, 285 |
| D5.4 CTA "Abrir ficha existente" | ✓ | Lines 291-297 |
| D5.4 AlertTriangle iconito | ✓ | Lines 263, 285 |
| D5.4 role="alert" + aria-live | ✓ | Lines 258-259, 280-281 |
| D5.5 useAuthorityEvidence + presidente | ✓ | Lines 76, 85 (note: usa `useAuthorityEvidence` directo, no `useAuthorityEvidenceFor` — equivalente y más legible para filtrar por cargo+body_id) |
| D5.5 certificanteFaltaRM / vistoBuenoFaltaRM | ✓ | Lines 123-126 |
| D5.5 canEmit gating | ✓ | `bloqueaRM` (line 127-131) propagado a `isDisabled` (line 190) |
| D5.5 botón disabled | ✓ | `disabled={isDisabled}` (line 245) |
| D5.5 block message role="alert" | ✓ | Lines 195-241 con 4 mensajes distintos por modo de fallo |
| D5.5 cita LSC/RRM | ✓ | RRM art. 109 lines 212, 219 |
| D5.5 dual verif SOLO si SECRETARIO | ✓ | `flujoConVistoBueno = certificanteRole === "SECRETARIO"` (line 91). Si ADMIN_UNICO/SOLIDARIO/PRESIDENTE, todos los flags se anulan (lines 94, 109, 121-126). |
| App.tsx /secretaria/cargos/nuevo | ✓ | Line 236, lazy + Suspense, dentro de SecretariaLayout |
| App.tsx /secretaria/personas/:id/representante/nuevo | ✓ | Line 241, lazy + Suspense, dentro de SecretariaLayout |

---

## Cross-coherence check

- **D4 ↔ D5 routes:** ✓
  - PersonaDetalle linkea a `/secretaria/cargos/nuevo?personId=${p.id}` (line 146) y `/secretaria/personas/${p.id}/representante/nuevo` (líneas 155, 193). Ambas rutas existen en App.tsx (líneas 236, 241).
- **D5.1 ↔ D5.2:** ✓ PersonasList linkea a `/secretaria/cargos/nuevo?personId=${p.id}` y DesignarAdminStepper acepta `?personId=` searchParams.
- **Legal coverage:**
  - L2 (PJ admin requiere rep): ✓ RepresentanteAdminPJStepper filtra `requiresRepresentative` (líneas 60-67)
  - L15-L16 (CC no certifica): ✓ excluído de `CARGOS_CERTIFICANTES` en cargo-validation.ts (L83-91)
  - L17 (VICESECRETARIO certifica): ✓ incluído en `CARGOS_COLEGIADOS` local (line 56) y en `CARGOS_CERTIFICANTES` de cargo-validation
  - L19 (NIF único): ✓ PersonaNuevaStepper bloquea `kind === "person"` (line 125)
  - L23 (RM obligatorio para cert): ✓ EmitirCertificacionButton aplica dual verificación cuando aplica
- **Builder D5.5 refinement (admin sin VºBº):** ✓ correct. Coherente con RRM art. 109 + LSC art. 210 + L9-L11. Los administradores únicos / solidarios / mancomunados certifican sus propias decisiones sin Vº Bº separado. El flag `flujoConVistoBueno = certificanteRole === "SECRETARIO"` cierra correctamente este flujo.

---

## Confirmation matrix

| Item | Status |
|---|---|
| 5 commits + 2 routes added | ✓ |
| CONSEJERO_COORDINADOR fuera del local del stepper certificantes | ✓ (no existe local CARGOS_CERTIFICANTES; CC aparece sólo en CARGOS_COLEGIADOS para selector, no certifica) |
| VICESECRETARIO en CARGOS_COLEGIADOS local | ✓ |
| Stepper acepta `?personId=` + `?entityId=` | ✓ |
| Nested Link refactored mobile card | ✓ (div role="link" + keyboard handler) |
| Modal NIF bloquea kind=person | ✓ |
| Doble verif RM con lógica condicional admin/secretario | ✓ |
| RepresentanteAdminPJStepper 3 pasos | ✓ |
| Routes en App.tsx funcionan | ✓ |
| typecheck + lint green | ✓ (1 pre-existing demo-backup error fuera de scope, 0 lint errors) |

---

## Recommendations (no bloqueantes)

1. **D5.1 mobile a11y note:** the desktop table row is NOT a `<tr role="link">` — desktop has a separate `<Link>` only in the Nombre cell. This is fine but creates asymmetric UX (whole mobile card is clickable; only the name cell is on desktop). Consider future enhancement: make desktop row clickable too via `onClick` on `<tr>` (with same stopPropagation pattern in Acciones cell). Out of D5 scope.

2. **D5.5 caching note:** `useAuthorityEvidence(entityId)` triggers a list query that is re-filtered client-side. For a sociedad with many AE rows this is fine, but if scaling, consider adding a parameter `cargo` to the hook for server-side filtering. Out of D5 scope.

3. **D5.2 minor:** `loadBodies` on lines 135-144 has both `tenant_id` y `entity_id` eq filters, and the `useEffect` pre-load on lines 114-125 only filters by `entity_id`. Both work because RLS filters by tenant, but the inconsistency could confuse future readers. Out of D5 scope.

None of these justify NEEDS-CHANGES.

---

## Tooling output (verified)

```text
$ bun run typecheck
src/lib/secretaria/demo-backup/reducer.ts(417,13): error TS2739 — pre-existing demo-backup error (out of scope, see wave 4 review precedent).

$ bun run lint
✖ 3 problems (0 errors, 3 warnings)  — all pre-existing "Unused eslint-disable directive" warnings in unrelated files.

$ bun run build
✓ built in 5.61s  — warnings only about chunk size (pre-existing).
```

---

## Final notes for builder

This is excellent work. The architectural decision in D5.2 (single source `isAuthorityRole`) and the legal interpretation in D5.5 (dual-RM only for Secretario flow) both demonstrate sound reasoning grounded in the spec. The dual verification UI is one of the most thoughtful pieces of error messaging in the whole module — distinguishing 4 distinct failure modes and citing RRM art. 109 with surgical precision.

Memory key: `personas-cargos / wave5-adversarial-verdict`
