# GRC Module Decoupling Audit & Remediation Plan

## Executive Summary

This report delivers a complete, exhaustive survey of all hardcoded references to **"ARGA"**, **"arga"**, **"TGMS"**, **"tgms"**, demo emails, company names, and demo-specific data across the GRC module (`src/pages/grc/`, `src/components/grc/`, `src/lib/grc/`, and associated hooks).

A total of **21 exact occurrences** across **10 files** (plus diagnostic/test metadata) were identified, analyzed, and mapped to a concrete replacement strategy using the existing `TenantBrandContext`, helper utilities in `@/lib/tenant-brand-labels`, dynamic user context, and generic domain fallbacks.

---

## 1. Inventory of Files Analyzed

The following surface areas were scanned and audited:

### Pages (`src/pages/grc/`) — 15 files
- `Alertas.tsx` (Clean of hardcoding)
- `Dashboard.tsx` (**1 occurrence**)
- `Excepciones.tsx` (**1 occurrence**)
- `GrcLayout.tsx` (**3 occurrences**)
- `IncidenteDetalle.tsx` (**2 occurrences**)
- `IncidenteStepper.tsx` (Clean of hardcoding)
- `IncidentesList.tsx` (**1 occurrence**)
- `ModuleDashboard.tsx` (Clean of hardcoding)
- `MyWork.tsx` (Clean of hardcoding)
- `PackDetalle.tsx` (Clean of hardcoding)
- `PacksPage.tsx` (Clean of hardcoding)
- `PenalAnticorrupcion.tsx` (**3 occurrences**)
- `Risk360.tsx` (**1 occurrence**)
- `RiskEditor.tsx` (Clean of hardcoding)
- `TPRM.tsx` (**3 occurrences**)

### Module Subpages (`src/pages/grc/modules/`) — 15 files
- `audit/ActionPlans.tsx` (Clean of hardcoding)
- `audit/Findings.tsx` (**1 occurrence**)
- `audit/Program.tsx` (Clean of hardcoding)
- `cyber/Incidents.tsx` (Clean of hardcoding)
- `cyber/SOC.tsx` (Clean of hardcoding)
- `cyber/Vulnerabilities.tsx` (Clean of hardcoding)
- `dora/BCM.tsx` (Clean of hardcoding)
- `dora/Incidents.tsx` (Clean of hardcoding)
- `dora/PoliciesLink.tsx` (**2 occurrences**)
- `dora/RTO.tsx` (Clean of hardcoding)
- `dora/Thresholds.tsx` (Clean of hardcoding)
- `gdpr/DPIAs.tsx` (Clean of hardcoding)
- `gdpr/DPO.tsx` (Clean of hardcoding)
- `gdpr/DSARs.tsx` (Clean of hardcoding)
- `gdpr/ROPA.tsx` (Clean of hardcoding)

### Shared GRC Components (`src/components/grc/`) — 3 files
- `ModuleShell.tsx` (Clean of hardcoding)
- `ModuleSidebar.tsx` (Clean of hardcoding)
- `SectionRouter.tsx` (Clean of hardcoding)

### GRC Libraries & Tests (`src/lib/grc/`) — 4 files
- `dashboard-readiness.ts` (**6 occurrences** in diagnostic copy / posture keys)
- `status-labels.ts` (Clean of hardcoding)
- `__tests__/dashboard-readiness.test.ts` (**2 occurrences** in test expectations)
- `__tests__/status-labels.test.ts` (Clean of hardcoding)

### Hooks & Context (`src/hooks/` & `src/context/`)
- `src/hooks/useThirdParties.ts` (**1 occurrence** in ID generation)
- `src/context/TenantBrandContext.tsx` (Analyzed provider & hooks)
- `src/lib/tenant-brand-labels.ts` (Analyzed label helper contract)

---

## 2. Complete Inventory of Occurrences

