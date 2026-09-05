## 2026-08-27T06:28:32Z
You are Challenger 1 for Milestone 2 of the Garrigues Decoupling project.

Your working directory is: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/challenger_m2_1
Project Root: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map
Authoritative User Request: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/ORIGINAL_REQUEST.md
Project Scope: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/PROJECT.md
Worker M2 Handoff: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/worker_m2/handoff.md

Instructions:
1. Empirically verify the functionality of `GarriguesStandaloneLayout` across all module routes (`/secretaria/*`, `/grc/*`, `/ai-governance/*`).
2. Write automated tests or run assertions verifying that navigation between modules, breadcrumb generation, scope switching, and user menu operate correctly.
3. Verify that the layout functions completely independently without importing or rendering `ShellLayout.tsx` or the TGMS demo sidebar.
4. Run `bun test`, `bun run typecheck`, and `bun run build`.
5. Issue an explicit verdict: APPROVE or REQUEST_CHANGES.
6. Write your report to `.agents/challenger_m2_1/handoff.md`.
7. Send a message back to orchestrator (ID: 225b873b-251e-4877-a333-49dbea5ed766) with your verdict and path to handoff.md.
