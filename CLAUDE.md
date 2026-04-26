# CLAUDE.md — arga-governance-map

Guía para IA y desarrolladores que retoman este proyecto. Leer antes de tocar cualquier archivo.

---

## Contexto de trabajo — leer primero

### Dos repositorios, roles distintos

| Repo | Rol | Contiene |
|---|---|---|
| **`arga-governance-map`** (este repo) | **Código fuente** | App React/TypeScript, hooks, SQL, tests |
| **`TGMS_mapfre_mockup`** | **Workspace de planificación** | Specs, planes, prompts Lovable, investigación de negocio |

**Regla:** Todo desarrollo de código va en este repo. Los planes y specs viven en `TGMS_mapfre_mockup/docs/superpowers/`.

### ARGA = MAPFRE (pseudónimo de negocio)
"Grupo ARGA Seguros" es el nombre ficticio que representa a MAPFRE en el demostrador. Los órganos de gobierno de MAPFRE deben verse reflejados en él. **Nunca usar "MAPFRE" directamente en código, datos demo ni commits.** Todos los datos demo, seeds, personas, órganos y entidades deben ser coherentes con la estructura corporativa de ARGA.

### Estructura corporativa ARGA (dato demo)
- **ARGA Seguros S.A.** — SA **cotizada** (equivalente IBEX 35). El motor de reglas NO debe bloquear cotizadas (DL-2 resuelta: evalúa LSC + advertencias LMV).
- **Fundación ARGA** → Cartera ARGA S.L.U. (100%) → 69.69% ARGA Seguros S.A. Free float 30.31%.
- **CdA:** 15 miembros (9 Independientes + 5 Ejecutivos + 1 Dominical). Presidente, 2 Vicepresidentes, Coordinador Independiente.
- **Pacto parasocial demo:** Fundación ARGA tiene derecho de veto en operaciones estructurales (fusión, escisión, disolución, venta activos >15% PN).
- **Voto de calidad:** Habilitado en CdA y Comité Ejecutivo. Deshabilitado en comisiones delegadas (Auditoría, Riesgos, Nombramientos, Retribuciones).

### Retribución consejeros ARGA (valores demo derivados del IAR 2025)
- **No ejecutivos:** VP CdA 220K€, Coord. Independiente 220K€, Vocal 115K€ + complementos por comisión
- **Ejecutivos RF:** Presidente 1.091K€, VP 535K€, CDG 535K€, DGA 456K€
- **RVA:** 100% BN + ROE ±5%. 70% inmediato / 30% diferido 3 años
- **ILP 2026-2028:** 50% cash + 50% acciones. TSR 30% + ROE 25% + RCGNV 25% + CSM 5% + ESG 15%
- **Techo JGA:** 4M€/año para no ejecutivos
- **Detalle completo:** `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md` (DL-6)

### Decisiones legales motor LSC — todas resueltas (2026-04-19)
6 decisiones resueltas. Las de mayor urgencia: DL-2 (cotizadas: evaluar + advertir, no bloquear) y DL-4 (selección automática plantilla SA/SL). Detalle: `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`.

### EAD Trust — QTSP y empresa tecnológica de Garrigues
**EAD Trust es el propietario de la operación como QTSP** (Qualified Trust Service Provider) y también es la **empresa tecnológica del grupo Garrigues** (g-digital). Proporciona firma electrónica cualificada (QES), sellos electrónicos (QSeal), timestamps cualificados y notificación certificada (ERDS) a través de su Digital Trust API. Nunca referenciar proveedores de firma competidores — EAD Trust es el único QTSP del ecosistema.

### Decisiones técnicas confirmadas
- **SIEM:** Microsoft Sentinel (feed OTel vía Edge Function)
- **QTSP:** EAD Trust Digital Trust API (firma QES, QSeal, ERDS)
- **Multi-jurisdicción:** Matriz de normalización jurisdiccional como paso previo a BR/MX/PT

### Módulos Garrigues — doble identidad

Los módulos GRC Compass (`/grc/*`), Secretaría Societaria (`/secretaria/*`) y AI Governance (`/ai-governance/*`) son:
1. **Dentro del demostrador TGMS**: módulos enchufables en el shell rojo, con identidad visual Garrigues (verde `#004438`)
2. **Como producto Garrigues autónomo**: pueden funcionar sin el shell TGMS para clientes más pequeños

En código, ambos modos están en este repo. La segregación a repos independientes por módulo es **trabajo futuro, no prioridad actual**.

### Modelo comercial
- Clientes grandes (tipo MAPFRE): shell TGMS completo + todos los módulos
- Clientes medianos/pequeños: uno o varios módulos Garrigues sin shell TGMS

### Prioridad actual: demo MAPFRE al máximo nivel funcional
- ✅ Código y datos demo pulidos
- ✅ Flujos UX completos y navegables
- ❌ No segregar módulos a repos separados todavía
- ❌ No construir infraestructura enterprise (RLS real, BYOK, WORM) — eso es fase posterior

---

## Qué es este proyecto

**TGMS Platform** — plataforma de gobernanza corporativa para grupos aseguradores multinacionales.
- Cliente demo: **Grupo ARGA Seguros** (ficcional, reconocible para MAPFRE)
- Propósito: demo funcional para validar la filosofía ante MAPFRE antes de iniciar desarrollo real

**Supabase:** proyecto `governance_OS`, ID `hzqwefkwsxopwrmtksbg`, región eu-central-1
**Auth demo:** `demo@arga-seguros.com` / `TGMSdemo2026!`
**Tenant demo:** `tenant_id = "00000000-0000-0000-0000-000000000001"`
**Entidad demo:** `entity_id = "00000000-0000-0000-0000-000000000010"` (ARGA Seguros S.A.)

---

## Stack

```
React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
Supabase JS v2 + TanStack Query v5 + React Router v6
React Hook Form + Zod + Sonner + Lucide + Montserrat (@fontsource/montserrat)
```

**TypeScript config:** `noImplicitAny: false`, `strictNullChecks: false` — no añadir anotaciones de tipo donde no existían antes.

**Gestor de paquetes:** bun (usa `bun install`, no npm/yarn)

---

## Design Systems

### Shell TGMS (rutas `/`, `/entidades`, `/organos`, `/politicas`, `/obligaciones`, etc.)
- Tokens: `--t-*` en `src/index.css`
- Color primario: `#E8112D` (rojo Pantone 185 C)
- Tipografía: Inter

### Módulos Garrigues (rutas `/secretaria/*`, `/grc/*`, `/ai-governance/*`)

**Skill de referencia:** `/Users/moisesmenendez/Dropbox/Codigo/agent/skills/desarrollar-ux-garrigues/SKILL.md`
Validado contra LIQUIDA360 (Feb 2026). **Seguir estrictamente.**

Tokens `--g-*` se añaden a `src/index.css` una sola vez, compartidos por todos los módulos Garrigues:

