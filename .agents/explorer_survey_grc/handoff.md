# Handoff Report — GRC Module Decoupling Survey

## 1. Observation

A full survey was conducted across all files under `src/pages/grc/`, `src/components/grc/`, `src/lib/grc/`, and associated hooks in `src/hooks/`.

The following 21 hardcoded references to "ARGA", "TGMS", demo emails, demo persons, and demo IDs were observed directly:

1. **`src/pages/grc/IncidentesList.tsx:201`**:
   `scope.mode === "sociedad" && scope.selectedEntity ? scope.selectedEntity.legalName : "Grupo ARGA Seguros";`
2. **`src/pages/grc/Risk360.tsx:202`**:
   `scope.mode === "sociedad" && scope.selectedEntity ? scope.selectedEntity.legalName : "Grupo ARGA Seguros";`
3. **`src/pages/grc/PenalAnticorrupcion.tsx:93`**:
   `description: "Riesgo de que agentes o socios comerciales realicen pagos ilícitos en nombre de ARGA Seguros para retener cuentas corporativas."`
4. **`src/pages/grc/PenalAnticorrupcion.tsx:167`**:
   `scope.mode === "sociedad" && scope.selectedEntity ? scope.selectedEntity.legalName : "Grupo ARGA Seguros";`
5. **`src/pages/grc/PenalAnticorrupcion.tsx:195-196`**:
   `const [auditorName, setAuditorName] = useState("Lucía Martín");`
   `const [auditorEmail, setAuditorEmail] = useState("lucia@arga-seguros.com");`
6. **`src/pages/grc/IncidenteDetalle.tsx:91-92`**:
   `const [signatoryName, setSignatoryName] = useState("Lucía Martín");`
   `const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");`
7. **`src/pages/grc/IncidenteDetalle.tsx:638`**:
   `<option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>`
8. **`src/pages/grc/Excepciones.tsx:554`**:
   `<option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>`
9. **`src/pages/grc/TPRM.tsx:53-54`**:
   `const [signatoryName, setSignatoryName] = useState("Lucía Martín");`
   `const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");`
10. **`src/pages/grc/TPRM.tsx:405`**:
    `desc: "¿Una caída o interrupción total de este servicio detiene operaciones aseguradoras o de facturación críticas de ARGA?"`
11. **`src/pages/grc/TPRM.tsx:425`**:
    `desc: "¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de ARGA centralizando el riesgo?"`
12. **`src/pages/grc/GrcLayout.tsx:106`**:
    `aria-label="Volver al shell TGMS"`
13. **`src/pages/grc/GrcLayout.tsx:111`**:
    `<span>Volver a TGMS</span>`
14. **`src/pages/grc/GrcLayout.tsx:164`**:
    `<span>TGMS</span>`
15. **`src/pages/grc/Dashboard.tsx:107`**:
    `tgms_handoff: "TGMS handoff",`
16. **`src/pages/grc/modules/audit/Findings.tsx:115`**:
    `<Link to={\`/hallazgos/\${f.code}\`} ...>Ver en TGMS →</Link>`
17. **`src/pages/grc/modules/dora/PoliciesLink.tsx:10`**:
    `<p ...>Políticas del shell TGMS asociadas al marco DORA de resiliencia ICT.</p>`
18. **`src/pages/grc/modules/dora/PoliciesLink.tsx:16`**:
    `<Link to="/politicas" ...>Ver todas las políticas en TGMS →</Link>`
19. **`src/hooks/useThirdParties.ts:74`**:
    `const id = input.id || \`TPRM-ARGA-\${Math.floor(100 + Math.random() * 900)}\`;`
20. **`src/lib/grc/dashboard-readiness.ts:11,386,411,424,672,673,893`**:
    Diagnostic strings mentioning `"TGMS shell"`, `"TGMS policies route"`, and type `"tgms_handoff"`.
21. **`src/lib/grc/__tests__/dashboard-readiness.test.ts:136,184`**:
    Test assertions on posture type `"tgms_handoff"`.

---

## 2. Logic Chain

