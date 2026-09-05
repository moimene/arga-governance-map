# Changes Log — Milestone 2: Standalone Garrigues Layout and Modular Packaging Architecture

## Overview
Implemented the standalone packaging architecture for the Garrigues Legal Tech suite (`Secretaría Societaria`, `GRC Compass`, `AI Governance`), creating the unified `src/components/garrigues-shell/` component hierarchy and integrating it as the parent route wrapper in `src/App.tsx`. Sanitized residual hardcoded strings in AI Governance and Board Pack.

---

## Detailed Changes by Module

### 1. New Component Package: `src/components/garrigues-shell/`
- **`navigation.ts`**:
  - Typed navigation registry defining the 3 canonical Garrigues modules (`secretaria`, `grc`, `ai-governance`) with route paths, icons, descriptions, and feature module keys.
  - Exported `getEnabledGarriguesModules(branding)` to dynamically filter modules by tenant white-list.
  - Exported `getActiveGarriguesModule(pathname)` to determine active module from the current URL.
  - Exported canonical nav items for GRC (`GRC_NAV_ITEMS`) and AI Governance (`AI_NAV_ITEMS`).
- **`GarriguesModuleSwitcher.tsx`**:
  - Reusable module switcher dropdown allowing instant navigation between Secretaría Societaria (`/secretaria`), GRC Compass (`/grc`), and AI Governance (`/ai-governance`).
  - Gated by tenant enabled modules, preserving entity scope when switching.
- **`GarriguesUserMenu.tsx`**:
  - Standalone user menu component decoupled from ARGA demo copy.
  - Resolves authenticated user full name, email, avatar initials, and dynamic role code label (`${roleText} — ${brandName(branding)}`).
  - Provides profile, settings, and sign-out actions using `useAuth()`.
- **`GarriguesHeader.tsx`**:
  - Independent topbar with dynamic breadcrumb trail (`${brandName(branding)} › ${moduleLabel} › ${scopeLabel}`), without hardcoded "TGMS" root.
  - Responsive hamburger toggle for mobile devices.
  - Scope badge (`Modo Sociedad` vs `Modo Grupo`) when in scoped modules.
  - Integrated `NotificationsBell` and `GarriguesUserMenu`.
- **`GarriguesSidebar.tsx`**:
  - Unified sidebar with brand header (`Garrigues Corporate Solutions`), `GarriguesModuleSwitcher`, dynamic scope switcher (for Secretaría and GRC), search, and contextual nav groups.
  - Responsive `GarriguesMobileSidebar` drawer using `<Sheet>`.
  - Supports dual modes: `embedded` (with configurable "Volver a TGMS" return button) and `standalone` (clean product info `Garrigues Suite v2.0`).
- **`GarriguesStandaloneLayout.tsx`**:
  - Root layout wrapper applying Garrigues brand styling (`--g-*` tokens, `.garrigues-module`, Montserrat/Inter typography).
  - Initializes `useSecretariaScope()` and renders `GarriguesSidebar`, `GarriguesMobileSidebar`, `GarriguesHeader`, and `<Outlet />`.
- **`index.ts`**:
  - Clean export barrel for all shell components and types.

### 2. Application Routing: `src/App.tsx`
- Lazy-imported `GarriguesStandaloneLayout` from `@/components/garrigues-shell`.
- Unified all `/secretaria/*`, `/grc/*`, and `/ai-governance/*` route trees under a single `GarriguesStandaloneLayout mode="embedded"` parent layout route.
- Removed legacy separate layout route wrappers, enabling seamless cross-module navigation between all Garrigues modules without route reloading or Red Shell flashes.

### 3. Residual String Sanitization
- **`src/pages/ai-governance/AiLayout.tsx`**:
  - Replaced hardcoded "Volver al shell TGMS" / "Volver a TGMS" with dynamic `brandName(branding)`.
  - Replaced static `<span>TGMS</span>` breadcrumb root with dynamic `{brandName(branding)}`.
- **`src/pages/ai-governance/SistemaDetalle.tsx`**:
  - Replaced static `"Lucía Martín"` and `"lucia@arga-seguros.com"` form defaults with dynamic `user?.email || "responsable.ia@empresa.com"` and `"Responsable de IA"`.
- **`src/components/board-pack/BPPortada.tsx`**:
  - Replaced static `"Grupo ARGA Seguros"` with dynamic `{groupFullLabel(branding)}`.
  - Replaced static `"TGMS Platform"` with dynamic `{shellLabel(branding)}`.

### 4. Test Suite
- Created `src/components/garrigues-shell/__tests__/garrigues-shell.test.tsx` with 14 comprehensive unit and integration tests covering navigation registry, module switcher, user menu, header, sidebar, and layout integration.

---

## Verification Results
- `bun run typecheck`: Passed (0 errors).
- `bun test`: Passed (3,341 passed, 152 skipped, 0 failed across 399 test files).
- `bun run build`: Built successfully in 7.47s.
- `rg -i "\b(arga|tgms)\b"`: 0 hardcoded brand literals in Garrigues JSX views.
