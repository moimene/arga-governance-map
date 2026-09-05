# Project Orchestration Plan

## Objective
Decouple Garrigues modules (`src/secretaria`, `src/grc`, `src/ai-governance` if applicable) from the ARGA demo environment, remove all hardcoded "ARGA" and "TGMS" strings/references, and establish a standalone packaging structure (`GarriguesStandaloneLayout.tsx`).

## Phases & Strategy
1. **Phase 0: Survey & Scope Mapping (3 Explorers in parallel)**
   - Explorer 1: Inspect `src/secretaria` for all literal occurrences of "ARGA" / "TGMS" and identify dynamic context injection points.
   - Explorer 2: Inspect `src/grc` for all literal occurrences of "ARGA" / "TGMS" and identify dynamic context injection points.
   - Explorer 3: Inspect `ShellLayout.tsx`, `App.tsx`, `SecretariaLayout.tsx`, `GRCLayout.tsx`, `TenantBrandContext.tsx`, and router configuration to design `GarriguesStandaloneLayout.tsx` and modular entry points.

2. **Phase 1: Project Plan & Feature Inventory (PROJECT.md)**
   - Synthesize survey findings into `PROJECT.md`.
   - Map exact file lists, interface contracts, and replacement strategies.

3. **Phase 2: Milestone Execution Loop**
   - **Milestone 1: Hardcoded References Removal in Secretaria & GRC**
     - Worker implements dynamic branding (`useTenantBrand` / `TenantBrandContext` / config fallback) across all views and components in `src/secretaria` and `src/grc`.
     - Reviewers + Challengers + Auditor verify absence of hardcoded literals and adherence to dynamic branding.
   - **Milestone 2: Garrigues Standalone Layout & Independent Packaging**
     - Worker implements `GarriguesStandaloneLayout.tsx`, navigation, standalone routing wrapper/exports.
     - Reviewers + Challengers + Auditor verify layout independence, menu navigation, and clean boundary separation.

4. **Phase 3: Final Verification & Audit**
   - Comprehensive TypeScript check (`tsc`), Vite build, unit & E2E tests.
   - Independent verification against all acceptance criteria in `ORIGINAL_REQUEST.md`.
   - Forensic Integrity Audit (`teamwork_preview_auditor`).
   - Reporting back to Sentinel.
