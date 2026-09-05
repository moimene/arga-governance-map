# BRIEFING — 2026-08-27T06:01:00Z

## Mission
Investigate layout, packaging, and routing architecture to enable a Standalone Garrigues Layout and packaging structure, decoupling Garrigues modules from TGMS red shell and ARGA demo menus.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Layout, Packaging, and Routing Architecture Investigator
- Working directory: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_layout
- Original parent: 225b873b-251e-4877-a333-49dbea5ed766
- Milestone: Layout & Packaging Architecture Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Produce structured analysis.md and handoff.md in working directory
- Adhere to Garrigues UX/Design System tokens (`--g-*`, `#004438`)
- Detail routing, component tree, dependencies on ShellLayout, and standalone wrapper specification

## Current Parent
- Conversation ID: 225b873b-251e-4877-a333-49dbea5ed766
- Updated: 2026-08-27T06:01:00Z

## Investigation State
- **Explored paths**: `src/App.tsx`, `src/components/shell/ShellLayout.tsx`, `src/components/shell/Header.tsx`, `src/components/shell/Sidebar.tsx`, `src/components/shell/UserMenu.tsx`, `src/pages/secretaria/SecretariaLayout.tsx`, `src/components/secretaria/shell/*`, `src/pages/grc/GrcLayout.tsx`, `src/components/grc/*`, `src/pages/ai-governance/AiLayout.tsx`, `src/context/TenantBrandContext.tsx`, `src/lib/tenant-brand-labels.ts`, `src/index.css`
- **Key findings**:
  1. Complete inventory of layout files and cross-module dependencies compiled.
  2. Identified all points of leakage ("Volver a TGMS" buttons, breadcrumb roots, hardcoded ARGA in UserMenu and GRC pages).
  3. Designed `GarriguesStandaloneLayout` architecture with 2-tier navigation (module switcher + contextual sub-menus), independent topbar, decoupled user menu, and dual-mode compatibility.
  4. Formulated routing consolidation strategy in `App.tsx`.
- **Unexplored areas**: None within layout and packaging scope.

## Key Decisions Made
- Recommended consolidating `SecretariaLayout`, `GrcLayout`, and `AiLayout` under a unified `GarriguesStandaloneLayout` container.
- Designed `GarriguesSidebar` with high-level module switcher tabs for Secretaría, GRC Compass, and AI Governance.
- Preserved zero-change guarantees for TGMS/ARGA demonstrator while enabling standalone Garrigues mode.

## Artifact Index
- `.agents/explorer_survey_layout/analysis.md` — Detailed architectural survey & design
- `.agents/explorer_survey_layout/handoff.md` — Handoff summary for orchestrator
