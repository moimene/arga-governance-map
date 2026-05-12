# Handoff — Personas y Cargos Completitud (post-Sprint 1)

**Propósito:** prompt self-contained + estado de cierre del Sprint 1 para retomar la
feature Personas y Cargos hacia 100% integrity production-ready en una conversación
fresca (nuevo agente, sin contexto previo, sin acceso a memoria Ruflo de la sesión
anterior).

**Estado al momento de escribir este doc:** Sprint 1 PR #5 abierto, Codex review
aprobado tácitamente, pendiente merge a `main` por decisión del usuario.

---

## 1. Estado actual (post-Sprint 1)

### PR #5 — `feature/personas-cargos-refactor`

- URL: <https://github.com/moimene/arga-governance-map/pull/5>
- HEAD: `ae31087`
- ~55 commits ahead de `main`
- **Mergeable:** `MERGEABLE`, `OPEN`
- **Codex verdict:** aprobado vía comment 2026-05-12 13:24:22 — `"Didn't find any major issues"`
- **Reviews:** 7 reviews Codex formales (state COMMENTED) + 1 issue comment de aprobación
- Status: pendiente merge a `main` con `gh pr merge 5 --merge` (no-ff preserve agent attribution per CLAUDE.md)

### Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`) ya aplicado en Wave 6

- Migración `20260513_000063_persons_tax_id_unique.sql` — UNIQUE parcial (tenant_id, tax_id)
- Migración `20260513_000064_authority_evidence_trigger_rm_fields.sql` — trigger reescrito (propaga inscripcion_rm_referencia + VICESECRETARIO + excluye CONSEJERO_COORDINADOR) + backfill correctivo
- Migración `20260513_000065_condiciones_persona_vicesecretario.sql` — CHECK ampliado + chk_condicion_body_coherente actualizado
- Datos: PRUEBA 1 renombrada a `E2E-B88888888-PRUEBA-1` para liberar conflict B88888888
- Datos: UPDATE de inscripcion_rm_referencia en PRESIDENTE + SECRETARIO del CdA de ARGA Seguros (`RM-DEMO-ARGA-CDA-2026`) — propagado a authority_evidence vía trigger

### Stats Sprint 1

| Métrica | Valor |
|---|---|
| Waves adversariales Ruflo (W1-W7) | 7 |
| Iteraciones Codex review tras open PR | 7 |
| Findings adversariales totales | 32 (20 Ruflo + 12 Codex) |
| Commits feature branch | ~55 |
| typecheck / lint / build | green |
| Tests | 59 pass / 0 fail / 140 skip |
| Bugs HIGH bloqueantes para demo Garrigues | 0 |

---

## 2. Documentación previa obligatoria para el nuevo agente

LEER en este orden antes de tocar nada:

1. `CLAUDE.md` raíz — guardrails operativos, design system Garrigues, reglas UX no negociables, tokens válidos `--g-*` y `--status-*`.
2. `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md` — spec original (incluye §2 con 23 decisiones legales L1-L23 firmadas por Garrigues, inmutables).
3. `docs/superpowers/plans/2026-05-12-personas-cargos-refactor-implementation.md` — plan original (3367 líneas, 26 archivos).
4. `docs/superpowers/plans/2026-05-12-personas-cargos-w6-cloud-apply-log.md` — log de aplicación a Cloud (qué se aplicó, qué se modificó, post-probes).
5. `docs/superpowers/reviews/2026-05-12-wave[1-5]-adversarial-*.md` — 7 reviews adversariales con findings y decisiones técnicas.
6. Skill obligatoria: `/Users/moisesmenendez/Dropbox/Codigo/agent/skills/desarrollar-ux-garrigues/SKILL.md` — tokens UX no negociables.

---

## 3. Decisiones inmutables (no renegociables)

### Decisiones legales L1-L23 (firmadas Garrigues 2026-05-12)

Listadas en spec original §2. Resumen crítico:

