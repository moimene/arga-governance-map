# Secretaría Societaria — Browser UX Smoke

Fecha: 2026-04-29
Herramienta: Browser Use sobre Vite local aislado (`127.0.0.1:5182`)
Alcance: revisión navegable de UX en Secretaría sin cambios de schema ni persistencia.

## Resultado ejecutivo

El módulo carga y navega sin error boundary en las rutas principales. La separación Grupo/Sociedad está visible y el lenguaje probatorio evita llamar "evidencia final productiva" a documentos o bundles operativos.

El principal riesgo para una prueba con usuarios legales no es estabilidad técnica, sino bloqueo de golden paths en modo Sociedad: algunas acciones primarias llevan a estados sin datos o inconsistentes, especialmente convocatoria nueva y tramitador desde certificación.

## Rutas smokeadas

Todas las rutas siguientes cargaron sin error boundary, sin loading bloqueado y sin errores de consola observables durante el smoke:

- `/secretaria`
- `/secretaria/convocatorias`
- `/secretaria/reuniones`
- `/secretaria/actas`
- `/secretaria/tramitador`
- `/secretaria/gestor-plantillas`
- `/secretaria/procesos-grupo`

## Hallazgos UX

### P1 — Dashboard muestra contenido técnico interno en primera pantalla

En `/secretaria`, tanto en Grupo como en Sociedad, el bloque `Sanitización Supabase / Contratos por flujo Secretaría` aparece muy arriba en el dashboard.

Impacto: para usuario legal parece una pantalla de control técnico, no una herramienta de secretaría societaria. Puede romper la comprensión inicial del módulo.

Recomendación: moverlo a un panel admin/debug o a una vista de "Estado técnico", manteniendo en el dashboard solo KPIs y acciones operativas.

### P1 — Sociedad por defecto no es viable para golden path

Al activar modo Sociedad, el sistema seleccionó `ARGA Alemania Versicherung AG`. Desde ahí, el CTA `Nueva convocatoria` llevó a un stepper bloqueado: `No hay órganos registrados para esta sociedad`.

Impacto: la acción primaria de sociedad termina en callejón sin salida en el primer uso.

Recomendación: para demo/hito humano, seleccionar por defecto una sociedad con datos completos, preferiblemente `ARGA Seguros, S.A.`, o validar antes de navegar que la sociedad tiene órganos y expedientes compatibles.

### P1 — Nueva convocatoria sigue sin órgano tras cambiar a ARGA Seguros

Dentro del stepper de nueva convocatoria, al cambiar la sociedad a `ARGA Seguros, S.A.`, el campo de órgano convocante siguió mostrando `No hay órganos registrados para esta sociedad` y el avance quedó deshabilitado.

Impacto: bloquea la creación de convocatoria en la sociedad principal de demo.

Hipótesis: puede ser un problema de recarga del stepper al cambiar `scope/entity`, un filtro de órganos incorrecto o datos demo incompletos para esa query concreta.

Recomendación: revisar el hook/filtro de órganos usados por `ConvocatoriasStepper` y añadir un smoke e2e: seleccionar `ARGA Seguros, S.A.` → `Nueva convocatoria` → órgano disponible → paso siguiente habilitado.

### P1 — Acta firmada no se resuelve correctamente en tramitador

Desde `Actas` en modo Sociedad `ARGA Seguros, S.A.`, una acta firmada mostraba certificación `SIGNED`. Al pulsar `Abrir en tramitador`, el tramitador indicó:

`La certificación contiene acuerdos, pero ninguno está disponible en el ámbito de sociedad actual.`

Además, el botón `Siguiente` estaba habilitado y permitió avanzar al paso 2, donde apareció `Seleccione un acuerdo en el paso anterior`.

Impacto: inconsistencia de flujo. El usuario puede avanzar sin acuerdo seleccionado, y el sistema no explica si el problema es ámbito, datos demo o falta de vínculo Agreement 360.

Recomendación: si no hay acuerdo resoluble en el ámbito, bloquear `Siguiente` y mostrar una acción concreta: volver al acta, regenerar vínculo Agreement 360, o abrir diagnóstico de referencias certificadas.

