# UX Configuración Secretaría — Oleada 3A: integridad de activación

**Estado:** COMPLETADA en código y Cloud; pendiente únicamente de confirmación para stage/commit/push  
**Fecha:** 2026-07-12  
**Plan marco:** `2026-07-11-ux-configuracion-oleada2-coherencia-plan.md`  
**Perímetro:** `/secretaria/plantillas`, `/secretaria/gestor-plantillas`, `plantillas_protegidas`, `plantilla_changelog` y `materia_template_binding`.

## 1. Objetivo

Eliminar la única equivalencia activa real del inventario y convertir el ciclo de estado de plantillas en una operación transaccional, trazable y autorizada en servidor:

- una sola plantilla `ACTIVA` por identidad funcional completa;
- sustitución de la vigente, movimiento de bindings y changelog dentro de la misma transacción;
- ningún cambio de estado directo desde PostgREST;
- autorización efectiva de `ADMIN_TENANT`, no solo ocultación en UI;
- cero borrados o renombrados de plantillas y materias.

## 2. Auditoría previa

### 2.1 Código

El flujo actual de `transitionTemplateState` realiza cinco operaciones separadas:

1. lectura de la plantilla;
2. lectura de las activas y Gate PRE cliente;
3. `UPDATE plantillas_protegidas`;
4. `INSERT plantilla_changelog`;
5. rollback compensatorio si falla el changelog.

El `UPDATE` no compara el estado observado y el Gate se ejecuta sobre un snapshot anterior. Existe una carrera TOCTOU: dos administradores pueden superar el Gate y activar dos versiones equivalentes. Tampoco existe RPC ni índice SQL de unicidad activa.

La identidad TypeScript ya es la base correcta: tenant, tipo, jurisdicción, materia con alias, órgano canónico, forma de adopción y tipo social. Brecha confirmada: `tipo_social = NULL` y el literal `ANY` no se normalizan hoy como equivalentes.

### 2.2 Cloud `governance_OS`

Target confirmado: `hzqwefkwsxopwrmtksbg`; tenant demo `00000000-0000-0000-0000-000000000001`.

- 110 plantillas: 74 `ACTIVA`, 36 `ARCHIVADA` antes de 3A.
- Única identidad funcional activa repetida:
  - v1.0.0 `92ee684b-8a34-4e8c-b3ca-c1827f7fa05f`;
  - v1.1.0 `52e7f727-125b-4d26-a46f-bf9a912df56e`.
- Ambas: `CONVOCATORIA / ES / CONVOCATORIA_COMISION_DELEGADA / COMISION_DELEGADA / MEETING / NULL=ANY`.
- Dependencias de ambas: 0 bindings, 0 comunicaciones, 0 expedientes o resoluciones sin sesión, 0 overrides, 0 borradores, 0 artefactos y 0 changelog.
- Cloud no tiene constraint/índice de una única activa por identidad.
- RLS de `plantillas_protegidas` permite hoy `ALL` a cualquier autenticado del tenant. `plantilla_changelog` permite insertar a cualquier autenticado del tenant y `materia_template_binding` tiene la misma brecha. El guard `ADMIN_TENANT` es solo de interfaz.
- `trg_plantilla_version_history` añade historia y `activated_at`, pero no sustituye el changelog WORM.

### 2.3 Decisión canónica tras discrepancia adversarial

Se conserva **v1.1.0** y se archiva **v1.0.0**.

Razones determinantes:

- v1.1.0 es posterior, tiene activación explícita, `version_history`, aprobación `Garrigues / Comité Legal` y contrato `variables-plantillas-v1.1`;
- v1.0.0 carece de contrato y de activación trazada, y su aprobación es demo-operativa;
- v1.0.0 contiene referencias jurídicas materialmente incorrectas: atribuye al art. 529 sexdecies LSC el comité de riesgos y aplica el RD 84/2015 de entidades de crédito a una aseguradora;
- la v1.1.0 conserva una fuente manual y notas que requieren mejora; al no tener binding ni uso, esa limitación se documenta para 3B y no justifica mantener como canónica una versión con citas incorrectas;
- no se redactará ni activará una v1.2.0 sin revisión Legal.

## 3. Diseño de implementación

### 3.1 Migración espejo `20260712124000`

Crear `supabase/migrations/20260712124000_secretaria_template_activation_integrity.sql` con una única transacción forward-only:

1. Función inmutable `fn_secretaria_template_functional_key(...)`, alineada con TypeScript:
   - cuatro alias de materia;
   - cinco alias de órgano;
   - `tipo_social NULL`, vacío y `ANY` equivalentes;
   - NULL de órgano/adopción sigue siendo ausencia, no comodín.
