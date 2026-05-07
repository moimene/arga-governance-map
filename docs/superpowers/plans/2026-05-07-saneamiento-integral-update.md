# Saneamiento integral — Update tras carril ARGA golden path

Fecha: 2026-05-07
Worktree operativo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
Rama: `main`
Modo: lectura. Este documento actualiza el backlog priorizado tras el cierre del carril ARGA Seguros golden path.

## Contexto

Documento referencia: `docs/superpowers/plans/2026-05-06-saneamiento-integral-inventario.md` (inventario base).

Entre 2026-05-06 (cierre del inventario) y 2026-05-07 se ejecutó el carril Secretaría golden path ARGA con 4 commits que **absorbieron todo el WIP no commiteado** que el inventario marcaba como INC-09:

| Commit | Alcance |
|---|---|
| `95f89d7 fix(secretaria): consolidate advanced golden path` | Body labels, meeting census, capa3 enriched, agenda precedence, hooks tenant-aware |
| `ec4e96e fix(secretaria): harden arga sociedad ficha` | Endurecimiento ficha societaria ARGA, eliminación pestaña Clases independiente, cap table operativo |
| `0340d4b fix(grc): preserve scope and document repo triage` | Scope GRC + documentación triage (sin tocar worktree legacy) |
| `7bd1b05 docs(secretaria): record golden path lane memory` | Memoria del carril (4 docs nuevos en `docs/superpowers/plans/`) |

Working tree limpio (`git status` 0/0), main sincronizada con `origin/main` (`git rev-list 0 0`).

Documentos de cierre del carril:

- `docs/superpowers/plans/2026-05-07-secretaria-carril-memoria-avances.md`
- `docs/superpowers/plans/2026-05-06-arga-seguros-golden-path-consolidation.md`
- `docs/superpowers/plans/2026-05-06-secretaria-global-safe-repair-closeout.md`
- `docs/superpowers/plans/2026-05-06-secretaria-gestor-reglas-acuerdo360-plan.md`

## Estado verificado 2026-05-07

| Comando | Resultado |
|---|---|
| `git status` | 0/0 — limpio |
| `git rev-list --left-right --count origin/main...HEAD` | `0 0` |
| `bunx tsc --noEmit --pretty false` | pass |
| `bun run lint` | pass |
| `bun test` | **862 pass / 66 skip / 0 fail** (antes 856; +6 tests del carril) |
| Readiness ARGA Seguros S.A. | **Completa, 0 bloqueos, 0 warnings** |
| Vercel preview | https://arga-governance-qg7m7hd6i-moises-menendezs-projects.vercel.app — READY |

## Re-evaluación del backlog

Verificación uno a uno de cada `INC-*` del inventario base:

| ID | Estado | Evidencia |
|---|---|---|
| INC-01 — AGENTS.md MAPFRE | **Sigue P0 vigente** | `grep MAPFRE AGENTS.md` → 6+ ocurrencias en líneas 27, 29, 31, 32, 69, 72, 83, 84, 638, 639. Línea 89 sigue con `entity_id 0...010` legacy |
| INC-02 — `docs/BORRADORES INTERMEDIOS/` | Sigue P1 | Sin tocar |
| INC-03 — `/grc-old` orphan route | **Sigue P0** | `App.tsx:153` sigue apuntando a `pages/modules/GrcDashboard.tsx` |
| INC-04 — Tile `/dashboards` link roto | Sigue P0 (subordinado a INC-03) | El archivo sigue como antes |
| INC-05 — `/aims` stub vs `/ai-governance/*` | **Sigue P0** | `App.tsx:154` sigue apuntando a `pages/modules/AimsDashboard.tsx` |
| INC-06 — 7 archivos sin `useTenantContext` | **Sigue P1** | Verificado por grep: 0 ocurrencias en los 7 archivos |
| INC-07 — AIMS Evaluaciones RLS 42501 | Sigue P1 documentado | Sin tocar |
| INC-08 — Módulos `/grc/m/*` con secciones placeholder | Sigue P1 | Sin tocar |
| INC-09 — WIP no commiteado | **RESUELTO ✅** | Absorbido por commits `95f89d7`, `ec4e96e`, `0340d4b`, `7bd1b05` |
| INC-10 — Status labels GRC duplicados | Sigue P2 | Sin tocar |
| INC-11 — `RequireAuth` import duplicado | Sigue P2 | Sin tocar |
| INC-12 — Worktree legacy `aims360` | **Sigue P0** | Sin tocar; el commit `0340d4b` documenta triage del repo principal, NO toca el worktree legacy |

