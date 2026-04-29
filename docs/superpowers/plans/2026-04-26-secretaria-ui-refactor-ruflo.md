# 2026-04-26 — Proceso Ruflo: refactor UX/UI Secretaría Societaria

## Objetivo

Refactorizar la UX del módulo `/secretaria` para que funcione como una mesa de trabajo del departamento legal, no como un inventario de tablas. El nuevo modelo debe separar claramente:

- **Modo Grupo**: coordinación, reporting, campañas recurrentes y procesos multi-sociedad.
- **Modo Sociedad**: trabajo operativo de una sociedad concreta: órganos, personas, cargos, libros, convocatorias, reuniones, actas, certificaciones, acuerdos, reglas y plantillas aplicables.

## Estado Ruflo

- Swarm iniciado desde CLI Ruflo con objetivo:
  `Refactor Secretaria UI around legal user journeys: Grupo vs Sociedad modes, society-scoped navigation/data, recurrent group workflows such as formulacion cuentas del grupo, and verified UX/e2e gates`.
- Swarm reportado por Ruflo: `swarm-mofeyydc`.
- Slots previstos por Ruflo: coordinator, researcher, architect, 2 coders, tester, reviewer.
- Limitación detectada: MCP Ruflo devolvió `Transport closed`; la CLI está disponible, pero `task list` no refleja los tasks creados aunque `task create` devuelve IDs. Este plan es la fuente canónica de coordinación hasta que se estabilice Ruflo.

### Reanudación dirigida por Codex — 2026-04-26

`bun run agents:swarm:status` informa `no-active-swarm`. `bun run agents:route` ha derivado el bloque pendiente a `Reviewer` con baja confianza, por lo que la coordinación queda en modo dirigido por Codex con subagentes acotados:

| Agente | Tipo | Scope | Escritura |
|---|---|---|---|
| Cicero | worker | Convocatorias: recordatorios de canales legales no bloqueantes | `src/pages/secretaria/ConvocatoriasStepper.tsx`, opcional `e2e/04-secretaria-convocatorias.spec.ts` |
| Dewey | explorer | Gap analysis Reuniones v2: asistentes, capital/voto, quorum, mayorías, pactos, acta | Sin escritura |
| Halley | explorer | Gap analysis mantenimiento de reglas: lifecycle, snapshots, overrides, tests, UI legal | Sin escritura |

Decisión vigente: en **Convocatoria** los requisitos legales/documentales/canales/plazo son recordatorios y alertas, no bloqueos, porque la convocatoria puede ejecutarse fuera del sistema. Los steppers posteriores pueden mantener bloqueos cuando afecten constitución, proclamación, certificación, permisos o evidencia final.

## Principios UX

1. **El usuario empieza por ámbito**, no por feature: Grupo o Sociedad.
2. **La sociedad seleccionada filtra menú, datos y acciones**.
3. **El modo Grupo lanza procesos recurrentes**, no solo dashboards.
4. **La unidad de trabajo legal es el expediente**, no la tabla.
5. **Cada pantalla debe responder “qué tengo que hacer ahora”**.
6. **Conservar rutas demo existentes**, añadiendo redirecciones/compatibilidad donde sea necesario.
7. **Cumplir tokens Garrigues**: sin colores Tailwind nativos ni hex en componentes `/secretaria`.

## Workstreams

### WS1 — Research UX legal

Responsable Ruflo sugerido: researcher.

Entregables:
- Mapa de navegación actual `/secretaria`.
- Jobs-to-be-done por perfiles: Secretaría General, asesor legal, paralegal, socio/administrador, auditor.
- Inventario de fricción: menú, naming, estados, pasos, CTAs, tablas, empty states.
- Propuesta de IA Grupo/Sociedad.

### WS2 — Arquitectura de ámbito

Responsable Ruflo sugerido: architect.

Entregables:
- Contrato `SecretariaScope`: `{ mode: "grupo" | "sociedad"; entityId?: string }`.
- Estrategia de persistencia: URL query `?entity=...`, localStorage o contexto React.
- Reglas de navegación:
  - Grupo: `/secretaria/grupo/*` o `/secretaria?scope=grupo`.
  - Sociedad: `/secretaria/sociedades/:id/*` como home operativa o `/secretaria?entity=:id`.
- Backward compatibility para rutas existentes: `/secretaria/convocatorias`, `/secretaria/reuniones`, etc.

### WS3 — Shell Secretaría v2