2. Saneamiento fail-closed:
   - valida los dos UUID, versión, estado, identidad y cero dependencias;
   - archiva solo v1.0.0;
   - no modifica su contenido ni referencias;
   - registra un evento contemporáneo `ACTIVA→ARCHIVADA` en changelog, `reconstructed=false`;
   - exige una única activa v1.1.0 al terminar.
3. Índice único parcial `ux_plantillas_active_functional_identity` para `estado='ACTIVA'`.
4. Helpers de autorización basados en `rbac_user_roles + rbac_roles`, con rol activo, no expirado y del tenant real.
5. RPC `fn_secretaria_transition_template_state(...)`:
   - `SECURITY DEFINER`, `search_path = pg_catalog, public` y objetos cualificados;
   - deriva tenant y actor de la sesión; el actor de changelog no se acepta desde cliente;
   - exige `ADMIN_TENANT` activo o `service_role`;
   - usa `operation_id`, hash de request, replay idempotente y CAS de estado;
   - serializa por identidad con advisory lock y bloquea filas `FOR UPDATE`;
   - aplica la misma matriz de estados del cliente;
   - al activar, exige destino `APROBADA`, aprobación formal y predecesora exacta;
   - archiva la predecesora, mueve sus bindings activos, activa el destino y escribe ambos eventos WORM en una transacción;
   - si el snapshot, la predecesora o la identidad han cambiado, falla sin mutaciones.
6. Trigger que impide cualquier cambio directo de `estado`; solo la RPC abre el guard transaccional.
7. RLS/ACL:
   - lectura tenant para autenticados;
   - insert/update/delete de plantillas solo para admin activo; insert solo `BORRADOR`, delete solo `BORRADOR`;
   - changelog insertable solo por admin activo o RPC; update/delete siguen WORM;
   - bindings mutables solo por admin activo;
   - endurecer `fn_secretaria_assign_template_binding` con el mismo guard servidor.
8. `REVOKE EXECUTE` a `PUBLIC/anon` y `GRANT` solo a `authenticated/service_role` para RPCs de escritura.

### 3.2 Cliente TypeScript

- Normalizar `tipo_social NULL/''/ANY` de forma idéntica en `functional-key.ts`.
- Mantener el Gate PRE como validación jurídica/UX.
- En una transición ejecutable, tratar una única vigente equivalente como sustitución atómica que requiere reconocimiento, no como instrucción para archivar manualmente antes.
- Sustituir `UPDATE + appendChangelog + rollback` por una única llamada RPC para todas las transiciones de estado.
- Mantener `appendChangelog` cliente para importación y edición de contenido, que no cambian `estado`.
- Conservar las firmas de hooks y `TransitionResult` para no romper las dos superficies consumidoras.

### 3.3 Tests

- Paridad de identidad: alias de materia, alias de órgano y `NULL=ANY`; `SA` sigue siendo distinto.
- Gate PRE: duplicado sigue bloqueante en auditoría general, pero es warning reconocido en modo de sustitución atómica.
- Servicio: payload RPC, actor no enviado, predecesora exacta, idempotency key, error sin rollback compensatorio y estado obsoleto.
- Contrato estructural de migración:
  - UUIDs y decisión v1.1 canónica;
  - no `DELETE` ni renombre;
  - guards de cero dependencias y contenido preservado;
  - función de identidad, índice parcial, locks, RBAC, trigger, WORM, grants y dos logs de sustitución;
  - RLS sin constante de tenant demo.
- Probe Cloud de existencia/permisos de la nueva RPC: anon y `SECRETARIO` no pueden ejecutar una transición.
- Actualizar cualquier contrato/e2e que dependa de los recuentos 74/36; los textos e IDs de tabs se mantienen.

## 4. Aplicación Cloud

1. Ejecutar `bun run db:check-target` inmediatamente antes de escribir.
2. Aplicar el SQL espejo mediante Management API con token del keychain; no usar `db push --linked`, repair ni otro proyecto.
3. Registrar `20260712124000` en `supabase_migrations.schema_migrations` por el mismo canal.
4. Verificar:
   - 73 activas, 37 archivadas;
   - v1.0 archivada, v1.1 activa;
   - 0 identidades activas duplicadas;
   - 14/14 core;
   - 0 bindings a plantillas no activas;
   - contenido/capas/referencias de ambas sin cambios;
   - un nuevo changelog contemporáneo para v1.0;
   - índice, funciones, trigger, RLS y grants presentes;
   - ledger con una sola fila para la versión.