## Avances que el carril aportó (no estaban como ítems del inventario)

Estos avances cierran necesidades funcionales reales, no figuran como "INC-*" porque eran capacidad operativa nueva, no incoherencia preexistente.

1. **ARGA Seguros readiness `Completa` 0/0** verificado por probe `secretaria-repair-demo-entity-coherence.ts --json`.
2. **Filtro `operational-bodies.ts`** — scope correcto de órganos en flujos de Secretaría.
3. **Ficha societaria endurecida** — pestaña `Clases` integrada en `Capital`, capital desembolsado coherente, autoridad separada de miembros, marco normativo diferenciado de motor de reglas.
4. **2 nuevos E2E tests**: `e2e/33-secretaria-entity-scope.spec.ts`, `e2e/34-secretaria-sociedad-ficha.spec.ts`.
5. **Vercel preview deploy** funcionando con bundle actualizado.
6. **Plan futuro Gestor de Reglas Acuerdo360** — read-only, sin migraciones, separa validez societaria / cumplimiento contractual / hold operativo.

## Nuevos elementos del backlog (incorporados desde el cierre del carril)

| ID nuevo | Tipo | Descripción | Riesgo |
|---|---|---|---|
| INC-13 | P0 funcional | Promover preview Vercel a producción cuando se confirme que el preview es el estado a exponer como URL principal | P0 |
| INC-14 | P0 funcional | Implementar Gestor de Reglas Acuerdo360 (plan ya documentado) — Legal necesita ver regla efectiva por materia | P0 |
| INC-15 | P1 datos | 22 sociedades demo restantes con readiness mixto: `3 Completa, 6 Parcial, 12 Rota, 11 No usable`. Cierre sociedad por sociedad con plan/apply idempotente | P1 |
| INC-16 | P1 datos | Estatutos/reglamentos siguen proyectados por overrides/perfil normativo; no existe repositorio estructurado versionado | P1 |
| INC-17 | P2 producto | Reducir dependencia de preview/manual deploy; documentar ruta exacta de despliegue prod cuando entorno objetivo quede fijado | P2 |

## Backlog re-priorizado 2026-05-07

### P0 demo bloqueante

1. **INC-12** Triage del worktree legacy `arga-governance-map-aims360`. Plan en `2026-05-06-legacy-worktree-aims360-inventario.md`.
2. **INC-14** Implementar Gestor de Reglas Acuerdo360 (read-only). Plan en `2026-05-06-secretaria-gestor-reglas-acuerdo360-plan.md`.
3. **INC-13** Promoción Vercel preview → producción cuando esté el go.
4. **INC-03** Eliminar `/grc-old` y `src/pages/modules/GrcDashboard.tsx` o redirigir a `/grc`.
5. **INC-04** Quitar tile `/dashboards` (irrelevante si INC-03 elimina el archivo entero).
6. **INC-05** Decidir destino de `/aims` (redirigir a `/ai-governance` o eliminar stub).
7. **INC-01** Sanitizar `AGENTS.md` (6+ menciones MAPFRE + entity_id desalineado).

### P1 consolidación funcional

8. **INC-06** Auditar y migrar 7 archivos Secretaría a `useTenantContext()`.
9. **INC-15** Saneamiento sociedad por sociedad de las 22 sociedades demo restantes (no-destructivo).
10. **INC-16** Decidir schema de estatutos/reglamentos versionados o mantener proyección por overrides.
11. **INC-08** Inventario de secciones modulares vacías en `/grc/m/*` y plegar las no operativas.
12. **INC-02** Mover `docs/BORRADORES INTERMEDIOS/` fuera del repo.