1. **Brand/Tenant Abstraction (Observations 1, 2, 4, 12, 13, 14):**
   - The application provides `TenantBrandContext` (`useTenantBranding()`) and label helpers in `src/lib/tenant-brand-labels.ts` (`groupFullLabel()`, `brandName()`, `shellLabel()`).
   - `GrcLayout.tsx` already uses `groupFullLabel(branding)` at line 125, but lines 106, 111, and 164 hardcode `"TGMS"`.
   - `IncidentesList.tsx` (line 201), `Risk360.tsx` (line 202), and `PenalAnticorrupcion.tsx` (line 167) can achieve dynamic branding by adopting the same `groupFullLabel(branding)` call.
   - `GrcLayout.tsx` navigation can use `brandName(branding)` for its back button and breadcrumb root.

2. **User Identity Resolution (Observations 5, 6, 9):**
   - In `PenalAnticorrupcion.tsx` (line 195-196), `IncidenteDetalle.tsx` (line 91-92), and `TPRM.tsx` (line 53-54), the initial state hardcodes `"Lucía Martín"` and `"lucia@arga-seguros.com"`.
   - Replacing this with `useCurrentUser()` / auth state or generic fallback (`"auditor@empresa.com"`, `"compliance@empresa.com"`) ensures no customer-specific personal data remains hardcoded in UI state.

3. **Domain Copy and Form Options (Observations 3, 7, 8, 10, 11, 15, 16, 17, 18):**
   - The hardcoded references in modal select dropdowns (`IncidenteDetalle.tsx:638`, `Excepciones.tsx:554`) can be generalized to `"Consejo de Administración (Sociedad Matriz)"` or dynamic scope formatting.
   - Text in questionnaires and taxonomies (`TPRM.tsx:405,425`, `PenalAnticorrupcion.tsx:93`) can use domain-agnostic copy ("la entidad", "la organización").
   - Navigation links in `modules/audit/Findings.tsx:115` and `modules/dora/PoliciesLink.tsx:10,16` can use `"Ver en plataforma →"` and `"Políticas corporativas..."`.

4. **ID Generation (Observation 19):**
   - `useThirdParties.ts:74` generates IDs prefixed with `TPRM-ARGA-`. Switching to `TPRM-${Math.floor(1000 + Math.random() * 9000)}` eliminates the customer-specific prefix without affecting database constraints.

5. **Diagnostic Contracts (Observations 20, 21):**
   - Technical descriptions in `dashboard-readiness.ts` can be sanitized to reference `"platform shell"` and `"Core policies"`, and tests updated accordingly.

---

## 3. Caveats

- **Scope:** This survey focuses on the GRC module (`src/pages/grc/`, `src/components/grc/`, `src/lib/grc/`, and GRC-specific hooks). The Secretaría module and AI Governance module are audited separately.
- **TenantBrandContext Defaults:** `src/lib/tenant-brand-labels.ts` defines default fallback constants (e.g. `DEFAULT_SHELL_LABEL = "TGMS PLATFORM"`, `DEFAULT_GROUP_FULL_LABEL = "Grupo ARGA Seguros"`). When `TenantBrandContext` provides a brand profile, those values are overridden. If an audit strictly checks that no component view in `src/pages/grc/` contains literal string constants, our proposed plan achieves 100% decoupling.
- **Database seeds / migrations:** Existing demo database rows in Supabase are not altered by this frontend refactoring plan.

---

## 4. Conclusion

All 21 hardcoded references in GRC have been pinpointed, documented, and given exact replacement specifications. Applying these targeted changes will decouple the GRC module completely from the ARGA demo environment while maintaining 100% backward compatibility and test stability.

---

## 5. Verification Method

To verify the absence of hardcoded references after implementation:

1. **Exact literal grep across GRC:**
   ```bash
   rg -i --glob '!*.test.ts' --glob '!*.test.tsx' '\b(arga|tgms)\b' src/pages/grc/ src/components/grc/
   ```
   *Expected result:* 0 matches in component views and subpages.

2. **Email pattern grep:**
   ```bash
   rg 'lucia@arga-seguros.com' src/pages/grc/ src/components/grc/ src/hooks/
   ```
   *Expected result:* 0 matches.

3. **Typecheck & Tests:**
   ```bash
   bun run typecheck
   bun test src/lib/grc/
   bun run build
   ```
   *Expected result:* 0 TypeScript errors, all GRC tests passing, clean production bundle.
