# BRIEFING — 2026-08-27T06:05:00Z

## Mission
Survey all hardcoded references to "ARGA", "arga", "TGMS", "tgms", and demo tenant/company identifiers across `src/grc/` and related hooks/components, producing a comprehensive decoupling audit and replacement plan.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, survey, synthesis
- Working directory: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.agents/explorer_survey_grc
- Original parent: 225b873b-251e-4877-a333-49dbea5ed766
- Milestone: GRC Module Decoupling Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT modify source code
- Inspect all files under `src/grc/` and related components/hooks
- Document every occurrence with file path, line number, code context, and rationale
- Propose dynamic replacement via `useTenantBrand()`, props, or config
- Deliver `analysis.md` and `handoff.md`

## Current Parent
- Conversation ID: 225b873b-251e-4877-a333-49dbea5ed766
- Updated: 2026-08-27T06:05:00Z

## Investigation State
- **Explored paths**: `src/pages/grc/`, `src/components/grc/`, `src/lib/grc/`, `src/hooks/useThirdParties.ts`, `src/context/TenantBrandContext.tsx`, `src/lib/tenant-brand-labels.ts`
- **Key findings**: Identified 21 exact occurrences of hardcoded references across 10 files and 2 test/metadata files in GRC. Formulated complete replacement plan.
- **Unexplored areas**: None within GRC scope.

## Key Decisions Made
- Categorized findings into 6 clear remediation buckets: Group Scope Label, Demo Signer/Email, Modal Select Options, Taxonomy & Questionnaire Copy, Shell Navigation & Breadcrumbs, and ID Prefix Generator.
- Detailed migration instructions written to `analysis.md` and `handoff.md`.

## Artifact Index
- `.agents/explorer_survey_grc/analysis.md` — Full survey and migration plan
- `.agents/explorer_survey_grc/handoff.md` — 5-component handoff report
