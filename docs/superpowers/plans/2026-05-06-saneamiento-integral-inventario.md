# Saneamiento integral — Inventario y backlog (carril read-only)

Fecha: 2026-05-06
Worktree operativo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
Rama: `main`
Modo: lectura. No se han aplicado fixes en código.

## Objetivo

Convertir el estado actual del prototipo en un inventario verificable: trabajo en curso, incoherencias documentales, gaps funcionales y un backlog priorizado para consolidar el demo. No mutar Cloud, no tocar schema, no commitear sin autorización.

## 1. Estado verificado del repo (Fase 0)

| Comando | Resultado |
|---|---|
| `git status --short` | 33 archivos modificados, 5 nuevos sin commit |
| `git rev-list --left-right --count origin/main...HEAD` | `0 0` — alineado con `origin/main` |
| `bun run db:check-target` | OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`) |
| `bunx tsc --noEmit --pretty false` | OK |
| `bun run lint` | OK (0 errors, warnings conocidos) |
| `bun run build` | OK (warning de chunk size conocido) |
| `bun test` | 856 pass, 66 skip, 0 fail |
| E2E `e2e/10-grc.spec.ts` | bloqueado por puerto 5201 en uso (dev server pre-existente). No ejecutado. |

**Último commit en `main`**: `e004009 feat(secretaria): seed societario demo completo` (2026-05-05).

## 2. Trabajo en curso no commiteado

33 archivos modificados + 5 nuevos, +999 / -193 líneas. Sin plan documentado en `docs/superpowers/plans/` posterior a 2026-05-05. Todo el trabajo gira en torno a un mismo tema: fiabilidad de censo, etiquetas de órganos, capa3 estructurada y precedencia de agenda en reuniones.

### 2.1 Archivos nuevos (todos con tests, todos pasan)

- `src/lib/secretaria/body-labels.ts` — normalización de etiquetas de órganos (JUNTA → "Junta General", CDA → "Consejo de Administración", etc.). Helper puro.
- `src/lib/secretaria/meeting-census.ts` — distingue censo JUNTA_GENERAL (vía `capital_holdings` filtrado por `is_treasury` y `voting_rights`) vs CONSEJO/COMISION (vía `condiciones_persona`). Helper puro.
- `src/lib/secretaria/__tests__/body-labels.test.ts`
- `src/lib/secretaria/__tests__/meeting-census.test.ts`
- `scripts/seed-nombramiento-consejero-rule-pack.ts`

### 2.2 Modificaciones agrupadas por tema

- **Hooks tenant-aware enriquecidos** (joins PostgREST con `persons.full_name`):
  - `useReunionSecretaria.ts` — añade `full_name?` a `MeetingAttendee` vía join con `person`.
  - `useActas.ts`, `useBoardPackData.ts`, `useGrcDashboard.ts`, `useIncidents.ts`, `useRisks.ts` — refinamientos similares.
- **Capa3 estructurada** (`src/lib/secretaria/capa3-fields.ts`, +84 líneas): deriva `orden_dia_texto`, `acuerdos_texto`, `miembros_presentes_texto` desde listas estructuradas para llenar plantillas DOCX sin huecos.
- **Precedencia de agenda corregida** (`src/lib/secretaria/meeting-agenda.ts`): ahora `source` (canónico) precede sobre `point` (texto libre); preserva `agreement_id`, `materia`, `tipo` de la fuente canónica.
- **ReunionStepper** (+148 líneas): integra `meeting-census`, añade `formatSavedQuorumPct` y `formatSavedQuorumDate`, label "Accionista".
- **ActaDetalle** (+125 líneas): firma QTSP + evidencia demo + link expediente.
- **GRC**: `Dashboard.tsx`, `GrcLayout.tsx`, `IncidenteStepper.tsx`, `IncidentesList.tsx`, `PenalAnticorrupcion.tsx`, `Risk360.tsx`, `RiskEditor.tsx`, `modules/cyber/Incidents.tsx`, `modules/dora/Incidents.tsx` — refinamientos de etiquetas, scoping y posture.
- **Engine**: `constitucion-engine.ts` (+66 líneas con tests).

### 2.3 Veredicto

Cambios coherentes, tests pasan, build limpio. Consolidables. Pero antes de aplicar fixes nuevos: identificar carril origen y commitear por familia para preservar bisectabilidad (regla activa de `2026-05-04-repo-sanitization-closeout.md`).

## 3. Inventario de incoherencias

| ID | Módulo | Tipo | Descripción | Evidencia | Riesgo |
|---|---|---|---|---|---|
| INC-01 | Docs | Documental | `AGENTS.md` líneas 27-32, 69, 72, 83, 89 mencionan explícitamente el cliente real; `CLAUDE.md` ya está sanitizado. Línea 89 usa `entity_id 0...010` cuando la canónica es `6d7ed736-...` | `AGENTS.md` | P0 |
| INC-02 | Docs | Documental | `docs/BORRADORES INTERMEDIOS/deep-research-report (18).md` y `(19).md` contienen 60+ referencias al cliente real en investigación bruta | `docs/BORRADORES INTERMEDIOS/` | P1 |
| INC-03 | Consola | Bug | `/grc-old` (`src/App.tsx:153`) renderiza `src/pages/modules/GrcDashboard.tsx`, que es un **grid de tiles TGMS mal nombrado**, NO el GRC dashboard real (`/grc` → `src/pages/grc/Dashboard.tsx`) | `App.tsx:153` + `pages/modules/GrcDashboard.tsx` | P0 |
| INC-04 | Consola | Bug | `src/pages/modules/GrcDashboard.tsx:34` enlaza a `/dashboards` — ruta NO registrada en `App.tsx` → link roto | `pages/modules/GrcDashboard.tsx:34` | P0 |
| INC-05 | Consola/AIMS | Bug | `/aims` (`App.tsx:154`) renderiza `pages/modules/AimsDashboard.tsx` — stub "Próximamente"; AIMS real está en `/ai-governance/*`. Doble identidad confunde al usuario | `App.tsx:154` + `pages/modules/AimsDashboard.tsx` | P0 |
| INC-06 | Secretaría | Deuda CLAUDE.md | 7 archivos usan queries Supabase pero NO usan `useTenantContext()` (regla activa: "ya NO usar `DEMO_TENANT` hardcodeado") | `ConvocatoriasStepper.tsx`, `ConvocatoriaDetalle.tsx`, `AcuerdoSinSesionStepper.tsx`, `ExpedienteSinSesionStepper.tsx`, `DecisionUnipersonalStepper.tsx`, `TramitadorLista.tsx`, `LibroSocios.tsx` | P1 |
| INC-07 | AIMS | Gap conocido | `/ai-governance/evaluaciones/nuevo` deshabilitado por RLS `42501` en `ai_risk_assessments` — UI read-only correcta pero workflow incompleto | `Evaluaciones.tsx` | P1 (documentado en CLAUDE.md) |
| INC-08 | GRC | Deuda | `/grc/m/{dora,cyber,gdpr,audit}/*` modular shell con secciones (`SOC.tsx`, `Vulnerabilities.tsx`, etc.) mostrando placeholders | `src/pages/grc/modules/*` | P1 |
| INC-09 | Repo | Trazabilidad | 33 archivos modificados + 5 nuevos sin commit, sin plan asociado posterior a 2026-05-05 | `git status` | P1 |
| INC-10 | GRC | Deuda técnica | Status values (`"Abierto"`, `"En tratamiento"`) hardcoded en `RiskEditor.tsx`, `IncidenteStepper.tsx` y `SEV_CHIP` duplicado en 3+ páginas | `pages/grc/RiskEditor.tsx`, `IncidenteStepper.tsx` | P2 |
| INC-11 | Consola | Deuda técnica | `RequireAuth` aparece importado dos veces en `App.tsx` (línea 12 y 41) | `App.tsx` | P2 |
| INC-12 | Worktree | Trazabilidad crítica | `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360` worktree legacy contiene 4 MB de material no portado: 22 docs/schema-registry, 3 planes, 5 e2e specs, 8 ramas locales, 4 sub-worktrees, 2 stashes. Detalle en `2026-05-06-legacy-worktree-aims360-inventario.md` | worktree legacy | P0 |

## 4. Backlog priorizado

### P0 demo bloqueante (5)

1. **INC-12** Triage del worktree legacy `arga-governance-map-aims360`. Antes de cualquier otro carril. Plan en `2026-05-06-legacy-worktree-aims360-inventario.md`.
2. **INC-03** Eliminar `/grc-old` (`App.tsx:153`) y `src/pages/modules/GrcDashboard.tsx` o redirigir a `/grc`.
3. **INC-04** Quitar tile `/dashboards` de `pages/modules/GrcDashboard.tsx:34` (irrelevante si se elimina el archivo entero — INC-03).
4. **INC-05** Decidir destino de `/aims` (`App.tsx:154`): redirigir a `/ai-governance` o eliminar el stub.
5. **INC-01** Sanitizar `AGENTS.md` (4 menciones al cliente real + entity_id desalineado).

### P1 consolidación funcional (4)

6. **INC-06** Auditar y migrar 7 archivos Secretaría a `useTenantContext()`.
7. **INC-09** Identificar carril origen del WIP no commiteado, dividir por familia y commitear con plan documentado.
8. **INC-08** Inventario de secciones modulares vacías en `/grc/m/*` y plegar las no operativas.
9. **INC-02** Mover `docs/BORRADORES INTERMEDIOS/` fuera del repo o `.gitignore` antes de cualquier publicación pública.

### P2 limpieza técnica (2)

10. **INC-10** Centralizar `status-labels` y `severity-chip` GRC.
11. **INC-11** Consolidar import duplicado `RequireAuth` en `App.tsx`.

### P3 documentación / observabilidad (1)

12. **INC-07** Decidir si el gap de Evaluaciones AIMS por RLS se cierra con schema patch o se mantiene como deuda documentada.

## 5. Estado de documentación raíz

| Doc | Estado | Acción |
|---|---|---|
| `CLAUDE.md` | Vigente, sanitizado | OK |
| `AGENTS.md` | **Obsoleto en parte** — menciones al cliente real + entity_id legacy | Sanitizar (P0) |
| `PRODUCT.md` | Sanitizado | OK |
| `DESIGN.md` | Sanitizado | OK |
| `docs/superpowers/plans/2026-05-05-secretaria-societario-demo-seed.md` | Vigente, último cierre formal | OK |
| `docs/superpowers/plans/2026-05-04-repo-sanitization-closeout.md` | Vigente | OK |
| Planes anteriores con referencias al cliente real en reglas explícitas | Vigentes si se usan solo como mapping interno; sanitizar antes de cualquier publicación | Revisar |
| `docs/BORRADORES INTERMEDIOS/deep-research-report (18-19).md` | Investigación bruta sobre cliente real | Sanitizar / mover (P1) |

## 6. Verificación

```md
Documentation and memory:
- Project docs updated: este plan + 2026-05-06-legacy-worktree-aims360-inventario.md
- Memory keys: legacy_worktree_aims360, repo_state_2026_05_06
- Stable lesson recorded: WIP no documentado en docs/superpowers/plans tras 2026-05-05 → política de carriles requiere log de plan obligatorio
- No secrets stored: yes

Data contract:
- Tables used: ninguna mutación; lectura indirecta vía hooks
- Source of truth: governance_OS Cloud, tenant 00000000-...-001
- Migration required: no
- Types affected: ninguno
- Cross-module contracts: handoffs read-only confirmados (AIMS→GRC, GRC/AIMS→Secretaría)
- Parity risk: bajo — solo deuda de UI/docs

Testing:
- Typecheck: pass
- Lint: pass (0 errors, warnings conocidos)
- Build: pass (warning de chunk size conocido)
- Unit tests: 856 pass, 66 skip, 0 fail
- E2E: bloqueado por puerto 5201 en uso (dev server pre-existente). Fallback: tests unitarios + build verdes
- Browser smoke: no ejecutado (puerto bloqueado)

Outcome:
- Bugs fixed: 0 (deliberadamente — WIP sin commit no debe entrelazarse con fixes nuevos)
- Gaps documented: 12 incoherencias inventariadas con archivo:línea
- Remaining P0: 5 (INC-01, INC-03, INC-04, INC-05, INC-12)
- Recommended next carril: triage del worktree legacy (INC-12) ANTES de cualquier otro fix
```

## 7. Recomendación

Dos opciones, ambas read-only en esta sesión:

**A. Conservadora (recomendada).** Cerrar este carril como inventario puro. Próximo carril: triage del worktree legacy (INC-12) siguiendo el plan en `2026-05-06-legacy-worktree-aims360-inventario.md`. Solo después abordar los P0 del repo principal (INC-01, INC-03, INC-04, INC-05) en commits atómicos.

**B. Híbrida.** Aplicar solo INC-04 (quitar tile `/dashboards`) y INC-01 (sanitizar `AGENTS.md`) en commits aislados que no tocan archivos del WIP. Diferir INC-03, INC-05 e INC-12 a carriles dedicados.

Decisión del usuario pendiente.
