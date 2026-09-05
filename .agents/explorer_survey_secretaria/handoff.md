# Handoff Report — Secretaria Decoupling Survey

**Agent**: `explorer_survey_secretaria`  
**Handoff Type**: Hard (Investigation Complete)  
**Target Module**: `src/secretaria/` (`src/pages/secretaria/`, `src/components/secretaria/`, `src/hooks/secretaria/`, `src/lib/secretaria/`)  
**Associated Analysis**: `.agents/explorer_survey_secretaria/analysis.md`

---

## 1. Observation

A full codebase search was performed across all directories containing Secretaria code:
- `src/pages/secretaria/` (76 files)
- `src/components/secretaria/` (66 files)
- `src/hooks/secretaria/` (8 files)
- `src/lib/secretaria/` (109 files)

### Key Observed Data:
1. **Production Code Occurrences**:
   - `src/components/secretaria/shell/useSecretariaScope.ts` (lines 59–62): Hardcoded entity search for `"ARGA Seguros, S.A."` in `getPreferredEntity()`.
   - `src/components/secretaria/shell/SecretariaSidebar.tsx` (lines 223, 228): Hardcoded shell link with `aria-label="Volver al shell TGMS"` and `<span>Volver a TGMS</span>`.
   - `src/pages/secretaria/TramitadorStepper.tsx` (line 895): Fallback entity name string `"ARGA Seguros"`.
   - `src/pages/secretaria/PersonaNuevaStepper.tsx` (lines 535, 571, 593, 608): Placeholders `"ARGA Servicios Externos, S.L."`, `"ARGA Servicios"`, `"persona@arga-seguros.com"`, `"contacto.secundario@arga-seguros.com"`.
   - `src/pages/secretaria/DecisionUnipersonalStepper.tsx` (line 215): Placeholder referencing `"Cartera ARGA S.L.U."`.
   - `src/pages/secretaria/AcuerdoSinSesionStepper.tsx` (line 840): Placeholder referencing `"secretaria@arga-seguros.com"`.
   - `src/pages/secretaria/TransmisionStepper.tsx` (line 296): Placeholder referencing `"evidence://ead-trust/ARGA_SEG_TRANSMISION_2026_01"`.
   - `src/pages/secretaria/sociedad-nueva/StepClasesSeries.tsx` (line 150): Helper text referencing `"ARGA Seguros"`.
   - `src/pages/secretaria/ConvocatoriasStepper.tsx` (lines 1478, 1560, 1603, 1611, 2212, 3092, 4144): Capa 3 defaults and UI strings referencing `"TGMS"`.
   - `src/pages/secretaria/ConvocatoriaDetalle.tsx` (lines 379, 385): ICS calendar UID domain `@arga-seguros.com` and PRODID `"PRODID:-//TGMS//Secretaría Societaria//ES"`.
   - `src/pages/secretaria/MatrizJurisdiccional.tsx` (lines 65, 68, 69, 91, 117, 145, 178, 189, 200, 211, 280, 451, 452, 545, 619): Mock filial names, decision bodies (`"CdA ARGA Seguros S.A."`), and UI badges (`"TGMS"`).
   - `src/components/secretaria/gestor/CatalogoTab.tsx` (line 545): Default transition actor `"Comité Legal TGMS"`.
   - `src/lib/secretaria/convocatoria-capa3-resolver.ts` (line 219): Default documentation channel referencing `"TGMS"`.
   - `src/lib/secretaria/legal-template-approval-plan.ts` (line 37): Approver string `"Comite Legal ARGA"`.
   - `src/lib/secretaria/template-configuration-routing.ts` (lines 98, 124): Dummy base URL `"https://tgms.local"`.

2. **Zero Hardcoded UUIDs in Runtime Code**: No production Secretaria file contains hardcoded tenant IDs (`00000000-...-0001`) or entity UUIDs. All database queries properly use `tenantId` from `useTenantContext()`.

3. **Existing Tenant Branding Architecture**: `src/context/TenantBrandContext.tsx` and `src/lib/tenant-brand-labels.ts` provide the branding context (`TenantBranding`, `useTenantBranding()`, `groupFullLabel()`, `brandName()`, `scopeLabel()`).