- **L1** — PJ socio NO requiere representante PF permanente (LSC art. 184).
- **L2** — PJ administradora SÍ requiere representante PF permanente (LSC art. 212bis, RRM art. 143).
- **L3** — Alta PJ con cargo admin sin rep: aceptable como demo con warning. Bloqueo duro en emisión certificación, no en alta.
- **L4** — PRESIDENTE CdA: cardinalidad 1 (LSC 529 sexies).
- **L5** — VICEPRESIDENTE: sin límite legal, parametrizable.
- **L6** — SECRETARIO CdA: cardinalidad 1 (RRM 109).
- **L7** — VICESECRETARIO: 1 en práctica habitual, no prohibición legal.
- **L8** — CONSEJERO_COORDINADOR: 1 en cotizadas (LSC 529 septies).
- **L9** — ADMIN_UNICO: 1 por definición.
- **L10** — ADMIN_SOLIDARIO: mínimo 2 (LSC 210).
- **L11** — ADMIN_MANCOMUNADO: mínimo 2 (LSC 210).
- **L12** — Enforce cardinalidad BD NO obligatorio para demo. Validación humana + warning suficiente. (Re-evaluar en este sprint completitud.)
- **L13** — Vacancia presidencial legal hasta 90 días.
- **L14** — Cese + nombramiento sucesor NO transaccionales atómicos (actos separados aceptables).
- **L15** — Presidentes de comisiones NO certifican societariamente.
- **L16** — Pestaña Autoridad: Secretario+Vicesecretario (CERTIFICANTE) vs Presidente+Vicepresidente (VºBº). Roles distinguibles (RRM 109).
- **L17** — VICESECRETARIO es cargo inscribible y certifica en suplencia (RRM 109, 124 + LSC 529 octies).
- **L18** — COMISIONADO NO es cargo societario inscribible. DESCARTADO.
- **L19** — NIF/CIF único por tenant. UNIQUE constraint obligatorio.
- **L20** — Cambio CIF por transformación/fusión: caso edge.
- **L21** — Inscripción RM declarativa para validez interna; constitutiva a efectos de certificación a terceros.
- **L22** — Distinción VIGENTE_INSCRITO vs VIGENTE_NO_INSCRITO: cargo válido sin inscripción pero NO puede certificar.
- **L23** — Referencia RM obligatoria en authority_evidence para considerar cargo certificante.

**Regla operativa:** si un agente sugiere algo que contradice L1-L23, defender con cita legal y NO cambiar.

### Decisiones arquitecturales (Sprint 1)

- Modelo canónico: tabla `condiciones_persona` con 11 valores `tipo_condicion` (chk_condiciones_persona_tipo_condicion + chk_condicion_body_coherente).
- `authority_evidence` propagada vía trigger `fn_sync_authority_evidence` (7 cargos certificantes — sin CONSEJERO_COORDINADOR).
- Dual-write transitorio `persons.representative_person_id` + `representaciones` scope `ADMIN_PJ_REPRESENTANTE`. Deprecar en este sprint completitud (Bloque 1 item 6).
- WORM tables (`no_session_*`, `capital_movements`) NO se rescriben en consolidación — soft-archive del duplicado preserva FK histórica.
- Garrigues UX tokens estrictos: `--g-*` y `--status-*` exclusivos. **Prohibidos:** Tailwind nativos (`text-gray-N`, `bg-amber-N`, etc.), hex literales, `--g-status-*` (incorrecto), `--g-brand` (correcto: `--g-brand-3308`), `--g-surface-secondary` (correcto: `--g-surface-subtle`).

---

## 4. Prompt para conversación fresca

Pegar el bloque siguiente literalmente en un chat nuevo (Claude, Codex, o humano):

```
# Prompt: Completar la gestión íntegra de Personas y Cargos (TGMS / ARGA Seguros)

## Contexto del proyecto

Repo: `moimene/arga-governance-map` (GitHub).
Worktree canónico: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` rama `main`.

El proyecto es **TGMS Platform** — plataforma de gobernanza corporativa para grupos
aseguradores. Cliente demo/prototipo: **Grupo ARGA Seguros** (pseudónimo). NUNCA usar
el nombre real del cliente en código, datos, commits ni docs.

Supabase Cloud: `governance_OS` (project_id `hzqwefkwsxopwrmtksbg`, eu-central-1).
Auth demo: `demo@arga-seguros.com` / `TGMSdemo2026!`.
Tenant: `00000000-0000-0000-0000-000000000001`.
Entidad canónica ARGA Seguros: `6d7ed736-f263-4531-a59d-c6ca0cd41602`.

