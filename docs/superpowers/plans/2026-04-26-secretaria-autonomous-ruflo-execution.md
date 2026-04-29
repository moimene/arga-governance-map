# 2026-04-26 — Ejecución autónoma orquestada Ruflo/Codex

## Mandato

Avanzar al máximo en el refactor de Secretaría Societaria, manteniendo a Codex como director técnico/legal de la ejecución y Ruflo como capa de enrutado, seguimiento y memoria operativa.

## Estado consolidado

El estado vivo del refactor UX/documental y las próximas fases previstas quedan consolidados en:

`docs/superpowers/plans/2026-04-27-secretaria-estado-refactor-ux-documental.md`

Usar ese documento como punto de entrada para retomar trabajo. Este plan mantiene el histórico de ejecución autónoma y QA por lotes.

## Estado de Ruflo

- `bun run agents:swarm:status`: `no-active-swarm`.
- `bun run agents:mcp:tools`: herramientas de agentes, tasks, swarm, workflow, autopilot y browser disponibles.
- `bun run agents:route`: el bloque global se enruta a `Researcher` con confianza baja. Decisión: usar esa señal como orientación, pero ejecutar en modo dirigido por Codex con subagentes acotados.

## Reglas de autonomía

1. No se revierten cambios ajenos ni se limpia el worktree sin orden expresa.
2. Cada subagente tiene un scope de escritura cerrado y no solapado.
3. Los flujos legales no se aplanan: cada pantalla debe explicar órgano, materia, modo, regla, override, denominador, mayoría y evidencia.
4. Convocatoria mantiene la decisión vigente: requisitos legales/documentales/canales/plazo son recordatorios no bloqueantes.
5. En Reuniones, Certificación, Actas y Registro sí pueden existir bloqueos cuando afecten constitución, proclamación, autoridad, firma o evidencia.
6. Toda tanda debe cerrar con `tsc`, tests focalizados, build y smoke e2e de Secretaría cuando aplique.
7. Los módulos Garrigues usan solo tokens `--g-*`, `--status-*` y `hsl(var(--sidebar-*)))`.

## Workstreams activos

| WS | Objetivo | Primer entregable ejecutable | Scope de escritura |
|---|---|---|---|
| WS-A | Reuniones v2 legal fidelity | Asistentes con capital/voto/representación, conflictos convertidos en input del motor, voto por resolución | `src/pages/secretaria/ReunionStepper.tsx`, `src/hooks/useReunionSecretaria.ts` |
| WS-B | Gobierno de reglas | Migration lifecycle + snapshot/evaluación WORM mínima | `supabase/migrations/*rule_lifecycle*`, `src/lib/rules-engine/*`, `src/hooks/useRuleResolution.ts`, tests puros |
| WS-C | Campañas de grupo | War Room de cuentas anuales con parametrización y generación de expedientes demo | `src/pages/secretaria/ProcesosGrupo.tsx`, `src/hooks/useGroupCampaigns.ts`, `supabase/migrations/20260426_000042_group_campaigns.sql` |
| WS-D | Modo sociedad completo | Cierre de navegación y vistas filtradas por sociedad | `src/components/secretaria/shell/*`, `src/lib/secretaria/scope-filters.ts`, páginas/listas Secretaría |
| WS-E | Trazabilidad de convocatoria | Guardar snapshot/reglas y alertas aceptadas al emitir convocatoria, sin bloquear | `src/hooks/useConvocatorias.ts`, `src/pages/secretaria/ConvocatoriasStepper.tsx` |
| WS-F | QA y UX Garrigues | Matriz de tests, smoke e2e y revisión tokens/overflow | `e2e/*`, documentación QA |

## Orden de integración

1. Integrar WS-A porque desbloquea la fidelidad material de sesión.
2. Integrar WS-E para que convocatoria quede trazable y no solo visual.
3. Integrar WS-B para que reglas tengan gobierno mantenible.
4. Integrar WS-C y WS-D para completar valor operativo Grupo/Sociedad.
5. Ejecutar WS-F como gate de cierre de cada tanda.

## Backlog crítico

- Reuniones: representantes deben ser personas válidas, no texto libre en FK.
- Reuniones: junta debe calcular capital económico, derechos de voto, clases y restricciones.
- Reuniones: conflictos deben excluir denominadores cuando proceda y no quedarse en aviso local.
- Reuniones: pactos/vetos deben separar validez societaria y cumplimiento contractual.
- Acta: incluir snapshot/ruleset hash, votos por punto, conflictos, pactos y WORM.
- Reglas: persistir lifecycle, vigencia, aprobación legal, hash y supersedes.
- Reglas: consolidar consumidores legacy (`useAgreementCompliance`, `useRulePackForMateria`, `useRulePacks`) en adaptador canónico.
- Campañas: descomponer Cuentas Anuales por sociedad y `AdoptionMode`.
- UX: cerrar modo sociedad para que no aparezcan opciones ambiguas como “Sociedades” dentro de una sociedad salvo que tengan función clara.

## Gate de avance autónomo

Una tanda queda lista cuando:

- `bunx tsc --noEmit` pasa.
- Tests focalizados del motor pasan.
- `bun run build` pasa.
- Smoke e2e Secretaría pasa o se documenta causa externa.
- El plan se actualiza con estado y siguiente lote.

## Lote 1 — Estado

