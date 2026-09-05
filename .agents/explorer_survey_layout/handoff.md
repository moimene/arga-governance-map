# Handoff Report: Standalone Garrigues Layout & Packaging Architecture

**Agent:** Explorer (Layout, Packaging, and Routing Architecture Investigator)  
**Target:** Orchestrator & Implementation Agents  
**Date:** 2026-08-27  
**Artifact:** `.agents/explorer_survey_layout/analysis.md`

---

## 1. Observation

1. **Current Layout Fragmentation in `src/App.tsx`:**
   - Lines 199–227: Core TGMS routes are wrapped in `<ProtectedShell>` (mounting `ShellLayout.tsx` with red Pantone 185 C tokens).
   - Lines 228–304: Secretaría Societaria routes are wrapped in a standalone `<SecretariaLayout />` (lazy loaded).
   - Lines 305–334: GRC Compass routes are wrapped in a separate `<GrcLayout />` (lazy loaded).
   - Lines 335–354: AI Governance routes are wrapped in a separate `<AiLayout />` (lazy loaded).
   - Each module layout is isolated: there is no shared container or navigation mechanism connecting the three Garrigues modules together.

2. **Hardcoded TGMS Exit Dependencies:**
   - `src/components/secretaria/shell/SecretariaSidebar.tsx` (lines 216–230): Contains a hardcoded button `"Volver a TGMS"` calling `navigate("/")`.
   - `src/pages/grc/GrcLayout.tsx` (lines 99–113): Contains a hardcoded button `"Volver a TGMS"` calling `navigate("/")`.
   - `src/pages/ai-governance/AiLayout.tsx` (lines 72–86): Contains a hardcoded button `"Volver a TGMS"` calling `navigate("/")`.
   - `src/pages/grc/GrcLayout.tsx` (line 164) & `src/pages/ai-governance/AiLayout.tsx` (line 127): Hardcode `"TGMS"` as the root of the breadcrumb trail (`<span>TGMS</span> › <span>...</span>`).

3. **Hardcoded ARGA / TGMS Strings in Views & Hooks:**
   - `src/components/shell/UserMenu.tsx` (line 19): Hardcodes `<div className="mt-0.5 text-xs font-normal text-muted-foreground">Secretaría General — Grupo ARGA</div>`.
   - `src/components/secretaria/shell/useSecretariaScope.ts` (lines 58–63): Hardcodes fallback search for `"ARGA Seguros, S.A."`.
   - `src/pages/grc/PenalAnticorrupcion.tsx` (lines 93, 167) & `Risk360.tsx` (line 202): Fallback strings literal `"Grupo ARGA Seguros"`.
   - `src/pages/grc/Excepciones.tsx` (line 554) & `IncidenteDetalle.tsx` (line 638): Hardcoded option `"Consejo de Administración (ARGA Seguros S.A.)"`.
   - `src/pages/grc/TPRM.tsx` (lines 405, 425): Hardcoded text `"ARGA"`.
   - `src/pages/grc/modules/dora/PoliciesLink.tsx` (lines 10, 16) & `Findings.tsx` (line 115): Hardcoded links to TGMS core shell (`/politicas`, `/hallazgos`).

4. **Tenant Branding Architecture (`TenantBrandContext.tsx` & `tenant-brand-labels.ts`):**
   - `TenantBrandProvider` provides dynamic branding overrides via Supabase `tenants.branding`.
   - When branding is `null`, `tenant-brand-labels.ts` defaults verbatim to `"TGMS PLATFORM"`, `"Grupo ARGA"`, and `"Grupo ARGA Seguros"` to preserve zero-change contract for the ARGA demo.

---

## 2. Logic Chain

