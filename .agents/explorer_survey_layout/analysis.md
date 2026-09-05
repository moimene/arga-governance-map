# Architectural Analysis: Standalone Garrigues Layout & Modular Packaging

**Author:** Explorer (Layout, Packaging, and Routing Architecture Investigator)  
**Date:** 2026-08-27  
**Scope:** Standalone packaging, unified Garrigues layout wrapper, routing architecture, and decoupling from TGMS shell and ARGA demo environment.

---

## 1. Executive Summary & Problem Boundary

### 1.1 Context & Business Model
The platform currently encompasses two operational dimensions:
1. **TGMS Enterprise Demonstrator (Dual-Mode / Large Enterprise):** A comprehensive governance platform (red shell, `#E8112D`, `--t-*` tokens) for multinational insurance groups with ARGA as the demonstration persona.
2. **Garrigues Autonomous Legal & Compliance Modules (Standalone Product):** Three specialized modules developed with Garrigues brand identity (`#004438`, `--g-*` tokens, Montserrat typography):
   - **Secretaría Societaria** (`/secretaria/*`)
   - **GRC Compass** (`/grc/*`)
   - **AI Governance** (`/ai-governance/*`)

### 1.2 Current State Deficiencies
- **Navigation Fragmentation:** Each Garrigues module (`SecretariaLayout`, `GrcLayout`, `AiLayout`) maintains its own disconnected layout and sidebar. A user inside Secretaría cannot navigate to GRC Compass or AI Governance without exiting through the TGMS Red Shell (`/`).
- **Hardcoded Exit Links to TGMS:** All three module sidebars currently end with a hardcoded button `"Volver a TGMS"` calling `navigate("/")`.
- **Topbar & Header Discrepancies:** `SecretariaHeader`, `GrcLayout`, and `AiLayout` have inconsistent header implementations. None provide a unified user profile menu, notification bell, or suite-level module switcher.
- **Leaked Demo References & Brand Defaults:** `UserMenu.tsx` hardcodes `"Secretaría General — Grupo ARGA"`, `GrcLayout.tsx` and `AiLayout.tsx` hardcode `"TGMS"` in breadcrumbs, `tenant-brand-labels.ts` defaults to `"TGMS PLATFORM"` / `"Grupo ARGA"`, and several GRC views contain hardcoded literal mentions of ARGA.

### 1.3 Target Architecture Objectives
- Provide a unified **`GarriguesStandaloneLayout.tsx`** that encapsulates all three Garrigues modules.
- Implement a dedicated **Garrigues Suite Navigation** supporting multi-module switching (Secretaria ↔ GRC ↔ AI Gov) and contextual sub-navigation.
- Provide an independent **Garrigues Suite Header** with unified breadcrumbs, search, scope switcher, notification bell, and dynamic user menu.
- Encapsulate tenant branding so that standalone deployments default to Garrigues Legal Tech styling and terminology without breaking zero-change guarantees for the TGMS/ARGA demonstrator.
- Support seamless **Dual-Mode Operation** (embedded in TGMS vs standalone Garrigues suite).

---

## 2. Inventory & Dependency Analysis

### 2.1 Component & Layout Inventory

```
src/
├── components/
│   ├── shell/                       # TGMS Red Shell (Pantone 185 C #E8112D)
│   │   ├── ShellLayout.tsx          # Active shell wrapper for core TGMS routes
│   │   ├── AppLayout.tsx            # Legacy layout (unused in App.tsx)
│   │   ├── Header.tsx               # TGMS Header (hardcoded "ARGA Seguros")
│   │   ├── Sidebar.tsx              # TGMS Sidebar (Gobernanza, Módulos, SII)
│   │   ├── UserMenu.tsx             # User menu (hardcoded "Secretaría General — Grupo ARGA")
│   │   ├── ScopeSwitcher.tsx        # Scope switcher for TGMS entities
│   │   ├── ScopeNotice.tsx          # Scope notice bar
│   │   ├── GlobalSearch.tsx         # TGMS Global search
│   │   └── NotificationsBell.tsx    # Notifications trigger
│   ├── secretaria/
│   │   └── shell/                   # Secretaría module shell components
│   │       ├── SecretariaHeader.tsx # Scope mode header (Sociedad vs Grupo)
│   │       ├── SecretariaSidebar.tsx# Full Secretaría sidebar with visibility guards
│   │       ├── ScopeSwitcher.tsx    # Entity/Group switcher for Secretaría
│   │       ├── GlobalSearch.tsx     # Search within Secretaría scope
│   │       ├── navigation.ts        # Nav groups (GRUPO_NAV_GROUPS / SOCIEDAD_NAV_GROUPS)
│   │       ├── useSecretariaScope.ts# Hook controlling scope mode and entity selection
│   │       └── types.ts             # Scope types and controller interfaces
│   └── grc/
│       ├── ModuleShell.tsx          # Secondary layout for dynamic GRC modules (/grc/m/:moduleId)
│       └── ModuleSidebar.tsx        # Secondary sidebar for DORA/GDPR/Cyber/Audit
├── pages/
│   ├── secretaria/
│   │   └── SecretariaLayout.tsx     # Layout wrapper for /secretaria/*
│   ├── grc/
│   │   └── GrcLayout.tsx            # Layout wrapper for /grc/* (has inline GrcSidebarContent)
│   └── ai-governance/
│       └── AiLayout.tsx             # Layout wrapper for /ai-governance/* (has inline AiSidebarContent)
```