### P2 — Botones documentales deshabilitados sin razón directa

En el detalle de acta se observaron botones deshabilitados como `Acta DOCX`, `Emitir certificación` y `Certificación DOCX`. La página sí incluye explicación jurídica sobre falta de snapshot legal, pero no queda asociada de forma directa a cada botón.

Impacto: el usuario ve acciones clave bloqueadas sin saber qué requisito operativo falta.

Recomendación: añadir tooltip o texto inline bajo cada acción bloqueada con la causa exacta: falta snapshot legal, falta evidencia operativa, falta acuerdo certificable, etc.

### P2 — Deep link de sociedad muestra estado intermedio genérico

Al navegar directamente a `Actas` con `scope=sociedad&entity=...`, la vista mostró brevemente `Sociedad seleccionada` y `Jurisdicción pendiente` antes de resolver los datos.

Impacto: menor, pero en demo puede parecer que la segregación por sociedad no está completamente cableada.

Recomendación: mantener skeleton contextual o loader específico: `Cargando ARGA Seguros, S.A.` cuando `entity` ya viene en URL.

### P2 — Texto jurisdiccional demasiado amplio para modo Sociedad

En modo Sociedad, la pantalla mantiene claims globales como `LSC/CSC/Lei das SA/LGSM`, incluso cuando la sociedad seleccionada es una entidad alemana.

Impacto: puede confundir al equipo legal porque la lógica aplicable debe explicarse por jurisdicción concreta.

Recomendación: hacer que el copy de modo Sociedad sea contextual: jurisdicción, tipo social, órgano y rule pack aplicable.

## Confirmaciones positivas

- La navegación principal de Secretaría no presentó error boundary.
- El modo Sociedad actualiza sidebar, breadcrumbs y URLs con `scope=sociedad&entity=...`.
- El lenguaje probatorio observado es prudente: `Evidencia operativa pendiente` y no promoción a evidencia final productiva.
- El detalle de acta ya advierte que la certificación requiere snapshot legal por punto para incorporar quórum, mayorías, conflictos, vetos y pactos.

## Data contract

- Tables used: no se han tocado tablas desde esta tanda; solo navegación UI contra estado existente.
- Source of truth: Cloud.
- Migration required: no.
- Types affected: no.
- RLS/RPC/storage affected: no.
- Cross-module contracts: no nuevos.
- Parity risk: bajo para esta tanda; los hallazgos son UX/datos demo/filtros UI.

## Verification

- Browser smoke: ejecutado manualmente con Browser Use.
- db:check-target: no ejecutado en esta tanda; no hubo acceso ni cambio Supabase.
- Typecheck: no ejecutado; no hubo cambio de código.
- Tests: no ejecutados; no hubo cambio de código.
- Build/lint/e2e: no ejecutado; el objetivo fue inspección UX navegable.

## Próximo corte recomendado

1. Corregir `ConvocatoriasStepper` para que `ARGA Seguros, S.A.` tenga órgano convocante resoluble y test e2e.
2. Bloquear avance en `TramitadorStepper` cuando entrada desde certificación no resuelve ningún Agreement 360 en ámbito.
3. Sacar el panel técnico de sanitización del dashboard de usuario legal.
4. Añadir razones de bloqueo en acciones documentales/certificación.

## Tanda de corrección P1 — 2026-04-29

Cambios aplicados:

- `ConvocatoriasStepper`: distingue carga/error/entidad inválida/resultado vacío al resolver órganos. El selector de órgano ya no muestra `No hay órganos` mientras la query sigue pendiente y no permite avanzar con entidad u órgano no resueltos.
- `TramitadorStepper`: el paso 1 exige un acuerdo visible y seleccionado antes de permitir `Siguiente`; si la certificación no resuelve acuerdos dentro del ámbito de sociedad, el avance queda bloqueado.
- `Dashboard`: el panel técnico `Sanitización Supabase / Contratos por flujo Secretaría` se conserva para trazabilidad, pero se desplaza debajo de KPIs operativos y métricas cross-module.
- `e2e/13-secretaria-lote2-qa.spec.ts`: añade regresión para órgano resoluble en convocatoria de sociedad y bloqueo de `Siguiente` en tramitador sin acuerdo.