| Item | File Path | Line | Category | Exact Hardcoded Code Snippet | Remediation Strategy |
|---|---|---|---|---|---|
| **#1** | `src/pages/grc/IncidentesList.tsx` | 201 | Company / Group Scope | `: "Grupo ARGA Seguros";` | Use `groupFullLabel(branding)` from `@/lib/tenant-brand-labels` with `useTenantBranding()`. |
| **#2** | `src/pages/grc/Risk360.tsx` | 202 | Company / Group Scope | `: "Grupo ARGA Seguros";` | Use `groupFullLabel(branding)` with `useTenantBranding()`. |
| **#3** | `src/pages/grc/PenalAnticorrupcion.tsx` | 93 | Demo Taxonomy Copy | `description: "Riesgo de que agentes o socios comerciales realicen pagos ilícitos en nombre de ARGA Seguros para retener cuentas corporativas."` | Replace `"en nombre de ARGA Seguros"` with generic `"en nombre de la entidad"`. |
| **#4** | `src/pages/grc/PenalAnticorrupcion.tsx` | 167 | Company / Group Scope | `: "Grupo ARGA Seguros";` | Use `groupFullLabel(branding)` with `useTenantBranding()`. |
| **#5** | `src/pages/grc/PenalAnticorrupcion.tsx` | 196 | Demo Email & Signer | `const [auditorEmail, setAuditorEmail] = useState("lucia@arga-seguros.com");` (and line 195 `auditorName: "Lucía Martín"`) | Default to authenticated user email via `useCurrentUser()` / auth state (`user?.email || "auditor@empresa.com"`). |
| **#6** | `src/pages/grc/IncidenteDetalle.tsx` | 92 | Demo Email & Signer | `const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");` (and line 91 `signatoryName: "Lucía Martín"`) | Default to authenticated user email (`user?.email || "compliance@empresa.com"`). |
| **#7** | `src/pages/grc/IncidenteDetalle.tsx` | 638 | Hardcoded Entity in Modal | `<option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>` | Replace with generic/dynamic label: `<option value="CDA">Consejo de Administración (Sociedad Matriz)</option>` or dynamic scope/branding name. |
| **#8** | `src/pages/grc/Excepciones.tsx` | 554 | Hardcoded Entity in Modal | `<option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>` | Replace with generic/dynamic label: `<option value="CDA">Consejo de Administración (Sociedad Matriz)</option>` or dynamic scope/branding name. |
| **#9** | `src/pages/grc/TPRM.tsx` | 54 | Demo Email & Signer | `const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");` (and line 53 `signatoryName: "Lucía Martín"`) | Default to authenticated user email (`user?.email || "compliance@empresa.com"`). |
| **#10** | `src/pages/grc/TPRM.tsx` | 405 | Demo Entity in Copy | `desc: "¿Una caída o interrupción total de este servicio detiene operaciones aseguradoras o de facturación críticas de ARGA?"` | Replace with `"¿Una caída o interrupción total de este servicio detiene operaciones de negocio o de facturación críticas de la entidad?"` |
| **#11** | `src/pages/grc/TPRM.tsx` | 425 | Demo Entity in Copy | `desc: "¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de ARGA centralizando el riesgo?"` | Replace with `"¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de la entidad centralizando el riesgo?"` |
| **#12** | `src/pages/grc/GrcLayout.tsx` | 106 | Shell / Platform Branding | `aria-label="Volver al shell TGMS"` | Replace with `aria-label={`Volver a ${brandName(branding)}`}` or generic `"Volver a plataforma"`. |
| **#13** | `src/pages/grc/GrcLayout.tsx` | 111 | Shell / Platform Branding | `<span>Volver a TGMS</span>` | Replace with `<span>Volver a {brandName(branding)}</span>` (or `"Volver a Plataforma"`). |
| **#14** | `src/pages/grc/GrcLayout.tsx` | 164 | Shell / Platform Branding | `<span>TGMS</span>` (Breadcrumb root) | Replace with `<span>{brandName(branding)}</span>` or `<span>{shellLabel(branding)}</span>`. |
| **#15** | `src/pages/grc/Dashboard.tsx` | 107 | Posture Label | `tgms_handoff: "TGMS handoff",` in `SOURCE_POSTURE_LABEL` | Replace with `"Handoff plataforma"` or `"Platform handoff"` or dynamic `${brandName(branding)} handoff`. |
| **#16** | `src/pages/grc/modules/audit/Findings.tsx` | 115 | Navigation Copy | `Ver en TGMS →` | Replace with `Ver en plataforma →` or `Ver hallazgo →` or dynamic `Ver en ${brandName(branding)} →`. |
| **#17** | `src/pages/grc/modules/dora/PoliciesLink.tsx` | 10 | Context Copy | `Políticas del shell TGMS asociadas al marco DORA de resiliencia ICT.` | Replace with `"Políticas corporativas asociadas al marco DORA de resiliencia ICT."` |
| **#18** | `src/pages/grc/modules/dora/PoliciesLink.tsx` | 16 | Navigation Copy | `Ver todas las políticas en TGMS →` | Replace with `"Ver todas las políticas →"` or dynamic `Ver en ${brandName(branding)} →`. |
| **#19** | `src/hooks/useThirdParties.ts` | 74 | Hardcoded ID Prefix | `const id = input.id || \`TPRM-ARGA-\${Math.floor(100 + Math.random() * 900)}\`;` | Replace with generic prefix `TPRM-${Math.floor(1000 + Math.random() * 9000)}`. |
| **#20** | `src/lib/grc/dashboard-readiness.ts` | 11, 386, 411, 424, 672, 673, 893 | Diagnostic Metadata | Strings `"shared with TGMS shell"`, `"TGMS policies route"`, type `"tgms_handoff"` | Update diagnostic copy to `"platform shell"`, `"Core policies route"`, and maintain or alias posture type. |
| **#21** | `src/lib/grc/__tests__/dashboard-readiness.test.ts` | 136, 184 | Test Assertions | Asserts `"tgms_handoff"` | Synchronize test assertions if posture type is renamed. |

