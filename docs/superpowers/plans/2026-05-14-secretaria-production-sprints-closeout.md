# Secretaría Societaria — cierre sprints productivo piloto

Fecha: 2026-05-14  
Repo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Rama: `main`  
Supabase Cloud: `governance_OS` (`hzqwefkwsxopwrmtksbg`)  
Tenant demo: `00000000-0000-0000-0000-000000000001`  
Entidad demo canonica: `6d7ed736-f263-4531-a59d-c6ca0cd41602`

## Resultado ejecutivo

El modulo Secretaría queda cerrado para piloto productivo solido en las areas no
dependientes de credenciales externas: Personas y Cargos, representaciones LSC,
plantillas P0, fixture E2E destructiva aislada y gates de calidad.

La limpieza semantica de duplicados ARGA/personas no se ha ejecutado porque el
criterio operativo exige confirmacion explicita por par. Queda inventariada como
decision legal/data-owner, no como bloqueo tecnico.

## Sprint 0 — inventario y preflights

Completado.

- `bun run db:check-target` verificado contra `governance_OS`
  (`hzqwefkwsxopwrmtksbg`) antes de tocar Cloud.
- `supabase migration list --linked` confirma drift historico: hay migraciones
  locales sin version remota y versiones remotas legacy sin archivo local. Por
  tanto, `supabase db push` sigue no apto para este repo hasta una reconciliacion
  dedicada del historial.
- Duplicados semanticos que requieren decision por par:
  - ARGA Seguros S.A. `A-00001001` vs ARGA Seguros, S.A. `A-99999903`.
  - Antonio Rios `12345679B` vs D. Antonio Rios Valverde `NIF-DEMO-01-89B557`.
  - Filiales/personas placeholder `PENDIENTE-*`.
- No se han borrado ni reescrito tablas WORM, `audit_log`, `no_session_*`,
  `censo_snapshot` ni `capital_movements`.
- Plantillas P0:
  - `RATIFICACION_ACTOS`: ya tenia campo estructurado de actos ratificados.
  - `FUSION_ESCISION`: cerrada con condicional `requiere_experto`.
  - `JUNTA_GENERAL_O_CONSEJO`: se conserva como alias legacy tolerado; la
    normalizacion organo-especifica queda recomendada para la ola de contenido
    legal, no como P0 de piloto.

## Sprint 1 — Personas y Cargos core

Completado.

- `fn_designar_cargo` se mantiene como RPC transaccional con idempotencia,
  cierre de singletons y bloqueo por capacidades.
- `fn_consolidate_person` queda restringida a `service_role`: no es operable por
  clientes autenticados ni por anon.
- Se endurecio la superficie RPC revocando `EXECUTE` a `PUBLIC`/`anon` en:
  `fn_designar_cargo`, `fn_update_persona`, `fn_cesar_cargo`,
  `fn_upsert_representante_admin_pj`, `fn_scan_vacancias_presidencia`,
  `fn_secretaria_assert_caller_authority_rm`, `fn_consolidate_person`,
  `fn_import_persona_row`, `fn_upsert_representacion_puntual` y
  `fn_close_representacion_puntual`.
- `fn_import_persona_row` permite alta/import idempotente desde UI, con
  comprobacion de tenant, capability y autoridad RM.
- La fuente canonica de representantes es `representaciones`; la lectura
  funcional de `persons.representative_person_id` queda deprecada.
- Las alertas de vacancia presidencial D+0/D+60/D+90 quedan cubiertas por el
  sprint Personas/Cargos previo y sus tests.

## Sprint 2 — UX cliente Personas y Cargos

Completado.

- Lista de personas con paginacion server-side y contador real.
- Busqueda server-side mantenida por `usePersonasEnriquecidasPage`.
- Edicion post-alta sigue en ficha de persona con RPC endurecida.
- Importacion CSV/TSV/XLS/XLSX en `/secretaria/personas/importar`:
  dry-run en cliente, deteccion de duplicados por `tax_id`, y apply via RPC.
- Chips RM reutilizables `Inscrito` / `Pendiente RM`.
- Timeline historico de representantes PJ en ficha de persona.

## Sprint 3 — Representaciones secundarias LSC

Completado.

- Nueva ruta `/secretaria/representaciones/nueva`.
- UI para `JUNTA_PROXY` por reunion y `CONSEJO_DELEGACION` por sesion.
- `meeting_id` es obligatorio en la RPC para estos scopes.
- Cierre por `effective_to`, nunca por `DELETE`.
- La pestaña Representaciones de sociedad enlaza altas puntuales y permite
  cerrar representaciones vigentes acotadas a reunion/sesion.

## Sprint 4 — cobertura E2E productiva

Completado en infraestructura y smoke critico.

- Nueva fixture destructiva aislada:
  `e2e/fixtures/secretaria-isolated-tenant.ts`.
