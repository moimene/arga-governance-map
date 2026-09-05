# Changes Log — Milestone 1: Brand Abstraction in Secretaria & GRC

## Overview
Sanitized and abstracted hardcoded brand literals ("ARGA", "TGMS", and demo emails/placeholders) across `src/secretaria/`, `src/grc/`, and related shared hooks/libraries, replacing them with dynamic branding utilities (`useTenantBranding`, `groupFullLabel`, `brandName`) or neutral generic fallbacks.

## Detailed Changes by File

### 1. Secretaria Module
- **`src/components/secretaria/shell/useSecretariaScope.ts`**:
  - Replaced hardcoded lookup for `"ARGA Seguros, S.A."` in `getPreferredEntity()` with dynamic root parent resolution (`entity.parentEntityId == null`) and optional `preferredName` matching.
- **`src/components/secretaria/shell/__tests__/preferred-entity.test.ts`**:
  - Adapted unit test to verify dynamic resolution and preferred name matching.
- **`src/components/secretaria/shell/SecretariaSidebar.tsx`**:
  - Replaced hardcoded `"Volver a TGMS"` bottom navigation button with dynamic `brandName(branding)`.
- **`src/pages/secretaria/TramitadorStepper.tsx`**:
  - Replaced `"ARGA Seguros"` fallback with dynamic `groupFullLabel(branding)`.
- **`src/pages/secretaria/PersonaNuevaStepper.tsx`**:
  - Replaced demo placeholders (`"ARGA Servicios Externos, S.L."`, `"ARGA Servicios"`, `"persona@arga-seguros.com"`, `"contacto.secundario@arga-seguros.com"`) with generic neutral placeholders (`"Sociedad Filial, S.L."`, `"Servicios Corporativos"`, `"persona@empresa.com"`, `"contacto.secundario@empresa.com"`).
- **`src/pages/secretaria/DecisionUnipersonalStepper.tsx`**:
  - Replaced `"Cartera ARGA S.L.U."` placeholder with `"Sociedad Matriz, S.L.U."`.
- **`src/pages/secretaria/AcuerdoSinSesionStepper.tsx`**:
  - Replaced `"secretaria@arga-seguros.com"` placeholder with `"secretaria@empresa.com"`.
- **`src/pages/secretaria/TransmisionStepper.tsx`**:
  - Replaced `"evidence://ead-trust/ARGA_SEG_TRANSMISION_2026_01"` placeholder with generic `"evidence://ead-trust/TRANSMISION_DOC_01"`.
- **`src/pages/secretaria/sociedad-nueva/StepClasesSeries.tsx`**:
  - Replaced `"ARGA Seguros"` in help text with `"la sociedad matriz"`.
- **`src/pages/secretaria/ConvocatoriasStepper.tsx`**:
  - Replaced static `"TGMS"` strings in documentation repository defaults, meeting defaults, error reminders, preaviso labels, and trace copy with neutral platform / statutory references (`"repositorio documental privado"`, `"repositorio documental de la plataforma"`, `"EXP-demo-pending"`, `"Preaviso mínimo (estatutario)"`, `"plataforma"`).
- **`src/lib/secretaria/convocatoria-capa3-resolver.ts`**:
  - Replaced default `"repositorio documental privado TGMS"` with `"Expediente electrónico de Secretaría Societaria (repositorio documental privado)"`.
- **`src/pages/secretaria/ConvocatoriaDetalle.tsx`**:
  - Replaced hardcoded `@arga-seguros.com` UID and `PRODID:-//TGMS//...` in ICS generator with dynamic hostname / generic `PRODID:-//Secretaría Societaria//ES`.
- **`src/pages/secretaria/MatrizJurisdiccional.tsx`**:
  - Replaced static `"ARGA Seguros S.A."` in banner and process flow with dynamic `{groupFullLabel(branding)}` and `"Sociedad Matriz"`.
  - Replaced hardcoded `"Cartera ARGA"` and filial brand names with generic filial names (`"Filial España, S.L.U."`, `"Filial Portugal, Unipessoal Lda."`, `"Filial Brasil Ltda."`, `"Filial México S.A. de C.V."`).
  - Replaced `"TGMS"` badges and headers with `"Plataforma"`.
  - Sanitized `MATERIAS_GRUPO` `decide_en` strings to reference `"Sociedad Matriz (ES)"`.