### 2.2 Direct Coupling & Leaks in Garrigues Modules

| File | Location | Leaked Dependency / Hardcoded Reference | Impact |
|---|---|---|---|
| `src/pages/secretaria/SecretariaLayout.tsx` | Line 19, 23 | Encapsulates only Secretaría; no links to GRC or AI Gov | Siloed module |
| `src/components/secretaria/shell/SecretariaSidebar.tsx` | Lines 216–230 | `<button onClick={() => navigate("/")}>Volver a TGMS</button>` | Hardcoded TGMS dependency |
| `src/pages/grc/GrcLayout.tsx` | Lines 99–113 | `<button onClick={() => navigate("/")}>Volver a TGMS</button>` | Hardcoded TGMS dependency |
| `src/pages/grc/GrcLayout.tsx` | Line 164 | `<span>TGMS</span> › <span>GRC Compass</span>` | Hardcoded breadcrumb root |
| `src/pages/ai-governance/AiLayout.tsx` | Lines 72–86 | `<button onClick={() => navigate("/")}>Volver a TGMS</button>` | Hardcoded TGMS dependency |
| `src/pages/ai-governance/AiLayout.tsx` | Line 127 | `<span>TGMS</span> › <span>AI Governance</span>` | Hardcoded breadcrumb root |
| `src/components/shell/UserMenu.tsx` | Line 19 | `"Secretaría General — Grupo ARGA"` | Hardcoded ARGA tenant copy |
| `src/components/shell/Header.tsx` | Lines 26–27 | `<span className="font-bold text-primary">ARGA</span>` | Hardcoded ARGA logo/brand |
| `src/pages/grc/modules/audit/Findings.tsx` | Line 115 | `"Ver en TGMS →"` linking to `/hallazgos` | Core shell link inside GRC |
| `src/pages/grc/modules/dora/PoliciesLink.tsx` | Lines 10, 16 | `"Políticas del shell TGMS"`, `"Ver todas las políticas en TGMS →"` (`/politicas`) | Core shell link inside GRC |
| `src/components/secretaria/shell/useSecretariaScope.ts` | Lines 59–62 | Checks for `"ARGA Seguros, S.A."` in `getPreferredEntity` | Hardcoded entity name in fallback |
| `src/pages/grc/PenalAnticorrupcion.tsx` | Lines 93, 167 | Literal `"ARGA Seguros"`, fallback `"Grupo ARGA Seguros"` | Un-abstracted demo data |
| `src/pages/grc/Risk360.tsx` | Line 202 | Fallback `"Grupo ARGA Seguros"` | Un-abstracted demo data |
| `src/pages/grc/TPRM.tsx` | Lines 405, 425 | Questions hardcoding `"ARGA"` | Un-abstracted questions |
| `src/pages/grc/Excepciones.tsx` | Line 554 | Option `"Consejo de Administración (ARGA Seguros S.A.)"` | Hardcoded select option |
| `src/pages/grc/IncidenteDetalle.tsx` | Line 638 | Option `"Consejo de Administración (ARGA Seguros S.A.)"` | Hardcoded select option |

---

## 3. Standalone Garrigues Layout Design

