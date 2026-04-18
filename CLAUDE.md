# CLAUDE.md — arga-governance-map

Guía para IA y desarrolladores que retoman este proyecto. Leer antes de tocar cualquier archivo.

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

**Documentos de referencia (rutas absolutas — NO están en este repo):**
- Spec: `/Users/moisesmenendez/Dropbox/DESARROLLO/TGMS_mapfre_mockup/docs/superpowers/specs/2026-04-18-secretaria-societaria-design.md`
- Plan v1 (T1–T12, con deuda UX): `/Users/moisesmenendez/Dropbox/DESARROLLO/TGMS_mapfre_mockup/docs/superpowers/plans/2026-04-18-secretaria-societaria-implementation.md`
- Plan v2 (T1–T14, UX corregida): `/Users/moisesmenendez/Dropbox/DESARROLLO/TGMS_mapfre_mockup/docs/superpowers/plans/2026-04-18-secretaria-societaria-implementation-v2.md`

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

## Convenciones de hooks Secretaría

```typescript
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export function useXxx(param?: string) {
  return useQuery({
    queryKey: ["tabla", param ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabla")
        .select("*")
        .eq("tenant_id", DEMO_TENANT);
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
  <Route path="/secretaria/acuerdos-sin-sesion"          element={<AcuerdosSinSesion />} />
  <Route path="/secretaria/acuerdos-sin-sesion/nuevo"    element={<AcuerdoSinSesionStepper />} />
  <Route path="/secretaria/acuerdos-sin-sesion/:id"      element={<AcuerdoSinSesionDetalle />} />
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

## Árbol de archivos a crear

```
src/
  pages/secretaria/
    SecretariaLayout.tsx        T2  ← primero
    Dashboard.tsx               T3
    ConvocatoriasList.tsx       T4
    ConvocatoriaDetalle.tsx     T4
    ConvocatoriasStepper.tsx    T4
    ReunionesLista.tsx          T5
    ReunionStepper.tsx          T5
    ActasLista.tsx              T6
    ActaDetalle.tsx             T6
    TramitadorLista.tsx         T7
    TramitadorStepper.tsx       T7
    AcuerdosSinSesion.tsx       T8
    AcuerdoSinSesionStepper.tsx T8
    AcuerdoSinSesionDetalle.tsx T8
    DecisionesUnipersonales.tsx T9
    DecisionDetalle.tsx         T9
    LibrosObligatorios.tsx      T10
    Plantillas.tsx              T11
    ExpedienteAcuerdo.tsx       T14 ← nuevo
  hooks/
    useJurisdiccionRules.ts     T3  ← incluye computeQuorumStatus, checkNoticePeriod
    useConvocatorias.ts         T4
    useReunionSecretaria.ts     T5
    useActas.ts                 T6
    useTramitador.ts            T7
    useAcuerdosSinSesion.ts     T8
    useDecisionesUnipers.ts     T9
    useLibros.ts                T10
    usePlantillas.ts            T11
    useAgreements.ts            T1b ← nuevo
    useAgreementCompliance.ts   T13 ← nuevo
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
- No añadir `strictNullChecks` o `noImplicitAny: true` — el proyecto usa TS relajado
- No crear helpers/abstracciones para casos de uso único
- No modificar las tablas del schema `sii.*`
- No tocar hooks de Fase 1 salvo para cross-links específicos (T12)
- No definir tokens `--g-*` en archivos de componentes — solo en `src/index.css`
