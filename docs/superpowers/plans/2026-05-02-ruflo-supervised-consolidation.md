# 2026-05-02 - Ruflo supervised consolidation

## Objetivo

Consolidar TGMS/ARGA como prototipo operativo avanzado demo-ready, con flujos reales
donde ya existen superficies conectadas, sin abrir riesgo de schema ni mezclar
ownership entre Secretaria, GRC, AIMS y TGMS Console.

## Guardrails activos

- No aplicar migraciones.
- No ejecutar `db push`.
- No regenerar tipos Supabase.
- No crear tablas/columnas ni tocar RLS, RPC, storage o policies.
- No promover evidence/legal hold como final; `000049` permanece HOLD.
- No escribir en `governance_module_events` ni `governance_module_links`.
- No introducir el nombre real del cliente en codigo, datos demo, seeds, docs de
  producto o commits; ARGA es el pseudonimo operativo.
- EAD Trust sigue siendo el unico QTSP del ecosistema.
- Secretaria, GRC y AIMS mantienen bounded context separado.
- TGMS Console solo compone, enruta y muestra readiness.

## Estado Ruflo

Comandos ejecutados:

```bash
bun run agents:doctor
bun run agents:swarm:status
bun run agents:route -- "Consolidar TGMS/ARGA advanced prototype complete con researchers read-only..."
```

Observaciones:

- `agents:doctor` pasa con warnings operativos no bloqueantes: version Ruflo no
  ultima, PID stale y dependencia WASM opcional no disponible.
- `agents:swarm:status` no mostro tareas activas utiles para este cierre.
- Ruflo CLI enruto la mision a `Architect` con baja confianza; se usa como
  trazabilidad, no como fuente unica de ejecucion.
- Ruflo MCP `hooks_route` cerro transporte; la coordinacion canonica de esta
  tanda queda en este documento y en la supervision Codex.

## Researchers read-only lanzados

| Carril | Responsabilidad | Permiso |
|---|---|---|
| UX/Garrigues | Tokens, accesibilidad basica, responsive, UX enganosa, standalone readiness | Read-only |
| Legal/domain | ARGA, EAD Trust, evidence HOLD, boundaries Secretaria/GRC/AIMS/Console | Read-only |
| Supabase/schema | Dependencias ocultas de tablas/RPC/storage/types, `ai_*` vs `aims_*`, writes prohibidos | Read-only |
| Verification/tests | Cobertura unit/e2e, riesgos flaky, matriz final de verificacion | Read-only |
| Connected flows | Matriz owner-write/read-only/handoff y flujos reales del prototipo | Read-only |

Ningun researcher tiene ownership de cambios. Cualquier parche se integra por
Codex tras revisar hallazgos, preservar cambios existentes del worktree y
re-ejecutar verificacion.

## Criterios de integracion

| Tipo | Accion |
|---|---|
| P0 | Corregir antes de cierre si rompe build, typecheck, golden path, rutas owner o guardrails |
| P1 | Corregir si afecta demo ejecutiva, coherencia cross-module o testing core |
| P2 | Documentar o corregir si es pequeno y no aumenta riesgo |
| Product backlog | Mover a backlog si requiere schema, RLS/RPC/storage, typegen, legal hold final o write probe |

## Matriz de verificacion supervisada

Comandos obligatorios para cierre:

```bash
bun run db:check-target
bun test
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5191 bunx playwright test e2e/10-grc.spec.ts e2e/11-global-search.spec.ts e2e/16-sanitization-smoke.spec.ts e2e/18-secretaria-golden-path.spec.ts --project=chromium --reporter=list
```

Auditorias adicionales:

```bash
rg -n "<nombre-real-cliente>" src supabase e2e
git diff --check
```

## Contrato de cierre

- El prototipo operativo puede crear y recorrer flujos reales ya conectados. La
  etiqueta demo-ready significa que es presentable sin abrir schema; no significa
  mockup ni UI falsa.
- Secretaria conserva alcance de prototipo avanzado: convocatoria, reunion
  vinculada, acta, certificacion, Acuerdo 360, tramitador y generacion documental
  operan sobre owners reales ya conectados.
- Product-complete queda separado y requiere decision explicita de schema,
  paridad Cloud/local, RLS/RPC/storage, evidence/legal hold final y adopcion de
  backbones `aims_*` / `grc_*`.

## Hallazgos integrados

| Hallazgo researcher | Decision | Cambio |
|---|---|---|
| Evidence spine figuraba `verifiable` mientras `000049` esta HOLD | Corregir ahora | `src/lib/arga-console/contracts.ts` marca evidence `pending` y test lo fija |
| CTA AIMS podia sonar a creacion directa de control GRC | Corregir ahora | `Evaluaciones.tsx` usa "Abrir intake GRC" |
| Secretaria mostraba senales GRC sin etiqueta de ownership | Corregir ahora | Dashboard Secretaria etiqueta KPIs GRC como senales read-only |
| `regulatory_notifications.deadline` no coincide con schema usado por GRC | Corregir ahora | `useModuleStatus` usa `notification_deadline` |
| `/secretaria/reuniones/nueva` era ruta confusa para handoffs | Corregir ahora | La ruta muestra intake read-only y enruta a convocatoria owner |
| `/secretaria/tramitador/:id` parecia detalle pero cargaba stepper nuevo | Corregir ahora | La ruta muestra expediente registral read-only con `useTramitacionById` |
| GRC incidente prometia notificacion automatica no probada localmente | Corregir ahora | Copy cambiado a marcado/intake de notificacion GRC |
| Labels visuales en steppers avanzados | Corregir incremental | `CoAprobacionStepper` y `SolidarioStepper` enlazan labels/controles principales |
| GDPR local demo sin postura conectada | Backlog demo UX | Requiere pase por submodulos GDPR no core |
| Sidebars fijos y standalone shell chrome | Backlog UX | Requiere patron responsive/standalone comun para los tres modulos |
| Storage privado con `getPublicUrl` | Product-complete | Requiere contrato signed-url/storage aprobado |
| Cliente Supabase no tipado y tipos locales stale | Product-complete | Requiere typegen/paridad aprobada |
| Writes futuros a `governance_module_events/links`, `aims_*`, `grc_*` | Product-complete | Requiere probes, RLS y contrato schema |

## Verificacion final

```bash
bun run db:check-target
bun test
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5191 bunx playwright test e2e/05-secretaria-reuniones.spec.ts e2e/10-grc.spec.ts e2e/11-global-search.spec.ts e2e/12-secretaria-navigation.spec.ts e2e/14-secretaria-documentos.spec.ts e2e/16-sanitization-smoke.spec.ts e2e/17-secretaria-template-context.spec.ts e2e/18-secretaria-golden-path.spec.ts e2e/19-cross-module-handoffs.spec.ts --project=chromium --reporter=list
```

Resultados:

- `db:check-target`: pass.
- `bun test`: pass, 582 pass, 66 skipped.
- `tsc`: pass.
- `lint`: pass, 0 errores, 24 warnings conocidos.
- `build`: pass.
- e2e ampliado: pass, 39/39.
- `git diff --check`: pass.
- Guardrails estaticos: sin nombre real del cliente en `src`, `supabase`, `e2e`; sin QTSP competidor; sin writes a `governance_module_events` / `governance_module_links`.

Memoria Ruflo:

- `patterns/ruflo_supervised_handoffs_demo_complete_2026_05_02`