5. Ejecutar advisors de seguridad y rendimiento tras el DDL.

## 5. Gates y verificación viva

- `bun test` completo.
- `bun run typecheck`.
- ESLint de todos los TS/TSX tocados.
- `git diff --check`.
- escaneo Garrigues de los archivos de interfaz tocados.
- `bun run build`.
- E2E afectados, aislados: 08, 14, 17, 21, 22, 24 y 25, más cualquier spec nuevo de RPC/seguridad.
- Verificación viva con login demo `SECRETARIO`:
  - salud sin la incidencia de duplicidad;
  - una sola versión vigente de la familia y v1.0 en histórico;
  - tabs/acciones de escritura siguen ocultos;
  - navegación y responsive sin regresión.

## 6. Review adversarial de cierre

Tres revisores independientes sobre el snapshot final:

1. SQL/seguridad: tenant, RBAC, RLS, locks, idempotencia, WORM y bypasses.
2. Dominio/Cloud: decisión canónica, bindings, cobertura, contenido preservado y migración/ledger.
3. Cliente/UX/tests: Gate, errores, contratos, accesibilidad, tokens y journeys.

Aplicar todos los P0/P1 y P2 pertinentes, repetir gates afectados y solo entonces cerrar.

## 7. Fuera de alcance

- Redactar o aprobar una v1.2.0 consolidada.
- Corregir las limitaciones de variables o notas de v1.1.0; pasan a 3B.
- Changelog retrospectivo de las otras 109 plantillas.
- Regularizar las 14 versiones 0.x o los 26 contratos ausentes.
- Panel de estancamiento, responsables o analítica.
- Reparar el drift histórico del CLI o usar `migration repair`.

## 8. Criterios de cierre

- Cero equivalencias activas en Cloud y unicidad imposible de vulnerar por carrera.
- Toda transición de estado deja changelog en la misma transacción o no deja ningún cambio.
- Activación sustituye únicamente la predecesora exacta y preserva bindings.
- `SECRETARIO`, roles ajenos, admin expirado y tenant cruzado no pueden mutar el ciclo.
- Ninguna fila de plantilla/materia se borra o renombra.
- Cobertura core 14/14 y UI viva sin la incidencia saneada.
- Gates completos y tres reviews adversariales cerrados.

## 9. Ejecución y evidencia de cierre — 2026-07-12

### 9.1 Implementación

- La identidad funcional TypeScript y SQL coincide en seis dimensiones, cuatro aliases de materia, cinco aliases de órgano, `NULL/''/ANY → ANY` para tipo social y `btrim` ASCII. Los separadores libres no colisionan porque la serialización cliente usa array JSON.
- Todas las transiciones de estado pasan por `fn_secretaria_transition_template_state`: tenant/actor derivados, RBAC servidor, CAS, locks por operación e identidad, ledger idempotente, sustitución exacta, movimiento de bindings y changelog WORM en la misma transacción.
- El cliente fija `operationId`, estado y predecesora durante el reconocimiento; solo repite una vez el mismo payload ante fallo de transporte ambiguo. Los errores stale refrescan las consultas, cierran diálogos obsoletos y devuelven foco a la superficie estable.
- La aprobación formal se crea únicamente en `REVISADA→APROBADA`; `APROBADA→ACTIVA` conserva aprobador y fecha. `ACTIVA→ARCHIVADA` con bindings exige sustitución atómica.
- La fuente RBAC dejó de ser automutable: `authenticated` solo lee `rbac_roles/rbac_user_roles`, `anon` no accede y `service_role` conserva CRUD sin `TRUNCATE`, `TRIGGER` ni `REFERENCES`. El helper SoD conserva su consumidor, con tenant, sujeto propio o admin activo para terceros y expiración.

### 9.2 Migraciones Cloud

Target comprobado antes de cada escritura: `governance_OS` (`hzqwefkwsxopwrmtksbg`). Cada DDL se prevalidó dentro de `ROLLBACK`, se aplicó por Management API con token del keychain y quedó en `supabase_migrations.schema_migrations`:

1. `20260712124000_secretaria_template_activation_integrity`;
2. `20260712133000_secretaria_template_activation_integrity_advisor_followup`;
3. `20260712133500_secretaria_template_guard_rls_followup`;
4. `20260712140000_secretaria_rbac_role_source_hardening`.

No se usó `db push --linked`, repair, borrado ni renombrado de materias o plantillas.

### 9.3 Estado Cloud final