Responsable Ruflo sugerido: coder A.

Write scope propuesto:
- `src/pages/secretaria/SecretariaLayout.tsx`
- nuevos componentes en `src/components/secretaria/shell/*`
- posible contexto `src/context/SecretariaScopeContext.tsx`

Entregables:
- Selector persistente Grupo/Sociedad.
- Sidebar agrupado según modo.
- Header contextual con sociedad seleccionada.
- Breadcrumb real: `Secretaría > ARGA Seguros S.A. > Convocatorias`.
- Estado vacío cuando no hay sociedad seleccionada en vistas societarias.

### WS4 — Data scoping por sociedad

Responsable Ruflo sugerido: coder B.

Write scope propuesto:
- hooks de Secretaría y páginas de listas.

Entregables:
- Filtros por `entity_id` en convocatorias, reuniones, actas, acuerdos, tramitador, libros, personas, capital y plantillas aplicables.
- Vistas grupo agregadas que no mezclen accidentalmente datos de sociedades cuando el usuario está en modo sociedad.
- Tests de no regresión Supabase 4xx/5xx.

### WS5 — Flujos recurrentes de Grupo

Responsable Ruflo sugerido: architect + coder B.

Caso inicial:
- **Formular cuentas del grupo**.

Entregables:
- Modelo funcional parametrizable:
  - `flow_templates`
  - `flow_template_steps`
  - `flow_runs`
  - `flow_run_tasks`
  - `flow_run_entities`
- UI inicial de campañas recurrentes en modo Grupo.
- Parametrización mínima: ejercicio, sociedades incluidas, órgano responsable, hitos, documentos requeridos, firma QES, evidencia WORM, recordatorios.
- Integración posterior con expedientes, convocatorias, reuniones, actas y tramitador.

### WS6 — Testing y review

Responsable Ruflo sugerido: tester + reviewer.

Entregables:
- E2E: entra en modo Grupo, selecciona sociedad, valida menú y datos filtrados.
- E2E: flujo recurrente Grupo crea una ejecución demo de formulación de cuentas.
- E2E: smoke de navegación existente sigue pasando.
- Revisión UX Garrigues: tokens, foco visible, labels, responsive, no texto truncado crítico.
- Revisión legal: no introducir `MAPFRE`, mantener ARGA y EAD Trust como QTSP único.

## Fases de implementación

### Fase 0 — Diseño y contrato

- Crear `SecretariaScopeContext`.
- Definir estructura de menú por modo.
- Definir naming final de navegación para usuario legal.
- Validación manual con navegador.

Gate:
- No cambios de datos.
- `bunx tsc --noEmit`.

### Fase 1 — Shell v2 sin alterar datos

- Añadir selector Grupo/Sociedad.
- Sidebar dinámico.
- Header contextual.
- Mantener rutas existentes y comportamiento actual.

Gate:
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/12-secretaria-navigation.spec.ts --reporter=list`.
- Sin errores consola Supabase.

### Fase 2 — Vistas filtradas por sociedad

- Aplicar `entityId` a listas y hooks.
- Convertir `SociedadDetalle` en home operativa.
- Crear rutas/links contextuales desde la sociedad a sus procesos.

Gate:
- Tests e2e de modo sociedad.
- Smoke de Sociedades, Personas, Convocatorias, Reuniones, Actas, Libros.

### Fase 3 — Modo Grupo operativo

- Nueva vista `Flujos recurrentes`.
- Primer template: `Formular cuentas del grupo`.
- Crear ejecución demo parametrizable.

Gate:
- E2E de campaña recurrente.
- Revisión legal de nomenclatura y estados.

### Fase 4 — Expediente societario

- Vista única que une convocatoria, reunión, acuerdos, acta, certificación, registro y archivo.
- Reducir saltos entre pantallas.

Gate:
- Smoke golden path de expediente.
- `bun run build`.

## Riesgos

- Muchas páginas asumen `tenantId` global y no `entityId`.
- Algunas relaciones no exponen `entity_id` directamente; pueden requerir join por `body_id`, `meeting_id` o `agreement_id`.
- Las plantillas pueden ser globales, jurisdiccionales o societarias; hay que definir precedencia.
- El flujo recurrente puede requerir migraciones si se implementa persistencia real.

## Decisión recomendada

Empezar por **Fase 1**. Es el mejor primer corte: mejora comprensión sin tocar schema ni lógica legal profunda.
