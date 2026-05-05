# Secretaria Societaria - Matriz de cierre funcional hacia demo-production-ready

Fecha: 2026-05-04  
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Rama: `main`  
Fuente de verdad: Supabase Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`)  
QTSP: EAD Trust  
Estado: cierre funcional avanzado; smoke Cloud transaccional P0 verde, harness tenant A/B verde, smoke con usuario Supabase Auth real verde, deteccion HTTP de `service_role` corregida, probe read-only de plantillas verde y E2E navegador destructivo ARGA test verde bajo autorizacion expresa. No equivale a produccion real: sigue siendo entorno demo/test, sin envio registral real.

## Lectura ejecutiva

Secretaria ya no esta bloqueada por pantallas aisladas ni por falta de contratos backend basicos. El modulo tiene flujos funcionales cableados, Fases 1-4 de logica y plantillas con 777+ tests registrados, y el cierre P0 actual eleva la verificacion local a 845 tests passing / 59 skipped en Vitest. Las plantillas activas estan cerradas en Cloud para uso demo-operativo, migracion `000051` aplicada/verificada en Cloud y hardening incremental `000052`/`000053`/`000054`/`000055`/`000056` aplicado/verificado en Cloud.

El siguiente limite no es React/UX. El smoke transaccional de exito ya pasa contra Cloud dentro de `BEGIN/ROLLBACK`: voto no-session, replay idempotente, cierre/materializacion, certificacion y transmision de capital. El harness tenant A/B tambien pasa con claims `authenticated`, no `service_role`: positivos same-tenant y denegaciones cross-tenant para voto, cierre/materializacion, certificacion, transmision, cierre de vencidos, plantilla ajena y capability negativa. Ademas, el smoke `--auth-user-isolation` crea un usuario Supabase Auth temporal, inicia sesion con password real, valida tenant/person/capability contra `user_profiles` y limpia 0 residuos. El probe read-only de plantillas tambien pasa contra Cloud: 37 activas, 16 borradores, 0 bloqueos. El E2E destructivo ARGA test de navegador tambien pasa para no-session y transmision de capital tras autorizacion expresa para mutar el entorno test.

## Actualizacion 2026-05-05 - post-000056

Se cerro el ciclo P0 de reunion real:

- Migracion `20260505093000_000056_secretaria_meeting_resolutions_transactional.sql` aplicada en Cloud.
- Nueva RPC `fn_save_meeting_resolutions(p_tenant_id, p_meeting_id, p_rows)` guarda de forma transaccional acuerdos, resoluciones, votos y `rule_evaluation_results`.
- Indices idempotentes desplegados: `ux_meeting_resolutions_point` y `ux_agreements_meeting_agenda_point`.
- `useSaveMeetingResolutions` deja de hacer writes multi-step desde cliente y usa la RPC.
- El flujo de reunion ya no usa censo demo: si falta organo, censo vigente o lista de asistentes guardada, quórum/votacion se bloquean explicitamente.
- Bug real corregido: `useBodyMembers` usaba `persons(full_name)` y PostgREST devolvia error por relacion ambigua; ahora usa alias FK explicito `person:person_id(full_name)`.
- QES documental ya no usa firmante demo literal; toma la persona actual. ERDS de no-session ya no envia a un destinatario hardcodeado; usa participantes vigentes del organo.
- Golden path navegador pasa: convocatoria -> reunion -> asistencia real -> quórum -> votacion -> acta -> certificacion -> tramitador -> documento.
- Destructive E2E ARGA test pasa con `SECRETARIA_E2E_MUTATE_ARGA=1`: no-session y transmision de capital.

## Estado actual post-000056

| Area | Estado | Evidencia registrada | Pendiente antes de Done |
|---|---|---|---|
| Target Supabase | Verde | `governance_OS` (`hzqwefkwsxopwrmtksbg`) usado como fuente de verdad. | Ejecutar `bun run db:check-target` al inicio de cada smoke. |
| Fases 1-4 logica Secretaria | Verde registrado | Documento `2026-05-04-secretaria-expanded-logic-functional-tests.md`: Fase 4 con 777 tests. Cierre P0 actual: full Vitest 845 pass / 59 skipped. | No sustituye smoke Cloud transaccional. |
| Migracion `000051` | Verde segun estado recibido | `20260504_000051_secretaria_p0_transactional_rpcs.sql` aplicada y verificada en Cloud. | Smoke transaccional destructivo controlado sobre RPCs reales. |
| Migracion `000052` | Verde | `20260504193000_000052_secretaria_p0_rpc_hardening.sql` aplicada, marcada como aplicada y verificada en Cloud. | Mantener en probes de regresion. |
| Migracion `000053` | Verde | `20260504201000_000053_secretaria_p0_pgcrypto_search_path.sql` aplicada, marcada como aplicada y verificada en Cloud. | Mantener en probes de regresion. |
| Migracion `000054` | Verde | `20260504203000_000054_secretaria_capital_movement_audit_uuid.sql` aplicada, marcada como aplicada y verificada en Cloud. | Mantener en probes de regresion. |
| Migracion `000055` | Verde | `20260504214500_000055_secretaria_http_service_role_detection.sql` aplicada, marcada como aplicada y verificada en Cloud. Corrige deteccion de `service_role` en llamadas HTTP/PostgREST leyendo claims JWT ademas del setting SQL legacy. | Mantener en probes de regresion. |
| Migracion `000056` | Verde | `20260505093000_000056_secretaria_meeting_resolutions_transactional.sql` aplicada, funcion `fn_save_meeting_resolutions` e indices idempotentes verificados en Cloud. | Mantener en probes de regresion y golden path de reunion. |
| RPC no-session | Verde Cloud | Contratos `fn_no_session_cast_response`, `fn_no_session_close_and_materialize_agreement` desplegados; `000052` anade capability y binding persona/actor; smoke `BEGIN/ROLLBACK` pasa voto y replay idempotente; harness A/B deniega tenant/person spoof. | E2E destructivo con usuarios fixture reales. |
| Certificacion no-session | Verde Cloud | `fn_generar_certificacion_acuerdo_sin_sesion` desplegada; `000052` exige `CERTIFICATION` y autoridad de la persona autenticada salvo service/admin; smoke certifica desde `agreements.id` sin `minute_id`; harness A/B deniega agreement ajeno. | E2E destructivo con usuarios fixture reales. |
| Capital/transmision | Verde Cloud | `fn_registrar_transmision_capital` desplegada; `000052` exige rol operador y valida que destino pertenece al tenant; `000054` corrige `audit_log.object_id` uuid; smoke ejecuta movimientos WORM con rollback; harness A/B deniega destino ajeno. | E2E destructivo controlado con tenant/run aislado. |
| RLS/RPC tenant guard | Verde Cloud | Tenant obligatorio, role/capability checks, persona/plantilla/destino tenant checks. Harness `--tenant-isolation` pasa con claims `authenticated` y table check de `capital_holdings`; `--auth-user-isolation` pasa con usuario Supabase Auth temporal y `user_profiles` real. | Ampliar a navegador destructivo y mas tablas UI. |
| Plantillas activas | Verde demo-operativo | `secretaria-p0-cloud-smoke.ts --readonly-only`: 37 activas, 16 borradores, 0 bloqueos; `ESTADO-PLANTILLAS-CORE.md`: 37 activas, 0 activas sin firma, 0 versiones no semver. | Decision Path B: mantener BORRADOR excluido o promover con aprobacion explicita. |
| Path B plantillas | Pendiente operativo | 16 filas `BORRADOR` aplicadas; no se archivaron ni promovieron versiones activas. | Decision: promover a `ACTIVA` o mantener como mejora no bloqueante. |
| E2E Secretaria no destructivo | Verde | Golden path `e2e/18`, watchdog `e2e/30` y responsive `e2e/21` pasan. Incluye reunion con censo real, no-session, certificacion directa interceptada, tramitador, generador documental y transmision UI. | Repetir antes de demo externa. |
| E2E destructivo ARGA test | Verde con autorizacion expresa | `SECRETARIA_E2E_MUTATE_ARGA=1 bunx playwright test e2e/32-secretaria-arga-real-destructive.spec.ts --project=chromium --reporter=list`: 3/3 pass. | No usar como patron para cliente real; mantenerlo opt-in y solo sobre entorno test. |
| Copy/QTSP/frontera registral | Verde registrado | Sin proveedor QTSP alternativo; frontera demo `PROMOTED`/`FILED` = preparado, no enviado al RM. | Mantener grep/copy check en cierre final. |

## Que se prueba ahora

| Track | Prioridad | Objetivo | Estado |
|---|---|---|---|
| Smoke Cloud transaccional post-000051/000052/000053/000054/000055/000056 | P0 | Ejecutado contra Cloud via `scripts/secretaria-p0-cloud-smoke.ts --transactional --require-transactional --tenant-isolation --require-tenant-isolation` dentro de `BEGIN/ROLLBACK`; `000056` verificada con RPC/index probes y golden path navegador. | Verde y repetible via Supabase CLI linked project. |
| E2E destructivo controlado | P0 | Golden path destructivo de navegador autorizado sobre ARGA test para no-session y transmision; guard opt-in obligatorio. | Verde para demo/test; para produccion real preferir tenant fixture aislado. |
| RLS tenant A/B | P0 | Confirmar aislamiento de lectura/escritura y denegacion cruzada en tablas y RPCs criticas. | Verde para RPCs P0 y `capital_holdings` via `--tenant-isolation`; verde con usuario Supabase Auth real via `--auth-user-isolation`. |
| Datos fixture | P0 | Crear dataset minimo reusable para JG anual, consejo con conflicto, no-session, certificacion y capital. | Parcial: fixture SQL rollback para no-session/certificacion/capital; pendiente JG/consejo UI real. |
| Validacion cierre plantillas | P0/P1 | Revalidar 37 activas y comprobar que las 16 Path B `BORRADOR` no aparecen como productivas salvo promocion explicita. | Verde read-only Cloud: 37 activas, 16 borradores, 0 bloqueos. |
| Regresion build/test/E2E | P0 | Preflight P0 verde: target, smoke transaccional, tenant A/B, usuario Auth real, template inventory, typecheck, tests P0, lint, build, E2E golden path, responsive/watchdog y destructive opt-in. Full Vitest 845 pass / 59 skipped. | Repetir antes de demo externa. |

## Matriz funcional de cierre

| Ciclo | Estado funcional | Gating para Done |
|---|---|---|
| Convocatoria -> reunion | Conectado y cubierto por E2E no destructivo. | Fixture JG anual temporal con agenda mixta y limpieza. |
| Reunion -> acta | Conectado en golden path y endurecido con RPC `fn_save_meeting_resolutions`. | Ampliar fixture de consejo con conflicto/voto de calidad si se quiere cobertura juridica mas rica. |
| Acta -> certificacion | Conectado para actas. | Certificacion desde no-session materializado y validacion de autoridad vigente contra Cloud. |
| Certificacion -> tramitador | Gate endurecido a firma + evidence bundle demo. | Verificar con fixture que no avanza si falta firma o bundle. |
| No-session -> documento | RPC transaccional desplegada y endurecida; UI tolerante preparada. | Smoke de voto, replay, cierre y generacion documental con `selected_template_id` preservado. |
| Co-aprobacion -> documento | Cableado con sociedad, organo, plantilla, motor y acuerdo. | Autoridad/capability real y smoke de materializacion idempotente. |
| Solidario -> documento | Cableado con sociedad, organo, plantilla, motor y acuerdo. | Administrador vigente real y smoke de actuante/documento. |
| Decision unipersonal -> documento | Routing restringido a `ACTA_CONSIGNACION`. | E2E con cap table/estado unipersonal aislado. |
| Capital/transmision -> cap table | RPC transaccional desplegada y endurecida; hotfix `000054` aplicado; tenant A/B verde. | E2E destructivo con residuo WORM aislado por tenant/run. |
| Plantillas -> composer | 37 activas cerradas demo-operativas. | Composer/selectores no deben usar BORRADOR Path B como version productiva sin promocion. |
| Tenant isolation | Guard RPC desplegado, harness tenant A/B verde y usuario Supabase Auth real verde. | Ampliar a navegador destructivo sobre tablas UI ricas. |

## Backlog de cierre

### P0 - Bloqueantes para demo-production-ready

1. Fixture destructiva aislada fuera de ARGA para produccion real.
   - Fixture temporal con tenant, entidad, organos, personas, capital, reuniones, acuerdos y documentos.
   - Cleanup verificable para tablas mutables.
   - Residuos WORM permitidos solo bajo tenant/run fixture, nunca bajo ARGA demo.
   - Estado demo/test: el spec ARGA opt-in ya pasa por autorizacion expresa, pero no debe ser el patron de cliente real.

2. Ampliacion RLS tenant A/B a navegador y tablas UI.
   - El harness con claims controlados ya pasa.
   - El smoke con usuario Supabase Auth temporal y `user_profiles` real ya pasa y limpia residuos.
   - Pendiente navegador destructivo con tablas: convocatorias, meetings, minutes, certifications, agreements, no-session, capital.

3. Acta de verificacion final.
   - Registrar comandos, fecha, target Cloud, dataset usado, cleanup y resultado.
   - No declarar Done con "pass local" si falta pass Cloud.

### P1 - Deben cerrarse para reducir riesgo operativo

1. Autoridad/capability real en co-aprobacion y solidario.
   - Resolver administradores vigentes desde `authority_evidence`/`capability_matrix`.
   - Bloquear no vigente, conflicto material o materia restringida.

2. Composer registral unico y Capa 3.
   - Integrar `validateCapa3ForMateria` en captura o preparacion documental.
   - Evitar documentos degradados cuando faltan variables juridicas.

3. Fixtures ricas de junta/consejo.
   - JG ordinaria anual completa.
   - Consejo con conflicto, representacion, voto de calidad y operacion vinculada.

4. Rule packs y evaluaciones WORM.
   - Cerrar duplicados `ACTIVE` heredados en `rule_pack_versions`.
   - Persistir `rule_evaluation_results` solo con traza Cloud V2 completa.

5. Decision Path B.
   - Promover las 16 mejoras o documentar que quedan fuera del demo productivo.

### P2 - Produccion real o modulo futuro

1. QTSP productivo end-to-end con EAD Trust, no solo stubs/refs demo.
2. Envio real al Registro Mercantil y subsanacion registral.
3. Legal hold/evidence bundle con tratamiento final productivo.
4. Observabilidad/SIEM productiva completa y runbooks de soporte.

## Criterios de Done

Secretaria puede declararse demo-production-ready solo cuando se cumpla todo:

1. `bun run db:check-target` confirma `governance_OS` antes de cualquier prueba Cloud.
2. `000051`, `000052`, `000053`, `000054`, `000055` y `000056` estan aplicadas en Cloud y los probes de existencia/security definer/tenant/capability/http-service-role/transaccionalidad por punto pasan.
3. Smoke Cloud transaccional pasa con fixture temporal y cleanup verificado: `secretaria_p0_cloud_smoke_rollback_ok`.
4. E2E destructivo controlado pasa. Estado demo/test actual: ARGA opt-in pasa con autorizacion expresa; para cliente real debe usarse tenant fixture aislado.
5. RLS tenant A/B pasa para tablas y RPCs criticas. Estado actual: verde para RPCs P0 y `capital_holdings` con claims controlados; verde para usuario Supabase Auth temporal con `user_profiles` real.
6. 37 plantillas activas siguen cerradas; Path B queda promovido con aprobacion o explicitamente excluido. Estado actual: probe read-only Cloud verde con 37 activas, 16 borradores y 0 bloqueos.
7. Preflight local completo pasa: typecheck, tests P0, lint, build y E2E Secretaria.
8. No aparece el nombre real del cliente en codigo/datos demo/commits; QTSP unico: EAD Trust.
9. Copy registral mantiene la frontera demo: preparado para Registro, sin envio real.
10. No queda ningun P0 abierto.

## Comandos de verificacion

Ejecutar desde el worktree principal:

```bash
bun run db:check-target
```

Preflight local P0:

```bash
scripts/secretaria-p0-preflight.sh
```

Preflight con todo el E2E Secretaria:

```bash
SECRETARIA_P0_FULL_E2E=1 scripts/secretaria-p0-preflight.sh
```

Tests de contrato P0 focalizados:

```bash
bunx vitest run \
  src/test/schema/secretaria-p0-transactional-rpcs.test.ts \
  src/lib/secretaria/__tests__/supabase-rpc-fallback.test.ts \
  src/lib/secretaria/__tests__/no-session-idempotency-contract.test.ts \
  src/lib/secretaria/__tests__/certification-agreement-source-contract.test.ts \
  src/lib/secretaria/__tests__/capital-transmission-contract.test.ts \
  --reporter=verbose
