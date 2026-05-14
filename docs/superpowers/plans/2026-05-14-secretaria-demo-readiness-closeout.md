# Secretaría Societaria — Demo Readiness Closeout

Fecha: 2026-05-14  
Repo fuente: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Rama operativa: `main`

## Objetivo

Cerrar el módulo Secretaría Societaria para demo operativa avanzada:

- flujos principales navegables,
- sin rutas demo simuladas accesibles,
- NO_SESSION materializado solo desde respuestas WORM,
- libros obligatorios con rutas de contenido/fallback,
- tests unit/schema/build/e2e relevantes documentados.

## Cambios de cierre

### P0 — NO_SESSION source of truth

Nueva migración:

- `supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql`

Cambios:

- `fn_no_session_cast_response` permite a `SECRETARIO` / `ADMIN_TENANT` documentar una respuesta por un destinatario concreto, pero la fila WORM queda ligada al `person_id` objetivo.
- `fn_no_session_close_and_materialize_agreement` deja de confiar en `p_resultado = 'APROBADO'` enviado por cliente.
- La materialización de `agreements` ocurre solo si `no_session_respuestas` acredita mayoría/unanimidad suficiente.
- `p_resultado = 'RECHAZADO'` se conserva como cierre operativo permitido.
- `execution_mode` y `compliance_snapshot` trazan `source_of_truth = no_session_respuestas`.

Cloud:

- Aplicada en Supabase `governance_OS` (`hzqwefkwsxopwrmtksbg`) con MCP `apply_migration`.
- Verificación Cloud:
  - `close_blocks_client_approval = true`
  - `cast_supports_proxy_response = true`

### UI NO_SESSION

Archivos:

- `src/hooks/useAcuerdosSinSesion.ts`
- `src/pages/secretaria/AcuerdoSinSesionStepper.tsx`

Cambios:

- `useCastVote` acepta `personId` objetivo y envía `p_person_id = targetPersonId`.
- El stepper ya no simula votos de terceros con el `personId` del usuario actual.
- `memberVotes` queda como estado de UI post-RPC para evitar lag visual, no como fuente de cierre.
- La RPC de cierre sigue recomputando en servidor.

### Ruta demo legacy

Archivos:

- `src/App.tsx`
- `src/pages/secretaria/ExpedienteSinSesionStepper.tsx` eliminado

Cambios:

- La ruta legacy `/secretaria/acuerdos-sin-sesion/expediente` ya no monta un componente demo con `DEMO_*` ni `setTimeout`.
- La URL se redirige a `/secretaria/acuerdos-sin-sesion` para evitar que caiga en `:id` con UUID inválido.

### Libros obligatorios

Archivo:

- `src/pages/secretaria/LibrosObligatorios.tsx`

Cambios:

- Eliminado el estado visible "Vista no disponible".
- Todos los `book_kind` tienen ruta natural o fallback:
  - `ACTAS` -> actas registradas
  - `SOCIOS` / `ACCIONES` -> libro de socios/capital
  - `SOCIO_UNICO` -> decisiones unipersonales
  - desconocidos -> ficha de sociedad

## Matriz de cobertura

| Área | Estado cierre | Evidencia |
|---|---:|---|
| Dashboard / navegación Secretaría | Completo | rutas lazy en `App.tsx`, e2e navegación |
| Convocatorias | Completo | stepper 8 pasos, agenda kind, e2e/read-only + UI-driving |
| Reuniones + actas | Completo | stepper reunión, RPC acta/certificación, e2e B4 |
| Certificación EAD/QTSP demo | Completo demo | RPC firmar/emitir, evidencias demo operativas |
| NO_SESSION | Cerrado P0 | migración 000068, hook target person, tests contrato |
| CO_APROBACION / SOLIDARIO | Completo demo | rutas, steppers, motor, e2e adoption modes |
| Decisiones unipersonales | Completo demo | ruta, stepper, detalle |
| Plantillas / gestor documental | Completo demo | gestor tri-capa, overrides, import wizard, tests |
| Alta sociedad | Completo demo | `SociedadNuevaStepper` + RPC TX1/TX2 |
| Personas / cargos | Completo demo | listas, detalle, designación, representante PJ |
| Libros / calendario | Cerrado demo | libros navegables, calendario por rol |
| Multi-jurisdicción / reglas | Completo demo | rutas y rule manager |

## Verificación requerida

Comandos de aceptación:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run e2e -- e2e/12-secretaria-navigation.spec.ts e2e/21-secretaria-responsive.spec.ts e2e/25-secretaria-epic-journeys.spec.ts
```

Para una demo destructiva sintética se mantienen suites opt-in separadas (`e2e/40-*`, `e2e/41-*`, `e2e/42-*`, `e2e/43-*`). No deben ejecutarse contra datos reales ARGA salvo con variables de entorno de fixture y limpieza explícitas.

## Riesgos residuales aceptados para demo

- El entorno conserva `DEMO_OPERATIVA` / `DEMO_EVIDENCE_BUNDLE_NOT_FINAL` como frontera explícita de prototipo. No equivale a evidencia productiva WORM/QTSP final.
- `supabase db push` no es utilizable actualmente por divergencia de historial remoto legacy. Para este cierre se aplicó la migración con MCP `apply_migration` y se conserva el SQL versionado en repo.
- Algunas specs históricas siguen mencionando `ExpedienteSinSesionStepper` o estados "pendientes"; este documento y `AGENTS.md` son el estado operativo de cierre.

## Script de demo recomendado

1. Entrar con `demo@arga-seguros.com`.
2. Abrir `/secretaria` y revisar KPIs/acciones rápidas.
3. Revisar Sociedades -> ARGA Seguros S.A. -> capital/cargos/reglas.
4. Crear o abrir convocatoria.
5. Abrir reunión y revisar flujo acta.
6. Emitir certificación demo desde acta.
7. Abrir Acuerdos sin sesión y mostrar NO_SESSION, CO_APROBACION y SOLIDARIO.
8. Abrir Plantillas y Gestor de plantillas.
9. Abrir Libros obligatorios y Libro de socios.
10. Abrir Calendario y Board Pack.