### 3.1 Architectural Principles
1. **Design System Consistency:** Enforce Garrigues tokens (`--g-brand-3308: #004438`, `--g-brand-bright: #009a77`, `--g-surface-*`, `--g-border-*`, `--g-text-*`, `--status-*`) and Montserrat/Inter typography across all shell elements.
2. **Hierarchical Suite Navigation:** Provide a 2-tier or unified sidebar that clearly separates **Suite Modules** (Secretaría Societaria, GRC Compass, AI Governance) and **Module Sub-views** (e.g. Mesa, Adopción, Libros, Riesgos, Sistemas IA).
3. **Mode Agnosticism (Dual-Mode vs Standalone):**
   - In **Standalone Mode**, the sidebar header displays "Garrigues Corporate Solutions" (or tenant brand), and there is no "Volver a TGMS" button.
   - In **TGMS Embedded Mode**, the sidebar displays a subtle, configurable "Volver a TGMS" return button.
4. **Independent Header & Topbar:** Integrate breadcrumbs, scope switcher (Sociedad vs Grupo), global search, notifications bell, and dynamic user profile menu into a consistent header component.

### 3.2 Component Hierarchy & Structure

```
src/components/garrigues-shell/
├── GarriguesStandaloneLayout.tsx    # Root layout container for standalone mode & shared shell
├── GarriguesHeader.tsx              # Topbar: Breadcrumbs, Scope Badge, Search, Notifications, UserMenu
├── GarriguesSidebar.tsx             # Unified sidebar with module switcher & contextual nav
├── GarriguesMobileSidebar.tsx       # Sheet-based mobile navigation drawer
├── GarriguesUserMenu.tsx            # Dynamic user menu decoupled from ARGA
├── GarriguesModuleSwitcher.tsx      # Top switcher tabs: [Secretaría] [GRC Compass] [AI Governance]
├── GarriguesScopeSwitcher.tsx       # Standardized entity/group scope selector
├── GarriguesBrandProvider.tsx       # Brand context adapter for Garrigues standalone mode
├── navigation.ts                    # Unified navigation registry across all 3 modules
└── types.ts                         # Layout contracts, module descriptors, user profile types
```

### 3.3 Component Specifications

#### A. `GarriguesStandaloneLayout.tsx`
- **Purpose:** Acts as the outer boundary for Garrigues routes.
- **Responsibilities:**
  - Injects CSS class `garrigues-module` and font styles.
  - Initializes and provides `SecretariaScopeController` (or unified `GarriguesScopeController`).
  - Renders `GarriguesSidebar` (desktop) and `GarriguesMobileSidebar` (mobile).
  - Renders `GarriguesHeader` with responsive toggle and contextual metadata.
  - Renders `<Outlet />` wrapped in `<ErrorBoundary>` and `<Suspense>`.
- **Props / Contract:**
  ```tsx
  export interface GarriguesLayoutProps {
    /** Whether running inside TGMS shell demonstrator or standalone product */
    mode?: "standalone" | "embedded";
    /** Custom back link when embedded (defaults to "/" in embedded mode, omitted in standalone) */
    parentAppUrl?: string;
    parentAppLabel?: string;
    children?: React.ReactNode;
  }
  ```

#### B. `GarriguesSidebar.tsx` & `GarriguesModuleSwitcher.tsx`
- **Purpose:** Provide seamless navigation between Garrigues modules and within the active module.
- **Design:**
  - **Header:** Garrigues logo / brand icon + "Garrigues Legal Tech" (or tenant brand).
  - **Module Switcher (Level 1):**
    - 🏛️ **Secretaría Societaria** (`/secretaria`)
    - 🛡️ **GRC Compass** (`/grc`)
    - 🧠 **AI Governance** (`/ai-governance`)
    - *Gated dynamically by `isModuleEnabled(branding, moduleKey)`*.
  - **Scope Switcher:** Contextual entity switcher (`Modo Grupo` vs `Modo Sociedad`).
  - **Search:** Embedded global search across current module resources.
  - **Module Nav Items (Level 2):**
    - If path starts with `/secretaria`: renders `SecretariaNavGroups` (Mesa, Adopción, Documentación, Registro, Libros, Sociedades, Configuración).
    - If path starts with `/grc`: renders `GrcNavItems` (Dashboard, Risk 360, TPRM, Penal, Packs, Mi Trabajo, Alertas, Excepciones, Dynamic Modules).
    - If path starts with `/ai-governance`: renders `AiGovNavItems` (Dashboard, Sistemas IA, Evaluaciones, Incidentes).
  - **Footer:**
    - User account quick status / help & documentation.
    - If `mode === "embedded"`: "Volver a TGMS" return action.
    - If `mode === "standalone"`: Version and product info (`Garrigues Suite v1.0`).