```css
/* COLORES DE MARCA — Pantone 3308 C */
--g-brand-3308:   #004438;   /* CTA, sidebar bg, focus ring */
--g-brand-bright: #009a77;   /* Acentos, éxito, enlaces activos */
--g-sec-700:      #007362;   /* Hover sobre primario */
--g-sec-300:      #6dc1b0;   /* Indicadores secundarios */
--g-sec-100:      #d8ece7;   /* Fondos sutiles */

/* TEXTO — todos WCAG AA sobre blanco */
--g-text-primary:   #4a4a49;  /* 9.5:1 — títulos, body */
--g-text-secondary: #50564f;  /* 8.2:1 — descripciones */
--g-text-inverse:   #ffffff;  /* Sobre fondos oscuros */
--g-link:           #004438;  /* 10.4:1 */
--g-link-hover:     #007362;

/* SUPERFICIES */
--g-surface-page:   #f0f0f0;
--g-surface-card:   #ffffff;
--g-surface-subtle: #d8ece7;  /* Headers de tabla, fondos verdes tenues */
--g-surface-muted:  hsl(60, 1%, 88%);

/* BORDES */
--g-border-default: #b7bfb0;
--g-border-subtle:  #b9babb;
--g-border-focus:   var(--g-brand-3308);

/* ESTADOS — SIN prefijo --g- */
--status-success: #009a77;
--status-warning: #878989;
--status-error:   hsl(0, 84%, 60%);
--status-info:    #596f7b;

/* SIDEBAR — HSL sin hsl() para uso con hsl(var(...)) */
--sidebar-background:          168 100% 13%;
--sidebar-foreground:          0 0% 100%;
--sidebar-primary:             0 0% 100%;
--sidebar-primary-foreground:  168 100% 13%;
--sidebar-accent:              170 100% 23%;
--sidebar-accent-foreground:   0 0% 100%;
--sidebar-border:              170 100% 23%;
--sidebar-width:               280px;
--sidebar-width-collapsed:     56px;

/* BORDER RADIUS */
--g-radius-none: 0px;
--g-radius-sm:   6px;   /* Badges, chips */
--g-radius-md:   8px;   /* Botones, inputs */
--g-radius-lg:   10px;  /* Cards, paneles */
--g-radius-xl:   16px;  /* Modales */
--g-radius-full: 9999px;

/* SOMBRAS */
--g-shadow-card:       0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05);
--g-shadow-card-hover: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--g-shadow-dropdown:   0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--g-shadow-modal:      0 25px 50px -12px rgb(0 0 0 / 0.25);
--g-shadow-brand:      0 10px 30px -10px hsl(168 100% 13% / 0.3);

/* TRANSICIONES */
--g-transition-fast:   150ms ease;
--g-transition-normal: 200ms ease-out;
--g-transition-smooth: 300ms cubic-bezier(0.16, 1, 0.3, 1);
```

---

## ⛔ Reglas UX Garrigues — NO NEGOCIABLES

### Prohibido absolutamente en componentes Garrigues

```tsx
// PROHIBIDO — hexadecimales
style={{ color: '#004438' }}
className="text-[#004438]"

// PROHIBIDO — colores Tailwind nativos
className="text-white text-gray-500 bg-green-600 border-gray-200"
className="bg-amber-50 text-amber-800 bg-green-100 text-green-800"

// PROHIBIDO — nombres CSS
style={{ color: 'white', background: 'green' }}

// PROHIBIDO — inline style para colores que tienen clase Tailwind equivalente
style={{ color: "var(--g-text-primary)" }}   // usar text-[var(--g-text-primary)]
style={{ backgroundColor: "var(--g-brand-3308)" }}  // usar bg-[var(--g-brand-3308)]
```

### Correcto

```tsx
// Texto
className="text-[var(--g-text-primary)]"
className="text-[var(--g-text-secondary)]"
className="text-[var(--g-text-inverse)]"

// Fondos
className="bg-[var(--g-surface-card)]"
className="bg-[var(--g-surface-subtle)]"
className="bg-[var(--g-brand-3308)]"

// Bordes
className="border-[var(--g-border-default)]"
className="border-[var(--g-border-subtle)]"

// Estados
className="text-[var(--status-success)]"
className="bg-[var(--status-error)]"

// Inline style SOLO para propiedades sin clase Tailwind (sombras, radius)
style={{ borderRadius: 'var(--g-radius-md)' }}
style={{ boxShadow: 'var(--g-shadow-card)' }}

// Sidebar
className="bg-[hsl(var(--sidebar-background))]"
className="text-[hsl(var(--sidebar-foreground))]"
```

### Patrones de componente obligatorios

- `forwardRef` en todos los componentes que acepten refs
- `aria-label` en botones que solo tienen icono
- `aria-invalid` + `aria-describedby` en campos con error
- `aria-busy` en botones con loading
- Labels visibles en formularios (nunca solo placeholder)
- Focus visible: double ring con `--g-brand-3308`

### Sidebar NavLink pattern

```tsx
<NavLink
  to={item.path}
  className={({ isActive }) => cn(
    'flex items-center gap-3 px-3 py-2.5 transition-all',
    isActive
      ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] font-medium'
      : 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]'
  )}
  style={{ borderRadius: 'var(--g-radius-md)' }}
>
```

### Button correcto

```tsx
// Primario
className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
style={{ borderRadius: 'var(--g-radius-md)' }}

// Outline
className="border border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"

// Ghost
className="text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
```

### Tablas correctas

```tsx
<thead>
  <tr className="bg-[var(--g-surface-subtle)]">
    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
```

```tsx
<tbody className="divide-y divide-[var(--g-border-subtle)]">
  <tr className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer">
    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
```

### Badges/chips de estado correctos

```tsx
// Usar tokens --status-*, nunca Tailwind color classes
const STATUS_CHIP = {
  ACTIVO:      'bg-[var(--status-success)] text-[var(--g-text-inverse)]',
  PENDIENTE:   'bg-[var(--status-warning)] text-[var(--g-text-inverse)]',
  ERROR:       'bg-[var(--status-error)] text-[var(--g-text-inverse)]',
  INFO:        'bg-[var(--status-info)] text-[var(--g-text-inverse)]',
  NEUTRAL:     'bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]',
}
// style={{ borderRadius: 'var(--g-radius-full)' }} para pills
// style={{ borderRadius: 'var(--g-radius-sm)' }}  para chips cuadrados
```

---

## ⚠️ Deuda UX en el plan v1 (T1–T12)

El código del plan `2026-04-18-secretaria-societaria-implementation.md` fue escrito antes de revisar la skill Garrigues y contiene violaciones. **Durante la implementación, corregir en cada archivo:**

| Violación en el plan | Corrección |
|---|---|
| `style={{ backgroundColor: "var(--g-brand)", color: "#fff" }}` | `className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"` |
| `style={{ color: "var(--g-text-primary)" }}` | `className="text-[var(--g-text-primary)]"` |
| `style={{ color: "var(--g-text-secondary)" }}` | `className="text-[var(--g-text-secondary)]"` |
| `style={{ borderColor: "var(--g-border-default)" }}` | `className="border-[var(--g-border-default)]"` |
| `className="... bg-amber-50 text-amber-800 ..."` | Tokens `--status-warning` + `--g-surface-muted` |
| `className="... bg-green-100 text-green-800 ..."` | Tokens `--status-success` + `--g-sec-100` |
| `var(--g-status-*)` (con prefijo `--g-`) | `var(--status-*)` (sin prefijo `--g-`) |
| `var(--g-brand)` | `var(--g-brand-3308)` |
| `var(--g-surface-secondary)` | `var(--g-surface-subtle)` |

**La skill a usar durante implementación:** `/Users/moisesmenendez/Dropbox/Codigo/agent/skills/desarrollar-ux-garrigues/SKILL.md`

---

## Estado de implementación

### Fase 1 — COMPLETADA

Shell TGMS completo con todas las rutas core conectadas a Supabase real:
- Dashboard, Governance Map, Entidades, Órganos, Reuniones
- Políticas (PR-008 + WorkflowStepper), Obligaciones, Controles, Evidencias
- Delegaciones, Hallazgos, Planes de Acción, Conflictos, Attestations
- SII (zona amber segregada)
- Tour 10 pasos funcionando