- **`src/components/secretaria/gestor/CatalogoTab.tsx`**:
  - Replaced fallback `"Comité Legal TGMS"` with `"Comité Legal Corporativo"`.
- **`src/lib/secretaria/legal-template-approval-plan.ts`**:
  - Replaced `"Comite Legal ARGA"` with `"Comite Legal Corporativo"`.
- **`src/lib/secretaria/template-configuration-routing.ts`**:
  - Replaced `"https://tgms.local"` with dynamic origin `ROUTING_BASE_URL` (`window.location?.origin` / `"https://governance.local"`).

### 2. GRC Module & Hooks
- **`src/pages/grc/IncidentesList.tsx`**:
  - Replaced fallback `"Grupo ARGA Seguros"` with dynamic `groupFullLabel(branding)`.
- **`src/pages/grc/Risk360.tsx`**:
  - Replaced fallback `"Grupo ARGA Seguros"` with dynamic `groupFullLabel(branding)`.
- **`src/pages/grc/PenalAnticorrupcion.tsx`**:
  - Replaced fallback `"Grupo ARGA Seguros"` with dynamic `groupFullLabel(branding)`.
  - Replaced hardcoded `"Lucía Martín"` and `"lucia@arga-seguros.com"` initial states with dynamic user email (`user?.email || "auditor@empresa.com"`) and generic `"Auditor de Cumplimiento"`.
  - Sanitized description in `DELITOS_TAXONOMY` to replace `"en nombre de ARGA Seguros"` with `"en nombre de la entidad"`.
- **`src/pages/grc/IncidenteDetalle.tsx`**:
  - Replaced hardcoded signatory credentials with dynamic user email and generic `"Responsable de Cumplimiento"`.
  - Replaced hardcoded dropdown option `"Consejo de Administración (ARGA Seguros S.A.)"` with `"Consejo de Administración (Sociedad Matriz)"`.
- **`src/pages/grc/TPRM.tsx`**:
  - Replaced hardcoded signatory credentials with dynamic user email and generic `"Responsable de Terceros"`.
  - Sanitized CIFA questions (q1, q5) to replace `"ARGA"` with `"la entidad"`.
- **`src/pages/grc/Excepciones.tsx`**:
  - Replaced hardcoded dropdown option `"Consejo de Administración (ARGA Seguros S.A.)"` with `"Consejo de Administración (Sociedad Matriz)"`.
- **`src/pages/grc/Dashboard.tsx`**:
  - Replaced `tgms_handoff` display string with `"Handoff plataforma"`.
- **`src/pages/grc/GrcLayout.tsx`**:
  - Replaced hardcoded `"Volver a TGMS"` button and `TGMS` breadcrumbs with dynamic `brandName(branding)`.
- **`src/pages/grc/modules/audit/Findings.tsx`**:
  - Replaced `"Ver en TGMS →"` link with `"Ver en plataforma →"`.
- **`src/pages/grc/modules/dora/PoliciesLink.tsx`**:
  - Replaced `"Políticas del shell TGMS..."` copy with `"Políticas corporativas..."` and `"Ver todas las políticas →"`.
- **`src/hooks/useThirdParties.ts`**:
  - Replaced prefix `TPRM-ARGA-` with generic `TPRM-`.
- **`src/lib/grc/dashboard-readiness.ts`**:
  - Sanitized diagnostic copy referencing `"TGMS shell"` and `"TGMS policies route"` to `"platform shell"` and `"Core policies route"`.

## Verification
- `bun run typecheck`: Passed (0 errors).
- `bun test`: Passed (3307 passed, 152 skipped, 0 failed across 396 test files).
- `bun run build`: Built successfully in 7.78s without errors.
- `rg -i "\b(arga|tgms)\b"`: 0 hardcoded brand literals in JSX/views.
