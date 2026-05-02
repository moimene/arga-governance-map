# 2026-05-02 - Prototipo operativo inventory y congelacion de carriles

## Decision de trabajo

Se congela el trabajo paralelo en el resto de carriles. El cierre pasa a un unico integrador para evitar que Secretaria, GRC, AIMS, consola, tests y Supabase sigan divergiendo.

## Objetivo inmediato

Cerrar **prototipo operativo demo-ready**:

- sin aplicar migraciones;
- sin `db push`;
- sin regenerar tipos Supabase;
- sin tocar RLS/RPC/storage/policies;
- sin levantar `000049_grc_evidence_legal_hold`;
- sin writes a `governance_module_events` ni `governance_module_links`;
- usando solo rutas, tablas y contratos ya conectados o declarados como read-only.

`product-complete` queda fuera de este cierre y requerira paquete separado de schema, paridad, RLS/RPC/storage, evidence/legal hold y adopcion explicita de `aims_*` / `grc_*`. Esto no degrada Secretaria a demo: Secretaria queda como prototipo operativo con flujos reales sobre las tablas y RPC ya conectadas.

## Baseline inicial

- Rama actual: `main`.
- Target Supabase: `governance_OS` (`hzqwefkwsxopwrmtksbg`) verificado con `bun run db:check-target`.
- Estado worktree: sucio; no revertir cambios existentes sin aprobacion explicita.

## Inventario worktree

Tracked modificados: 54 archivos.

Areas principales:

| Area | Archivos / patrones | Estado prototipo operativo | Riesgo |
|---|---|---|---|
| Secretaria UI | `src/pages/secretaria/*`, componentes Secretaria, hooks Secretaria | Carril principal de cierre | Alto por golden path y volumen de cambios |
| Secretaria dominio/docs | `src/lib/secretaria/*`, `docs/legal-team/*`, contratos Secretaria | Revisar como soporte demo | Medio |
| Document generation | `src/lib/doc-gen/*`, `ProcessDocxButton`, `GenerarDocumentoStepper` | Necesario para golden path | Alto |
| Rules engine | `src/lib/rules-engine/*` | Necesario para tramitador y plantillas | Medio |
| GRC | `src/pages/grc/*`, `src/lib/grc/*`, `e2e/10-grc.spec.ts` | Mantener standalone/read-only y handoffs | Medio |
| AIMS | `src/pages/ai-governance/*`, `src/lib/aims/*` | Slice 1 ya avanzado; validar | Bajo/medio |
| Consola TGMS | `src/components/arga-console/*`, `src/lib/arga-console/*` | Readiness y journeys | Medio |
| E2E | `e2e/04`, `10`, `14`, `15`, `16`, `17`, `18`, auth/setup/config | Verificacion final | Medio |
| Supabase types | `supabase/functions/_types/database.ts` | No regenerar ni tratar como fuente de schema | Alto |
| Migraciones sin trackear | `supabase/migrations/20260426_000042...000045`, `20260427_000100...000101` | Fuera del cierre operativo salvo docs/probes | Alto |
| Supabase temp | `supabase/.temp/*` | Ignorar para cierre | Bajo |

## Nuevos archivos relevantes sin trackear

| Grupo | Archivos | Decision prototipo operativo |
|---|---|---|
| AIMS | `src/lib/aims/readiness.ts`, tests | Mantener si pasan tests; contrato local no-schema |
| GRC | `src/lib/grc/dashboard-readiness.ts`, tests, contrato GRC | Mantener si refleja pantallas reales |
| Arga Console | `src/lib/arga-console/platform-readiness.ts`, tests | Mantener como read model local |
| Secretaria closeout | `src/lib/secretaria/*closeout*`, legal review, boundary tests | Revisar contra golden path |
| Doc-gen tests/context | `src/lib/doc-gen/__tests__/*`, `resolver-context.ts` | Mantener si estabiliza variables DOCX |
| E2E golden path | `e2e/18-secretaria-golden-path.spec.ts` | Convertir en criterio de cierre |
| Scripts probe | `scripts/probe-secretaria-*`, cleanup scripts | Ejecutar solo si no mutan Cloud o requieren aprobacion |
| SQL drafts | `docs/legal-team/sql-drafts/*` | Documentacion/draft; no aplicar |
| Migraciones | `supabase/migrations/*` nuevas | HOLD para cierre operativo |

## Carriles congelados y regla de ownership