---

## 3. Detailed File-by-File Analysis

### 3.1 `src/pages/grc/IncidentesList.tsx`
- **Location:** Line 201
- **Code:**
  ```tsx
  const scopeLabel =
    scope.mode === "sociedad" && scope.selectedEntity
      ? scope.selectedEntity.legalName
      : "Grupo ARGA Seguros";
  ```
- **Analysis:** When in "grupo" mode, the page hardcodes `"Grupo ARGA Seguros"`.
- **Recommendation:**
  ```tsx
  import { useTenantBranding } from "@/context/TenantBrandContext";
  import { groupFullLabel } from "@/lib/tenant-brand-labels";
  ...
  const branding = useTenantBranding();
  const scopeLabel =
    scope.mode === "sociedad" && scope.selectedEntity
      ? scope.selectedEntity.legalName
      : groupFullLabel(branding);
  ```

### 3.2 `src/pages/grc/Risk360.tsx`
- **Location:** Line 202
- **Code:**
  ```tsx
  const scopeLabel =
    scope.mode === "sociedad" && scope.selectedEntity
      ? scope.selectedEntity.legalName
      : "Grupo ARGA Seguros";
  ```
- **Analysis:** Identical pattern to `IncidentesList.tsx`.
- **Recommendation:** Use `useTenantBranding()` and `groupFullLabel(branding)`.

### 3.3 `src/pages/grc/PenalAnticorrupcion.tsx`
- **Location:** Lines 93, 167, 196
- **Code:**
  - Line 93: `description: "Riesgo de que agentes o socios comerciales realicen pagos ilícitos en nombre de ARGA Seguros para retener cuentas corporativas."`
  - Line 167: `: "Grupo ARGA Seguros";`
  - Line 195-196: `const [auditorName, setAuditorName] = useState("Lucía Martín"); const [auditorEmail, setAuditorEmail] = useState("lucia@arga-seguros.com");`
- **Analysis:**
  - Line 93 is static fallback seed copy for the compliance taxonomy.
  - Line 167 is the group scope label.
  - Line 196 is a hardcoded signer email for e-archiving evidence sealing.
- **Recommendation:**
  - Line 93: Replace with `"Riesgo de que agentes o socios comerciales realicen pagos ilícitos en nombre de la entidad para retener cuentas corporativas."`
  - Line 167: Replace with `groupFullLabel(branding)`.
  - Line 195-196: Pre-populate from `useCurrentUser()` (`user?.nombre || "Auditor de Cumplimiento"`, `user?.email || "auditor@empresa.com"`).

### 3.4 `src/pages/grc/IncidenteDetalle.tsx`
- **Location:** Lines 91-92, 638
- **Code:**
  - Lines 91-92: `const [signatoryName, setSignatoryName] = useState("Lucía Martín"); const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");`
  - Line 638: `<option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>`
- **Analysis:**
  - Lines 91-92 hardcode the certifier.
  - Line 638 in the Escalation Modal hardcodes `ARGA Seguros S.A.` in the select dropdown.