Hooks creados en Fase 1:
```
src/hooks/useEntities.ts
src/hooks/useBodies.ts
src/hooks/usePoliciesObligations.ts
src/hooks/useDelegations.ts
src/hooks/useFindings.ts
src/hooks/useConflicts.ts
src/hooks/useSii.ts
```

### Fase 2 — COMPLETADA (commit `9e6b7e5`): Módulo Secretaría Societaria (`/secretaria/*`)

T1→T14 completos: 15 tablas + `agreements` + triggers + seed, SecretariaLayout
con tokens `--g-*`, Dashboard con KPIs, Convocatorias (lista + stepper 7 pasos),
Reuniones (stepper 6 pasos crea agreements), Actas + Certificaciones vinculadas
a `agreement_id`, Tramitador (stepper 5 pasos), Acuerdos sin sesión (tracker
unanimidad), Decisiones unipersonales, Libros con alertas de legalización,
Plantillas ES/PT/BR/MX, cross-module en OrganoDetalle + PoliticaDetalle,
`useAgreementCompliance` (motor de validez), `ExpedienteAcuerdo` (timeline
8 estados + compliance snapshot).

### Fase 3 — COMPLETADA (commit `f6effd9`): GRC Compass (`/grc/*`)

Módulos implementados: DORA (Incidents, BCM, RTO), Cyber (Incidents, Vulnerabilities),
Audit (Findings, ActionPlans), Packs país, Risk360, MyWork, ModuleDashboard,
IncidenteDetalle/Stepper, Excepciones, Alertas, country packs.

### Fase 4 — COMPLETADA (commit `1feac7b`): AI Governance (`/ai-governance/*`)

### Fase 5 — COMPLETADA (commit `a084229`): Integración hub cross-module TGMS

### Olas de remediación

| Ola | Commit | Descripción |
|---|---|---|
| Ola 1 | `8fd44f1` | `fix(secretaria)`: motor de validez + KPI acuerdos pendientes |
| Ola 2 | `e0d9d20` | `fix(hooks)`: tenant scoping + rutas/columnas alineadas |
| Ola 3 | `c401d78` | `chore(types)`: elimina `@typescript-eslint/no-explicit-any` en hooks, componentes y páginas (core, grc, secretaria, sii). Exporta tipos `*DetailRow` desde hooks para que las páginas importen el shape real de Supabase. Smoke `tsc --noEmit && vite build` limpio. |

**Patrón de tipado establecido (Ola 3):**
- Para queries con join PostgREST (`*, foreign(col)`): definir un tipo `Raw` local o exportado (`type Raw = Omit<Row, "flat_col"> & { foreign?: { col?: type | null } | null }`) y castear `(data ?? []) as Raw[]` en el boundary de la query.
- Para `maybeSingle()`: castear `data as X | null`.
- Para `DetailRow` (join más rico que list): exportar tipo `XxxDetailRow` desde el hook y que la página lo importe vía `import type`.
- Para reduce: `reduce<Record<string, RowType[]>>((acc, item) => {...}, {})`.
- Para errores: `catch (e) { const msg = e instanceof Error ? e.message : String(e); }`.

### Sprint A — Seeds & Motor Integration (commit `9b9b307`→`18105f2`)

A0–A3: Seeds ejecutados en Supabase Cloud:
- A0: Migración `000010` (rule_packs, rule_pack_versions, rule_param_overrides, etc.)
- A1: `seed-rule-packs.ts` — 16 rule packs con payloads LSC
- A2: `seed-demo-data.ts` — datos demo coherentes (personas, mandatos, reuniones, acuerdos)
- A3: `seed-etd-stubs.ts` — EAD Trust Digital API stubs (case-files, evidences)

A4–A6: Integración motor en UI:
- A4: TramitadorStepper conectado al motor (useRulePackForMateria, 5 pasos)
- A5: GenerarDocumentoStepper con QTSP pipeline (QES signing + SHA-512 archival)
- A6: Storage archiver (`archiveDocxToStorage` + `computeSha512` via Web Crypto API)

### Sprint B — Hardening Enterprise (commit `18105f2`)

- B1: RLS real en todas las tablas de dominio (tenant_id + policies)
- B2: RBAC con 5 roles (SECRETARIO/CONSEJERO/COMPLIANCE/ADMIN_TENANT/AUDITOR) + SoD toxic pairs + SodGuard component
- B3: Audit Trail WORM (SHA-512 hash chain, trigger `fn_audit_worm`, verificación `fn_verify_audit_chain`)
- B4: Evidence bundles SHA-512 + QTSP sealing stubs (`evidence_bundles` table)
- B5: Legal Hold + Retention policies (seed + UI)
- B6: Board Pack ejecutivo (`/secretaria/board-pack`) — 9 secciones, DL-2 cotizada warnings, DL-5 voto calidad
- B7: Observability (telemetry OTel stub + SLODashboard con 3 gauges)

### Sprint C — UX Polish (commit `18105f2`)

- C1: Garrigues tokens audit — 0 violaciones (todos `var(--g-*)` y `var(--status-*)`)
- C2: WCAG 2.1 AA — contrast ratios, aria-labels, focus rings
- C3: Bundle optimization — React.lazy code-splitting en todas las páginas
- C4–C5: Empty states + Loading skeletons + ErrorBoundary global
- C6: Scope Switcher — filtrado funcional por entidad/jurisdicción
- C7: Responsive/Mobile — hamburger menu, column collapse, touch targets

### Code Review & Bug Fixes (commit `18105f2`)

- Fix P0: `pack` scoping bug en `documentacion-engine.ts` (variable fuera de for-loop → `actaPack`)
- Fix P0: `resolverReglaEfectiva` en `jerarquia-normativa.ts` (override mode para arrays, booleanos, strings)
- Fix P0: unsafe `.toUpperCase()` en `useBoardPackData.ts`
- Fix P1: double-nested CSS `var(var(...))` en `SLODashboard.tsx`
- Fix P1: untyped `any` state en `EvidenceForenseSection.tsx`
- Fix P1: missing debug context en `SodGuard.tsx` error log

**Tests: 299/299 pass, tsc 0 errors, build clean.**

### Sprint D — Funcionalidades avanzadas ✅ COMPLETADO (commit `f017ff3`)

- D1: Workflow plantillas REVISADA→APROBADA→ACTIVA
- D2: Firma QES real EAD Trust (hook `useQTSPSign`, pipeline completo)
- D3: Notificación certificada ERDS (NO_SESSION + Convocatoria SL, hook `useERDSNotification`)
- D4: Motor pactos parasociales MVP (pactos-engine.ts, 3 evaluadores, integración orquestador)

### Sprint E — Mejoras producto ✅ COMPLETADO (commits `f4b79d2`, `23e3d2f`, `3cab2fd`)

- E-D5: Dashboard v2 con métricas avanzadas
- E-D6: Exportación PDF Board Pack
- E-D7: Calendario de vencimientos
- E-D8: Flujo aprobación multi-step
- E-D9: Búsqueda global cross-module Cmd+K

### Oleada 2 — Plantillas de contenido + Rule Packs ✅ COMPLETADA (2026-04-20)

- Migration 000012: 17 MODELO_ACUERDO + payloads 13 rule packs LSC
- `useModelosAcuerdo` hook (plantillas por materia en TramitadorStepper)
- TipoSocial extendido a `'SA' | 'SL' | 'SLU' | 'SAU'` + migration 000014
- Tab "Modelos de acuerdo" en Plantillas.tsx con filtro por materia
- **342/342 tests, tsc 0 errors, build clean**

### Motor v2.1 — Expansión LSC ✅ COMPLETADO (2026-04-20)

8 commits, 352/352 tests:

- `AdoptionMode` += `CO_APROBACION` + `SOLIDARIO`; `TipoActa` += `ACTA_ORGANO_ADMIN`
- `CoAprobacionConfig`, `SolidarioConfig`, `ExecutionMode` (migration 000016: `execution_mode JSONB` en `agreements`)
- 3 nuevas tablas SQL: `pactos_parasociales`, `pacto_clausulas`, `pacto_evaluacion_results` (WORM) — migration 000015
- 12 nuevos rule packs seeded (28 total) — migration 000017
- `evaluarCoAprobacion()` + `evaluarSolidario()` en `votacion-engine.ts`
- Orquestador flujos D (CO_APROBACION) y E (SOLIDARIO)
- Seed `PACTO_FUNDACION_ARGA_2024` (3 cláusulas: VETO operaciones estructurales, CONSENTIMIENTO_INVERSOR capital, MAYORIA_REFORZADA_PACTADA 75% vinculadas) — migration 000018
- 10 tests CO-01..CO-06 + SO-01..SO-04
- `docs/contratos/variables-plantillas-v1.1.yaml` — contrato 49 variables (4 fuentes)
- `usePactosParasociales` hook (`usePactosVigentes` + `usePactosParasociales`)

**Tests: 352/352 pass, tsc 0 errors, build clean.**

### Sprint MVP Gestión Societaria F1-F10 ✅ COMPLETADO (2026-04-21)

Pipeline completo de generación de actas + certificaciones QTSP con gate
hash basado en censo WORM. Plan: `docs/superpowers/plans/2026-04-21-gestion-societaria-mvp-plan.md`.

**Migraciones aplicadas en Cloud (000023–000029):**
- `000023` — capability_matrix + authority_evidence (schema base F1)
- `000024` — minutes + certifications extensiones: `body_id`, `entity_id`, `snapshot_id`, `snapshot_hash`, `gate_hash`, `authority_evidence_id`, `tsq_token bytea`
- `000025..000026` — sociedades/personas (sprint paralelo — no MVP F1-F10)
- `000027` — `fn_generar_acta` + `fn_generar_certificacion` con gate_hash SHA-256(snapshot_hash‖resultado_hash)
- `000028` — `fn_firmar_certificacion` (QES stub) + `fn_emitir_certificacion` (evidence bundle URI)
- `000029` — backfill `minutes.body_id` + `minutes.entity_id` para actas legacy (desde `meetings → governing_bodies`). Regresión detectada en F10.2: sin esta propagación, `EmitirCertificacionButton` no renderizaba en ActaDetalle.

**RPCs del pipeline QTSP:**
- `fn_generar_acta(p_meeting_id, p_content, p_snapshot_id) → uuid` (F8.1)
- `fn_generar_certificacion(p_minute_id, p_tipo, p_agreements_certified text[], p_certificante_role, p_visto_bueno_persona_id) → uuid` (F8.1)
- `fn_firmar_certificacion(p_certification_id, p_qtsp_token, p_tsq_token) → void` (F8.2)
- `fn_emitir_certificacion(p_certification_id) → text` (F8.2) — devuelve URI del evidence bundle

**Componente F9:**
- `src/components/secretaria/EmitirCertificacionButton.tsx` — ejecuta los 3 pasos en cadena, precarga Vº Bº con `usePresidenteVigente`, oculto si `useHasCapability(userRole, "CERTIFICATION")` es false. Demo default `userRole="SECRETARIO"` hasta sprint de auth real.
- `src/hooks/useAuthorityEvidence.ts` — añadido `usePresidenteVigente(entityId, bodyId?)` para precargar Vº Bº en SA.
- `src/hooks/useActas.ts` — añadido `useAgreementIdsForMinute(minuteId)` + extendido `ActaRow` con `body_id` + `entity_id`.
- `src/pages/secretaria/ActaDetalle.tsx` — botón montado con guard `id && acta.entity_id`.

**Hook `useCapabilityMatrix`:**
- `useCapabilityMatrix()` — TanStack Query con staleTime 5 min.
- `useHasCapability(role, action)` — helper sin fetch adicional.

**Desviaciones del plan vs schema real (corregidas inline):**
1. `meetings.entity_id` no existe → JOIN con `governing_bodies` para resolver
2. `authority_evidence` usa `cargo`/`estado='VIGENTE'`, NO `role`/`valido_hasta`
3. `censo_snapshot` no tiene `hash_snapshot` → derivarlo de `audit_log.hash_sha512` vía `audit_worm_id`
4. `audit_log` usa `object_type`/`object_id`/`delta`, NO `entity`/`entity_id`/`payload`
5. `evidence_bundles` no tiene `storage_uri` → sintetizar `evidence_bundle:<id>@<manifest_hash>`
6. `certifications.tsq_token` es `bytea` no `text` → `decode(p_tsq_token, 'base64')::bytea` en RPC

**Tests de schema (`src/test/schema/rpcs-acta-cert.test.ts`):**
Probes de existencia vs Cloud para las 4 RPCs — aceptan cualquier error que NO sea `function does not exist`. 4/4 pass.

**Estado Cloud post-F10.1 verificado vía MCP:**
- `authority_evidence` VIGENTE en ARGA Seguros: 4 filas (PRESIDENTE × 2, SECRETARIO × 2)
- `capability_matrix`: 15 filas (5 roles × 3 acciones SNAPSHOT/VOTE/CERTIFICATION, todos con `reason` jurídica anotada)
- 6/6 paridad modelo canónico OK (entities_sin_pj=0, pj_mal_tipificados=0, entities_sin_profile_vigente=0, mandates_sin_holdings=0, mandates_sin_condiciones=0, ARGA cap table=100.00%)
- `minutes` 2/2 con `body_id` + `entity_id` populados (post-000029)

**Commits principales:**
- `faeca5a` — F1 capability_matrix + authority_evidence + extensiones minutes/certifications
- `5d052bc` — F8.1 fn_generar_acta + fn_generar_certificacion con gate hash
- `d29dba5` — F8.2 fn_firmar_certificacion + fn_emitir_certificacion
- `00df80c` — F9 botón Emitir certificación con pipeline QTSP completo
- `e2daaab` — F10.1 seed demo ARGA coherente con autoridad y capability_matrix
- `f075c95` — F10.2 backfill minutes.body_id/entity_id (regresión F9 button render)

**Limitaciones conocidas (no bloqueantes para demo):**
- ~~2 PRESIDENTEs VIGENTEs para el mismo body_id~~ — **Resuelto 2026-04-24**: duplicados eliminados. Quedan `00000000-...-0102` (Antonio Ríos, PRESIDENTE) y `00000000-...-0101` (Lucía Paredes, SECRETARIO). `usePresidenteVigente` sin ambigüedad.
- Actas legacy (2 demo pre-F8.1) tienen `meeting_resolutions` vacío → `p_agreements_certified = []`. La RPC acepta arrays vacíos. Actas nuevas creadas via pipeline F5→F6→F7 sí tienen resolutions.
- `snapshot_id` NULL en actas legacy → RPC usa `COALESCE 'NO_SNAPSHOT_HASH'` como gate. Sin WORM retroactivo (intencional — preservaría la cadena).
- `userRole="SECRETARIO"` hardcodeado en el botón F9. La integración con `useUserRole` + `auth.users` es del sprint de auth real.

**Tests: 356/356 pass (59 skipped por RPC `execute_sql` no expuesto), tsc 0 errors, build clean.**

### Sprint G — Acuerdos sin sesión: modos avanzados + veto ✅ COMPLETADO (2026-04-23)