| Carril | Owner funcional | Permitido ahora | Prohibido ahora |
|---|---|---|---|
| Secretaria | Secretaria Societaria | Golden path, docs, tests, UX conectada | Crear modelos GRC/AIMS |
| GRC | GRC Compass | Readiness, UX conectada, handoffs read-only | Crear actos Secretaria o inventario AIMS |
| AIMS | AIMS 360 | Validar Slice 1, UX conectada, handoffs read-only | Crear riesgos/controles GRC o actos Secretaria |
| TGMS Console | Core | Componer, enrutar, mostrar readiness | Mutar estados owner |
| Evidence/legal hold | Plataforma | Etiquetar referencia/stub | Presentar evidencia final o mover `000049` |
| Supabase | Plataforma | `db:check-target`, inventario, probes read-only aprobados | Migraciones, RLS, RPC, storage, db push, typegen |

## Prioridad de cierre

1. Baseline completo: `bun test`, `tsc`, `lint`, `build`, smoke e2e.
2. Secretaria golden path: convocatoria -> reunion -> acta -> certificacion -> documento -> expediente/board pack.
3. AIMS/GRC/Consola: validar contratos no-schema y route-only handoffs.
4. Global search: rutas owner correctas.
5. UX Garrigues: tokens, responsive, empty/loading/error states.
6. Prototype/demo pack: guion, checklist, rutas, datos ARGA, known limitations.

## Known limitations que deben quedar visibles

- `000049_grc_evidence_legal_hold` sigue en HOLD.
- Evidence/legal hold no es final productivo.
- `governance_module_events` / `governance_module_links` son contrato futuro; no writes en el cierre operativo.
- `aims_*` y `grc_*` son backbone candidato; adopcion por workflow futuro.
- TPRM y penal/anticorrupcion siguen backlog no conectado salvo que exista ruta+datos reales.
- Migraciones nuevas locales permanecen fuera del cierre operativo.

## Siguiente paso

Ejecutar baseline completo y convertir cada fallo en una tarea de cierre con prioridad:

- P0: bloquea golden path o build/typecheck.
- P1: rompe demo ejecutiva o navegacion core.
- P2: UX/copy/test coverage sin bloqueo funcional.
- Product backlog: requiere schema/infra o decision posterior.

## Baseline ejecutado

Comandos ejecutados:

```bash
bun run db:check-target
bun test
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5191 bunx playwright test e2e/10-grc.spec.ts e2e/11-global-search.spec.ts e2e/16-sanitization-smoke.spec.ts e2e/18-secretaria-golden-path.spec.ts --project=chromium --reporter=list
```

Resultados:

| Check | Resultado | Notas |
|---|---|---|
| `db:check-target` | Pass | `governance_OS` (`hzqwefkwsxopwrmtksbg`) |
| `bun test` | Pass | 582 pass, 66 skipped; Bun configurado para unit tests bajo `src` |
| `tsc` | Pass | 0 errores |
| `lint` | Pass | 0 errores, 24 warnings conocidos |
| `build` | Pass | warnings conocidos de Browserslist/chunk size |
| e2e focalizado | Pass | 20/20: GRC, global search, sanitization, Secretaria golden path |

P0 corregidos durante baseline:

- `bun test` ejecutaba specs Playwright bajo `e2e/`; se anadio `bunfig.toml` con `root = "./src"` para separar unit tests de e2e.
- `src/lib/doc-gen/__tests__/variable-resolver.test.ts` usaba `vi.hoisted`, no compatible con Bun test; se sustituyo por store global determinista compatible con Bun/Vitest.
- `src/pages/secretaria/MatrizJurisdiccional.tsx` tenia `text-white` en modulo Garrigues; se sustituyo por `text-[var(--g-text-inverse)]`.

Tanda Ruflo supervisada posterior:

- Evidence spine alineado con HOLD (`pending`, no `verifiable`).
- Handoffs AIMS/GRC -> Secretaria pasan por intake read-only en `/secretaria/reuniones/nueva`.
- `/secretaria/tramitador/:id` carga detalle read-only real en lugar de stepper nuevo.
- `useModuleStatus` usa `regulatory_notifications.notification_deadline`.
- Nuevo e2e focalizado: `e2e/19-cross-module-handoffs.spec.ts`.

Verificacion final de la tanda:

| Check | Resultado |
|---|---|
| `bun run db:check-target` | Pass contra `governance_OS` |
| `bun test` | Pass, 582 pass, 66 skipped |
| `bunx tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass, 0 errores, 24 warnings conocidos |
| `bun run build` | Pass, warnings conocidos de Browserslist/chunk size |
| e2e ampliado | Pass, 39/39 |
| Guardrails estaticos | Pass: sin nombre real cliente en `src/supabase/e2e`, sin QTSP competidor, sin writes a `governance_module_events/links`, `git diff --check` limpio |

Auditorias de cierre:

- Codigo/demo sin `MAPFRE`: pass en `src`, `supabase`, `e2e`.
- Tokens Garrigues basicos en rutas Secretaria/GRC/AIMS: pass para hex, Tailwind colors nativos detectados y estilos inline de color prohibidos.
- Evidence/legal hold: la UI y contratos siguen declarando demo/operativa/reference; `000049` permanece HOLD.
