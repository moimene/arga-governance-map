# Exhaustive Survey & Decoupling Analysis: Secretaria Module (`src/secretaria/`)

> **Explorer Agent**: `explorer_survey_secretaria`  
> **Investigation Date**: 2026-08-27  
> **Target Scope**: All files in `src/pages/secretaria/`, `src/components/secretaria/`, `src/hooks/secretaria/`, and `src/lib/secretaria/`  
> **Project Context**: `arga-governance-map` — Decoupling Garrigues modules from ARGA demo environment.

---

## 1. Executive Summary

An exhaustive investigation was performed across all 190+ source and test files comprising the **Secretaría Societaria** module (`src/pages/secretaria/`, `src/components/secretaria/`, `src/hooks/secretaria/`, `src/lib/secretaria/`).

### Key Findings
1. **Core Database Isolation**: The module runtime is already tenant-isolated via `useTenantContext()` (`tenantId` dynamically retrieved from Supabase Auth / `user_profiles`). There are **no hardcoded tenant UUIDs** or entity UUIDs in production UI / stepper logic.
2. **Hardcoded Brand & Demo References**: A total of **15 production files** contain literal strings referencing `"ARGA"`, `"arga"`, `"TGMS"`, `"tgms"`, or demo email domains (`@arga-seguros.com`).
3. **Categories of Hardcoded Strings**:
   - **Shell & Scope Fallbacks**: Explicit check for `"ARGA Seguros, S.A."` in `useSecretariaScope.ts` and `"Volver a TGMS"` in `SecretariaSidebar.tsx`.
   - **Form Placeholders & Helpers**: Input placeholders with `@arga-seguros.com` or `"Cartera ARGA S.L.U."` across 5 steppers.
   - **Default Capa 3 Template Values**: Handlebars resolver defaults emitting `"repositorio documental privado de TGMS"` or `"expediente electrónico de convocatoria TGMS"`.
   - **ICS Calendar Metadata**: Hardcoded UID domain (`@arga-seguros.com`) and PRODID header (`PRODID:-//TGMS//Secretaría Societaria//ES`) in `ConvocatoriaDetalle.tsx`.
   - **Multi-Jurisdiction Fallback Mock Data**: Fallback filial names (`"ARGA Seguros Brasil"`, `"ARGA Seguros Portugal"`, etc.) and parent governance labels in `MatrizJurisdiccional.tsx`.
4. **Existing Branding Mechanism**: `src/context/TenantBrandContext.tsx` and `src/lib/tenant-brand-labels.ts` already exist and provide `useTenantBranding()`, `brandName()`, `groupFullLabel()`, and `scopeLabel()`. These provide the ideal foundation for clean dynamic resolution without breaking backwards compatibility.

---

## 2. Detailed Catalog of Production Occurrences