- **Recommendation:**
  - Lines 91-92: Pre-populate from `useCurrentUser()` / auth state.
  - Line 638: Change to `<option value="CDA">Consejo de Administración (Sociedad Matriz)</option>` or dynamically format with `scope.selectedEntity?.legalName ?? groupFullLabel(branding)`.

### 3.5 `src/pages/grc/Excepciones.tsx`
- **Location:** Line 554
- **Code:**
  - Line 554: `<option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>`
- **Analysis:** Same escalation modal dropdown as `IncidenteDetalle.tsx`.
- **Recommendation:** Change to `<option value="CDA">Consejo de Administración (Sociedad Matriz)</option>` or dynamic scope resolution.

### 3.6 `src/pages/grc/TPRM.tsx`
- **Location:** Lines 53-54, 405, 425
- **Code:**
  - Lines 53-54: `const [signatoryName, setSignatoryName] = useState("Lucía Martín"); const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");`
  - Line 405: `desc: "¿Una caída o interrupción total de este servicio detiene operaciones aseguradoras o de facturación críticas de ARGA?"`
  - Line 425: `desc: "¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de ARGA centralizando el riesgo?"`
- **Analysis:**
  - Lines 53-54 hardcode certifier identity.
  - Lines 405 & 425 hardcode `ARGA` in CIFA assessment questionnaires.
- **Recommendation:**
  - Lines 53-54: Pre-populate from `useCurrentUser()`.
  - Line 405: Change to `"¿Una caída o interrupción total de este servicio detiene operaciones de negocio o de facturación críticas de la entidad?"`
  - Line 425: Change to `"¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de la entidad centralizando el riesgo?"`

### 3.7 `src/pages/grc/GrcLayout.tsx`
- **Location:** Lines 106, 111, 164
- **Code:**
  - Line 106: `aria-label="Volver al shell TGMS"`
  - Line 111: `<span>Volver a TGMS</span>`
  - Line 164: `<span>TGMS</span>`
- **Analysis:** Layout sidebar bottom action and breadcrumbs hardcode `"TGMS"`. Note that lines 121 and 125 of `GrcLayout.tsx` already use `useTenantBranding()` and `groupFullLabel(branding)`.
- **Recommendation:**
  - Line 106: `aria-label={`Volver a ${brandName(branding)}`}`
  - Line 111: `<span>Volver a {brandName(branding)}</span>`
  - Line 164: `<span>{brandName(branding)}</span>`

### 3.8 `src/pages/grc/Dashboard.tsx`
- **Location:** Line 107
- **Code:**
  - Line 107: `tgms_handoff: "TGMS handoff",` in `SOURCE_POSTURE_LABEL`
- **Analysis:** Readiness diagnostic posture badge label displays `"TGMS handoff"`.
- **Recommendation:**
  - Change to `"Handoff plataforma"` or `"Platform handoff"`.

### 3.9 `src/pages/grc/modules/audit/Findings.tsx`
- **Location:** Line 115
- **Code:**
  - Line 115: `<Link to={`/hallazgos/${f.code}`}>Ver en TGMS →</Link>`
- **Analysis:** Link from GRC audit finding to root finding view hardcodes `"TGMS"`.
- **Recommendation:**
  - Change to `Ver en plataforma →` or `Ver detalle →`.

### 3.10 `src/pages/grc/modules/dora/PoliciesLink.tsx`
- **Location:** Lines 10, 16
- **Code:**
  - Line 10: `Políticas del shell TGMS asociadas al marco DORA de resiliencia ICT.`
  - Line 16: `Ver todas las políticas en TGMS →`
- **Analysis:** Text and button link to policies view hardcode `"TGMS"`.
- **Recommendation:**
  - Line 10: `"Políticas corporativas asociadas al marco DORA de resiliencia ICT."`
  - Line 16: `"Ver todas las políticas →"`

### 3.11 `src/hooks/useThirdParties.ts`
- **Location:** Line 74
- **Code:**
  - `const id = input.id || \`TPRM-ARGA-\${Math.floor(100 + Math.random() * 900)}\`;`
- **Analysis:** Mutation fallback ID embeds demo company code `ARGA`.
- **Recommendation:**
  - Change to `const id = input.id || \`TPRM-\${Math.floor(1000 + Math.random() * 9000)}\`;`