LEER PRIMERO sin excepción:
- `CLAUDE.md` (raíz del repo) — guardrails operativos + design system Garrigues + reglas UX
- `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md` — spec original sprint 1 (incluye 23 decisiones legales L1-L23 firmadas por Garrigues)
- `docs/superpowers/plans/2026-05-12-personas-cargos-refactor-implementation.md` — plan original 7 waves
- `docs/superpowers/plans/2026-05-12-personas-cargos-w6-cloud-apply-log.md` — log de aplicación a Cloud (migraciones + UPDATE RM CdA)
- `docs/superpowers/plans/2026-05-12-personas-cargos-completitud-handoff.md` — ESTE DOC (handoff)
- `docs/superpowers/reviews/2026-05-12-wave[1-5]-adversarial-*.md` — 7 reviews adversariales con findings y decisiones técnicas
- Skill obligatoria: `/Users/moisesmenendez/Dropbox/Codigo/agent/skills/desarrollar-ux-garrigues/SKILL.md` (tokens UX no negociables)

## Goal del nuevo sprint

Cerrar la gestión de personas y cargos al 100% integrity production-ready. El sprint
anterior (PR #5 — feature/personas-cargos-refactor, ~55 commits, 32 findings
adversariales procesados, Codex APROBADO) cubre el happy path para demo Garrigues
19-23 mayo 2026. ESTE nuevo sprint cubre todo lo que un cliente firmando contrato
real va a necesitar.

## Estado actual (post-Sprint 1)

Cubierto:
- 3 migraciones aplicadas a Cloud: UNIQUE tax_id + trigger RM + VICESECRETARIO en CHECK
- 11 huecos de PRESIDENTE+SECRETARIO sin authority_evidence cerrados via backfill
- Script `consolidate-duplicate-persons.ts` con 47 FK coverage + WORM skip + preflight 6 checks + Type A/B + fresh preflight per merge
- Hooks completos: useAsignarCargo, useCesarCargo, useUpsertRepresentanteAdminPJ, useRepresentantesAdminPJByPerson, useCondicionesPersonaMutations, useAuthorityEvidence (con VICESECRETARIO, sin CONSEJERO_COORDINADOR)
- Helpers UI: cargo-validation.ts (requiresBodyId, requiresRepresentative, isAuthorityRole, isAuthorityRoleInscribable), persona-filters.ts (isProductionPerson + excludeTestData)
- UI: PersonaDetalle (separación vigentes/histórico + modal cese + banner PJ + botones), PersonasList (acción asignar cargo por fila), DesignarAdminStepper (acepta personId + paso Sociedad + isAuthorityRole single source + dual persistence + entity scope fallback + cap subido a 2000 + preselected byId lookup), RepresentanteAdminPJStepper (wizard 3 pasos), PersonaNuevaStepper (bloqueo NIF dup), EmitirCertificacionButton (doble verif RM + role passthrough VICESECRETARIO)
- E2E spec en `e2e/44-personas-cargos-flow.spec.ts`

NO cubierto (este sprint):
- Atomicidad real (RPCs)
- Singleton enforce automático
- Edición persona post-alta
- Representaciones secundarias (JUNTA_PROXY, CONSEJO_DELEGACION)
- Sucesión jurídica (transformación/fusión)
- UX cliente: searchable selectors, paginación, importación bulk, notificaciones
- Limpieza datos demo (duplicados semánticos PF + entidades ARGA Seguros A-00001001 vs A-99999903)
- Features deseables: sync RM real, conflictos cross-sociedad, workflow aprobación, reportes regulatorios

## Scope del sprint completitud — 4 bloques priorizados

### Bloque 1 — Plan A' core: production-grade integrity (3 semanas, CRÍTICO)