Migración `000031` aplicada en Cloud. **359/359 tests, tsc 0 errors.**

- **G3:** Bug `vetoAplicado` always-false corregido. `VotacionInput` recibe `vetoActivo?: boolean`. Gate 5 del votacion-engine emite WARNING cuando hay pacto activo. Orquestador Flujo A pre-evalúa pactos y pasa `vetoActivo` antes de llamar a `evaluarVotacion`. 3 tests V-G3-01/02/03.
- **G4:** `CoAprobacionStepper.tsx` (5 pasos) — adopción `CO_APROBACION` (k de n admins). Usa `evaluarCoAprobacion()` en tiempo real. Ruta: `/secretaria/acuerdos-sin-sesion/co-aprobacion`.
- **G5:** `SolidarioStepper.tsx` (4 pasos) — adopción `SOLIDARIO`. Usa `evaluarSolidario()`. Ruta: `/secretaria/acuerdos-sin-sesion/solidario`.
- **G6:** Auto-cierre de procesos `VOTING_OPEN` vencidos. Migración `000031`: `fn_cerrar_votaciones_vencidas(p_tenant_id)` SECURITY DEFINER, devuelve int. Hook `useCloseExpiredVotaciones` (mutation). `AcuerdosSinSesion.tsx` llama `closeExpired.mutate()` en mount.
- **AcuerdosSinSesion.tsx**: 3 botones CTA (Sin sesión, Co-aprobación, Administrador solidario).

**Archivos modificados:** `types.ts`, `votacion-engine.ts`, `orquestador.ts`, `votacion-engine.test.ts`, `useAcuerdosSinSesion.ts`, `AcuerdosSinSesion.tsx`, `App.tsx`. **Nuevos:** `CoAprobacionStepper.tsx`, `SolidarioStepper.tsx`, `20260423_000031_fn_cerrar_votaciones_vencidas.sql`.

### Sprint H — UX/UI Review + Gestor Documental ✅ COMPLETADO (2026-04-23)

**359/359 tests, tsc 0 errors.**

**H1 — Gestor documental operativo:**
- **H1a — `variable-resolver.ts`:** Bug raíz: `sources.has("ENTIDAD")` fallaba porque la BD guarda fuentes como `"entities.name"` (dotted path), no `"ENTIDAD"`. Fix: `normalizeFuente()` mapea `"entities.*"→"ENTIDAD"`, `"governing_bodies.*"→"ORGANO"`, `"meetings.*"→"REUNION"`, `"agreements.*"→"EXPEDIENTE"`. Además eliminada la guarda `sources.has(...)`: todas las fuentes se pre-cargan cuando el contexto tiene IDs. Resolución automática de variables funcional para todas las plantillas existentes.
- **H1b — SQL:** Eliminadas cabeceras `-- PLANTILLA N:` de `capa1_inmutable` en `COMISION_DELEGADA` y `CONVOCATORIA_SL_NOTIFICACION` vía `regexp_replace`.
- **H1c — SQL:** Contenido legal real español escrito para 4 `MODELO_ACUERDO` BORRADOR: `MODIFICACION_ESTATUTOS`, `AUMENTO_CAPITAL`, `DISTRIBUCION_DIVIDENDOS`, `NOMBRAMIENTO_AUDITOR`. Cada uno incluye `capa2_variables` y `capa3_editables` con campos tipados. Promovidos a ACTIVA.
- **H1d — SQL:** 8 plantillas `REVISADA` → `ACTIVA`: `APROBACION_CUENTAS` (×2), `CESE_CONSEJERO` (×2), `DELEGACION_FACULTADES` (×2), `NOMBRAMIENTO_CONSEJERO` (×2). Ahora visibles en `GenerarDocumentoStepper`.

**H2 — Etiquetas de estado en español:**
- Creado `src/lib/secretaria/status-labels.ts` — mapa central con 30+ estados de todos los dominios.
- Función `statusLabel(status)` con fallback al valor raw.
- Actualizado: `AcuerdosSinSesion.tsx`, `TramitadorLista.tsx`, `ReunionesLista.tsx`, `DecisionesUnipersonales.tsx`. Ya no muestran claves DB (`VOTING_OPEN`, `EN_TRAMITE`, etc.) — muestran "Votación abierta", "En trámite", etc.

**H3 — Acciones rápidas en Dashboard:**
- Sección "Acciones rápidas" con 4 botones: Nueva convocatoria, Nueva reunión, Nuevo acuerdo, Generar documento. Insertada entre header y KPIs.

**H4 — CTA "Usar esta plantilla" en Plantillas.tsx:**
- Botón primario verde aparece en el panel de detalle cuando `estado === 'ACTIVA'`.
- Navega a `/secretaria/tramitador/nuevo?materia=X&plantilla=Y` para `MODELO_ACUERDO`, o `?plantilla=Y` para otros tipos.
- Botón de transición de workflow degradado a outline (secundario) cuando coexiste con el CTA principal.

**H5 — Editor inline capa1 en GestorPlantillas.tsx:**
- Para plantillas en `BORRADOR`: botón "Editar contenido" / "Añadir contenido" en la sección Capa 1.
- Abre textarea editable con Save/Cancel. Usa `useUpdateContenidoPlantilla` (ya existía).
- Permite al equipo legal añadir/corregir texto sin acceso directo a SQL.

**H6 — Limpieza mensajes placeholder:**
- `TramitadorStepper.tsx`: "Pendiente Oleada 2 (legal)" → "No hay modelo de acuerdo disponible para esta materia en este momento."

### Sprint C gestor societario MVP ✅ COMPLETADO (2026-04-24)

**359/359 tests, tsc 0 errors.** Migración `000041` aplicada en Cloud.

**Migración 000041:**
```sql
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS approval_workflow jsonb,
  ADD COLUMN IF NOT EXISTS document_url text;
```

**C3 — ReunionStepper pasos 1–4 reales (`useReunionSecretaria.ts` + `ReunionStepper.tsx`):**
- `ConstitutionStep`: datos reunión + botón "Declarar apertura" → `useOpenMeeting` (status→OPEN)
- `AsistentesStep`: miembros de `condiciones_persona` vía `useBodyMembers`; selector PRESENCIAL/REPRESENTADO/AUSENTE; guarda con `useReplaceAttendees` (delete-all + insert)
- `QuorumStep`: presentes/total/%, Motor V2 `evaluarMayoria`; persiste en `meetings.quorum_data.quorum`
- `DebatesStep`: lista dinámica `{punto, notas}`; persiste en `meetings.quorum_data.debates`
- Hooks añadidos: `useBodyMembers`, `useOpenMeeting`, `useReplaceAttendees`, `useUpdateQuorumData`

**C4 — ApprovalWorkflowCard usa Supabase (`ExpedienteAcuerdo.tsx`):**
- Estado inicializado desde `agreement.approval_workflow` (no localStorage)
- `saveWorkflow()` → `agreements.update({ approval_workflow })` + invalidateQueries
- Badge "Ver documento archivado" cuando `agreement.document_url` existe

**C5 — document_url escrito tras archivar (`GenerarDocumentoStepper.tsx`):**
- Tras archivar en Storage: `agreements.update({ document_url: docUrl })` + invalidateQueries
- Badge verde "Vinculado al expediente" en UI de estado archivado

**C6 — CierreStep real — golden path completo (`ReunionStepper.tsx` + `useReunionSecretaria.ts`):**
- `useSaveMeetingResolutions(meetingId)`: delete-all + insert `meeting_resolutions` (1 fila por debate punto; ADOPTED si favor>contra)
- `useGenerarActa()`: RPC `fn_generar_acta(p_meeting_id, p_content, null)` → devuelve UUID acta
- `VotacionesStep`: botón "Registrar resultado de la votación" → persiste `meeting_resolutions` reales
- `CierreStep`: carga resolutions reales, llama `fn_generar_acta` con `buildActaContent()`, navega a `/secretaria/actas/:minuteId`
- `buildSteps` pasa `meetingId` a `CierreStep`