- Guardrails:
  - opt-in doble `SECRETARIA_E2E_DESTRUCTIVE=1` y
    `SECRETARIA_E2E_ISOLATED_TENANT=1`;
  - bloqueo runtime si una mutacion contiene el tenant ARGA o la entidad ARGA;
  - solo opera sobre tenant sintetico no-ARGA;
  - cleanup verificable del tenant y usuario de test.
- Nueva suite:
  `e2e/45-secretaria-isolated-fixture.spec.ts`.
- Smoke UI no destructivo ejecutado para dashboard y tramitador.

La cobertura UI-driving larga ya existe en suites B1/B3/B4/B5/B6/B7 y queda
apta para ejecutarse con fixture aislada. No se ha ejecutado contra ARGA demo una
destructiva completa de todos los journeys porque el objetivo de cierre era
evitar efectos laterales en datos demo canonicos.

## Sprint 5 — legal/productivo

Completado para piloto.

- `FUSION_ESCISION` incorpora condicional legal para informe de experto
  independiente (`requiere_experto`) y campo editable booleano.
- `RATIFICACION_ACTOS` deja de estar en la lista de P0 toleradas.
- `KNOWN_P0_TEMPLATES` queda vacia: el gate de plantillas P0 ya no acepta deuda
  conocida por defecto.
- Quedan fuera por dependencias externas:
  - QTSP productivo EAD Trust con credenciales/contrato operativo real.
  - Registro Mercantil real.
  - CNMV/IBEX real.
  - Microsoft Sentinel/SIEM productivo.

## Migraciones y Cloud

Migracion local versionada:

- `supabase/migrations/20260514181001_secretaria_production_sprint_closeout.sql`

Aplicacion Cloud:

- SQL no destructivo aplicado contra `governance_OS` despues de
  `bun run db:check-target`.
- Por drift historico de migraciones, no se uso `supabase db push`.
- Verificaciones Cloud:
  - `anon` sin `EXECUTE` efectivo sobre RPCs sensibles.
  - `fn_consolidate_person` solo invocable por `service_role`.
  - RPCs nuevas con `SECURITY DEFINER` y `search_path = public, extensions`.
  - `FUSION_ESCISION` contiene `{{#if requiere_experto}}`.

## Pruebas ejecutadas

```bash
bun run db:check-target
bun run lint
bun run typecheck
bun run test
bun run build
bunx vitest run \
  src/test/schema/secretaria-production-closeout.test.ts \
  src/test/secretaria/personas-cargos-sprint2-ui-contract.test.ts \
  src/test/schema/gate-pre-cloud-calibration.test.ts \
  src/test/schema/template-import-schema-real-data.test.ts
bunx playwright test \
  e2e/03-secretaria-dashboard.spec.ts \
  e2e/06-secretaria-tramitador.spec.ts \
  --project=chromium
bunx playwright test e2e/45-secretaria-isolated-fixture.spec.ts --project=chromium
SECRETARIA_E2E_DESTRUCTIVE=1 \
SECRETARIA_E2E_ISOLATED_TENANT=1 \
SECRETARIA_E2E_RUN_ID=closeout-final2-20260514 \
  bunx playwright test e2e/45-secretaria-isolated-fixture.spec.ts --project=chromium
```

Post-E2E destructivo:

- tenants `Secretaría E2E closeout*20260514*`: 0.
- usuarios `secretaria-closeout*20260514*@example.test`: 0.

## Riesgos residuales

- Consolidacion semantica ARGA/personas: pendiente de aprobacion explicita por
  cada par. La RPC existe, pero no debe ejecutarse sin decision legal/data-owner.
- Drift de historial Supabase: requiere una tarea separada de reconciliacion de
  migraciones antes de volver a usar `supabase db push`.
- `xlsx` aumenta el chunk de importacion; esta lazy route queda separada del
  bundle principal de Secretaría.
- Las integraciones reales externas permanecen sustituidas por stubs/demo.

## Script recomendado de demo/piloto

1. Entrar con `demo@arga-seguros.com`.
2. Abrir `/secretaria` y revisar KPIs, acciones rapidas y navegacion.
3. Ir a Sociedades -> ARGA Seguros S.A. -> Personas/Cargos/Representaciones.
4. Mostrar chips RM y autoridad vigente para PRESIDENTE/SECRETARIO.
5. Abrir una ficha de persona y revisar timeline de representante PJ.
6. Importar un CSV/XLSX pequeño desde `/secretaria/personas/importar` en modo
   dry-run; aplicar solo si se usa tenant/fixture autorizada.
7. Crear una representacion puntual desde sociedad:
   `JUNTA_PROXY` o `CONSEJO_DELEGACION`.
8. Abrir Tramitador y generar documento con plantilla activa.
9. Revisar Expediente 360, NO_SESSION, CO_APROBACION y SOLIDARIO.
10. Abrir Gestor de plantillas y confirmar que no hay P0 bloqueantes.
11. Cerrar mostrando que QTSP/RM/CNMV/SIEM reales estan explicitamente fuera de
    alcance hasta credenciales/contratos.