1. **RPC `fn_designar_cargo`** SECURITY DEFINER transaccional: cese previo + alta nueva atómica. Reemplaza el try/catch del frontend.
2. **RPC `fn_consolidate_person`** SECURITY DEFINER: consolidación duplicados atómica. Reemplaza script con try/catch + revert.
3. **Singleton enforce automático**: partial UNIQUE index `(entity_id, body_id, tipo_condicion) WHERE estado='VIGENTE'` para cargos singleton (PRESIDENTE, SECRETARIO, VICESECRETARIO, CONSEJERO_COORDINADOR, ADMIN_UNICO).
4. **Validación cardinalidad**: ADMIN_SOLIDARIO ≥2, ADMIN_MANCOMUNADO ≥2 enforced (BD o UI dura).
5. **Vacancia presidencial timer 90d** con alertas.
6. **Deprecar dual-write** `persons.representative_person_id` → migrar UI a leer solo `representaciones`, eventualmente DROP de la columna.
7. **Sucesión jurídica**: relación predecesor/sucesor para transformación SL→SA, fusión por absorción, escisión. RDL 5/2023 art. 3.

### Bloque 2 — UX cliente production-ready (2-3 semanas)

8. **Edición persona post-alta** (`useUpdatePersona` + UI editable en PersonaDetalle).
9. **Searchable selector PF** con server-side search (no cap, búsqueda por nombre/NIF).
10. **Listado personas con paginación / virtualización** (TanStack Virtual o similar).
11. **Chips visuales Inscrito/Pendiente** en pestaña Autoridad (badge `--status-success` / `--status-warning`).
12. **Importación masiva CSV/Excel** de personas + cargos (validación + dry-run + apply).
13. **Histórico de representantes PJ** con timeline.
14. **Notificaciones automáticas**: vacancia próxima 90d, mandato próximo a expirar, cargo sin RM ref.
15. **Calendar integration**: mandatos con fecha_fin → recordatorios.

### Bloque 3 — Representaciones secundarias LSC (1 semana)

16. **UI JUNTA_PROXY** — delegación voto socio por reunión específica. LSC arts. 184-187.
17. **UI CONSEJO_DELEGACION** — delegación voto consejero por sesión. LSC arts. 248-249.
Ambas tablas ya existen en `representaciones` con scope correspondiente, falta UI de gestión.

### Bloque 4 — Higiene de datos demo (2-3 días, antes de Bloque 1)

18. **Consolidación "ARGA Seguros S.A." (A-00001001) ↔ "ARGA Seguros, S.A." (A-99999903)**: investigación + decisión legal + ejecución via `--pair` explícito del script Wave 2.
19. **Consolidación duplicados PF semánticos** ("Antonio Ríos" 12345679B vs "D. Antonio Ríos Valverde" NIF-DEMO-01-89B557 y similares).
20. **Filiales con `PENDIENTE-*`**: ARGA Brasil/México/Portugal/etc. — decisión NIFs reales vs archivado.
21. **Resolver `DemoBackupSecretaria.tsx`** untracked (errors typecheck heredados de otro WIP).

### Bloque 5 — Features deseables (sprint dedicado post-piloto)

22. Sync RM real (API FENADISMER / Colegio Registradores).
23. Conflictos de interés cross-sociedad (persona en CdA de 2 competidoras).
24. Workflow dual-approval para cargos críticos.
25. Roles de acceso granulares por entidad.
26. Reportes regulatorios automatizados (CNMV, IBEX).
27. Refactor estético DesignarAdminStepper.
28. Columna física `VIGENTE_INSCRITO` vs `VIGENTE_NO_INSCRITO` en authority_evidence.

## Decisiones INMUTABLES (no renegociar)

Decisiones legales L1-L23 ya firmadas por equipo legal Garrigues. Listadas en
`docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md` §2.
Resumen crítico:
- L1: PJ socio NO requiere representante PF permanente (art. 184 LSC).
- L2: PJ administradora SÍ requiere representante PF permanente (art. 212bis LSC).
- L15-L16: CONSEJERO_COORDINADOR NO certifica societariamente. Reserva al Secretario + VºBº Presidente (RRM art. 109).
- L17: VICESECRETARIO certifica en suplencia. Cargo inscribible (RRM 109, 124 + LSC 529 octies).
- L18: COMISIONADO NO es cargo societario inscribible. DESCARTADO.
- L19: NIF/CIF único por tenant.
- L23: Referencia RM obligatoria en authority_evidence para certificar.

Si Codex review o un agente sugiere algo que contradice L1-L23, defender con cita legal y NO cambiar.