### P2 limpieza técnica / observabilidad

13. **INC-10** Centralizar `status-labels` y `severity-chip` GRC.
14. **INC-11** Consolidar import duplicado `RequireAuth` en `App.tsx`.
15. **INC-17** Documentar ruta de despliegue prod.
16. **INC-07** Decidir si el gap de Evaluaciones AIMS por RLS se cierra con schema patch o se mantiene como deuda documentada.

## Lecciones del carril (válidas para futuros)

Del cierre `2026-05-07-secretaria-carril-memoria-avances.md`:

1. No reabrir saneamiento global destructivo. Sociedad por sociedad con plan/apply idempotente.
2. ARGA Seguros S.A. es el golden path, mantener readiness 0/0 ante cualquier cambio.
3. Ficha societaria muestra datos de negocio, no códigos internos salvo en contexto técnico.
4. Administradores de SA con Consejo = miembros vigentes del Consejo, no tabla de no colegiados.
5. Acuerdo360 NO es el motor de reglas: es expediente/snapshot. La regla efectiva vive en rule packs, overrides, pactos, marco normativo.
6. Si la UI online no refleja cambios locales verificados, comprobar bundle/despliegue/cache antes de reabrir datos.

## Crítica adversarial pendiente (si se relanza Codex)

Las advertencias de la auto-crítica de 2026-05-06 quedan parcialmente desactivadas pero no canceladas:

- **Asunción "0 commits únicos"** en worktree legacy: sigue verificada solo para 1 de 8 ramas. Verificar `git log origin/main..<branch>` para las 7 restantes antes de archivar.
- **`.env` no neutralizado** en worktree legacy: regla "no ejecutar" sigue dependiendo de disciplina humana. Mitigación técnica pendiente (ej. `mv .env .env.archived`).
- **Stash drop sin patch export**: pendiente al activar Fase 7 del plan triage.

## Decisión pendiente del usuario

¿Cuál es el siguiente carril?

A. **Triage worktree legacy (INC-12)** — saca el riesgo de comandos accidentales y libera 4 MB de material. 3 fases mínimas viables: backup → archive → neutralizar `.env`.
B. **Gestor de Reglas Acuerdo360 (INC-14)** — el carril Secretaría más estratégico para Legal.
C. **Promoción Vercel a prod (INC-13)** — corto, pero requiere decisión externa.
D. **Sanitización rápida de orphan routes + AGENTS.md (INC-03/04/05/01)** — quirúrgico, ~30 min, libera 4 P0 documentales/UI.
E. **Saneamiento sociedad por sociedad (INC-15)** — largo, requiere decisiones funcionales por sociedad.

## Verificación

```md
Documentation and memory:
- Project docs updated: este addendum + actualización repo_state_2026_05_06.md → repo_state_2026_05_07.md
- Memory keys actualizadas: project_status, repo_state_2026_05_07
- Stable lesson recorded: saneamiento global destructivo prohibido; sociedad-por-sociedad con plan/apply
- No secrets stored: yes

Data contract:
- Tables used: ninguna mutación en este addendum
- Source of truth: governance_OS Cloud, tenant 00000000-...-001
- Migration required: no
- Cross-module contracts: handoffs read-only confirmados
- Parity risk: bajo

Testing:
- Typecheck: pass
- Lint: pass
- Build: pass (verificado por carril)
- Unit tests: 862 pass / 66 skip / 0 fail
- E2E ARGA scope: pass (carril)
- E2E ficha societaria: pass (carril)
- Vercel preview: READY

Outcome:
- INCs cerrados: INC-09
- INCs nuevos: INC-13, INC-14, INC-15, INC-16, INC-17
- INCs vigentes: INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08, INC-10, INC-11, INC-12
- Worktree limpio: yes
- Recommended next carril: pendiente decisión usuario (A/B/C/D/E)
```