**Gotcha clave confirmado:** `meeting_attendees` tiene `attendance_type` (no `role`/`present`/`attendance_mode`). Fuente de verdad: `supabase/functions/_types/database.ts`.

### Smoke test + deuda de tipos ✅ COMPLETADO (2026-04-25)

**Smoke test golden path — resultados:**
- `fn_generar_acta(p_meeting_id uuid, p_content text, p_snapshot_id uuid) → uuid` verificada en Cloud
- `agreements.approval_workflow` (jsonb) y `agreements.document_url` (text) verificadas en Cloud
- Reunión `cda-22-04-2026` (`c3305c16-...`) tiene `body_id` CdA con 17 miembros vigentes (post-cleanup)
- `meeting_attendees` y `meeting_resolutions` vacíos — correcto, el stepper los crea
- Golden path predicho sin bloqueantes

**condiciones_persona CdA — limpieza Cloud:**
Seeds antiguo y canónico se solapaban. Eliminados:
- `000…0101` (Lucía Paredes dummy) y `000…0102` (Antonio Ríos dummy) — PRESIDENTE/SECRETARIO duplicados
- `000…0104–0109` — 6 CONSEJERO dummy (Carlos Vega, María Santos, Pedro García, Ana López, Jorge Martínez, Elena Ruiz)

Estado post-limpieza: **1 PRESIDENTE + 1 SECRETARIO + 15 CONSEJERO = 17 miembros únicos**.

**Deuda de tipos resuelta:**
`AgreementFull` en `src/hooks/useAgreementCompliance.ts` ahora incluye:
```typescript
approval_workflow: Record<string, unknown>[] | null;
document_url: string | null;
```
Eliminados los casts `as { approval_workflow?: ... }` y `as { document_url?: ... }` en `ExpedienteAcuerdo.tsx`. Único cast residual: `a.approval_workflow as ApprovalStep[] | null` (narrowing JSONB genérico → tipo concreto, inevitable).

**Próximos — Sprint F (multi-jurisdicción)**

Sprint F (multi-jurisdicción): BR/MX/PT, SCIM, BYOK, particionado.

**Documentos de referencia (rutas absolutas — NO están en este repo):**
- Spec: `/Users/moisesmenendez/Dropbox/DESARROLLO/TGMS_mapfre_mockup/docs/superpowers/specs/2026-04-18-secretaria-societaria-design.md`
- Plan v1 (T1–T12, con deuda UX): `/Users/moisesmenendez/Dropbox/DESARROLLO/TGMS_mapfre_mockup/docs/superpowers/plans/2026-04-18-secretaria-societaria-implementation.md`
- Plan v2 (T1–T14, UX corregida): `/Users/moisesmenendez/Dropbox/DESARROLLO/TGMS_mapfre_mockup/docs/superpowers/plans/2026-04-18-secretaria-societaria-implementation-v2.md`
- Plan maestro pendientes: `docs/superpowers/plans/2026-04-19-plan-maestro-pendientes.md`

---

## Arquitectura: `agreements` como agregado raíz (ya implementado en Fase 2)

### Tabla `agreements`

```sql
agreements (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid REFERENCES entities,
  body_id uuid REFERENCES governing_bodies,
  agreement_kind text NOT NULL,       -- 'APROBACION_CUENTAS'|'NOMBRAMIENTO_CESE'|'MOD_ESTATUTOS'|...
  matter_class text NOT NULL,         -- 'ORDINARIA'|'ESTATUTARIA'|'ESTRUCTURAL'
  inscribable boolean DEFAULT false,
  adoption_mode text NOT NULL,        -- 'MEETING'|'UNIVERSAL'|'NO_SESSION'|'UNIPERSONAL_SOCIO'|'UNIPERSONAL_ADMIN'
  required_quorum_code text,
  required_majority_code text,
  jurisdiction_rule_id uuid REFERENCES jurisdiction_rule_sets,
  proposal_text text,
  decision_text text,
  decision_date date,
  effective_date date,
  status text NOT NULL DEFAULT 'DRAFT',  -- 'DRAFT'→'PROPOSED'→'ADOPTED'→'CERTIFIED'→'INSTRUMENTED'→'FILED'→'REGISTERED'|'REJECTED_REGISTRY'→'PUBLISHED'
  parent_meeting_id uuid REFERENCES meetings,
  unipersonal_decision_id uuid REFERENCES unipersonal_decisions,
  no_session_resolution_id uuid REFERENCES no_session_resolutions,
  statutory_basis text,
  compliance_snapshot jsonb,          -- frozen al pasar a ADOPTED
  created_at timestamptz DEFAULT now()
)
```

### Ajustes a tablas existentes

```sql
ALTER TABLE certifications    ADD COLUMN agreement_id uuid REFERENCES agreements;
ALTER TABLE registry_filings  ADD COLUMN agreement_id uuid REFERENCES agreements;
ALTER TABLE meeting_resolutions ADD COLUMN agreement_id uuid REFERENCES agreements;
```

### Hook `useAgreementCompliance` (T13)

```typescript
type ComplianceResult = {
  convocation_compliant: boolean;
  quorum_compliant: boolean;
  conflict_handled: boolean;
  majority_compliant: boolean;
  instrument_required: 'ESCRITURA' | 'INSTANCIA' | 'NINGUNO';
  registry_required: boolean;
  blocking_issues: string[];
}
```

---

## Modelo canónico de identidad (Fase 0+1 — completado 2026-04-21)

### 8 tablas del modelo canónico

| Tabla | Responsabilidad |
|---|---|
| `entities` (extendida) | sociedad + `person_id` FK + `tipo_organo_admin` |
| `entity_capital_profile` | capital social (escriturado, desembolsado, títulos, nominal) con historial |
| `share_classes` | clases de acciones/participaciones por entidad |
| `condiciones_persona` | rol de persona en sociedad/órgano (SOCIO, CONSEJERO, ADMIN_*, etc.) |
| `capital_holdings` | libro de socios con `share_class_id` FK y `is_treasury` |
| `representaciones` | PJ_PERMANENTE + JUNTA_PROXY + CONSEJO_DELEGACION |
| `parte_votante_current` | proyección regenerable (voting_weight + denominator_weight separados) |
| `censo_snapshot` | inmutable, WORM, tipos ECONOMICO/POLITICO/UNIVERSAL |

### Principio de acceso

- **Fase 0+1 (actual):** `mandates` sigue siendo tabla; el backfill creó datos en `condiciones_persona` y `capital_holdings`. NO hay dual-write todavía.
- **Fase 2 (futuro):** dual-write bidireccional `mandates ↔ nuevo modelo` con `pg_trigger_depth()` guard.
- **Fase 3 (futuro):** motor LSC lee solo `censo_snapshot` vía `src/lib/rules-engine/snapshot-loader.ts`.
- **Fase 4 (futuro):** hooks frontend migrados por módulo.
- **Fase 5 (futuro):** `mandates` pasa a VIEW read-only.

### Reglas de oro (vigentes ya en Fase 0+1)

