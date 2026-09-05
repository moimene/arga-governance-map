## 2026-08-27T05:58:55Z
You are an Explorer investigating the layout, packaging, and routing architecture to enable a Standalone Garrigues Layout and packaging structure.

Your working directory is: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_layout
Project Root: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map
Authoritative User Request: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/ORIGINAL_REQUEST.md

Instructions:
1. Read ORIGINAL_REQUEST.md first.
2. Inspect `src/components/layout/ShellLayout.tsx`, `src/App.tsx`, `src/routes.tsx` (or route definitions), `src/secretaria/SecretariaLayout.tsx`, `src/grc/GRCLayout.tsx`, `src/ai-governance/AIGovernanceLayout.tsx`, and related layout/navigation components.
3. Analyze what dependencies the Garrigues modules currently have on `ShellLayout.tsx` (TGMS red shell, demo navigation, ARGA menus, header, user menu, etc.).
4. Design a standalone packaging architecture:
   - Specification for `GarriguesStandaloneLayout.tsx` (or similar standalone wrapper): Garrigues brand identity (`#004438`, `--g-*` tokens), dedicated standalone navigation/sidebar across Garrigues modules (Secretaria, GRC, AI Governance), independent topbar/header, tenant brand provider encapsulation.
   - Routing integration in `App.tsx` or standalone route definitions (e.g., allowing standalone access via `/garrigues/*` or standalone mode flag/routes while keeping dual-mode compatibility if desired).
5. Document the exact file structure, component tree, routing contracts, and transition requirements.
6. Write your detailed architectural analysis to `.agents/explorer_survey_layout/analysis.md` and a summary in `handoff.md`.
7. Send a message back to the orchestrator (conversation ID: 225b873b-251e-4877-a333-49dbea5ed766) with a concise summary and path to your handoff.md.

Note: You are read-only. Do NOT modify source files.