| Agente | Resultado | Estado |
|---|---|---|
| Kuhn | Reuniones: selector de representante válido para asistencia representada, `capital_representado`, `via_representante` y limpieza de representante si no aplica. | Integrado |
| Schrodinger | Convocatorias: `rule_trace`, `reminders_trace`, `accepted_warnings` y persistencia no bloqueante tras emisión. | Integrado |
| Poincare | Gobierno de reglas: plan de lifecycle/snapshot WORM y riesgos de migración. | Convertido parcialmente en migration `000043` |
| Helmholtz | Grupo/Sociedad: diagnóstico de explicabilidad, steppers scope-aware y War Room de campañas. | Backlog priorizado |
| Plato | QA: e2e de cambio Sociedad/Grupo y acceso a Campañas de grupo. | Integrado |
| Codex | Consumidores legacy: `useAgreementCompliance` y `usePreviewAcuerdo` dejan de leer `status/params` inexistentes. | Integrado |

### Cambios estructurales añadidos por Codex

- `20260426_000043_rule_lifecycle_governance.sql`: lifecycle jurídico en `rule_pack_versions`, hashes y campos WORM en `rule_evaluation_results`, manteniendo `is_active` como compatibilidad.
- `useAgreementCompliance` y `usePreviewAcuerdo`: alineados con schema real `payload/is_active` y `rule_packs.tenant_id`.

### Siguiente lote recomendado

1. **Sociedad explicable shell**: corregir copy de header, navegación/búsqueda scope-aware y eliminar ambigüedad de “Sociedades” dentro de modo Sociedad.
2. **Sociedad en creación**: steppers nuevos deben consumir `?scope=sociedad&entity=...` para preseleccionar entidad y evitar que el usuario cree expedientes en otra sociedad por error.
3. **Campañas War Room**: listar campañas lanzadas, detalle por sociedad/fase/tarea, enlaces a expedientes reales y reintentos.
4. **Reglas lifecycle UI mínima**: catálogo de rule packs, detalle, versión activa, hash y overrides por sociedad.
5. **Reuniones v2 siguiente corte**: conflictos como exclusiones reales del denominador, pactos/vetos separados y snapshot al cerrar acta.

## Lote 2 — Scope 4 QA

Scope de escritura aplicado: `e2e/` y este plan. No se han tocado archivos `src/`.

### Matriz QA

| Comportamiento Lote 2 | Cobertura | Estado | Notas |
|---|---|---|---|
| Steppers con sociedad preseleccionada por URL | Preparado en matriz, sin spec ejecutable nueva | Pendiente de implementación | `ConvocatoriasStepper` y `AcuerdoSinSesionStepper` todavía inicializan `selectedEntityId` localmente y no consumen `useSearchParams`; añadir e2e ahora sería frágil/rojo. |
| War Room de campañas | `e2e/13-secretaria-lote2-qa.spec.ts` | Cubierto | Smoke de render en `?scope=grupo` y guard al abrir desde `?scope=sociedad&entity=...`; no lanza campañas ni escribe datos. |
| Búsqueda/navegación scope-aware | `e2e/12-secretaria-navigation.spec.ts` | Cubierto base | Verifica cambio Sociedad/Grupo, propagación de query `scope=sociedad&entity=...` al navegar y acceso a Campañas de grupo en modo Grupo. |
| Menú lateral Secretaría | `e2e/12-secretaria-navigation.spec.ts` | Cubierto base | Recorre rutas principales sin crash ni respuestas REST fallidas. |

### Verificaciones Scope 4

- OK: `bunx tsc --noEmit`.
- OK: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5176 bunx playwright test e2e/13-secretaria-lote2-qa.spec.ts --project=chromium` — 3/3 tests passed, incluyendo setup auth.

## Lote documental v2 — Scope D QA e2e

Scope de escritura aplicado: `e2e/14-secretaria-documentos.spec.ts` y este plan. No se han tocado archivos `src/`.

### Matriz QA documental

| Comportamiento documental | Cobertura | Estado | Notas |
|---|---|---|---|
| Botón `Convocatoria DOCX` visible en detalle de convocatoria | `e2e/14-secretaria-documentos.spec.ts` | Cubierto | Navega desde el listado y abre el primer registro disponible, sin IDs fijos. |
| Descarga DOCX de convocatoria | `e2e/14-secretaria-documentos.spec.ts` | Probe `test.fail` | Playwright no recibe `download` y la sonda de anchor no observa creación de `.docx` en el runtime actual. El probe queda activo como expected-fail hasta que el handler sea observable/estable. |
| Botón `Informe PRE` visible en detalle de convocatoria | `e2e/14-secretaria-documentos.spec.ts` | Cubierto | Mismo detalle de convocatoria; valida que el botón esté disponible para el usuario demo. |
| Descarga DOCX de informe PRE | `e2e/14-secretaria-documentos.spec.ts` | Probe `test.fail` | Misma limitación que convocatoria; valida el patrón esperado `informe_pre_convocatoria_<registro>_<fecha>.docx` cuando el flujo empiece a emitir señal. |
| Botón `Acta DOCX` visible en detalle de acta | `e2e/14-secretaria-documentos.spec.ts` | Cubierto | Navega desde el listado de actas y abre el primer registro disponible, sin IDs fijos. |

### Verificaciones Scope D

- OK: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5176 bunx playwright test e2e/14-secretaria-documentos.spec.ts --project=chromium` — 5/5 passed; 2 probes de descarga ejecutados como `test.fail` esperado.
- OK: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5176 bunx playwright test e2e/04-secretaria-convocatorias.spec.ts e2e/05-secretaria-reuniones.spec.ts e2e/14-secretaria-documentos.spec.ts --project=chromium` — 13/13 passed; 2 probes de descarga expected-fail.