1. `entity_capital_profile` tiene como máximo **una fila VIGENTE por entidad** (UNIQUE parcial).
2. `condiciones_persona` usa **`COALESCE(body_id, sentinel)`** en su índice único (`ux_condicion_vigente`), no índices parciales separados.
3. `capital_holdings.is_treasury = true` implica `voting_weight = 0` y `denominator_weight = 0` en la proyección.
4. `censo_snapshot` es **inmutable**: triggers BEFORE UPDATE/DELETE lanzan excepción con mensaje "inmutable".
5. Todo `censo_snapshot` rellena `audit_worm_id` automáticamente vía trigger BEFORE INSERT.
6. `persons.person_type` está restringido por CHECK a `('PF'|'PJ')` — el dominio "persona jurídica" se mapea a `'PJ'`, **no** a `'JURIDICA'`.

### Estructura de capital demo (post-T17)

```
Fundación ARGA (G-99999901)
   └─100%→ Cartera ARGA S.L.U. (B-99999902) [entity 00000000-...-020]
              ├─69.69%→ ARGA Seguros S.A. (A-99999903) [entity 6d7ed736-...]
              └─30.31% restante: Mercado libre (X-99999904)
```

**Constantes en `src/test/helpers/supabase-test-client.ts`:**
- `DEMO_ENTITY_ARGA = "6d7ed736-f263-4531-a59d-c6ca0cd41602"` (no el `00000000-...-010` que el plan original asumía — ese UUID no existe en Cloud)
- `DEMO_ENTITY_CARTERA = "00000000-0000-0000-0000-000000000020"`
- `DEMO_PJ_FUNDACION_TAX_ID = "G-99999901"`
- `DEMO_PJ_CARTERA_TAX_ID = "B-99999902"`
- `DEMO_PJ_ARGA_SEGUROS_TAX_ID = "A-99999903"`
- `DEMO_PJ_MERCADO_LIBRE_TAX_ID = "X-99999904"`

### Scripts disponibles

- `bun run scripts/seed-demo-arga-canonico.ts` — seed demo ARGA (cadena capital Fundación→Cartera→ARGA + Mercado Libre free float). Idempotente.
- `bun run scripts/validate-model-bootstrap.ts` — valida las 6 paridades post-bootstrap (entity→PJ, capital_profile VIGENTE, mandates↔holdings, mandates↔condiciones, ARGA suma 100%). Read-only, exit code 0/1.

### Tests

- `src/test/schema/canonical-model.test.ts` — estructura tablas + constraints (T5–T8)
- `src/test/schema/canonical-triggers.test.ts` — inmutabilidad censo_snapshot (T9)
- `src/test/schema/canonical-functions.test.ts` — fn_refresh + fn_crear_snapshot (T10–T11)
- `src/test/schema/canonical-bootstrap.test.ts` — bootstrap PJ + backfill T15/T16 + seed ARGA T17
- `src/test/schema/canonical-rls.test.ts` — RLS tenant scoping (T12)

### Limitaciones conocidas del Cloud project

- **`execute_sql` RPC no está expuesto** en este proyecto. Todos los tests y scripts del modelo canónico usan PostgREST + joins client-side (Set-based keys, reduce-for-sum). No usar `supabase.rpc("execute_sql", ...)` en código nuevo — siempre PostgREST o `mcp__53aea412-..._execute_sql` (solo para orquestación fuera de runtime).
- **`mandates` status en Cloud es 'Activo' (ES)**, no 'ACTIVE'. Backfill de T15 normaliza via `UPPER(COALESCE(m.status,'ACTIVO')) IN ('ACTIVE','ACTIVO')`.
- **`mandates.role` en Cloud es texto libre** con mayúsculas mixtas y paréntesis (ej. "Consejera Delegada (CEO)", "presidente", "Secretaria no Consejera"). Backfill de T15 normaliza via `LOWER(m.role) LIKE '%pattern%'` con VICEPRESIDENTE evaluado antes que PRESIDENTE.

### Deuda WORM intencional

`censo_snapshot` es append-only. El sentinel insertado por los tests T9 (`meeting_id='eeeeeeee-0000-0000-0000-000000000001'`) persiste para siempre — cualquier `DELETE` del propio test fallaría por trigger inmutable. Si hiciera falta purgar (reset, T14 re-seed): `SET LOCAL session_replication_role = replica;` + DELETE en sesión admin fuera de cualquier test (desactiva triggers temporalmente **solo** para la purga).

---

## Convenciones de hooks Secretaría

**⚠️ IMPORTANTE (Sprint G):** Ya NO usar `DEMO_TENANT` hardcodeado. Todos los hooks usan `useTenantContext()`:

```typescript
import { useTenantContext } from "@/context/TenantContext";

export function useXxx(param?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["tabla", tenantId, param ?? "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabla")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return (data ?? []) as Tipo[];
    },
  });
}
```

---

## Rutas Secretaría (en App.tsx)

```tsx
<Route element={<SecretariaLayout />}>
  <Route path="/secretaria"                              element={<SecretariaDashboard />} />
  <Route path="/secretaria/convocatorias"                element={<ConvocatoriasList />} />
  <Route path="/secretaria/convocatorias/nueva"          element={<ConvocatoriasStepper />} />
  <Route path="/secretaria/convocatorias/:id"            element={<ConvocatoriaDetalle />} />
  <Route path="/secretaria/reuniones"                    element={<ReunionesLista />} />
  <Route path="/secretaria/reuniones/:id"                element={<ReunionStepper />} />
  <Route path="/secretaria/decisiones-unipersonales"     element={<DecisionesUnipersonales />} />
  <Route path="/secretaria/decisiones-unipersonales/:id" element={<DecisionDetalle />} />
  <Route path="/secretaria/acuerdos-sin-sesion"                  element={<AcuerdosSinSesion />} />
  <Route path="/secretaria/acuerdos-sin-sesion/nuevo"            element={<AcuerdoSinSesionStepper />} />
  <Route path="/secretaria/acuerdos-sin-sesion/co-aprobacion"    element={<CoAprobacionStepper />} />
  <Route path="/secretaria/acuerdos-sin-sesion/solidario"        element={<SolidarioStepper />} />
  <Route path="/secretaria/acuerdos-sin-sesion/:id"              element={<AcuerdoSinSesionDetalle />} />
  <Route path="/secretaria/tramitador"                   element={<TramitadorLista />} />
  <Route path="/secretaria/tramitador/nuevo"             element={<TramitadorStepper />} />
  <Route path="/secretaria/tramitador/:id"               element={<TramitadorStepper />} />
  <Route path="/secretaria/actas"                        element={<ActasLista />} />
  <Route path="/secretaria/actas/:id"                    element={<ActaDetalle />} />
  <Route path="/secretaria/libros"                       element={<LibrosObligatorios />} />
  <Route path="/secretaria/plantillas"                   element={<Plantillas />} />
  <Route path="/secretaria/acuerdos/:id"                 element={<ExpedienteAcuerdo />} />
</Route>
```

---

## Árbol de archivos clave