Decisiones arquitecturales inmutables del sprint 1:
- Modelo canónico: `condiciones_persona` (8 cargos válidos + chk_condicion_body_coherente).
- `authority_evidence` propagada via trigger `fn_sync_authority_evidence` (7 cargos certificantes, NO incluye CONSEJERO_COORDINADOR).
- Dual-write transitorio `persons.representative_person_id` + `representaciones` — DEPRECAR en Bloque 1 item 6.
- WORM tables (`no_session_*`, `capital_movements`) NO se rescriben en consolidación — soft-archive del duplicado preserva FK histórica.
- Garrigues UX tokens (`--g-*`, `--status-*`) ZERO TOLERANCE — cero Tailwind nativos, cero hex literales, cero `--g-status-*` / `--g-brand` / `--g-surface-secondary` (estos 3 son incorrectos — usar `--status-*`, `--g-brand-3308`, `--g-surface-subtle`).

## Workflow recomendado

1. **Brainstorming + Spec** (1-2 días): leer toda la documentación previa + memoria Ruflo `personas-cargos` si está disponible, dialogar con stakeholder para confirmar prioridades, escribir nuevo spec `docs/superpowers/specs/2026-05-XX-personas-cargos-completitud-design.md` con respaldo legal Garrigues por cada decisión nueva. Validar con equipo legal antes de pasar a plan.
2. **Plan implementable** (1 día): writing-plans skill o equivalente. Plan day-by-day con TDD, commits incrementales, criterios de aceptación.
3. **Ejecución con adversarial review** (opcional pero recomendado): swarm Ruflo (`mcp__ruflo__swarm_init` topology hierarchical-mesh) con builder + reviewer paralelos por wave. O ejecución sequential con Codex review post-PR para findings adicionales.
4. **Aplicación a Cloud**: SIEMPRE con confirmación explícita del usuario antes de cada `apply_migration` o consolidación. Preview branch Supabase recomendado para schema cambios.
5. **Demo readiness verification**: script `scripts/demo-readiness-personas-cargos.ts` (extender con los criterios nuevos de cada bloque).

## Artefactos reutilizables (NO recrear)

Hooks: `useAsignarCargo`, `useCesarCargo`, `useUpsertRepresentanteAdminPJ`, `useRepresentanteAdminPJ`, `useRepresentantesAdminPJByPerson`, `usePersonaCanonical`, `usePersonasCanonical`, `usePersonasEnriquecidas`, `useAuthorityEvidence`, `useAuthorityEvidenceFor`, `usePresidenteVigente`, `useCargosPersona`, `useAdministradores`, `useAdministradoresSocietarios`, `useComposicionOrgano`.

Helpers UI: `src/lib/secretaria/cargo-validation.ts` (NO confundir con `src/lib/rules-engine/*` que es motor LSC), `src/lib/secretaria/persona-filters.ts`.

Scripts: `scripts/consolidate-duplicate-persons.ts` (47 FK + WORM skip + Type A/B + stale preflight guard).

UI: `PersonaDetalle.tsx`, `PersonasList.tsx`, `DesignarAdminStepper.tsx`, `PersonaNuevaStepper.tsx`, `RepresentanteAdminPJStepper.tsx`, `EmitirCertificacionButton.tsx`.

Tests: `e2e/44-personas-cargos-flow.spec.ts`, `src/test/secretaria/cargo-validation.test.ts`, `src/test/secretaria/persona-filters.test.ts`, `src/test/schema/*` (canonical-model, authority-evidence-trigger-rm, condiciones-persona-vicesecretario, persons-tax-id-unique).

## Hard guardrails

- NUNCA aplicar migraciones a Cloud sin confirmación explícita del usuario.
- NUNCA tocar `governance_module_events` ni `governance_module_links` (handoffs cross-module no se escriben).
- NUNCA usar nombre real del cliente en código/datos/commits.
- NUNCA modificar tablas WORM (`audit_log`, `no_session_*`, `capital_movements_audit`, `censo_snapshot`) salvo via APIs auditadas.
- NUNCA borrar (DELETE) cargos históricos — soft-archive con UPDATE estado='CESADO' + fecha_fin.
- Garrigues UX tokens estrictos en cualquier UI Garrigues (rutas `/secretaria/*`, `/grc/*`, `/ai-governance/*`).
- Antes de cualquier trabajo Supabase: `bun run db:check-target`.

## Estimación realista

