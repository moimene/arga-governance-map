# Worktree legacy `arga-governance-map-aims360` — Inventario read-only

Fecha: 2026-05-06
Worktree de origen del análisis: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` (rama `main`).
Worktree analizado: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360`.
Modo: lectura. No se ha movido, copiado, mergeado ni borrado nada.

## Contexto

`CLAUDE.md` y `AGENTS.md` (ambos en el worktree principal) declaran desde 2026-05-03:

> Todas las conversaciones y carriles deben trabajar sobre este repo/worktree y sincronizar mediante commits/push a `origin/main`. No trabajar en `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360` salvo lectura histórica o extracción puntual aprobada. Si hay cambios pendientes en otro worktree, no fusionarlos en bloque: primero inventariar, extraer por patch revisado y verificar en este worktree principal.

Este documento es ese inventario, completado en read-only para habilitar la decisión sobre triage.

## 1. Estado git del worktree legacy

| Item | Valor |
|---|---|
| Rama actual | `codex/aims360` |
| Upstream | sin upstream remoto |
| `git rev-list --left-right --count origin/main...HEAD` | `43 0` — la rama está **43 commits BEHIND `origin/main`**, no ahead |
| Commits únicos en HEAD vs origin/main | **0** (verificado con `git log origin/main..HEAD`) |
| HEAD | `93428ae feat(secretaria): C2 — AcuerdoSinSesionStepper 5 pasos completos con persistencia` (2026-04-24) |
| Working tree | 167 archivos modificados/borrados (130 son migraciones SQL borradas) |
| Untracked | 245 archivos (~4 MB) |
| Stashes | 2 (en `codex/ux-lovable-sync`) |
| Ramas locales | 8 + 4 sub-worktrees `worktree-agent-*` |

**Conclusión clave:** no hay pérdida de commits. Todo el trabajo histórico de `codex/aims360` ya está en `origin/main` del worktree principal. El problema es exclusivamente working tree, untracked, stashes y ramas no resueltas.

## 2. Material valioso únicamente en el worktree legacy

### 2.1 docs/schema-registry/ (22 archivos, todos untracked)

Análisis operativos generados entre 2026-04-27 y 2026-04-29. Ninguno existe en main vigente.

| Archivo | Título |
|---|---|
| `2026-04-27-aims-000050-operations-gate.md` | AIMS 000050 Operations Gate |
| `2026-04-27-aims-standalone-map.md` | AIMS Standalone Data Map - Sprint 1.2 |
| `2026-04-27-aims-standalone-slice-1.md` | AIMS Standalone Slice 1 |
| `2026-04-27-aims-standalone-slice-2.md` | AIMS Standalone Slice 2 |
| `2026-04-27-grc-evidence-legal-hold-freeze.md` | GRC Evidence / Legal Hold Freeze |
| `2026-04-27-grc-p0-clean-gate.md` | GRC P0 Clean Gate |
| `2026-04-27-grc-p0-cloud-prep.md` | GRC P0 Cloud Prep - Privacy + DORA/Cyber |
| `2026-04-27-grc-p0-p1-gate-review.md` | GRC P0/P1 Gate Review |
| `2026-04-27-grc-p1-erm-audit-tprm-gate.md` | GRC P1 ERM/Audit/TPRM Gate |
| `2026-04-27-high-risk-triage.md` | Supabase High-Risk Triage - Sprint 1.1 |
| `2026-04-27-quality-consolidation-posture-audit.md` | Quality Consolidation - AIMS/GRC Data Posture |
| `2026-04-27-roadmap-execution-command-center.md` | Roadmap Execution Command Center |
| `2026-04-27-secretaria-continuity-map.md` | Secretaria Continuity Map |
| `2026-04-27-supabase-parity-registry.md` | Supabase Parity Registry - Sprint 1 |
| `2026-04-27-test-coverage-gaps.md` | Test Coverage Gaps - AIMS/GRC Roadmap |
| `2026-04-27-verification-lane.md` | Verification Lane - Supabase/AIMS/GRC |
| `2026-04-28-aims-adapter-hardening.md` | AIMS Adapter Hardening - Nulls, Status and Preview Safety |
| `2026-04-28-aims-hooks-strict-fallback.md` | AIMS Hooks Strict Fallback Gate |
| `2026-04-28-quality-gate-ui.md` | Quality Gate UI - AIMS/GRC Data Posture |
| `2026-04-29-aims-executive-demo-runway.md` | AIMS Executive Demo Runway |
| `2026-04-29-aims-grc-data-contract-export.md` | AIMS/GRC Data Contract Export |
| `2026-04-29-grc-executive-p0-p1-dashboard.md` | GRC Executive P0/P1 Dashboard |
| `2026-04-29-grc-p0-hooks-strict-fallback.md` | GRC P0 Hooks Strict Fallback |
| `2026-04-29-grc-p1-hooks-strict-fallback.md` | GRC P1 Hooks Strict Fallback |
| `2026-04-29-grc-r5-legal-demo-runway.md` | GRC R5 Legal Demo Runway |

