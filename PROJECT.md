# Project: Garrigues Modules Decoupling and Standalone Packaging

## Architecture
The application features a dual architecture:
1. **Core TGMS Shell (`ShellLayout.tsx`)**: Red Pantone 185 C tokens, demo navigation, ARGA multi-entity governance map.
2. **Garrigues Standalone Shell (`src/components/garrigues-shell/GarriguesStandaloneLayout.tsx`)**: Garrigues brand identity (`#004438`, `--g-*` tokens), independent top-level module switcher across Secretaría Societaria (`/secretaria/*`), GRC Compass (`/grc/*`), and AI Governance (`/ai-governance/*`), decoupled header and user menu, dynamic branding via `TenantBrandContext`.

```
                  ┌──────────────────────────────────────────────┐
                  │                 App.tsx                      │
                  └───────┬──────────────────────────────┬───────┘
                          │                              │
                          ▼                              ▼
             ┌────────────────────────┐      ┌────────────────────────┐
             │ ShellLayout (TGMS Red) │      │ GarriguesStandalone-   │
             │   (Core Platform)      │      │ Layout (Green #004438) │
             └────────────────────────┘      └───────────┬────────────┘
                                                         │
                             ┌───────────────────────────┼───────────────────────────┐
                             ▼                           ▼                           ▼
                   ┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
                   │   /secretaria/*   │       │      /grc/*       │       │ /ai-governance/*  │
                   │ (Secretaría Soc.) │       │   (GRC Compass)   │       │  (AI Governance)  │
                   └───────────────────┘       └───────────────────┘       └───────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Secretaria Literal Abstraction | Remove all 15 occurrences of hardcoded "ARGA", "TGMS", "@arga-seguros.com" in `src/secretaria/` using `useTenantBranding()` and generic fallbacks. | M1 | Survey | DONE |
| 2 | GRC Literal Abstraction | Remove all 21 occurrences of hardcoded "ARGA", "TGMS", "lucia@arga-seguros.com", "TPRM-ARGA-" in `src/grc/` and related hooks using `useTenantBranding()`, dynamic user context, and generic fallbacks. | M1 | Survey |
| 3 | Dynamic Scope & ID Generation | Generalize scope selection in `useSecretariaScope.ts` and prefix generation in `useThirdParties.ts` without client-specific strings. | M1 | Survey | DONE |
| 4 | Garrigues Standalone Layout Suite | Create `src/components/garrigues-shell/GarriguesStandaloneLayout.tsx`, `GarriguesSidebar.tsx`, `GarriguesHeader.tsx`, `GarriguesUserMenu.tsx`, `GarriguesModuleSwitcher.tsx`, and `navigation.ts`. | M2 | Survey | DONE |
| 5 | Routing & Packaging Integration | Update `src/App.tsx` and module layouts (`SecretariaLayout.tsx`, `GrcLayout.tsx`, `AiLayout.tsx`) to integrate standalone container and navigation while preserving route compatibility. | M2 | Survey | DONE |
| 6 | Decoupled Navigation & Breadcrumbs | Implement module switcher across Secretaria, GRC, AI Governance without hardcoded "Volver a TGMS" buttons or static "TGMS" breadcrumb roots. | M2 | Survey | DONE |
| 7 | Full Build & Test Verification | Execute `bun run typecheck`, `bun test`, and `bun run build` ensuring 0 regressions and 0 errors. | M3 | Acceptance Criteria | DONE |
| 8 | Forensic Integrity & Hardcode Audit | Independent audit confirming 0 hardcoded literal "ARGA"/"TGMS" references in Garrigues views and clean standalone packaging. | M3 | Acceptance Criteria | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Hardcoded References Removal in Secretaria & GRC | Abstraction of static ARGA/TGMS strings across all views, hooks, steppers, and helpers in `src/secretaria` and `src/grc`. | None | DONE |
| 2 | Standalone Garrigues Layout & Packaging Structure | Implementation of `GarriguesStandaloneLayout.tsx`, modular sidebar/header/user-menu, and `App.tsx` routing integration. | M1 | DONE |
| 3 | Verification, Regression Testing & Forensic Audit | Typecheck, build, test suite execution, adversarial check, and forensic integrity audit. | M1, M2 | DONE |

## Interface Contracts
### `TenantBrandContext` & Branding Helpers
- `useTenantBranding()`: Returns `{ branding: TenantBranding | null, isLoading: boolean }`
- `groupFullLabel(branding)`: Resolves company legal name or default label dynamically.
- `brandName(branding)`: Resolves short brand name or default label dynamically.
- `shellLabel(branding)`: Resolves platform/shell label.

### `GarriguesStandaloneLayout`
- Route container rendering `<Outlet />` with Garrigues theme tokens `--g-*` and `.garrigues-module`.
- Sidebar with top-level module switcher (`Secretaria`, `GRC`, `AI Governance`) + contextual sub-navigation.
- Header with dynamic breadcrumbs, tenant scope switcher, notifications, and `GarriguesUserMenu`.

## Code Layout
- `src/components/garrigues-shell/`: Standalone shell components (`GarriguesStandaloneLayout.tsx`, `GarriguesSidebar.tsx`, `GarriguesHeader.tsx`, `GarriguesUserMenu.tsx`, `GarriguesModuleSwitcher.tsx`, `navigation.ts`, `index.ts`).
- `src/secretaria/` (`pages/`, `components/`, `hooks/`, `lib/`): Secretaria Societaria module.
- `src/grc/` (`pages/`, `components/`, `hooks/`, `lib/`): GRC Compass module.
- `src/ai-governance/` (`pages/`, `components/`, `hooks/`, `lib/`): AI Governance module.
- `src/App.tsx`: Top-level application routing.