| File Path | Line(s) | Category | Exact Hardcoded Code Snippet | Rationale & Remediation Plan |
|---|---|---|---|---|
| `src/components/secretaria/shell/useSecretariaScope.ts` | 59–62 | Scope Fallback | `entities.find((entity) => entity.legalName === "ARGA Seguros, S.A.") ?? ...` | Remove hardcoded `"ARGA Seguros, S.A."`. Prioritize root parent entity (`entity.parentEntityId == null`), or match against `branding?.nombre` / `branding?.scope_label`, with fallback to `entities[0]`. |
| `src/components/secretaria/shell/SecretariaSidebar.tsx` | 223, 228 | Navigation Button | `aria-label="Volver al shell TGMS"`<br>`<span>Volver a TGMS</span>` | Replace with dynamic `shellLabel(branding)` or `"Volver al Inicio"` / hide in standalone mode. |
| `src/pages/secretaria/TramitadorStepper.tsx` | 895 | Entity Name Fallback | `selectedAgreementLegalName = ... "ARGA Seguros";` | Replace with `branding?.nombre ?? "Sociedad"` or generic default `"Sociedad"`. |
| `src/pages/secretaria/PersonaNuevaStepper.tsx` | 535 | Placeholder | `placeholder={draft.person_type === "PF" ? "Lucía Martín García" : "ARGA Servicios Externos, S.L."}` | Replace with `"Servicios Corporativos, S.L."`. |
| `src/pages/secretaria/PersonaNuevaStepper.tsx` | 571 | Placeholder | `placeholder="ARGA Servicios"` | Replace with `"Servicios Corporativos"`. |
| `src/pages/secretaria/PersonaNuevaStepper.tsx` | 593 | Placeholder | `placeholder="persona@arga-seguros.com"` | Replace with `"persona@empresa.com"`. |
| `src/pages/secretaria/PersonaNuevaStepper.tsx` | 608 | Placeholder | `placeholder="contacto.secundario@arga-seguros.com"` | Replace with `"contacto.secundario@empresa.com"`. |
| `src/pages/secretaria/DecisionUnipersonalStepper.tsx` | 215 | Placeholder | `placeholder="Ejemplo: El socio único de Cartera ARGA S.L.U., en uso de las facultades que le confiere el art. 15 LSC..."` | Replace with `"Ejemplo: El socio único de la sociedad, en uso de las facultades que le confiere el art. 15 LSC, adopta el siguiente acuerdo…"`. |
| `src/pages/secretaria/AcuerdoSinSesionStepper.tsx` | 840 | Placeholder | `placeholder="Ej. secretaria@arga-seguros.com o referencia interna SEC-2026-001"` | Replace with `"Ej. secretaria@empresa.com o referencia interna SEC-2026-001"`. |
| `src/pages/secretaria/TransmisionStepper.tsx` | 296 | Placeholder | `placeholder="evidence://ead-trust/ARGA_SEG_TRANSMISION_2026_01 o DOC-SOC-..."` | Replace with `"evidence://ead-trust/TRANSMISION_2026_01 o DOC-SOC-..."`. |
| `src/pages/secretaria/sociedad-nueva/StepClasesSeries.tsx` | 150 | Helper Text | `help="Ej.: dividendo preferente para ARGA Seguros antes de reparto ordinario."` | Replace with `"Ej.: dividendo preferente para la sociedad matriz antes de reparto ordinario."`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 1478 | Capa 3 Default | `firstText(borradorCapa3Values.canal_documentacion, "repositorio documental privado de TGMS")` | Replace with `"repositorio documental privado de la plataforma"` or dynamic `brandName(branding)`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 1560 | Capa 3 Default | `expediente_id: "expediente electrónico de convocatoria TGMS"` | Replace with `"expediente electrónico de convocatoria"`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 1603 | Capa 3 Default | `canal_documentacion: "repositorio documental TGMS"` | Replace with `"repositorio documental de la plataforma"`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 1611 | Capa 3 Default | `envio_ref: "TGMS-demo-pending"` | Replace with `"EXP-demo-pending"`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 2212 | Error/Warning | `message: "Documento obligatorio recordado por el motor pendiente de incorporación en TGMS."` | Replace with `"Documento obligatorio recordado por el motor pendiente de incorporación en la plataforma."`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 3092 | UI Label | `Preaviso mínimo (TGMS):{" "}` | Replace with `Preaviso mínimo (estatutario):{" "}` or `Preaviso configurado:{" "}`. |
| `src/pages/secretaria/ConvocatoriasStepper.tsx` | 4144 | Helper Text | `...quedan como trazabilidad si una publicación o notificación se ejecuta fuera de TGMS.` | Replace with `...si una publicación o notificación se ejecuta fuera de la plataforma.`. |
| `src/pages/secretaria/ConvocatoriaDetalle.tsx` | 379 | ICS UID | `const uid = \`convocatoria-${Date.now()}@arga-seguros.com\`;` | Replace with `const uid = \`convocatoria-${Date.now()}@governance.local\`;` or use `window.location.hostname`. |
| `src/pages/secretaria/ConvocatoriaDetalle.tsx` | 385 | ICS PRODID | `"PRODID:-//TGMS//Secretaría Societaria//ES"` | Replace with `"PRODID:-//Secretaría Societaria//ES"`. |
| `src/pages/secretaria/MatrizJurisdiccional.tsx` | 65, 91, 117, 145 | Mock Fallback Data | `nombre: "Cartera ARGA S.L.U."`<br>`nombre: "ARGA Seguros Portugal, Unipessoal Lda."`<br>`nombre: "ARGA Seguros Brasil Ltda."`<br>`nombre: "ARGA Seguros México S.A. de C.V."` | Replace mock entity fallbacks with generic names (`"Filial España S.L.U."`, `"Filial Portugal Unipessoal Lda."`, etc.) or derive from live entities list. |
| `src/pages/secretaria/MatrizJurisdiccional.tsx` | 68, 69 | Mock Deadlines | `label: "Inscripción decisión socio único — Cartera ARGA"`<br>`label: "Depósito cuentas anuales Cartera ARGA"` | Replace with generic labels (`"Inscripción decisión socio único — Filial España"`, etc.). |
| `src/pages/secretaria/MatrizJurisdiccional.tsx` | 178, 189, 200, 211 | Decision Body Strings | `decide_en: "CdA ARGA Seguros S.A. (ES) o delegado"`<br>`decide_en: "CdA / JGA ARGA Seguros S.A. (ES)"`<br>`decide_en: "JGA ARGA Seguros S.A. (ES) — mayoría reforzada 2/3"` | Replace with `"CdA Sociedad Matriz (ES) o delegado"`, `"CdA / Junta General Sociedad Matriz (ES)"`, etc. |
| `src/pages/secretaria/MatrizJurisdiccional.tsx` | 280 | Banner Header | `<span className="font-semibold">ARGA Seguros S.A. (España)</span>.` | Replace with `{parentEntity?.legalName ?? groupFullLabel(branding) ?? "Sociedad Matriz (España)"}`. |
| `src/pages/secretaria/MatrizJurisdiccional.tsx` | 451, 452 | Process Flow Steps | `desc: "CdA o Comité Ejecutivo ARGA Seguros S.A. adopta el acuerdo..."`<br>`where: "TGMS España"` | Replace with `"CdA o Comité Ejecutivo de la Sociedad Matriz adopta el acuerdo..."`<br>`where: "Sede España"`. |
| `src/pages/secretaria/MatrizJurisdiccional.tsx` | 545, 619 | UI Badges & Headings | `<span ...>TGMS</span>`<br>`<h3>Reglas activas en TGMS</h3>` | Replace with `<span ...>Plataforma</span>` and `<h3>Reglas activas en la plataforma</h3>`. |
| `src/components/secretaria/gestor/CatalogoTab.tsx` | 545 | Default Fallback Actor | `const transitionActor = user?.email ?? "Comité Legal TGMS";` | Replace with `user?.email ?? "Comité Legal"`. |
| `src/lib/secretaria/convocatoria-capa3-resolver.ts` | 219 | Capa 3 Doc Resolver | `read: () => "Expediente electrónico de Secretaría Societaria (repositorio documental privado TGMS)"` | Replace with `"Expediente electrónico de Secretaría Societaria (repositorio documental privado)"`. |
| `src/lib/secretaria/legal-template-approval-plan.ts` | 37 | Approval Metadata | `approvedBy: "Comite Legal ARGA"` | Replace with `"Comite Legal"`. |
| `src/lib/secretaria/template-configuration-routing.ts` | 98, 124 | Internal Base URL | `new URL(target, "https://tgms.local")` | Replace with standard dummy base `"https://governance.local"` or `"http://localhost"`. |

