## 2026-08-27T08:19:42Z

You are Worker M2 tasked with implementing Milestone 2: Standalone Garrigues Layout and Modular Packaging Architecture.

Your working directory is: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/worker_m2
Project Root: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map
Authoritative User Request: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/ORIGINAL_REQUEST.md
Project Scope Document: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/PROJECT.md

Explorer Investigation Inputs (read these first):
- Layout & Packaging Architecture Analysis: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_layout/analysis.md
- Layout Handoff: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_layout/handoff.md

Task Scope:
1. Create `src/components/garrigues-shell/`:
   - `GarriguesStandaloneLayout.tsx`: Standalone wrapper component applying Garrigues brand styling (`--g-*` tokens, `.garrigues-module`), housing `GarriguesSidebar`, `GarriguesHeader`, and rendering `<Outlet />` with proper scroll container.
   - `GarriguesSidebar.tsx`: Dedicated Garrigues sidebar with:
     - Top brand section with Garrigues logo/badge (`Garrigues Corporate Solutions` / dynamic `brandName(branding)`).
     - `GarriguesModuleSwitcher`: Top-level switcher to toggle between Secretaría Societaria (`/secretaria`), GRC Compass (`/grc`), and AI Governance (`/ai-governance`).
     - Contextual navigation links for the active module (Secretaria links, GRC links, AI Governance links).
     - Clean bottom footer without hardcoded "Volver a TGMS" (optional return link if in embedded mode or clean external return).
   - `GarriguesHeader.tsx`: Independent topbar with dynamic breadcrumb trail (module name › subpage name, without hardcoded "TGMS" root), tenant scope switcher / search, notification bell, and `GarriguesUserMenu`.
   - `GarriguesUserMenu.tsx`: Decoupled user menu with dynamic user role/email, without hardcoded "Grupo ARGA" subtitle.
   - `GarriguesModuleSwitcher.tsx`: Reusable module switcher dropdown or tab bar.
   - `navigation.ts`: Typed navigation registry with routes, labels, icons, and permissions for Secretaría, GRC, and AI Governance.
   - `index.ts`: Clean export barrel for `src/components/garrigues-shell`.

2. Update `src/App.tsx` and Route Layouts:
   - Integrate `GarriguesStandaloneLayout` as the parent route wrapper for `/secretaria/*`, `/grc/*`, and `/ai-governance/*` routes in `src/App.tsx` (or standalone routes), ensuring seamless navigation between all three Garrigues modules without dependency on `ShellLayout.tsx` (the TGMS red shell).
   - Ensure all existing routes (`/secretaria/*`, `/grc/*`, `/ai-governance/*`) remain fully backward-compatible and accessible.

3. Clean up residual hardcoded strings:
   - `src/pages/ai-governance/AiLayout.tsx`: Sanitize "Volver a TGMS" and static "TGMS" breadcrumb root to use `brandName(branding)`.
   - `src/pages/ai-governance/SistemaDetalle.tsx`: Sanitize any static demo emails/strings.
   - `src/components/board-pack/BPPortada.tsx`: Replace static "Grupo ARGA Seguros" and "TGMS Platform" at lines 41, 110 with dynamic `groupFullLabel(branding)` and `shellLabel(branding)`.

4. Verification:
   - Run `bun run typecheck` (`tsc --noEmit`)
   - Run `bun test`
   - Run `bun run build`
   - Verify 0 TypeScript errors and all tests passing.