**Acción propuesta:** leer cada uno, decidir cuáles aportan algo no cubierto por CLAUDE.md o `docs/superpowers/plans/2026-05-04-repo-sanitization-closeout.md`. Portar relevantes con `git mv` desde el principal o `cp` + commit `docs(schema-registry): import legacy AIMS/GRC analysis from aims360 worktree`.

### 2.2 Planes superpowers untracked (3)

- `docs/superpowers/plans/2026-04-30-prd-diligent-gap-closure-12m.md` — **PRD: Cierre de gaps Diligent + diferenciación TGMS — Roadmap 12 meses**. No existe en main. Posible material estratégico no portado.
- `docs/superpowers/plans/2026-05-02-document-assembly-pipeline-plan.md` — **Marcado SUPERSEDED 2026-05-02**. Descartar.
- `docs/superpowers/plans/2026-05-02-plan-refactorizacion-datos-schema-12m.md` — **Plan de Refactorización — Datos y Schema TGMS (12 meses, 4 olas trimestrales)**. No existe en main. Decidir si alinear con CLAUDE.md actual.

### 2.3 E2E specs únicos (5)

| Spec | Conflicto numeración con main vigente |
|---|---|
| `e2e/12-aims.spec.ts` | sí — main tiene `12-secretaria-navigation.spec.ts` |
| `e2e/13-grc-domains.spec.ts` | sí — main tiene `13-secretaria-lote2-qa.spec.ts` |
| `e2e/16-grc-p0.spec.ts` | sí — main tiene `16-sanitization-smoke.spec.ts` |
| `e2e/17-grc-p1.spec.ts` | sí — main tiene `17-secretaria-template-context.spec.ts` |
| `e2e/18-data-posture.spec.ts` | sí — main tiene `18-secretaria-golden-path.spec.ts` |

**Acción propuesta:** revisar contenido de cada spec legacy. Si son útiles, renumerar a `40-aims-from-aims360.spec.ts`, `41-grc-domains.spec.ts`, etc. para evitar colisión.

### 2.4 Material no-código (descartar del repo)

- 4 archivos PDF/PPTX de marketing EAD Trust (~1.5 MB total): `EADTrust-Taxand-Marketplace.{pdf,pptx}`, `EADTrust-Verticals-Tax-AI.{pdf,pptx}`. **No deben vivir en el repo.** Mover a `Dropbox/DESARROLLO/assets/` o equivalente.

### 2.5 Stashes (2)

- `stash@{0}` (`On codex/ux-lovable-sync: supabase-schema-hold-2026-05-02`):
  - 1 archivo: `supabase/functions/_types/database.ts`, 5641 líneas (4439 ins, 1202 del). Es el types regenerado del schema en ese momento. **Probablemente superado por el estado actual de Cloud**. Verificar antes de descartar.
- `stash@{1}` (`On codex/ux-lovable-sync: pre-lovable-sync-excluded-schema-temp`):
  - `CLAUDE.md` (+166 líneas), `bunfig.toml` (+2)
  - 5 contratos: `2026-04-27-aims-grc-data-contract.md`, `2026-04-27-cross-module-data-contract.md`, `2026-04-27-secretaria-data-contract.md`, `2026-05-02-grc-screen-posture-contract.md`, `2026-05-02-secretaria-document-generation-boundary.md`
  - 3 planes: `2026-04-19-task0-enterprise-hardening.md`, `2026-04-27-demo-operable-roadmap.md`, `2026-04-27-sanitization-master-plan.md`

**Acción propuesta:** inspeccionar `stash@{1}` para extraer los 5 contratos + 3 planes que no estén en main vigente. `stash@{0}` requiere verificación pero probablemente se descarta.

### 2.6 Ramas locales no resueltas (8 + 4 sub-worktrees)

Ramas locales:

- `codex/aims360` (HEAD actual, behind origin/main)
- `codex/ux-lovable-sync` (con remote tracking en `origin/codex/ux-lovable-sync`)
- `feat/canonical-identity-model-phase-0-1` (con remote)
- `fix/personas-g2` (con remote)
- `fix/sociedades-g1` (con remote)
- `sprint-i/gas-completeness`
- `claude/crazy-diffie-9bf775` (en sub-worktree)
- `worktree-agent-a1ead8b5`, `a475964d`, `aa19998d`, `af325be0` (4 sub-worktrees)

**Acción propuesta:** inspeccionar diff de cada rama vs origin/main. Si no hay nada único, borrar localmente. Las sub-worktrees `worktree-agent-*` deben resolverse con `git worktree remove`.