1. **Premise:** The requirements (R1 & R2 from `ORIGINAL_REQUEST.md`) mandate eliminating hardcoded "ARGA" / "TGMS" strings from Garrigues modules and establishing a standalone packaging structure with an independent layout wrapper (`GarriguesStandaloneLayout.tsx`).
2. **Analysis of Current Architecture:** Currently, when navigating between Garrigues modules, the user is forced to transition through three distinct layouts (`SecretariaLayout`, `GrcLayout`, `AiLayout`) that do not cross-link, and each ends in an explicit button returning to the TGMS root (`/`).
3. **Design of Unified Layout (`GarriguesStandaloneLayout`):**
   - By creating a consolidated `src/components/garrigues-shell/GarriguesStandaloneLayout.tsx`, all three Garrigues modules can be wrapped in a single parent route in `App.tsx`.
   - This layout provides a unified sidebar (`GarriguesSidebar.tsx`) with a high-level module switcher (Secretaría, GRC Compass, AI Governance) and contextual sub-menus for the active module.
   - It provides a standardized topbar (`GarriguesHeader.tsx`) with dynamic breadcrumbs, scope selector, global search, notification bell, and decoupled user menu (`GarriguesUserMenu.tsx`).
4. **Decoupling Brand Defaults & Data Leaks:**
   - In standalone mode (or for non-ARGA tenants), the layout uses contextual branding defaults (e.g. "Garrigues Corporate Solutions", "Grupo Corporativo") without breaking `tenant-brand-labels.ts` defaults for the ARGA enterprise demonstrator.
   - Dynamic lookups in `useSecretariaScope.ts` (parent-less entity) and replacing literal ARGA strings with `groupFullLabel(branding)` or `brandName(branding)` satisfy the zero-hardcode requirement.

---

## 3. Caveats

- **Dual-Mode Requirement:** The TGMS Red Shell (`ShellLayout.tsx`) must remain fully functional for the ARGA demonstrator. Changes must strictly avoid breaking existing tests or contracts for the TGMS shell.
- **Dynamic GRC Sub-Modules (`/grc/m/:moduleId`):** `ModuleShell.tsx` and `ModuleSidebar.tsx` dynamically query `grc_module_nav` from Supabase. They will render inside `GarriguesStandaloneLayout` as nested sub-layouts.
- **Route Backwards Compatibility:** Existing route paths (`/secretaria/*`, `/grc/*`, `/ai-governance/*`) must be preserved so that all existing deep links, test cases, and bookmark URLs continue to function seamlessly.

---

## 4. Conclusion

The standalone Garrigues layout and packaging structure is fully viable and straightforward to implement without requiring breaking changes:
1. **Component Suite:** Create `src/components/garrigues-shell/` containing `GarriguesStandaloneLayout.tsx`, `GarriguesSidebar.tsx`, `GarriguesHeader.tsx`, `GarriguesUserMenu.tsx`, `GarriguesModuleSwitcher.tsx`, and `navigation.ts`.
2. **Route Unification in `App.tsx`:** Consolidate lines 228–354 of `src/App.tsx` under a single layout route using `GarriguesStandaloneLayout`.
3. **Hardcoded Reference Sanitization:** Replace all literal `"TGMS"` and `"ARGA"` occurrences in GRC/Secretaría views with dynamic labels from `useTenantBranding()` and `useSecretariaScope()`.

---

## 5. Verification Method

To independently verify this architectural investigation and subsequent implementation:
1. **Source Inspection:**
   - Inspect `src/components/garrigues-shell/GarriguesStandaloneLayout.tsx` and verify proper usage of `--g-*` CSS tokens and `.garrigues-module` class.
   - Inspect `src/App.tsx` to verify route consolidation.
2. **Grep Audit for Literal References:**
   - Run: `rg -i "ARGA" src/pages/grc src/pages/secretaria src/pages/ai-governance`
   - Run: `rg -i "Volver a TGMS" src/`
   - Verify that no hardcoded literal labels remain in user-facing views of Garrigues modules.
3. **Build & Test Suite Execution:**
   - Run `bun run typecheck` (`tsc --noEmit`) to verify 0 type errors.
   - Run `bun test` to verify all 3,110+ existing tests pass.
   - Run `bun run build` to verify clean production bundle generation.
