# BRIEFING — 2026-08-27T08:01:00Z

## Mission
Investigate and catalog all hardcoded references to ARGA/TGMS in the Secretaria module (`src/secretaria/` -> `src/pages/secretaria/`, `src/components/secretaria/`, `src/hooks/secretaria/`, `src/lib/secretaria/`), and formulate a comprehensive decoupling and replacement plan.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis, handoff
- Working directory: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_secretaria
- Original parent: 225b873b-251e-4877-a333-49dbea5ed766
- Milestone: Decouple Garrigues Modules (Secretaria survey)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes in source files
- Adhere strictly to project rules and tenant branding architecture

## Current Parent
- Conversation ID: 225b873b-251e-4877-a333-49dbea5ed766
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/pages/secretaria/`
  - `src/components/secretaria/`
  - `src/hooks/secretaria/`
  - `src/lib/secretaria/`
  - `src/context/TenantBrandContext.tsx`
  - `src/lib/tenant-brand-labels.ts`
  - `src/context/TenantContext.tsx`
- **Key findings**:
  - Exactly 15 production files contain runtime hardcoded literals referencing ARGA/TGMS or demo emails.
  - Zero hardcoded tenant UUIDs in production UI/steppers (already dynamic via `useTenantContext()`).
  - Existing `TenantBrandContext` and `tenant-brand-labels.ts` provide the exact infrastructure needed for dynamic abstraction.
- **Unexplored areas**: None within the Secretaria module.

## Key Decisions Made
- Categorized all occurrences into scope fallbacks, placeholders/helpers, template defaults, calendar metadata, and multi-jurisdiction mock data.
- Formulated an abstraction plan leveraging `TenantBrandContext` and generic fallbacks.

## Artifact Index
- `.agents/explorer_survey_secretaria/analysis.md` — Detailed file-by-file catalog and replacement plan.
- `.agents/explorer_survey_secretaria/handoff.md` — 5-Component handoff report.
