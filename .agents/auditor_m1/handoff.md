# Forensic Audit Report — Milestone 1: Brand Abstraction in Secretaria & GRC

**Work Product**: Milestone 1 deliverables (`src/secretaria/`, `src/grc/`, `src/hooks/useThirdParties.ts`, `src/lib/secretaria/`, `src/lib/grc/`)  
**Profile**: General Project (Integrity Mode: `development` per `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

### Phase Results

- **Check 1: Hardcoded Literal & Expected Output Detection**: **PASS**  
  Zero hardcoded brand strings (`"ARGA"`, `"TGMS"`, `"@arga-seguros.com"`) present in user-facing JSX, form placeholders, dropdown options, calendar headers, or runtime logic. Residual search matches in `src/` are exclusively developer comments explaining statutory/historical rationale.
- **Check 2: Facade & Dummy Implementation Detection**: **PASS**  
  No dummy implementations, empty mocks, or constant-returning stubs introduced. All abstractions utilize genuine dynamic branding resolution via `useTenantBranding()`, `groupFullLabel()`, `brandName()`, `useCurrentUser()`, or generic legal terminology.
- **Check 3: Pre-populated / Fabricated Verification Artifact Detection**: **PASS**  
  No fake test runners, pre-populated logs, or mock attestation records detected in the workspace.
- **Check 4: Static Typecheck Verification**: **PASS**  
  `bun run typecheck` (`bunx tsc -b --pretty false`) completed with exit code 0 and 0 errors.
- **Check 5: Unit & Integration Test Suite Execution**: **PASS**  
  `bun test` completed with 3,307 passed tests, 152 skipped tests (requiring live Supabase DB connection), and 0 failures across 396 test files.
- **Check 6: Production Build Verification**: **PASS**  
  `bun run build` built successfully in 7.67 seconds with 0 bundling errors.

---

## 1. Observation

### 1.1 Code Modifications Audited
Audited the 28 production/test source files modified in Milestone 1:
- **Secretaria**:
  - `src/components/secretaria/shell/useSecretariaScope.ts`: Line 57-67 abstracts `getPreferredEntity()` to search by `preferredName` (if supplied), root parent (`parentEntityId == null`), or fallback entity.
  - `src/components/secretaria/shell/__tests__/preferred-entity.test.ts`: Verified dynamic unit tests.
  - `src/components/secretaria/shell/SecretariaSidebar.tsx`: Line 223, 228 uses `brandName(branding)`.
  - `src/pages/secretaria/TramitadorStepper.tsx`: Line 898 uses `groupFullLabel(branding)`.
  - `src/pages/secretaria/PersonaNuevaStepper.tsx`: Lines 535, 571, 593, 608 use generic placeholders (`"Sociedad Filial, S.L."`, `"Servicios Corporativos"`, `"persona@empresa.com"`, `"contacto.secundario@empresa.com"`).
  - `src/pages/secretaria/DecisionUnipersonalStepper.tsx`: Line 215 uses `"Sociedad Matriz, S.L.U."`.
  - `src/pages/secretaria/AcuerdoSinSesionStepper.tsx`: Line 840 uses `"secretaria@empresa.com"`.
  - `src/pages/secretaria/TransmisionStepper.tsx`: Line 296 uses `"evidence://ead-trust/TRANSMISION_DOC_01"`.
  - `src/pages/secretaria/sociedad-nueva/StepClasesSeries.tsx`: Line 150 uses `"la sociedad matriz"`.
  - `src/pages/secretaria/ConvocatoriasStepper.tsx`: Lines 1478, 1560, 1603, 1611, 2212, 3092, 4144 use neutral platform defaults (`"repositorio documental privado"`, `"EXP-demo-pending"`, `"Preaviso mínimo (estatutario)"`).
  - `src/lib/secretaria/convocatoria-capa3-resolver.ts`: Line 219 uses neutral documentation repository reference.
  - `src/pages/secretaria/ConvocatoriaDetalle.tsx`: Lines 379, 385 use dynamic host for ICS `UID` and generic `PRODID`.
  - `src/pages/secretaria/MatrizJurisdiccional.tsx`: Lines 65-280 use `groupFullLabel(branding)` and generic filial names (`"Filial España, S.L.U."`, `"Filial Portugal, Unipessoal Lda."`, etc.).
  - `src/components/secretaria/gestor/CatalogoTab.tsx`: Line 545 uses `"Comité Legal Corporativo"`.
  - `src/lib/secretaria/legal-template-approval-plan.ts`: Line 37 uses `"Comite Legal Corporativo"`.
  - `src/lib/secretaria/template-configuration-routing.ts`: Lines 98, 124 use `ROUTING_BASE_URL` (`window.location?.origin` / `"https://governance.local"`).
- **GRC**:
  - `src/pages/grc/IncidentesList.tsx`: Line 204 uses `groupFullLabel(branding)`.
  - `src/pages/grc/Risk360.tsx`: Line 205 uses `groupFullLabel(branding)`.
  - `src/pages/grc/PenalAnticorrupcion.tsx`: Lines 93, 172, 200-201 use `groupFullLabel(branding)`, dynamic `user?.email || "auditor@empresa.com"`, and `"Auditor de Cumplimiento"`.
  - `src/pages/grc/IncidenteDetalle.tsx`: Lines 92-93, 640 use dynamic `user?.email || "compliance@empresa.com"`, `"Responsable de Cumplimiento"`, and `"Consejo de Administración (Sociedad Matriz)"`.
  - `src/pages/grc/TPRM.tsx`: Lines 55-56, 407, 427 use dynamic `user?.email || "compliance@empresa.com"`, `"Responsable de Terceros"`, and neutral CIFA phrasing (`"la entidad"`).
  - `src/pages/grc/Excepciones.tsx`: Line 554 uses `"Consejo de Administración (Sociedad Matriz)"`.
  - `src/pages/grc/Dashboard.tsx`: Line 107 uses `"Handoff plataforma"`.
  - `src/pages/grc/GrcLayout.tsx`: Lines 106, 111, 164 use `brandName(branding)`.
  - `src/pages/grc/modules/audit/Findings.tsx`: Line 115 uses `"Ver en plataforma →"`.
  - `src/pages/grc/modules/dora/PoliciesLink.tsx`: Lines 10, 16 use `"Políticas corporativas..."` and `"Ver todas las políticas →"`.
  - `src/hooks/useThirdParties.ts`: Line 74 generates IDs with prefix `TPRM-` (removing hardcoded `TPRM-ARGA-`).
  - `src/lib/grc/dashboard-readiness.ts`: Lines 386, 673 sanitize diagnostic copy to `"platform shell"`.

### 1.2 Ripgrep Brand Audit Output
```bash
$ rg -i "\b(arga|tgms)\b" src/pages/secretaria src/components/secretaria src/pages/grc src/components/grc -g '!*test*' -g '!*.md'
# Results: All matches are purely explanatory code comments (e.g. "// El Consejo canónico ARGA usa body_type=CDA")
# Verified 0 matches in JSX elements, user strings, or state.

$ rg "arga-seguros.com" src/pages/secretaria src/components/secretaria src/pages/grc src/components/grc src/lib/secretaria src/lib/grc src/hooks/useThirdParties.ts -g '!*test*'
# Results: 0 matches found.
```

### 1.3 Behavioral Execution Results
- `bun run typecheck`: Exit code 0 (0 errors).
- `bun test`: Exit code 0 (3,307 passed, 152 skipped, 0 failed across 396 files, 16.18s).
- `bun run build`: Exit code 0 (Built cleanly in 7.67s).

---

## 2. Logic Chain

1. **Direct Verification of R1 (Hardcoded Reference Removal)**:
   The forensic search confirmed that all user-visible strings, options, badges, links, and placeholder literals were refactored to use `useTenantBranding()`, `useCurrentUser()`, or generic legal terms.
2. **Authenticity of Implementations**:
   The code was examined line-by-line. The scope resolution in `useSecretariaScope.ts` now identifies the group root entity through entity hierarchy (`parentEntityId == null`) rather than a hardcoded string comparison. In `TPRM.tsx` and `PenalAnticorrupcion.tsx`, credentials bind directly to the authenticated session context.
3. **No Regressions or Breaks**:
   The entire test suite ran green (3,307 passing tests), typecheck passed with 0 errors, and the production bundle built without issues.

---

## 3. Caveats

- **Scope Boundary**: Milestone 1 focused on brand and literal abstraction in `src/secretaria/` and `src/grc/`. Milestone 2 contains the creation of `GarriguesStandaloneLayout.tsx` and top-level module switcher packaging.
- **Code Comments**: Historical architectural rationale and LSC decision notes in comments (e.g. references to DL-2 or LSC articles) were deliberately preserved and do not affect runtime behavior or client isolation.

---

## 4. Conclusion

Milestone 1 satisfies all functional, architectural, and forensic integrity criteria under Development Mode. The changes are authentic, free of hardcoded cheating or fake mocks, and preserve 100% demo fidelity while enabling true white-label multi-tenant decoupling.

**Verdict: CLEAN**

---

## 5. Verification Method

To independently reproduce this verification:
```bash
# 1. Typecheck
bun run typecheck

# 2. Test suite
bun test

# 3. Production build
bun run build

# 4. View/component brand grep (verify 0 occurrences in JSX/views)
rg -i "\b(arga|tgms)\b" src/pages/secretaria src/components/secretaria src/pages/grc src/components/grc -g '!*test*' -g '!*.md'
```