#### C. `GarriguesHeader.tsx`
- **Purpose:** Standardize top navigation and action bar across all Garrigues modules.
- **Elements:**
  1. Mobile hamburger menu button (`lg:hidden`).
  2. Dynamic Breadcrumb: `Garrigues Suite › [Active Module] › [Active Section] › [Entity/Group Name]`.
  3. Scope indicator badge: `Modo Sociedad (Entity)` vs `Modo Grupo (Grupo)`.
  4. Search bar (or quick shortcut `Cmd+K`).
  5. Notification bell (`NotificationsBell`).
  6. Standalone User Menu (`GarriguesUserMenu`).

#### D. `GarriguesUserMenu.tsx`
- **Purpose:** Provide user profile, settings, and session termination without hardcoded ARGA references.
- **Implementation:**
  - Reads `user` from `useAuth()` (email, user metadata).
  - Displays dynamic user initials / avatar.
  - Displays user name from auth profile (or defaults to authenticated email).
  - Displays role / tenant name dynamically from `useTenantBranding()` or `TenantContext` (e.g., `Secretaría General — ${brandName(branding)}`).
  - Provides "Cerrar sesión" triggering `supabase.auth.signOut()`.

---

## 4. Routing & Packaging Architecture

### 4.1 Dual-Mode Routing Strategy

We propose a dual-mode routing setup in `App.tsx` that supports:
1. **Direct Module Routing (`/secretaria/*`, `/grc/*`, `/ai-governance/*`):** Maintained for full backwards compatibility with existing bookmarks and TGMS shell links.
2. **Unified Standalone Route Mount (`/garrigues/*`):** Allows accessing the complete Garrigues suite as a consolidated sub-app.
3. **Tenant-Driven Default Route:** When a tenant logs in whose enabled modules are exclusively Garrigues (or in a standalone build), `/` automatically routes to `/secretaria` or `/garrigues/dashboard` instead of the TGMS Red Shell.

### 4.2 Route Structure in `App.tsx`

```tsx
// ── Modular Routes Decomposition ──────────────────────────────────────────

// 1. Core TGMS Demonstrator Routes (Red Shell)
<Route element={<ProtectedShell />}>
  <Route path="/" element={<Dashboard />} />
  <Route path="/governance-map" element={<GovernanceMap />} />
  <Route path="/entidades" element={<EntidadesList />} />
  {/* ... other TGMS core routes ... */}
</Route>

// 2. Unified Garrigues Suite (Standalone / Shared Layout)
<Route
  element={
    <RequireAuth>
      <Suspense fallback={<ModuleFallback />}>
        <GarriguesStandaloneLayout mode="embedded" />
      </Suspense>
    </RequireAuth>
  }
>
  {/* Secretaría Societaria */}
  <Route path="/secretaria" element={<SecretariaDashboard />} />
  <Route path="/secretaria/convocatorias" element={<ConvocatoriasList />} />
  <Route path="/secretaria/convocatorias/nueva" element={<ConvocatoriasStepper />} />
  {/* ... all /secretaria/* routes ... */}

  {/* GRC Compass */}
  <Route path="/grc" element={<GrcDashboardPage />} />
  <Route path="/grc/risk-360" element={<Risk360 />} />
  <Route path="/grc/tprm" element={<TPRM />} />
  {/* ... all /grc/* routes ... */}

  {/* AI Governance */}
  <Route path="/ai-governance" element={<AiDashboard />} />
  <Route path="/ai-governance/sistemas" element={<Sistemas />} />
  {/* ... all /ai-governance/* routes ... */}
</Route>
```

*Note on Modular Packaging:* By having `GarriguesStandaloneLayout` wrap all three module subtrees under a single layout route, we eliminate the triple layout duplication (`SecretariaLayout`, `GrcLayout`, `AiLayout`) and achieve complete suite navigation across modules.

---

## 5. Tenant Branding & Label Abstraction Strategy

### 5.1 Resolving Hardcoded Defaults in `tenant-brand-labels.ts`
Currently, `tenant-brand-labels.ts` defaults to ARGA:
```ts
export const DEFAULT_SHELL_LABEL = "TGMS PLATFORM";
export const DEFAULT_SCOPE_LABEL = "Grupo ARGA";
export const DEFAULT_SII_ORG_LABEL = "Grupo ARGA Seguros";
export const DEFAULT_BRAND_NAME = "TGMS";
export const DEFAULT_GROUP_FULL_LABEL = "Grupo ARGA Seguros";
```