Verificación:

- `bun run db:check-target`: OK contra `governance_OS`.
- `bun test src/lib/secretaria/__tests__/sanitized-flow-contracts.test.ts`: 4/4 OK.
- `bunx tsc --noEmit --pretty false`: OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5182 bunx playwright test e2e/13-secretaria-lote2-qa.spec.ts --project=chromium`: 4/4 OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5182 bunx playwright test e2e/12-secretaria-navigation.spec.ts --project=chromium`: 4/4 OK.
- `bun run build`: OK, con warnings conocidos de Browserslist/chunk-size.
- Browser Use smoke: OK. `ARGA Seguros, S.A.` muestra `Consejo de Administración`; tramitador mantiene `Siguiente` deshabilitado sin acuerdo; el panel técnico queda después de KPIs.

Pendiente:

- Añadir razones de bloqueo por botón en `ActaDetalle` y certificaciones DOCX.
- Revisar la navegación lateral de `StepperShell`: hoy permite saltar a pasos futuros aunque el botón `Siguiente` esté bloqueado. No se ha cambiado en esta tanda para evitar impacto transversal.

## Tanda de corrección P2 — 2026-04-29

Cambios aplicados:

- `StepperShell`: los pasos futuros quedan deshabilitados si existe un paso anterior con `canAdvance === false`; si el usuario queda en un paso posterior tras un cambio de estado, el shell vuelve al primer paso bloqueante.
- `ProcessDocxButton`: admite `disabledReason`, muestra causa visible bajo el botón y evita presentar carga o generación como acción disponible cuando falta un requisito.
- `EmitirCertificacionButton`: muestra causa visible cuando no hay acuerdos proclamables o cuando el padre declara un bloqueo documental/legal; mantiene lenguaje de bundle operativo demo.
- `ConvocatoriaDetalle`: completa variables documentales requeridas por plantillas Cloud/PRE para convocatoria e informe PRE, incluyendo placeholders demo explícitos para snapshot, timestamp y firma QES productiva pendiente.
- `e2e/13-secretaria-lote2-qa.spec.ts`: añade regresión de navegación lateral bloqueada en tramitador sin acuerdo.
- `e2e/14-secretaria-documentos.spec.ts`: cubre captura Capa 3 en generación DOCX, descarga de convocatoria/informe PRE y razones visibles de bloqueo en acta/certificación.

Verificación:

- `bun run db:check-target`: OK contra `governance_OS`.
- `bunx tsc --noEmit --pretty false`: OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5182 bunx playwright test e2e/13-secretaria-lote2-qa.spec.ts --project=chromium`: 4/4 OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5182 bunx playwright test e2e/14-secretaria-documentos.spec.ts --project=chromium`: 6/6 OK.
- `bun run build`: OK, con warnings conocidos de Browserslist/chunk-size.
- Browser Use smoke: OK. En `Tramitador registral` sin acuerdos disponibles, los pasos 2-5 y `Siguiente` aparecen deshabilitados.

Data contract:

- Tables used: `governing_bodies`, `agreements`, `certifications`, `plantillas_protegidas`, `convocatorias.rule_trace`, `convocatorias.reminders_trace`, `convocatorias.accepted_warnings`.
- Source of truth: Cloud.
- Migration required: no.
- Types affected: no.
- RLS/RPC/storage affected: no.
- Cross-module contracts: no nuevos.
- Parity risk: bajo-medio; las plantillas Cloud/PRE quedan cubiertas por variables actuales, pero el equipo legal puede ampliar variables obligatorias en Cloud.

## Documentation and memory

- Project docs updated: `docs/superpowers/plans/2026-04-29-secretaria-browser-ux-smoke.md`
- Memory key: `patterns/secretaria-browser-ux-smoke-golden-path-blockers`
- Stable lesson recorded: yes
- No secrets stored: yes
