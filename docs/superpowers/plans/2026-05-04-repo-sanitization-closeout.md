# Repo Sanitization Closeout — UX Workbench + Secretaría Journeys

Fecha: 2026-05-04  
Worktree operativo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Rama: `main`

## Objetivo

Convertir las dos campañas recientes en un estado de repo verificable: cambios activos, pruebas no destructivas, gaps funcionales documentados y commits separados por familia. No se aplican migraciones ni cambios de schema.

## Clasificación de cambios

### Activo y verificable

- TGMS Console, Governance Map, Documentación y SII: reorganización workbench, lenguaje más explicable y responsive.
- GRC Compass: dashboard/listas principales con prioridad de trabajo, móvil con cards y desktop con tablas densas pero legibles.
- AIMS / AI Governance: dashboard, sistemas, incidentes y evaluaciones con patrón workbench y navegación no dependiente del shell TGMS.
- Secretaría: sociedades, personas, libros, plantillas, actas, convocatoria y tramitador con copy de frontera demo/Registro saneada.

### Tests activos no destructivos

- `e2e/20-console-responsive.spec.ts`
- `e2e/21-secretaria-responsive.spec.ts`
- `e2e/22-grc-workbench-responsive.spec.ts`
- `e2e/23-aims-workbench-responsive.spec.ts`
- `e2e/24-core-ux-workbench.spec.ts`
- `e2e/10-grc.spec.ts`
- `e2e/16-sanitization-smoke.spec.ts`
- `e2e/25-secretaria-epic-journeys.spec.ts`, con `fn_cerrar_votaciones_vencidas` stubeada para evitar writes de housekeeping.

### Cuarentena funcional

- Journeys mutantes completos de Secretaría: reunión con asistentes/votos, transmisión de participaciones y generación/emisión documental deben esperar fixtures aisladas o RPCs transaccionales aprobadas.
- `/grc/m/*`: queda como P1 para responsive pass propio del nested module shell.

## Gaps que no se corrigen con hacks

### P0 — Registro de socios / movimientos de capital

Necesita operación transaccional aprobada para cerrar origen, crear destino/remanente, escribir `capital_movements`, enlazar documentación soporte y devolver impacto en capital/voto. Sin esa pieza, la UI solo puede demostrar preparación y lectura.

### P1 — Reuniones con censo, delegación y voto por punto

Necesita fixture aislada o harness test-only para no mutar demo Cloud compartida. La cobertura actual valida navegación y frontera, no creación end-to-end destructiva.

### P1 — SL/cotizada con canales diferenciados

Necesita dataset estable para validar notificación individual, publicación pública y voto a distancia sin depender de datos vivos.

### P1 — Evidence / Registro productivo

El sistema termina en `PROMOTED` o preparado para Registro. No prueba envío real al Registro Mercantil ni evidencia final productiva.

## Reglas de saneamiento aplicadas

- No introducir `MAPFRE` en `src`, `e2e` ni `supabase`.
- No tocar Supabase schema, RLS, RPC, storage ni types.
- Ningún E2E activo debe ejecutar writes conocidos en Cloud demo compartida.
- Toda brecha funcional queda como requisito con tabla/RPC/fixture necesario.
- Commits por familia para mantener bisectabilidad.