---

## 3. Informational Code Comments (Non-Executing)

The following files contain comments referencing "ARGA" as documentation of the historical demo requirements or legal rules (DL-2, DL-5, SLP vs SA). These do not affect runtime execution or UI rendering, but can be sanitized during refactoring for absolute cleanliness:

1. `src/pages/secretaria/ActaDetalle.tsx:305`: `// test. Para ARGA (presidente/secretario del CdA real) esto es siempre`
2. `src/pages/secretaria/AcuerdoSinSesionStepper.tsx:115`: `// 2. ARGA tiene body_types 'COMISION' y 'COMITE' (no 'COMISION_DELEGADA').`
3. `src/pages/secretaria/AcuerdoSinSesionStepper.tsx:251`: `// evaluaba pactos; ahora un veto de operación estructural (Fundación ARGA...`
4. `src/pages/secretaria/CatalogoMaterias.tsx:373`: `// tipoSocial — ARGA (SA) veía las 6 materias SLP de la Junta de Socios`
5. `src/pages/secretaria/CoAprobacionStepper.tsx:526`: `// operación estructural (Fundación ARGA) dispara su advertencia contractual.`
6. `src/pages/secretaria/ConvocatoriaDetalle.tsx:109`: `// El Consejo canónico ARGA usa body_type=CDA.`
7. `src/pages/secretaria/ConvocatoriasStepper.tsx:152`: `// mapping inicial solo cubría 'CDA' y 'COMISION_DELEGADA' pero ARGA...`
8. `src/pages/secretaria/ConvocatoriasStepper.tsx:2624`: `{/* ITEM-095: copy honesto — TGMS registra los canales, no realiza el envío. */}`
9. `src/pages/secretaria/ConvocatoriasStepper.tsx:3479`: `// (las 6 SLP) no aparezcan en una convocatoria de ARGA (SA).`
10. `src/pages/secretaria/Dashboard.tsx:840`: `// cuando el usuario arrancaba con scope ARGA seleccionado.`
11. `src/pages/secretaria/DecisionUnipersonalStepper.tsx:346`: `// gate por tipoSocial — ARGA (SA) veía las 6 materias SLP de Garrigues.`
12. `src/pages/secretaria/MatrizJurisdiccional.tsx:2, 42, 167`: Comments describing Spanish SA governance model vs filiales.
13. `src/pages/secretaria/ReunionStepper.tsx:298`: `// Ejecutivo de ARGA (body_type COMITE → COMISION_DELEGADA) tiene`
14. `src/pages/secretaria/SolidarioStepper.tsx:440`: `// veto de operación estructural (Fundación ARGA) dispara su advertencia`
15. `src/components/secretaria/PactosCompliancePanel.tsx:15`: `// operación estructural (p. ej. Fundación ARGA sobre FUSION/ESCISION) dispare`
16. `src/components/secretaria/shell/types.ts:19`: `// preferencia de matriz en getPreferredEntity para tenants sin hardcode ARGA.`
17. `src/lib/secretaria/operational-bodies.ts:31`: `// apareciendo (p.ej. /organos, fichas de entidad) — no tocarlo. ARGA no`
18. `src/lib/secretaria/informe-preceptivo-gate.ts:8, 9`: `// slug garrigues-junta-socios — ARGA no tiene esa clave en ningún órgano...`
19. `src/lib/secretaria/agenda-materias.ts:145, 392, 503`: Comments explaining SLP vs SA behavior.
20. `src/lib/secretaria/data-class.ts:10`: `// (localStorage \`tgms.includeTestData=1\` o \`?includeTest=1\`), porque sus specs crean`