### 2.7 Working tree modificaciones (167 archivos)

Distribución:

| Directorio | Cuenta |
|---|---|
| `supabase/migrations/` (D, borradas) | 130 |
| `src/pages/` | 4 |
| `docs/superpowers/` | 3 |
| `src/hooks/` | 2 |
| `supabase/functions/_types/` | 1 |
| `src/{routes,modules,lib,context,components}/` | 5 |
| `src/App.tsx` | 1 |
| `scripts/` | 2 |
| Otros (`playwright.config.ts`, `package.json`, `eslint.config.js`, `e2e/*`) | 7 |

**Análisis:**

- Las **130 migraciones borradas en working tree** ya están aplicadas en Cloud (último HOLD: `000049_grc_evidence_legal_hold` según CLAUDE.md). La supresión local no fue commiteada. Riesgo: bajo. Pero confirma que el worktree legacy es operativamente inseguro.
- Los **37 archivos `M`** (modificaciones, no borrados) requieren comparación uno a uno con main vigente. Probablemente la mayoría son iteraciones viejas ya superadas.

## 3. Riesgo activo del worktree legacy

- Cualquier `bun run db:check-target`, seed o migración ejecutada **dentro** del worktree legacy podría tocar Supabase Cloud usando `.env` desactualizados.
- El worktree tiene su propio `.claude/`, `.claude-flow/`, `.swarm/`, `.mcp.json` y `package.json` modificado: configuración divergente del principal.
- 4 sub-worktrees `worktree-agent-*` con `+` indican trabajo experimental no resuelto y susceptible de colisionar.

**Mitigación inmediata:** la regla de CLAUDE.md "no trabajar ahí" debe tratarse como absoluta hasta cerrar el triage.

## 4. Plan de triage propuesto (por aprobar)

| Fase | Acción | Riesgo | Reversible |
|---|---|---|---|
| 1 | **Backup defensivo**: `tar czf ~/Dropbox/backups/arga-aims360-20260506.tgz` del worktree completo antes de tocar nada | 0 | sí |
| 2 | **Schema-registry**: leer los 22 archivos, decidir cuáles aportan, copiar al main vigente y commit `docs(schema-registry): import legacy AIMS/GRC analysis from aims360 worktree` | bajo | sí |
| 3 | **Planes superpowers**: portar `2026-04-30-prd-diligent-gap-closure-12m.md` y `2026-05-02-plan-refactorizacion-datos-schema-12m.md` si aportan; descartar el SUPERSEDED | bajo | sí |
| 4 | **E2E specs**: para cada uno, decidir mantener (renumerar a `40-*`, `41-*`, etc.) o descartar | bajo | sí |
| 5 | **Material no-código**: mover 4 PDFs/PPTX EAD Trust a `Dropbox/DESARROLLO/assets/` fuera del repo | 0 | sí |
| 6 | **Stash@{1}**: inspeccionar y extraer contratos + planes no presentes en main | medio | sí (con backup) |
| 7 | **Stash@{0}**: verificar y dropear (database.ts ya superado) | medio | sí (con backup) |
| 8 | **Ramas locales**: borrar las 6 ramas que no aporten commits únicos | medio | sí (recuperables vía reflog mientras no se haga `gc`) |
| 9 | **Sub-worktrees `worktree-agent-*`**: inspeccionar; `git worktree remove` los vacíos | medio | sí |
| 10 | **Archivar el worktree**: renombrar a `arga-governance-map-aims360-archived-20260506`, mantener en disco como histórico | 0 | sí |
| 11 | **Documentar**: crear `docs/superpowers/plans/2026-05-06-legacy-worktree-triage-resultado.md` con qué se portó, qué se descartó, decisiones | 0 | — |

## 5. Lo que NO se hace en este plan

- Borrar el worktree (mantener archivado tras backup).
- Ejecutar comandos Supabase desde dentro del worktree legacy.
- Mergear branches en main vigente.
- Decidir destino de las 4 sub-worktrees `worktree-agent-*` antes de inspeccionarlas.

## 6. Política derivada

Reforzar en `CLAUDE.md` y `AGENTS.md`:

- Worktree único operativo desde 2026-05-03 — **regla ya escrita pero incumplida en el pasado**.
- Considerar añadir un hook de shell que avise si se hace `git status` o `bun run` dentro de cualquier ruta `arga-governance-map-*` distinta del principal.

## 7. Verificación

```md
Outcome:
- Worktree legacy tocado: NO. Solo lectura.
- Backup creado: NO (Fase 1 requiere autorización).
- Material extraído: NADA.
- Inventario completo: SÍ.
- Plan documentado: SÍ.
- Decisión pendiente: aprobar Fase 1 (backup) para empezar el triage.
```
