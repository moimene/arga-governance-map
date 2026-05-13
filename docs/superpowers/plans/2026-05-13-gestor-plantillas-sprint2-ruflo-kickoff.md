# Sprint 2 Gestor de Plantillas — Kickoff Ruflo adversarial

Fecha: 2026-05-13  
Rama de trabajo: `codex/gestor-plantillas-sprint2-ruflo`  
Baseline: `main` post PR #9 (`042253b fix(secretaria): close template manager sprint 2 debt`)

## Estado de arranque

PR #9 quedó integrado en `main` antes de abrir este sprint. Ese PR cerró la
deuda técnica F1/F2/F3/F4/F5/F6/F7/F11/F12 del Sprint 1.

Ruflo se arrancó con topología `hierarchical-mesh` y se usó con tres carriles
read-only supervisados por Codex:

- Arquitectura/scope: editor tri-capa + configuración por sociedad.
- QA: matriz de tests y smoke gates.
- Revisión adversarial: bloqueantes antes de implementar producto.

Codex mantiene integración, edición final, verificación y protección de
guardrails.

## Findings adversariales incorporados

### P0 corregidos en esta rama

1. `plantilla_changelog.diff_summary` en Cloud es `text`.
   `appendChangelog` ahora serializa el resumen a texto JSON antes de insertar.

2. `plantilla_changelog` tiene `UNIQUE (plantilla_id, to_version)`.
   Como el changelog funciona como event log, `appendChangelog` persiste
   `to_version` como versión lógica + idempotency key, y conserva la versión
   lógica en `diff_summary.logical_to_version`.

3. La idempotencia anterior agrupaba por plantilla + versión + bucket 5s.
   Ahora incluye un discriminador del evento (`motivo + diff_summary`) para que
   dos transiciones distintas dentro del mismo bucket no se deduzcan entre sí.

### P1 corregido en esta rama

El editor inline de contenido (`useUpdateContenidoPlantilla`) escribía directo
en `plantillas_protegidas` sin changelog. Ahora:

- solo permite editar `BORRADOR`;
- hace `UPDATE` + `appendChangelog`;
- registra `CONTENT` con capas tocadas;
- revierte el contenido si falla el changelog;
- invalida `plantillas_protegidas`, métricas y `plantilla_changelog`.

### Decisiones operativas

- La regla operativa vigente es la del Sprint 1: `REVISADA -> APROBADA`
  requiere `aprobada_por` y `fecha_aprobacion`. La nota antigua del spec v2 que
  trataba esos campos como puramente descriptivos queda superseded para el
  Gestor de Plantillas.
- `tipo_social` no se usará para bifurcar plantillas en Sprint 2. La
  configuración por sociedad se apoya en `entity_settings` y en overrides de
  capa 3 por entidad.
- No se corrigen en este sprint los dos P0 legales conocidos
  (`FUSION_ESCISION`, `RATIFICACION_ACTOS`); siguen dependiendo del Comité
  Legal.

## Scope Sprint 2 producto

### Fase 0 — Baseline técnico

- Hotfix changelog + contenido auditado.
- Validar `template-admin`, hooks de import/preflight y hook de contenido.
- Ejecutar `typecheck`, `lint`, `build`.

### Fase 1 — Editor tri-capa en `/secretaria/gestor-plantillas`

Objetivo: sustituir la edición parcial de Capa 1 por una superficie de edición
de BORRADOR con tres capas:

- Capa 1: texto Handlebars con diagnósticos de variables/helpers.
- Capa 2: variables del motor, fuente, condición y duplicados.
- Capa 3: campos editables, obligatoriedad, opciones y defaults.

El editor debe:

- bloquear edición de plantillas no `BORRADOR`;
- guardar con changelog `CONTENT`;
- mostrar diff/dirty state antes de guardar;
- permitir cancelar y restaurar el estado original;
- reutilizar Gate PRE para preview de errores antes de transición.

### Fase 2 — Configuración por sociedad

Objetivo: UI admin sobre tablas existentes:

- `entity_settings_catalog` en lectura;
- `entity_settings` para valores por sociedad.

Scope:

- edición de valores por sociedad;
- controles por `value_type` (`boolean`, `text`, `number`, `enum`);
- agrupación por categoría;
- fallback visual a `default_value` del catálogo;
- sin CRUD del catálogo en esta fase.

### Fase 3 — Overrides Capa 3 por sociedad

Objetivo: UI de overrides granulares sobre
`plantilla_capa3_overrides_por_entidad`:

- default por campo;
- opciones por campo;
- obligatoriedad por campo;
- aviso de compatibilidad si `compatible_with_canonical_version` difiere de la
  versión de la plantilla.

No se muta la plantilla canónica activa.

## QA gates

Fast gate:

```bash
bun test src/lib/secretaria/template-admin/__tests__/ \
  src/hooks/secretaria/__tests__/useImportPlantillaPackage.test.tsx \
  src/hooks/secretaria/__tests__/useTemplatePreflight.test.tsx \
  src/hooks/__tests__/useUpdateContenidoPlantilla.test.tsx
```

Full local gate:

```bash
bun run typecheck
bun run lint
bun run build
```

E2E después de fixture admin:

```bash
PLAYWRIGHT_PORT=5191 bunx playwright test \
  e2e/21-secretaria-gestor-plantillas-tabs.spec.ts \
  e2e/22-secretaria-gestor-import-wizard.spec.ts \
  e2e/24-secretaria-gestor-rbac.spec.ts \
  e2e/20-secretaria-plantillas-overrides.spec.ts \
  --project=chromium
```

## Guardrails

- No migrations.
- No `db push`, RLS, RPC, storage, policies ni tipos generados.
- Antes de cualquier Supabase Cloud write: `bun run db:check-target`.
- No usar service role en cliente.
- No mencionar el nombre real del cliente; ARGA sigue siendo pseudónimo.
- UX Garrigues: solo tokens `var(--g-*)` / `var(--status-*)`, sin hex ni
  Tailwind native colors en módulos Garrigues.

## Backlog no bloqueante

- Fixture `ADMIN_TENANT` para des-skippear E2E happy path.
- Decidir si el importer debe permitir `BORRADOR` replacement cuando ya existe
  una `ACTIVA` con la misma functional key.
- Backfill opcional de changelog para plantillas históricas si Auditoría no
  debe mostrarlas como huérfanas.
