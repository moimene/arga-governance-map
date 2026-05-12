# QA notes - Gestor de Plantillas Sprint 1

Fecha: 2026-05-12
PR: #8 (`claude/compassionate-elbakyan-63e406`)
Commit de fixes de review: `c6e3a0f`

## Verdict

`READY_FOR_RE_REVIEW`

La QA encontro 3 hallazgos P1 changes-blocking y 1 correccion secundaria. Todos quedaron resueltos en `c6e3a0f` con regresiones automatizadas. No quedan nuevos bloqueantes conocidos mas alla de los follow-ups diferidos documentados para Sprint 2.

## Hallazgos resueltos

### P1 - Preflight del importer escribia BORRADOR antes del ACK

El wizard llamaba a `useImportPlantillaPackage` en el paso de preflight. Si Gate PRE devolvia solo warnings, el hook creaba un BORRADOR antes de pedir el motivo de ACK. Al reintentar con `ackMotivo`, se creaba un segundo BORRADOR.

Resolucion:
- `useImportPlantillaPackage` devuelve `WARNINGS_NEED_ACK` antes de `createDraftFromImport`.
- `TemplateImportWizard` avanza al paso de ACK con el resultado de Gate PRE sin escritura.
- Test nuevo cubre que no hay write sin ACK y que con ACK valido se escribe una sola vez.

### P1 - Transicion a APROBADA no persistia firma

`transitionTemplateState` solo persistia `estado`. Una plantilla podia quedar en `APROBADA` con `aprobada_por = null` y luego Gate PRE bloqueaba `APROBADA -> ACTIVA` por metadata incompleta.

Resolucion:
- `TransitionInput` acepta `aprobadaPor` y `fechaAprobacion`.
- La transicion a `APROBADA` falla con `MISSING_APPROVAL_DATA` si no hay firma previa ni firma nueva.
- La transicion persiste `aprobada_por` y `fecha_aprobacion` cuando aplica.
- Tests nuevos cubren fallo sin firma y persistencia con firma.

### P1 - Gate PRE bloqueaba metadata de aprobacion para BORRADOR

Gate PRE trataba `META_APROBADA_POR` como BLOCKING sin distinguir el destino. El importer podia bloquear paquetes que aun debian entrar como BORRADOR.

Resolucion:
- `GatePreContext` acepta `targetEstado`.
- Para `BORRADOR` y `REVISADA`, metadata de aprobacion pendiente baja a `INFO`.
- Para `APROBADA` y `ACTIVA`, sigue siendo `BLOCKING`.
- Tests nuevos cubren ambos destinos.

### Secondary - Comentario de idempotencia del batch

El comentario de `scripts/import-templates-batch.ts` sugeria idempotencia entre ejecuciones, pero la clave usa `plantillaId` recien insertado y no evita duplicados cross-run.

Resolucion:
- Comentario corregido: la idempotencia solo cubre changelog dentro de la misma ejecucion.
- Se anade follow-up F12 para idempotencia funcional cross-run.

## Riesgos residuales aceptados

- Siguen vigentes los follow-ups Sprint 2 ya documentados, mas F11 y F12.
- El usuario demo `demo@arga-seguros.com` sigue como `SECRETARIO`; no prueba tabs Importar/Validacion sin elevar rol o seed `ADMIN_TENANT`.
- Las dos plantillas P0 toleradas (`FUSION_ESCISION`, `RATIFICACION_ACTOS`) siguen como riesgo legal documentado y pendiente de Comite Legal.
- El batch service-role requiere uso humano controlado con `--dry-run` previo hasta resolver F12.

## Validacion ejecutada

```bash
bun run typecheck
bun run lint
bun test src/hooks/secretaria/__tests__/useImportPlantillaPackage.test.tsx
bun test src/lib/secretaria/template-admin/__tests__/
bun run build
PLAYWRIGHT_PORT=5191 bunx playwright test e2e/22-secretaria-gestor-import-wizard.spec.ts --project=chromium
```

Resultado:
- Typecheck: OK.
- Lint: OK con 4 warnings existentes de `eslint-disable` no usados.
- Hook importer: 2 tests pass.
- Template-admin: 67 tests pass, 2 skip.
- Build: OK, con warnings esperados de Browserslist/chunk size.
- E2E importer wizard: 2 pass, 1 skip por falta de seed `ADMIN_TENANT`.

## Smoke test post-merge sugerido

1. Actualizar `main` tras merge y confirmar `git status` clean.
2. Ejecutar `bun run typecheck && bun run lint && bun run build`.
3. Arrancar app y entrar como `demo@arga-seguros.com`.
4. Verificar `/secretaria/gestor-plantillas` con rol `SECRETARIO`: 5/7 tabs visibles, sin Importar/Validacion.
5. Con rol `ADMIN_TENANT`, recorrer importer con paquete warning-only: debe pedir ACK sin crear BORRADOR previo.
6. Validar transicion `REVISADA -> APROBADA` con firma y despues `APROBADA -> ACTIVA`.
7. Revisar Auditoria/Metadatos: una sola entrada de changelog por import con ACK.
8. Confirmar que no se ejecutaron migraciones ni cambios de Supabase durante la QA.
