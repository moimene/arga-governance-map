# DISPATCH LOG

## 2026-08-27T05:58:30Z
Parent Task: Decouple Garrigues modules (Secretaria, GRC, AI Governance) from ARGA demo environment, remove hardcoded references, and establish a standalone packaging structure.
Requirements:
1. R1: Remove hardcoded references to "ARGA" and "TGMS" in `src/secretaria` and `src/grc`. Use `TenantBrandContext` or config variables dynamically.
2. R2: Modular Packaging (Standalone Layout) - Provide an alternative container/layout for Garrigues modules (`GarriguesStandaloneLayout.tsx` or similar) so they can be instantiated and navigated without depending on `ShellLayout.tsx`.
Acceptance Criteria:
- Source code audit verifies no hardcoded literal "ARGA" / "TGMS" in views of `src/secretaria` and `src/grc`.
- `GarriguesStandaloneLayout.tsx` (or similar) cleanly wraps module routes without main shell dependency.
- TypeScript check (`tsc`) and Vite build pass without errors.