```
src/
  pages/secretaria/
    SecretariaLayout.tsx            T2   Layout Garrigues con sidebar verde
    Dashboard.tsx                   T3   KPIs + próximas reuniones + acuerdos pendientes
    ConvocatoriasList.tsx           T4
    ConvocatoriaDetalle.tsx         T4
    ConvocatoriasStepper.tsx        T4   7 pasos, motor V2 integrado
    ReunionesLista.tsx              T5
    ReunionStepper.tsx              T5   6 pasos, crea agreements
    ActasLista.tsx                  T6
    ActaDetalle.tsx                 T6
    TramitadorLista.tsx             T7
    TramitadorStepper.tsx           T7   5 pasos, motor rule packs A4
    AcuerdosSinSesion.tsx           T8
    AcuerdoSinSesionStepper.tsx     T8
    AcuerdoSinSesionDetalle.tsx     T8
    DecisionesUnipersonales.tsx     T9
    DecisionDetalle.tsx             T9
    LibrosObligatorios.tsx          T10
    Plantillas.tsx                  T11  + H4: CTA "Usar esta plantilla" para ACTIVA
    GestorPlantillas.tsx            T11  + H5: editor inline capa1 para BORRADOR
    ExpedienteAcuerdo.tsx           T14  Timeline 8 estados + compliance snapshot
    GenerarDocumentoStepper.tsx     A5   DOCX gen + QTSP QES + Storage archival
    BoardPack.tsx                   B6   9 secciones ejecutivas + DL-2/DL-5
    CoAprobacionStepper.tsx         G4   5 pasos adopción CO_APROBACION (k de n)
    SolidarioStepper.tsx            G5   4 pasos adopción SOLIDARIO

  hooks/
    useJurisdiccionRules.ts         T3   computeQuorumStatus, checkNoticePeriod
    useConvocatorias.ts             T4
    useReunionSecretaria.ts         T5
    useActas.ts                     T6
    useTramitador.ts                T7
    useAcuerdosSinSesion.ts         T8
    useDecisionesUnipers.ts         T9
    useLibros.ts                    T10
    usePlantillas.ts                T11
    useAgreementsList.ts            T1b
    useAgreementCompliance.ts       T13  Motor validez V2 + feature flag
    useRulePackForMateria.ts        A4   Rule pack + active version lookup
    useUserRole.ts                  B2   RBAC roles + permissions + hasPermission()
    useEvidenceBundles.ts           B4   Evidence bundles + audit chain verify
    useBoardPackData.ts             B6   9 parallel queries + DL-2 cotizada logic
    useQTSPSign.ts                  A5   QES signing hook
    useQTSPVerification.ts          T22  Trust Center verification
    useERDSNotification.ts          D3   ERDS certified notification hook
    useModelosAcuerdo.ts            OL2  MODELO_ACUERDO query by materia
    usePactosParasociales.ts        D4   Pactos vigentes + hook con cláusulas
    useAcuerdosSinSesion.ts         T8+G6 + useCloseExpiredVotaciones mutation

  components/
    SodGuard.tsx                    B2   SoD violation checker (BLOCK/WARN)
    EvidenceForenseSection.tsx      B4   SHA-512 bundles + chain verification UI
    SLODashboard.tsx                B7   3 gauges (latency, error rate, uptime)
    ErrorBoundary.tsx               C5   Global error boundary + "Reintentar"

  lib/
    rules-engine/                        Motor de reglas LSC completo (15 archivos)
      types.ts                           Tipos base (RulePack, ExplainNode, etc.)
      jerarquia-normativa.ts             Resolución jerárquica LEY→ESTATUTOS→PACTO→REGLAMENTO
      convocatoria-engine.ts             Validación convocatoria (plazo, forma, contenido)
      constitucion-engine.ts             Quórum de constitución (simple/reforzado)
      majority-evaluator.ts              Mayorías de votación (simple/reforzada/unanimidad)
      votacion-engine.ts                 6-gate voting pipeline
      no-session-engine.ts               5-gate sin sesión pipeline
      documentacion-engine.ts            Acta + documentos pre-sesión
      bordes-no-computables.ts           Cotizadas, representación, voto calidad
      orquestador.ts                     Orquestador transversal (6 etapas)
    doc-gen/
      storage-archiver.ts               SHA-512 + Supabase Storage + evidence_bundles
      template-renderer.ts              Handlebars template rendering
      variable-resolver.ts              H1a: normalizeFuente fix — dotted DB paths → ENTIDAD/ORGANO/REUNION/EXPEDIENTE
      docx-generator.ts                 DOCX generation via docx-js
    secretaria/
      status-labels.ts                  H2: mapa central STATUS_LABEL + fn statusLabel()
    telemetry.ts                    B7   OTel-compatible event tracking stub
```

---

## Datos demo Secretaría (seed T1)

- Convocatorias: `CONV-001` (CdA 22/04/2026, ES, SA), `CONV-002` (Comisión Auditoría), `CONV-003` (JGE 2ª conv ES art.194)
- Reunión: `cda-22-04-2026` (9 presentes, 5 votaciones, acta firmada)
- Actas: `ACTA-CDA-001`, `ACTA-CAU-001`
- Certificación: `CERT-001` (acuerdo PR-008, firmante: Lucía Martín)
- Tramitaciones: `TRAM-001` (notarial ES, EN_TRAMITE), `TRAM-002` (SIGER MX, PRESENTADA), `TRAM-003` (PSM MX, SUBSANACION)
- Acuerdos sin sesión: `ASOC-001` (APROBADO), `ASOC-002` (VOTING_OPEN, deadline 20/04/2026)
- Decisiones unipersonales: `DEC-SU-001` (FIRMADA), `DEC-AU-001` (BORRADOR)
- Libros: 3 libros (alerta legalización < 30/04/2026)
- Plantillas: `TPL-001`, `TPL-002`, `TPL-003`
- Persona: Lucía Martín (Secretaria del CdA, `persons` del core)

---

## No hacer

- No usar colores Tailwind nativos (`text-white`, `bg-gray-*`, `bg-amber-*`, `bg-green-*`) en componentes Garrigues
- No usar hex directamente en className o style — siempre tokens `var(--g-*)` o `var(--status-*)`
- No usar `--g-brand` (incorrecto) → usar `--g-brand-3308`
- No usar `--g-status-*` (incorrecto) → usar `--status-*` (sin prefijo `--g-`)
- No usar `--g-surface-secondary` (no existe) → usar `--g-surface-subtle`
- No usar `style={{ color: "var(--g-...)" }}` cuando existe clase Tailwind equivalente
- No double-nest CSS variables: si `statusColor = "var(--status-success)"`, usar `color: statusColor`, NO `` `var(${statusColor})` ``
- No usar `import crypto from "crypto"` — es módulo Node.js. Usar `globalThis.crypto.subtle` (Web Crypto API)
- No añadir `strictNullChecks` o `noImplicitAny: true` — el proyecto usa TS relajado
- No crear helpers/abstracciones para casos de uso único
- No modificar las tablas del schema `sii.*`
- No tocar hooks de Fase 1 salvo para cross-links específicos (T12)
- No definir tokens `--g-*` en archivos de componentes — solo en `src/index.css`
- No usar variables de for-loop fuera del bloque — extraer a variable con scope correcto (bug `pack` en documentacion-engine)

## Testing

```bash
# Tests unitarios (299/299 pass)
npx vitest run

# Type check (0 errors)
npx tsc --noEmit

# Build (2219 modules, ~6.5s)
npx vite build --outDir /tmp/tgms-dist
```

**Nota:** `vite build` al `dist/` por defecto puede fallar con EPERM por permisos del folder. Usar `--outDir /tmp/tgms-dist`.

## Supabase Cloud

- **Proyecto:** `hzqwefkwsxopwrmtksbg` (governance_OS, eu-central-1)
- **Auth demo:** `demo@arga-seguros.com` / `TGMSdemo2026!`
- **Tenant:** `00000000-0000-0000-0000-000000000001`
- **Entidad ARGA Seguros:** `00000000-0000-0000-0000-000000000010`
- **Migraciones aplicadas:** 000001–000010 + seeds (rule packs, demo data, ETD stubs)
- **RLS:** Habilitado en todas las tablas de dominio con tenant scoping
- **Tablas rules engine:** `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `rbac_roles`, `rbac_user_roles`, `sod_toxic_pairs`, `evidence_bundles`, `audit_worm_trail`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health