- Inventario: 110 plantillas, 73 `ACTIVA` y 37 `ARCHIVADA`.
- v1.0.0 `92ee684b-8a34-4e8c-b3ca-c1827f7fa05f`: `ARCHIVADA`; exactamente un changelog contemporáneo `ACTIVA→ARCHIVADA`, `reconstructed=false`.
- v1.1.0 `52e7f727-125b-4d26-a46f-bf9a912df56e`: `ACTIVA`; sigue siendo la única vigente de la familia.
- Los catorce hashes contrastados no cambiaron:
  - v1.0: `1100693457e0f4e1668b7308a6b38a88`, `140344e1768a77426835f755d84b9989`, `965846a9edbd0226ed4bd03ad03c5cf4`, `083a488fd3ac845781f0ca1d59529b4f`, `8896f9789dd3699faafd8d9294460d37`, `d41d8cd98f00b204e9800998ecf8427e`, `99914b932bd37a50b983c5e7c90ae93b`;
  - v1.1: `b865b09c5db66035c232e72146c804f7`, `0e3360c2084e48222899dce7412a638c`, `2545dc367d89dd8cd29ef43b359fe2ff`, `00595792727e39f069210cabcb526c31`, `82fed7b063b0533bd4cc1cd0538d5811`, `5d85221399fd389d9e5dcb6a6379c3f5`, `df51e28cc694024b99c878aed3b7f959`.
- Cero identidades activas duplicadas, cero bindings activos inválidos y cobertura core 14/14.
- Índice único funcional válido/listo; guards de estado, binding y changelog activos; ledger y changelog WORM sin DML cliente.
- Demo real: solo `SECRETARIO` activo. Puede leer su rol, pero autoasignación/reescritura de roles, transición, binding y SoD cross-tenant devuelven `42501`.
- La sonda `supabase/tests/secretaria_template_activation_integrity_probe.sql` completó todas las aserciones y terminó en `ROLLBACK`: cero tenants, plantillas, bindings, roles, operaciones o helpers `3a…` residuales.

### 9.4 Gates finales

- `bun test`: **2393 pass, 152 skip, 0 fail**; 8624 aserciones.
- Probe PostgREST con login demo: **7/7**.
- `bun run typecheck`, ESLint de todo lo tocado, `git diff --check`, scan Garrigues y `bun run build`: limpios.
- E2E coordinados 08/12/14/16/17/21/22/24/25, ejecutados en lotes aislados con login renovado: **50 journeys pass, 1 skip ADMIN_TENANT esperado, 0 fail**; los cinco setups de autenticación también pasaron.
- Una ejecución conjunta larga perdió la sesión de Playwright tras el décimo caso y redirigió los restantes al login. Las capturas confirmaron que no era un fallo de pantalla; los mismos specs pasaron aislados sin modificar producto.

### 9.5 Reviews adversariales

La primera vuelta detectó y se corrigió antes del cierre:

1. **P1 seguridad:** `rbac_user_roles` permitía autoasignar `ADMIN_TENANT` a cualquier autenticado del tenant.
2. **P1 dominio cliente:** el Gestor sobrescribía el aprobador formal al activar.
3. **P2 paridad:** el órgano usaba `String.trim()` frente a `btrim` SQL.
4. **P2 UX:** un error stale podía dejar abierto el diálogo de aprobación sobre datos obsoletos.
5. **P2 Cloud:** los guards de binding/changelog necesitaban lectura `SECURITY DEFINER` para no quedar falseados por RLS.

Tras los fixes, las tres revisiones independientes —SQL/seguridad, dominio/Cloud y cliente/UX/tests— cerraron con **0 P0, 0 P1 y 0 P2**.

### 9.6 Riesgos residuales no bloqueantes

- Los advisors conservan warnings esperados para RPCs `SECURITY DEFINER` autenticadas con autorización interna y varios INFO de índices históricos; no hay warning nuevo de acceso anon/RLS de 3A.
- La administración interactiva de roles queda deliberadamente backend-only hasta una RPC específica con SoD y auditoría; no existe hoy consumidor legítimo de DML directo.
- No hay credenciales de una cuenta `ADMIN_TENANT` operativa con tenant observable para un E2E UI positivo. El happy path servidor se probó transaccionalmente con claims sintéticos y el canal de servicio; el login demo requerido prueba el camino negativo real.
- No se abrió una carrera física de dos conexiones; advisory locks, CAS, locks de fila e índice único se probaron por contrato y hacen cumplir la invariancia en base de datos.

### 9.7 Cierre

Todos los criterios de §8 están satisfechos. El working tree permanece sin stage ni commit, conforme a la restricción de pedir confirmación antes de publicar.