### 5.2 Standalone Branding Resolver
To ensure zero visual change for the ARGA demo while allowing Garrigues Standalone mode to show generic or Garrigues-branded labels:
1. Introduce contextual brand resolvers or tenant branding presets:
   ```ts
   export interface BrandFallbackConfig {
     shellLabel: string;
     scopeLabel: string;
     brandName: string;
     groupFullLabel: string;
   }

   export const TGMS_ARGA_DEFAULTS: BrandFallbackConfig = {
     shellLabel: "TGMS PLATFORM",
     scopeLabel: "Grupo ARGA",
     brandName: "TGMS",
     groupFullLabel: "Grupo ARGA Seguros",
   };

   export const GARRIGUES_STANDALONE_DEFAULTS: BrandFallbackConfig = {
     shellLabel: "GARRIGUES LEGAL & GRC",
     scopeLabel: "Grupo Corporativo",
     brandName: "Garrigues",
     groupFullLabel: "Grupo Corporativo",
   };
   ```
2. In `getPreferredEntity()` within `useSecretariaScope.ts`, decouple the hardcoded string:
   ```ts
   export function getPreferredEntity(entities: SecretariaEntityOption[], preferredName?: string) {
     if (preferredName) {
       const match = entities.find((e) => e.legalName === preferredName || e.name === preferredName);
       if (match) return match;
     }
     // Default: parent-less entity (group holding/parent) or first entity
     return (
       entities.find((entity) => entity.parentEntityId == null) ??
       entities[0] ??
       null
     );
   }
   ```
   *(For ARGA tenant, `preferredName` can be injected via tenant config or fall back to parent entity).*

### 5.3 Cross-Module Text Sanitization Plan
1. **`src/pages/grc/PenalAnticorrupcion.tsx` & `Risk360.tsx`:** Replace `"Grupo ARGA Seguros"` fallback with `groupFullLabel(branding)`.
2. **`src/pages/grc/Excepciones.tsx` & `IncidenteDetalle.tsx`:** Replace hardcoded select option `"Consejo de Administración (ARGA Seguros S.A.)"` with dynamic entity collegiate body options derived from `useEntitiesList()`.
3. **`src/pages/grc/TPRM.tsx`:** Replace static `"ARGA"` in assessment questions with `"la entidad"` or `${brandName(branding)}`.
4. **`src/pages/grc/modules/audit/Findings.tsx` & `PoliciesLink.tsx`:** Guard TGMS deep links so they only render when `mode === "embedded"` or when core TGMS modules are enabled in tenant profile.

---

## 6. Verification & Quality Gates

1. **Static Analysis & Typecheck:**
   - Run `bun run typecheck` (`tsc --noEmit`) to ensure zero type regressions.
   - Run `bun run lint` to verify ESLint compliance.
2. **Unit & Regression Testing:**
   - Execute `bun test` across all 3,100+ tests.
   - Verify `tenant-brand-labels.test.ts` passes and retains ARGA contract assertions.
   - Add new tests for `GarriguesStandaloneLayout`, `GarriguesSidebar`, `GarriguesUserMenu`, and module switching.
3. **Visual & Layout Inspection:**
   - Verify standalone layout renders with correct `--g-*` tokens (Pantone 3308 C `#004438`).
   - Verify smooth switching between Secretaría, GRC, and AI Governance without route reloads or TGMS red flashes.
   - Verify responsive navigation on mobile viewports via `GarriguesMobileSidebar`.
   - Verify zero unwanted occurrences of literal `"ARGA"` or `"TGMS"` in standalone views.

---

## 7. Next Steps for Implementation

1. **Step 1 (Layout & Navigation Shell):** Implement `src/components/garrigues-shell/*` (`GarriguesStandaloneLayout`, `GarriguesSidebar`, `GarriguesHeader`, `GarriguesUserMenu`, `navigation.ts`).
2. **Step 2 (App.tsx Route Integration):** Refactor `src/App.tsx` to mount Garrigues modules under the unified `GarriguesStandaloneLayout`.
3. **Step 3 (String Decoupling & Brand Resolver):** Abstract hardcoded strings in `useSecretariaScope.ts`, `UserMenu.tsx`, and GRC pages (`PenalAnticorrupcion`, `TPRM`, `Excepciones`, etc.) using `useTenantBranding()`.
4. **Step 4 (Test Suite & Verification):** Add layout tests and run full project test suite.