- Bloque 4 (datos demo): 2-3 días — primero, evita romper Bloques 1-3.
- Bloque 1 (Plan A' crítico): ~3 semanas (RPCs + singleton + cardinalidad + vacancia + dual-write deprecación + sucesión).
- Bloque 2 (UX cliente): ~2-3 semanas.
- Bloque 3 (representaciones secundarias): ~1 semana.
- Bloque 5 (deseables): sprint dedicado post-piloto, no parte de este sprint.

**Total Bloques 1-4: ~6-8 semanas.** Bloque 5 queda diferido.

## Entry point

Arranca con:
1. Lee CLAUDE.md raíz del repo.
2. Lee `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md` completo (incluyendo §2 decisiones L1-L23).
3. Lee `docs/superpowers/plans/2026-05-12-personas-cargos-w6-cloud-apply-log.md` para entender qué está aplicado a Cloud.
4. Lee `docs/superpowers/plans/2026-05-12-personas-cargos-completitud-handoff.md` (este doc).
5. Lee este prompt entero otra vez.
6. Reconfirma con el usuario las prioridades de los 5 bloques + cualquier decisión nueva que necesite firma legal.
7. Brainstorming + spec → plan → impl, en ese orden.

NO empezar a programar sin haber leído los docs y reconfirmado prioridades.
```

---

## 5. Memoria estructurada para Ruflo / cualquier sistema de memoria persistente

Si el nuevo agente usa Ruflo MCP, puede recrear contexto via memory_search en namespace
`personas-cargos`. Si no está disponible, este doc es la fuente de verdad.

Keys relevantes que existían en la sesión anterior (pueden no persistir entre conversaciones):
- `spec-summary` — resumen del spec + commits + paths
- `legal-decisions-LSC-RRM` — L1-L23 completos
- `adversarial-mode-rules` — patrón builder + reviewer del swarm
- `wave[1-7]-builder-decisions` / `wave[1-7]-adversarial-verdict` — outputs de cada wave
- `codex-loop-iteration-[1-7]-findings` — findings de Codex
- `codex-loop-FINAL-approved` — cierre del loop con aprobación

Si las memoria Ruflo no se cargan, leer los review docs en `docs/superpowers/reviews/2026-05-12-wave*` que contienen los hallazgos críticos commiteados.

---

## 6. Comandos de arranque rápido

```bash
# 1. Posicionarse en worktree canónico
cd /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map

# 2. Verificar target Supabase
bun run db:check-target

# 3. Pull último estado de feature branch (o main tras merge de PR #5)
git checkout main && git pull origin main --ff-only

# 4. Si PR #5 ya merged: leer el merge commit + verificar Cloud
gh pr view 5 --json mergedAt,state

# 5. Si PR #5 NO merged todavía: pedirle al usuario decidir merge antes de Sprint 2
gh pr view 5 --json state,mergeable,reviewDecision

# 6. Confirmar gates locales
bun run typecheck
bun run lint
bun run build
bun test src/test/secretaria src/test/schema
```

---

## 7. Quién firma qué

- **Decisiones legales L1-L23 + nuevas decisiones del sprint completitud:** Equipo Legal Garrigues / Comité Legal.
- **Decisiones arquitecturales (RPC, schema changes):** stakeholder técnico + Claude/Codex sugiriendo opciones.
- **Aplicación a Cloud demo:** usuario `moimene` confirma explícitamente cada migración via MCP `apply_migration` o `execute_sql`.
- **Merge a `main`:** usuario `moimene` ejecuta `gh pr merge` (no automático).

---

## 8. Contacto y trazabilidad

Este doc, junto con el spec original (`2026-05-12-personas-cargos-refactor-design.md`)
y el plan implementable (`2026-05-12-personas-cargos-refactor-implementation.md`)
forman la base de continuidad para retomar la feature.

Si surgen dudas sobre decisiones tomadas en Sprint 1, leer los 7 review docs
adversariales en `docs/superpowers/reviews/2026-05-12-wave*` que documentan
los findings detectados, las decisiones de fix, y las justificaciones legales
cuando aplican.

PR #5 contiene además 22+ commits con mensajes detallados explicando cada cambio.
`git log --oneline main..feature/personas-cargos-refactor` da el listado completo.
