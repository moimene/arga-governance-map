## 2026-08-27T06:03:02Z

You are Worker M1 tasked with implementing Milestone 1: Abstraction and removal of hardcoded ARGA and TGMS references across the Secretaria and GRC modules.

Your working directory is: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/worker_m1
Project Root: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map
Authoritative User Request: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/ORIGINAL_REQUEST.md
Project Scope Document: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/PROJECT.md

Explorer Investigation Inputs (read these first):
- Secretaria Findings: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_secretaria/analysis.md
- GRC Findings: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_grc/analysis.md

Task Scope:
1. In `src/secretaria/`:
   - `src/components/secretaria/shell/useSecretariaScope.ts`: Remove hardcoded `"ARGA Seguros, S.A."` search; resolve primary parent entity dynamically (e.g. `parentEntityId == null` or first active entity).
   - `src/pages/secretaria/TramitadorStepper.tsx`: Replace fallback `"ARGA Seguros"` with dynamic `groupFullLabel(branding)` or `selectedEntity?.legalName`.
   - `src/pages/secretaria/PersonaNuevaStepper.tsx`: Replace demo placeholders ("ARGA Servicios Externos, S.L.", "ARGA Servicios", "persona@arga-seguros.com", "contacto.secundario@arga-seguros.com") with generic neutral placeholders ("Sociedad Filial, S.L.", "contacto@empresa.com", etc.).
   - `src/pages/secretaria/DecisionUnipersonalStepper.tsx`: Replace placeholder "Cartera ARGA S.L.U." with generic "Sociedad Matriz, S.L.U.".
   - `src/pages/secretaria/AcuerdoSinSesionStepper.tsx`: Replace placeholder "secretaria@arga-seguros.com" with generic "secretaria@empresa.com".
   - `src/pages/secretaria/TransmisionStepper.tsx`: Replace placeholder with generic "evidence://ead-trust/TRANSMISION_DOC_01".
   - `src/pages/secretaria/sociedad-nueva/StepClasesSeries.tsx`: Replace helper text "ARGA Seguros" with dynamic/generic label.
   - `src/pages/secretaria/ConvocatoriasStepper.tsx` & `src/lib/secretaria/convocatoria-capa3-resolver.ts`: Replace static "TGMS" strings in documentation channels/portals with dynamic `brandName(branding)` or generic "repositorio corporativo".
   - `src/pages/secretaria/ConvocatoriaDetalle.tsx`: Replace "@arga-seguros.com" in ICS UID and PRODID with dynamic hostname / generic PRODID.
   - `src/pages/secretaria/MatrizJurisdiccional.tsx`: Replace static "ARGA Seguros S.A." table strings with dynamic `groupFullLabel(branding)` and generic filial labels.
   - `src/components/secretaria/gestor/CatalogoTab.tsx`: Replace "Comité Legal TGMS" with "Comité Legal Corporativo".
   - `src/lib/secretaria/legal-template-approval-plan.ts`: Replace "Comite Legal ARGA" with "Comite Legal Corporativo".
   - `src/lib/secretaria/template-configuration-routing.ts`: Replace "https://tgms.local" with window origin or generic URL.

2. In `src/grc/` & hooks:
   - `src/pages/grc/IncidentesList.tsx` & `src/pages/grc/Risk360.tsx`: Replace fallback `"Grupo ARGA Seguros"` with `groupFullLabel(branding)`.
   - `src/pages/grc/PenalAnticorrupcion.tsx`: Replace fallback `"Grupo ARGA Seguros"` with `groupFullLabel(branding)`, replace hardcoded `"Lucía Martín"` / `"lucia@arga-seguros.com"` initial states with dynamic user context or generic compliance state, sanitize description referencing "ARGA Seguros".
   - `src/pages/grc/IncidenteDetalle.tsx` & `src/pages/grc/TPRM.tsx`: Replace hardcoded `"Lucía Martín"` / `"lucia@arga-seguros.com"` with generic/dynamic state, replace hardcoded option `"Consejo de Administración (ARGA Seguros S.A.)"` with `"Consejo de Administración (Sociedad Matriz)"` or dynamic entity name.
   - `src/pages/grc/Excepciones.tsx`: Replace hardcoded `"Consejo de Administración (ARGA Seguros S.A.)"` with dynamic/generic label.
   - `src/pages/grc/TPRM.tsx`: Sanitize questions at lines 405, 425 to use "la entidad" / "la organización".
   - `src/pages/grc/Dashboard.tsx`: Sanitize `tgms_handoff` display string if needed.
   - `src/pages/grc/modules/audit/Findings.tsx` & `src/pages/grc/modules/dora/PoliciesLink.tsx`: Replace "TGMS" link texts with generic platform navigation.
   - `src/hooks/useThirdParties.ts`: Replace `TPRM-ARGA-` prefix with `TPRM-`.
   - `src/lib/grc/dashboard-readiness.ts` & `src/lib/grc/__tests__/dashboard-readiness.test.ts`: Sanitize diagnostic copy referencing TGMS.

3. Verification:
   - Run `bun run typecheck`
   - Run `bun test`
   - Run `bun run build`
   - Verify `rg -i "\b(arga|tgms)\b" src/pages/grc src/components/grc src/pages/secretaria src/components/secretaria` has 0 hardcoded brand literals in views.