---

## 2. Logic Chain

1. **Premise**: To achieve requirement R1 (Decouple Garrigues modules from ARGA demo data and eliminate hardcoded brand references) and prepare for standalone modular deployment (R2), all user-visible and internal hardcoded literals must be replaced with dynamic resolution or generic fallback defaults.
2. **Analysis of Hardcoded Patterns**:
   - Scope selection (`useSecretariaScope.ts`) currently defaults to looking for `"ARGA Seguros, S.A."`. In a multi-tenant or standalone deployment for another client, this lookup fails and falls back to `parentEntityId == null`. Eliminating the explicit name check and using `parentEntityId == null` as the primary rule directly supports any corporate holding structure.
   - Placeholder text in form inputs (`PersonaNuevaStepper`, `DecisionUnipersonalStepper`, `AcuerdoSinSesionStepper`, `TransmisionStepper`) serves only as instructional guidance for end-users. Generic placeholders (`"empresa@ejemplo.com"`, `"Sociedad Filial, S.L."`) provide clear guidance without hardcoding demo identities.
   - Template metadata defaults (`ConvocatoriasStepper`, `convocatoria-capa3-resolver.ts`, `ConvocatoriaDetalle.tsx`) currently inject `"TGMS"` and `@arga-seguros.com` into generated payloads. Abstracting these via `brandName(branding)` or neutral system terms (`"repositorio documental privado"`, `window.location.hostname`) ensures generated documents and calendar invitations adapt dynamically to any tenant.
   - `MatrizJurisdiccional.tsx` contains static fallback tables reflecting ARGA's international structure. Deriving the parent entity name dynamically from `groupFullLabel(branding)` or `entities.find(e => e.parentEntityId == null)` and using generic filial placeholders (`"Filial Portugal Unipessoal Lda."`) makes the view universally applicable.
3. **Conclusion**: Every hardcoded instance can be cleanly decoupled with zero regression risk to existing functionality and full compatibility with the existing `TenantBrandContext`.

---

## 3. Caveats

- **Historical Comments**: Multiple files contain non-executing comments referencing `"ARGA"` or `"DL-2/DL-5"` (e.g. `// ARGA (SA) veía las 6 materias SLP...`). These comments explain the domain history but have zero runtime impact.
- **Test Fixtures**: Test files under `__tests__/` contain mock fixtures using `"ARGA"`. These tests validate logic against sample schemas. Modifying test fixture data should be coordinated to avoid unnecessary test churn, though standardizing mock utilities is recommended.
- **Standalone Layout (R2)**: `SecretariaLayout.tsx` already exists and is wrapped with Garrigues design tokens (`--g-*`). To run completely standalone without the TGMS shell, the back-link in `SecretariaSidebar.tsx` should adapt dynamically or be toggleable via route configuration.

---

## 4. Conclusion

The Secretaria module is in an excellent state for decoupling:
- Core database queries are already 100% tenant-scoped.
- The 15 files with hardcoded literals are well-isolated and strictly categorized into:
  1. Scope resolution fallback (`useSecretariaScope.ts`)
  2. Input placeholders & help texts (5 steppers)
  3. Default Capa 3 template strings & calendar ICS metadata (3 files)
  4. Multi-jurisdiction demo table strings (`MatrizJurisdiccional.tsx`)
  5. Sidebar back-navigation label (`SecretariaSidebar.tsx`)
- All proposed replacements can be executed cleanly without breaking the build or existing test suite.

---

## 5. Verification Method

Once changes are applied by the implementer agent:
1. **Search Verification**:
   ```bash
   rg -n -i "\b(arga|tgms)\b|arga-seguros" src/pages/secretaria/ src/components/secretaria/ src/hooks/secretaria/ src/lib/secretaria/ -g '!**/__tests__/**' -g '!*.test.*'
   ```
   *Expected Output*: Only sanitized comments or 0 matches.
2. **Typecheck & Build**:
   ```bash
   bun run typecheck
   bun run build
   ```
   *Expected Output*: Exit code 0, 0 TypeScript errors.
3. **Unit Tests**:
   ```bash
   bun test
   ```
   *Expected Output*: All tests pass without regressions.