```

Regresion completa local:

```bash
bun run test
bunx tsc --noEmit --pretty false
bun run lint
bun run build
```

E2E Secretaria no destructivo:

```bash
bunx playwright test e2e/*secretaria*.spec.ts --project=chromium --workers=1 --reporter=list
```

Plantillas Cloud activas:

El probe read-only canonico vive dentro de `scripts/secretaria-p0-cloud-smoke.ts --readonly-only`. Consulta `plantillas_protegidas`, ejecuta `auditTemplateInventory()` y falla si una plantilla activa tiene bloqueos de firma, semver, metadatos o contenido critico. Estado 2026-05-04: 37 activas, 16 borradores, 0 bloqueos.

## Comandos ya formalizados

Smoke read-only Cloud:

```bash
bun scripts/secretaria-p0-cloud-smoke.ts --readonly-only
```

El script carga de forma local `docs/superpowers/plans/.env` si existe, acepta el alias `SERVICE_ROLE_SECRET` y no imprime secretos. Read-only schema/RPC smoke verde tras `000055`.

Smoke transaccional Cloud con rollback:

```bash
bun scripts/secretaria-p0-cloud-smoke.ts \
  --transactional \
  --require-transactional \
  --tenant-isolation \
  --require-tenant-isolation \
  --auth-user-isolation \
  --require-auth-user-isolation
```

El script usa `SECRETARIA_P0_DATABASE_URL`/`DATABASE_URL` + `psql` si estan disponibles. Si no, usa el Supabase CLI vinculado, valida `supabase/.temp/project-ref` y ejecuta el mismo fixture transaccional con rollback.

Smoke transaccional Cloud ejecutado el 2026-05-04:

```text
[OK] transactional cloud smoke - BEGIN/ROLLBACK fixture passed via linked Supabase CLI project hzqwefkwsxopwrmtksbg
[OK] tenant isolation cloud smoke - BEGIN/ROLLBACK fixture passed via linked Supabase CLI project hzqwefkwsxopwrmtksbg
[OK] auth user isolation smoke - temporary Supabase Auth user exercised tenant, person and capability checks; fixture cleaned
```

Harness tenant A/B con rollback:

```bash
bun scripts/secretaria-p0-cloud-smoke.ts --tenant-isolation --require-tenant-isolation
```

Smoke usuario Supabase Auth real:

```bash
bun scripts/secretaria-p0-cloud-smoke.ts --auth-user-isolation --require-auth-user-isolation
```

Este smoke crea un usuario temporal via Admin API, inserta `user_profiles`/tenant/personas fixture, inicia sesion con password real usando anon key, valida tenant/person/capability con RPCs y limpia usuario/perfil/tenant/personas al finalizar. Verificacion de limpieza post-ejecucion: 0 tenants, 0 persons y 0 profiles con prefijo `Secretaria P0 Auth`.

Harness tenant A/B ejecutado el 2026-05-04:

```text
[OK] tenant isolation cloud smoke - BEGIN/ROLLBACK fixture passed via linked Supabase CLI project hzqwefkwsxopwrmtksbg
```

Guard E2E destructivo opt-in:

```bash
SECRETARIA_E2E_DESTRUCTIVE=1 \
SECRETARIA_E2E_TENANT_IDS="<tenant-a>,<tenant-b>" \
bunx playwright test e2e/31-secretaria-destructive-guard.spec.ts --project=chromium --reporter=list
```

E2E destructivo ARGA real opt-in:

```bash
SECRETARIA_E2E_MUTATE_ARGA=1 \
PLAYWRIGHT_PORT=5203 \
bunx playwright test e2e/32-secretaria-arga-real-destructive.spec.ts \
  --project=chromium \
  --workers=1 \
  --reporter=list
```

Ejecutado el 2026-05-04 contra Cloud `governance_OS` tras `bun run db:check-target`:

```text
3 passed
- setup demo auth
- acuerdo sin sesión: UI crea, vota, materializa, genera documento y emite certificación
- transmisión de capital: UI registra movimiento append-only y saldos derivados
```

El spec crea fixtures ARGA marcadas `[E2E REAL]`, usa un órgano QA de un solo votante para validar el voto real con `TenantContext.personId`, exige llamada a `fn_registrar_transmision_capital` y cierra holdings de prueba activos en teardown. No declara envío real al Registro Mercantil.

E2E completo no destructivo de Secretaría:

```bash
PLAYWRIGHT_PORT=5204 \
bunx playwright test e2e/*secretaria*.spec.ts \
  --project=chromium \
  --workers=1 \
  --reporter=list
```

Ejecutado el 2026-05-04:

```text
64 passed
3 skipped (guards/specs destructivos opt-in)
```

Suite Vitest completa:

```bash
bun run test
```

Ejecutada el 2026-05-04:

```text
834 passed
59 skipped/pending
0 failed
295 test suites passed
```

Watchdog funcional no destructivo:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 \
bunx playwright test e2e/30-secretaria-functional-watchdog.spec.ts --project=chromium --reporter=list
```

## Consolidacion 2026-05-05

Se eliminaron los 21 warnings preexistentes de lint:

- Extraccion de `validateCapa3` a `src/lib/secretaria/capa3-form-validation.ts`.
- Correccion de dependencias inestables en hooks de `TenantContext`, `ObligacionesList`, `PersonaNuevaStepper`, `ReunionStepper` y `TramitadorStepper`.
- Supresion dirigida de `react-refresh/only-export-components` solo en modulos shadcn/context que deliberadamente exportan providers, hooks o variants.

Endurecimiento P0 de acuerdo sin sesion:

- `useCastVote` ya no usa fallback cliente para mutar contadores si falta `fn_no_session_cast_response`.
- `useAdoptNoSessionAgreement` ya no inserta `agreements` ni cierra `no_session_resolutions` desde el cliente si falta `fn_no_session_close_and_materialize_agreement`.
- El detalle de acuerdo sin sesion comparte la misma evaluacion de resultado que el stepper y deshabilita "Cerrar como Aprobado" si no hay mayoria/unanimidad suficiente.
- El copy del tramitador evita sugerir "envio" registral real: se mantiene como preparacion registral demo.

Verificacion ejecutada el 2026-05-05:

```text
db:check-target: pass governance_OS (hzqwefkwsxopwrmtksbg)
bun run lint: 0 errors, 0 warnings
bunx tsc --noEmit --pretty false: pass
vitest targeted no-session/Capa3/client-hardening/reunion/QES/ERDS: 17 passed
golden path e2e/18-secretaria-golden-path.spec.ts: 2 passed
e2e/21 + e2e/30: 17 passed
SECRETARIA_E2E_MUTATE_ARGA=1 e2e/32-secretaria-arga-real-destructive.spec.ts: 3 passed
full Vitest: 845 passed, 59 skipped
bun run build: pass
```

## Repetibilidad operativa

Comandos canonicos ya disponibles:

- `scripts/secretaria-p0-preflight.sh`: target, smoke Cloud, aislamiento tenant/Auth, typecheck, P0 contracts, lint, build y E2E criticos.
- `e2e/32-secretaria-arga-real-destructive.spec.ts`: E2E destructivo ARGA opt-in para no-session completo y transmision de capital.
- `scripts/secretaria-p0-cloud-smoke.ts --tenant-isolation --auth-user-isolation`: harness RLS/RPC con rollback y usuario Supabase Auth real.
- `scripts/secretaria-p0-cloud-smoke.ts --readonly-only`: schema/RPC/template inventory read-only.

Nota de entorno local: los scripts `dev`, `build`, `build:dev`, `preview`, `test` y `test:watch` invocan Vite/Vitest con `bunx --bun` para evitar el fallo de carga del binario nativo de Rollup bajo Node 24 en macOS/Dropbox.

## Decision de cierre

Decision actual: cerrar el nucleo funcional de Secretaria como demo-production-ready para el modulo prioritario.

El modulo ya tiene backend P0 desplegado, smoke transaccional Cloud verde, harness tenant A/B verde, smoke con usuario real verde, inventario de plantillas activo sin blockers, preflight P0 completa verde y E2E destructivo real ARGA verde para los dos ciclos que bloqueaban produccion demo: acuerdo sin sesion hasta certificacion y transmision de capital hasta ledger WORM.

Limite de alcance: esto no convierte el entorno en produccion regulada final. La frontera demo se mantiene: `PROMOTED` significa preparado para registro/demo-operativo, no presentado/enviado al Registro Mercantil; la evidencia QTSP sigue siendo demo/operativa salvo integracion productiva EAD Trust externa.

## RC Secretaria 2026-05-05

Checkpoint RC verificado contra Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`):

```text
SECRETARIA_P0_FULL_E2E=1 scripts/secretaria-p0-preflight.sh: pass
- Supabase target: pass
- Cloud transactional smoke: pass
- tenant isolation + auth user isolation: pass
- TypeScript: pass
- P0 RPC contract tests: 42 passed
- Lint: pass, 0 warnings
- Build: pass
- Critical E2E: 17 passed
- Full Secretaria E2E: 65 passed, 3 destructive opt-in skipped

SECRETARIA_E2E_MUTATE_ARGA=1 e2e/32-secretaria-arga-real-destructive.spec.ts: 3 passed
bun run test -- --reporter=dot: 845 passed, 59 skipped
```

Warnings no bloqueantes:

- Browserslist/caniuse-lite desactualizado.
- Aviso Vite de chunks grandes. No afecta al RC funcional; queda como mejora de performance/bundling.