---

## 4. Test Fixtures and Unit Test Files

Unit test files under `src/lib/secretaria/__tests__/`, `src/components/secretaria/__tests__/`, `src/pages/secretaria/__tests__/`, and `src/hooks/secretaria/__tests__/` contain mock data using `"ARGA Seguros, S.A."`, `"tenant-arga"`, `"6d7ed736-f263-4531-a59d-c6ca0cd41602"`, `"admin@arga-seguros.com"`, etc.

Examples of fixture files:
- `src/lib/secretaria/__tests__/acta-legal-structure.test.ts`
- `src/lib/secretaria/__tests__/agreement-template-compatibility.test.ts`
- `src/lib/secretaria/__tests__/group-campaign-engine.test.ts`
- `src/lib/secretaria/__tests__/junta-universal.test.ts`
- `src/lib/secretaria/__tests__/legal-artifact-manifest.fixture.ts`
- `src/lib/secretaria/__tests__/libros-societarios.test.ts`
- `src/lib/secretaria/__tests__/matter-execution-profile.test.ts`
- `src/lib/secretaria/__tests__/operational-bodies.test.ts`
- `src/lib/secretaria/__tests__/rule-manager-contract.test.ts`
- `src/lib/secretaria/__tests__/rule-pack-params.test.ts`
- `src/lib/secretaria/__tests__/standalone-certifications.test.ts`
- `src/lib/secretaria/__tests__/template-configuration-routing.test.ts`
- `src/lib/secretaria/__tests__/template-library-ux.test.ts`

**Strategy for Tests**:
- Keep test assertion logic intact while standardizing mock generator utilities (`createMockEntity()`, `createMockTenant()`) where possible.
- If a test explicitly verifies that a template handles specific entity names, ensure tests test arbitrary corporate names (e.g. `"Acme Corp S.A."`, `"Empresa Matriz S.A."`).

---

## 5. Comprehensive Abstraction and Decoupling Plan