### 3.12 `src/lib/grc/dashboard-readiness.ts` & Tests
- **Location:** Lines 11, 386, 411, 424, 672, 673, 893
- **Analysis:**
  - Diagnostic copy refers to `"TGMS shell"` and `"TGMS policies route"`.
  - Type `GrcSourcePosture` has `"tgms_handoff"`.
- **Recommendation:**
  - Update strings to `"platform shell"` and `"Core policies route"`.
  - If renaming type `tgms_handoff` to `platform_handoff`, update both `dashboard-readiness.ts` and `dashboard-readiness.test.ts` in lockstep.

---

## 4. Integration with TenantBrandContext and Shared Infrastructure

### Current Capabilities of `TenantBrandContext`:
1. `useTenantBranding()` returns `TenantBranding | null`:
   ```ts
   export interface TenantBranding {
     nombre?: string;
     shell_label?: string;
     scope_label?: string;
     sii_org_label?: string;
     tokens?: Record<string, string>;
   }
   ```
2. Helper functions in `@/lib/tenant-brand-labels`:
   - `brandName(branding)`: defaults to `"TGMS"` when branding is null or empty.
   - `shellLabel(branding)`: defaults to `"TGMS PLATFORM"`.
   - `scopeLabel(branding)`: defaults to `"Grupo ARGA"`.
   - `groupFullLabel(branding)`: defaults to `"Grupo ARGA Seguros"`.
   - `groupPortfolioLabel(branding)`: defaults to `"Vista de grupo: cartera societaria ARGA"`.

### Decoupling Strategy:
- **Views & Components in GRC:** Must never have literal `"ARGA"` or `"TGMS"` strings.
- All display names must pass through `useTenantBranding()` and the helper functions in `@/lib/tenant-brand-labels`.
- All fallback copy for generic text (e.g. CIFA questions, Penal taxonomy descriptions) must use domain-neutral terminology ("la entidad", "la organización").
- All email inputs must initialize from `useCurrentUser()` rather than demo email strings.

---

## 5. Standalone Packaging Considerations (`GarriguesStandaloneLayout`)

The GRC module already has its own layout shell: `src/pages/grc/GrcLayout.tsx`.
- It uses the Garrigues brand identity (`--g-*` tokens, Pantone 3308 C `#004438`, Montserrat typography).
- It provides its own navigation sidebar with `ScopeSwitcher` (`/grc`, `/grc/risk-360`, `/grc/tprm`, `/grc/penal-anticorrupcion`, `/grc/packs`, `/grc/mywork`, `/grc/alertas`, `/grc/excepciones`).
- When embedded in `GarriguesStandaloneLayout` (for clients without the main TGMS shell), `GrcLayout` can simply omit the "Volver a TGMS" button or conditionally route back to the standalone hub if no parent shell exists.

---

## 6. Implementation Checklist for Remediation Agent

- [ ] `src/pages/grc/IncidentesList.tsx`: Import `useTenantBranding`, `groupFullLabel`; replace line 201.
- [ ] `src/pages/grc/Risk360.tsx`: Import `useTenantBranding`, `groupFullLabel`; replace line 202.
- [ ] `src/pages/grc/PenalAnticorrupcion.tsx`: Replace lines 93, 167, 195-196.
- [ ] `src/pages/grc/IncidenteDetalle.tsx`: Replace lines 91-92, 638.
- [ ] `src/pages/grc/Excepciones.tsx`: Replace line 554.
- [ ] `src/pages/grc/TPRM.tsx`: Replace lines 53-54, 405, 425.
- [ ] `src/pages/grc/GrcLayout.tsx`: Replace lines 106, 111, 164 with dynamic brand helpers.
- [ ] `src/pages/grc/Dashboard.tsx`: Replace line 107 label.
- [ ] `src/pages/grc/modules/audit/Findings.tsx`: Replace line 115 link text.
- [ ] `src/pages/grc/modules/dora/PoliciesLink.tsx`: Replace lines 10, 16 copy and link text.
- [ ] `src/hooks/useThirdParties.ts`: Replace line 74 ID generator prefix.
- [ ] `src/lib/grc/dashboard-readiness.ts` & `dashboard-readiness.test.ts`: Clean diagnostic strings.
- [ ] Run `bun test` and `bun run build` to confirm 0 errors.