### Layer 1: Enhanced Brand and Label Abstraction (`src/lib/tenant-brand-labels.ts`)
Extend `src/lib/tenant-brand-labels.ts` to provide generic, tenant-aware helpers:
```ts
// Example additions:
export function defaultCompanyPlaceholder(b: TenantBranding | null, type: "PF" | "PJ" = "PJ"): string {
  if (type === "PF") return "Nombre y Apellidos";
  return b?.nombre ? `${b.nombre} Filial, S.L.` : "Servicios Corporativos, S.L.";
}

export function defaultEmailDomain(b: TenantBranding | null): string {
  return "empresa.com";
}

export function defaultDocumentRepositoryLabel(b: TenantBranding | null): string {
  return b?.nombre 
    ? `repositorio documental privado de ${b.nombre}`
    : "repositorio documental privado";
}
```

### Layer 2: Scope Controller Normalization (`useSecretariaScope.ts`)
Replace the hardcoded entity lookup in `getPreferredEntity()`:
```ts
// Before:
export function getPreferredEntity(entities: SecretariaEntityOption[]) {
  return (
    entities.find((entity) => entity.legalName === "ARGA Seguros, S.A.") ??
    entities.find((entity) => entity.name === "ARGA Seguros, S.A.") ??
    entities.find((entity) => entity.legalName.startsWith("ARGA Seguros,")) ??
    entities.find((entity) => entity.name.startsWith("ARGA Seguros,")) ??
    entities.find((entity) => entity.parentEntityId == null) ??
    entities[0] ??
    null
  );
}

// After:
export function getPreferredEntity(entities: SecretariaEntityOption[], preferredName?: string | null) {
  if (preferredName) {
    const match = entities.find(
      (entity) => entity.legalName === preferredName || entity.name === preferredName
    );
    if (match) return match;
  }
  return (
    // 1. Root parent entity (top of corporate holding)
    entities.find((entity) => entity.parentEntityId == null) ??
    // 2. First available entity in tenant catalog
    entities[0] ??
    null
  );
}
```

### Layer 3: Form Placeholders and Helpers
Clean up input placeholders and help texts in:
- `PersonaNuevaStepper.tsx`
- `DecisionUnipersonalStepper.tsx`
- `AcuerdoSinSesionStepper.tsx`
- `TransmisionStepper.tsx`
- `StepClasesSeries.tsx`

### Layer 4: Default Capa 3 Template Values
In `ConvocatoriasStepper.tsx` and `convocatoria-capa3-resolver.ts`, replace `"TGMS"` references with generic or branding-derived descriptions:
- `"repositorio documental privado"`
- `"expediente electrónico de convocatoria"`
- `"Preaviso mínimo (estatutario)"`

### Layer 5: Calendar Metadata (`ConvocatoriaDetalle.tsx`)
In `generateIcs()`:
- UID: `convocatoria-${Date.now()}@${typeof window !== "undefined" ? window.location.hostname : "governance.local"}`
- PRODID: `PRODID:-//Secretaría Societaria//ES`

### Layer 6: Multi-Jurisdiction View (`MatrizJurisdiccional.tsx`)
1. In the header banner, resolve parent entity dynamically:
   ```tsx
   const parentEntity = entities.find(e => e.parentEntityId == null);
   const parentName = parentEntity?.legalName ?? groupFullLabel(branding) ?? "Sociedad Matriz";
   ```
2. Replace hardcoded `"TGMS"` badges and headers with `"Plataforma"`.
3. In `MATERIAS_GRUPO`, replace hardcoded `"ARGA Seguros S.A."` in `decide_en` with `"Sociedad Matriz (ES)"`.

### Layer 7: Standalone Packaging & Shell Decoupling (`SecretariaSidebar.tsx` / `SecretariaLayout.tsx`)
- Update `SecretariaSidebar.tsx` bottom navigation:
  - If branding specifies `shell_label`, display `Volver a {shellLabel(branding)}`.
  - In standalone mode (when no outer shell is loaded), either hide the button or render a home navigation button `Volver al Inicio` pointing to `/secretaria`.

---

## 6. Verification Checklist

1. **Grep Audit**: Zero literal occurrences of `"ARGA"` or `"TGMS"` in user-facing UI text within `src/pages/secretaria/` and `src/components/secretaria/`.
2. **TypeScript Compilation**: `bun run build` and `tsc --noEmit` succeed with 0 errors.
3. **Unit Tests**: Full test suite passes without regression (`bun test`).
4. **Visual & Behavioral Consistency**: With default branding or demo tenant active, visual appearance and workflows remain 100% functional.
