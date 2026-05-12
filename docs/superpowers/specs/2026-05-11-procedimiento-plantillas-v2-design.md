# PROCEDIMIENTO_PLANTILLAS v2 — design spec

**Versión:** v2.0 (diseño)
**Fecha:** 2026-05-11
**Estado:** Diseño cerrado pendiente de aprobación final del usuario antes de pasar a plan de implementación.
**Autor del diseño:** sesión colaborativa operador del catálogo + Claude (brainstorming-skill).
**Relación con v1:** v1 (`2026-05-10-procedimiento-plantillas-v1.md`) sigue siendo la guía operativa vigente para naming conventions, helpers Handlebars permitidos, citas legales, identidad demo, versionado semver, schema capa3, SQL idempotente y validación post-aplicación con JSONB operators. v2 **no reemplaza nada de eso** — añade dos capacidades nuevas:
1. **Adaptación por sociedad** (overrides + settings + bloques sectoriales)
2. **Gobernanza por catálogo** (eliminación de la firma legal bloqueante por plantilla)

Cualquier procedimiento operativo de v1 sigue aplicando salvo lo expresamente reemplazado en §2 de este spec.

---

## 0. TL;DR

v2 introduce **adaptación por sociedad** sobre el catálogo canónico de plantillas firmadas en v1, manteniendo `capa1_inmutable` intacta y respetando la premisa de *composer con edición humana final*. La arquitectura cubre el 90% de adaptaciones con 4 mecanismos complementarios sin merge runtime de Handlebars:

1. **Parámetros normativos** (40% de casos) → ya cubiertos por `rule_param_overrides` (statu quo, no cambia).
2. **Defaults y opciones de capa3** (25%) → tabla nueva `plantilla_capa3_overrides_por_entidad`.
3. **Bloques condicionales `{{#if (eq ENTIDAD.<key> ...)}}` en capa1** (15%) → tabla `entity_settings` con catálogo cerrado.
4. **Cargos y firmantes textuales** (10%) → mismo mecanismo que (3) — claves `cargo_*_label` en `entity_settings`.
5. **Texto sectorial extenso** (8%) → biblioteca `bloques_sectoriales` + UI de sugerencia + auditoría WORM en `bloque_insertions`.
6. **Multi-jurisdicción (2%) → OUT OF SCOPE de v2.** Se pospone a v3 con motor LSC por jurisdicción y abogados locales.

**Cambio fundacional:** se elimina la firma legal bloqueante por plantilla. La gobernanza pasa a ser **por catálogo** (Comité Legal aprueba el conjunto + reglas de composición), con trazabilidad en `plantilla_changelog`.

---

## 1. Contexto y motivación

### 1.1 Estado al cierre de v1 (2026-05-10)

Tras los lotes B2.1 → B9 el catálogo `plantillas_protegidas` está consolidado:

- 41 plantillas ACTIVA + 35 ARCHIVADA en tenant demo
- 100% firmadas por "Comité Legal ARGA — Secretaría Societaria (demo-operativo)"
- 39 materias activas, 0 helpers prohibidos, 0 referencias a Ley 3/2009 derogada
- Estructura tri-capa: `capa1_inmutable` + `capa2_variables` + `capa3_editables`
- Variables resueltas via `src/lib/doc-gen/variable-resolver.ts` desde 8 fuentes (ENTIDAD, ORGANO, REUNION, EXPEDIENTE, CAP_TABLE, MOTOR, SISTEMA, USUARIO)

### 1.2 Lo que v1 no cubre

El catálogo es **único para todo el tenant**. Una vez que el grupo ARGA (1 holding + N sociedades operativas con tipos sociales distintos SA/SL/SLU y sectores regulatorios distintos) necesita personalizar plantillas por sociedad, v1 no ofrece mecanismo. Hoy la única vía es duplicar la plantilla en `plantillas_protegidas` o tolerar que el secretario edite manualmente el borrador generado.

### 1.3 Lo que sí cubre el statu quo

`rule_param_overrides(tenant_id, entity_id, materia, clave, valor, fuente)` ya está en producción desde Sprint B + Motor v2.1. Cubre adaptación de **parámetros normativos** (quórum, mayorías, antelación, capital mínimo, vetos de pactos parasociales). El motor LSC lo consume vía `compliance_snapshot` que se inyecta en el resolver MOTOR.

Esto significa que el 40% de casos de adaptación por sociedad **ya funciona hoy** sin que el operador lo perciba. v2 reformula la pregunta: **¿qué adaptación por sociedad necesitamos que NO cubra ya `rule_param_overrides`?**

### 1.4 Premisa de diseño

El sistema es un **composer de acuerdos con edición humana final**. No necesita cubrir el 100% de la casuística — necesita facilitar el 80% de los borradores para que el secretario edite lo mínimo. Cada mecanismo del diseño se optimiza para reducir tiempo de edición humana, no para automatizar generación 100%.

---

## 2. Cambio fundacional: gobernanza por catálogo (eliminar firma legal bloqueante)

### 2.1 Modelo v1 (eliminado)

Cada plantilla ACTIVA requería `aprobada_por` con identidad del firmante (Comité Legal). Cualquier modificación a `capa1_inmutable` exigía:
- Nueva versión semver (patch/minor/major)
- Nueva firma legal del Comité (`fecha_aprobacion`, identidad)
- Ciclo Harvey AI ↔ revisor legal humano de 2-4 semanas por plantilla

Esto hacía **inmanejable** la corrección iterativa y la evolución del catálogo. La introducción de `{{ENTIDAD.cargo_secretario_label}}` en lugar de "Secretario del Consejo" en una sola plantilla (refactor técnico trivial) requería ciclo legal completo.

### 2.2 Modelo v2 (vigente)

Se adopta **gobernanza por catálogo**:
- El Comité Legal aprueba el **catálogo de plantillas** (conjunto + reglas de composición + bloques sectoriales) en revisiones periódicas, no por bump individual.
- Cada cambio a plantilla queda registrado en `plantilla_changelog` con `autor`, `timestamp`, `motivo`, `bump_type`, `diff_summary`.
- `plantillas_protegidas.aprobada_por` se mantiene como **campo descriptivo opcional** (ya es nullable hoy) — sin gate, sin validación, sin bloqueo.
- La trazabilidad legal se preserva: cualquier auditor puede reconstruir el historial completo de una plantilla desde `plantilla_changelog`.

### 2.3 Implicaciones operativas

- **F2 desbloqueado**: migración progresiva de las 41 plantillas canónicas para introducir `{{ENTIDAD.<key>}}` deja de ser sub-proyecto Harvey. Pasa a refactor técnico con PR + changelog. Coste por plantilla: ~30 minutos en lugar de 2-4 semanas.
- **F3 desbloqueado**: bumps de versión no requieren ciclo legal — pueden ser frecuentes.
- **Promoción de bloque sectorial → condicional canónico** deja de ser cuello de botella.
- **Riesgo asumido**: la responsabilidad jurídica se traslada del firmante individual al proceso de PR review. El equipo Secretaría Societaria + revisor técnico son responsables de la corrección legal de cada cambio.

### 2.4 Schema impact

Una sola tabla nueva (`plantilla_changelog`) y la decisión de no añadir constraints sobre `aprobada_por`. Sin migraciones de datos retroactivas — las 41 plantillas existentes mantienen su `aprobada_por` actual como información histórica.

---

## 3. Arquitectura del sistema de overrides

### 3.1 Diagrama lógico

```
                         ┌──────────────────────────────────────┐
                         │ plantillas_protegidas (canónica)     │
                         │   capa1_inmutable                    │
                         │   capa2_variables                    │
                         │   capa3_editables                    │
                         └──────────────────────────────────────┘
                                          │
                                          │
              ┌───────────────────┬───────┴────────┬─────────────────────┐
              ▼                   ▼                ▼                     ▼
       rule_param_           entity_              plantilla_           bloques_
       overrides            settings           capa3_overrides       sectoriales
       (motor LSC)        (capa1 if/else)        (capa3 UI)        (sugerencia UI)
              │                   │                │                     │
              ▼                   ▼                ▼                     ▼
       MOTOR.* en           ENTIDAD.* en       Default + opciones    Panel lateral
       resolver             resolver           del form              composer
              │                   │                │                     │
              └───────────────────┴────────┬───────┴─────────────────────┘
                                           │
                                           ▼
                                  Documento generado
                                  + auditoría WORM
```

### 3.2 Mecanismos por categoría

| Cat. | Frecuencia | Mecanismo | Tabla(s) involucrada(s) |
|---|---|---|---|
| 1. Parámetros normativos | 40% | `rule_param_overrides` (statu quo) | `rule_param_overrides`, `rule_pack_versions` |
| 2. Defaults/opciones capa3 | 25% | Overrides granulares por campo | `plantilla_capa3_overrides_por_entidad` |
| 3. Condicionales capa1 | 15% | Settings por entidad + Handlebars | `entity_settings_catalog`, `entity_settings` |
| 4. Cargos textuales | 10% | Mismo que (3), claves `cargo_*_label` | `entity_settings_catalog`, `entity_settings` |
| 5. Texto sectorial | 8% | Biblioteca + sugerencia + WORM | `bloques_sectoriales`, `bloque_insertions` |
| 6. Multi-jurisdicción | 2% | **OUT OF SCOPE v2** | Pospuesto a v3 |

### 3.3 Principios invariantes

- **`capa1_inmutable` nunca se sobrescribe en runtime.** Se introducen condicionales Handlebars dentro de la canónica que activan/desactivan bloques pre-aprobados. Todo el texto que aparece en el documento generado está en la canónica.
- **No fork de plantillas por sociedad.** Una sociedad consume la plantilla canónica + overrides; nunca tiene una copia.
- **Catálogo único de claves semánticas.** `entity_settings_catalog` es global y actúa como esquema validador. Las plantillas referencian `{{ENTIDAD.<key>}}` con `key ∈ entity_settings_catalog`.
- **Auditoría WORM para insercciones de bloques sectoriales.** Cualquier inserción de bloque queda registrada con copia literal del texto al momento de inserción.

### 3.4 Política de evolución del catálogo

`entity_settings_catalog` es una tabla viva (puede crecer en v2.1+) y necesita protocolo de evolución para no romper datos existentes:

- **Añadir clave nueva**: trivial. INSERT en catalog + opcional `default_value`. Las plantillas pueden empezar a referenciar `{{ENTIDAD.<nueva_key>}}` en bumps siguientes.
- **Cambiar `descripcion`, `categoria`, `usado_por_plantillas`**: trivial. UPDATE directo. No afecta datos en `entity_settings`.
- **Cambiar `value_type`** (ej. `text` → `enum` con `allowed_values`): **breaking change**. Procedimiento obligatorio:
  1. Crear clave nueva con sufijo `_v2` (ej. `sector_regulado_v2`) y `value_type` nuevo
  2. Backfill: script de migración que lee `entity_settings` con la clave antigua, transforma valores, INSERT en clave nueva
  3. Actualizar plantillas canónicas para referenciar la clave nueva (bump capa1)
  4. Marcar clave antigua como ARCHIVADA (añadir columna `estado_catalog ∈ {ACTIVA, ARCHIVADA}` en T1; las claves ARCHIVADA siguen leyéndose pero no se sugieren en página admin)
  5. Tras periodo de gracia (>1 sprint), DELETE de filas `entity_settings` con clave antigua
- **Cambiar `allowed_values`** de un enum (añadir): trivial. UPDATE catalog. Valores existentes siguen válidos.
- **Cambiar `allowed_values` de un enum (eliminar)**: requiere validar que ninguna entidad tenga valor en lo eliminado. Si las hay, migrar primero.
- **Cambiar `default_value`**: cambia el comportamiento para entidades sin override. Documentar en `plantilla_changelog` (no es cambio de plantilla, pero sí afecta render).
- **Eliminar clave**: solo si tiene `estado_catalog='ARCHIVADA'` y 0 filas en `entity_settings`. FK ON DELETE RESTRICT lo garantiza.

**Impacto schema:** añadir columna `estado_catalog text NOT NULL DEFAULT 'ACTIVA' CHECK ∈ {'ACTIVA', 'ARCHIVADA'}` en T1. Documentado en §4.1 T1.

---

## 4. Modelo de datos — DDL alto nivel

### 4.1 Tablas nuevas (6 en total)

#### T1 — `entity_settings_catalog` (global, registro maestro)

Propósito: vocabulario semántico cerrado de las claves que una sociedad puede tener en `entity_settings`. Actúa como esquema validador via FK.

| Columna | Tipo | Constraints | Propósito |
|---|---|---|---|
| `key` | text | PK | Identificador snake_case (`cargo_secretario_label`, `es_cotizada`, `sector_regulado`) |
| `value_type` | text | NOT NULL, CHECK ∈ {`'boolean'`, `'text'`, `'enum'`, `'number'`} | Tipo del valor en `entity_settings.value` |
| `allowed_values` | jsonb | NULL salvo `value_type='enum'` | Array de valores permitidos cuando enum |
| `default_value` | jsonb | NULLABLE | Valor canónico cuando la sociedad no tiene override (resolver lo aplica como fallback) |
| `descripcion` | text | NOT NULL | Para qué sirve la clave (auditoría humana) |
| `categoria` | text | NOT NULL, CHECK ∈ {`'CARGO'`, `'CONFIG_CONDICIONAL'`, `'PERFIL_SOCIETARIO'`, `'PERFIL_SECTORIAL'`} | Agrupación lógica |
| `usado_por_plantillas` | text[] | NULLABLE | Materias que consumen esta clave — informativo, no constraint. Reconstruido por CI script (§11.6). |
| `estado_catalog` | text | NOT NULL DEFAULT 'ACTIVA', CHECK ∈ {`'ACTIVA'`, `'ARCHIVADA'`} | Lifecycle de la clave (§3.4 política de evolución) |
| `created_at` | timestamptz | DEFAULT now() | |

**RLS:** lectura pública (catálogo es metadata global compartida), escritura restringida a rol `ADMIN_TENANT` via página admin (§5.4) o via migración SQL.

**Decisión A confirmada**: global. No tenant_id.

**Validación cruzada (trigger BEFORE INSERT/UPDATE):**
- `value_type='enum'` → `allowed_values IS NOT NULL AND jsonb_typeof(allowed_values)='array'`
- Si `default_value` no es NULL y `value_type='enum'` → `default_value ∈ allowed_values`
- Para claves de tipo `text` referenciadas en `capa1_inmutable` de alguna plantilla ACTIVA: `default_value` no puede ser NULL (regla operativa garantizada por CI script `audit-entity-settings-keys.ts`, no por trigger — el catálogo puede tener `default_value` NULL para claves opcionales no usadas en capa1).
- DELETE solo si `estado_catalog='ARCHIVADA'` Y no existen filas en `entity_settings` con esa key (FK ON DELETE RESTRICT lo garantiza).

#### T2 — `entity_settings` (tenant-scoped, valores por sociedad)

| Columna | Tipo | Constraints | Propósito |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `tenant_id` | uuid | NOT NULL, FK→tenants | Aislamiento RLS |
| `entity_id` | uuid | NOT NULL, FK→entities | Sociedad a la que aplica el setting |
| `key` | text | NOT NULL, FK→entity_settings_catalog(key) ON DELETE RESTRICT | **F1: catálogo cerrado garantizado** |
| `value` | jsonb | NOT NULL | Valor (validado vs `value_type` del catalog) |
| `created_at` | timestamptz | DEFAULT now() | |
| `updated_at` | timestamptz | NULLABLE | |
| `updated_by` | uuid | NULLABLE | Trazabilidad del autor del cambio |

**Constraints:**
- UNIQUE `(entity_id, key)` — una sociedad tiene UN valor por clave
- FK a `entity_settings_catalog(key)` ON DELETE RESTRICT — impide borrar claves del catálogo si están en uso

**Trigger validador (BEFORE INSERT/UPDATE):** comprueba `value` contra `value_type` del catalog:
- `boolean` → `jsonb_typeof(value)='boolean'`
- `text` → `jsonb_typeof(value)='string'`
- `number` → `jsonb_typeof(value)='number'`
- `enum` → `value ∈ allowed_values del catalog`

**RLS:** tenant_id scoping estándar.

#### T3 — `plantilla_capa3_overrides_por_entidad` (tenant-scoped, granular)

Propósito: defaults UI por sociedad sobre campos editables de capa3. No toca capa1.

**Decisión C confirmada**: granular por campo (un row por campo override).

| Columna | Tipo | Constraints | Propósito |
|---|---|---|---|
| `id` | uuid | PK | |
| `tenant_id` | uuid | NOT NULL, FK→tenants | |
| `entity_id` | uuid | NOT NULL, FK→entities | |
| `plantilla_id` | uuid | NOT NULL, FK→plantillas_protegidas | |
| `campo` | text | NOT NULL | Nombre del campo capa3 (validado contra `capa3_editables[].campo`) |
| `default_value_override` | jsonb | NULLABLE | Nuevo default. NULL = no override |
| `opciones_override` | jsonb | NULLABLE | Array de opciones permitidas para selectores. NULL = no override |
| `obligatoriedad_override` | text | NULLABLE, CHECK ∈ {`'OBLIGATORIO'`, `'RECOMENDADO'`, `'OPCIONAL'`} | NULL = mantener canónico |
| `compatible_with_canonical_version` | text | NOT NULL | Versión canónica contra la que se validó este override (F3) |
| `motivo` | text | NOT NULL | Justificación humana (auditoría) |
| `created_at` | timestamptz | DEFAULT now() | |
| `created_by` | uuid | NULLABLE | |

**Constraints:**
- UNIQUE `(entity_id, plantilla_id, campo)` — un override por campo por sociedad
- CHECK: al menos UNO de `default_value_override` / `opciones_override` / `obligatoriedad_override` no es NULL (row sin overrides es inválido)
- CHECK `length(motivo) >= 10` — fuerza justificación significativa (R3 reforzado a nivel BD, no solo UI)

**Trigger validador:**
- `opciones_override = []` (array vacío) → REJECT (F5: sociedad sin opciones rompe UI)
- Si `default_value_override` no NULL Y `opciones_override` no NULL → `default_value_override ∈ opciones_override` o REJECT
- `campo` debe existir en `plantillas_protegidas.capa3_editables[].campo` para el `plantilla_id` referenciado. Implementación con función PL/pgSQL helper que usa `jsonb_path_exists($capa3_editables, '$[*] ? (@.campo == $campo_param)')`. La validación ocurre en INSERT y UPDATE.
- `plantillas_protegidas.estado` debe ser `'ACTIVA'` para el `plantilla_id` referenciado (R11: no overrides para plantillas ARCHIVADA o BORRADOR).

**RLS:** tenant_id scoping estándar.

#### T4 — `bloques_sectoriales` (global, biblioteca pre-aprobada)

Propósito: texto pre-redactado para perfiles regulatorios específicos (banca, seguros, energía, cotizadas, EIP, etc.). No embebido en plantillas canónicas — se sugiere al composer y se inserta como copia literal en capa3.

**Decisión B confirmada**: global. Sin tenant_id en v2.0. Campo `visibilidad` reservado para extensión futura (v2.2+).

| Columna | Tipo | Constraints | Propósito |
|---|---|---|---|
| `id` | uuid | PK | |
| `clave_bloque` | text | NOT NULL | Identificador snake_case (`BANCA_IDONEIDAD_CRR`, `CNMC_AUTORIZACION_ENERGIA`) |
| `version` | text | NOT NULL | semver del bloque |
| `sector` | text | NOT NULL, CHECK ∈ {`'BANCA'`, `'SEGUROS'`, `'ENERGIA'`, `'FARMA'`, `'COTIZADAS'`, `'EIP'`, `'INMOBILIARIO'`, `'PUBLICO_PRIVADO'`, `'MERCADO_VALORES'`, `'GENERICO'`} | Perfil regulatorio |
| `materia_aplicable` | text[] | NOT NULL | Materias compatibles (ej. `['NOMBRAMIENTO_CONSEJERO', 'COMITES_INTERNOS']`) |
| `texto_aprobado` | text | NOT NULL | Texto literal pre-redactado |
| `referencia_legal` | text | NULLABLE | Citas concretas (Reglamento UE 575/2013, etc.) |
| `descripcion` | text | NULLABLE | Para qué sirve (auditoría humana) |
| `aprobada_por` | text | NULLABLE | Opcional descriptivo, no gate (consistente con §2) |
| `estado` | text | NOT NULL, CHECK ∈ {`'ACTIVA'`, `'ARCHIVADA'`} | Lifecycle |
| `created_at` | timestamptz | DEFAULT now() | |

**Constraints:**
- UNIQUE `(clave_bloque, version)` — múltiples versiones del mismo bloque coexisten
- INDEX sobre `(sector, estado)` para sugerencia rápida en composer

**Soft-delete only (R5 reforzado):**
- DELETE físico de filas en `bloques_sectoriales` está prohibido. Trigger BEFORE DELETE rechaza la operación con excepción.
- Para "eliminar" un bloque: cambiar `estado` a `'ARCHIVADA'` (UPDATE).
- Cambios a `texto_aprobado` cuando `estado='ACTIVA'` están prohibidos. Trigger BEFORE UPDATE rechaza si el campo cambia. Para corregir un bloque: ARCHIVAR la versión actual + INSERT nueva versión con bump semver.
- FK desde `bloque_insertions.bloque_id` es ON DELETE RESTRICT (refuerza el soft-delete a nivel relacional).

**RLS:** lectura pública, escritura restringida a rol `ADMIN_TENANT` via página admin (§5.4) o via migración SQL.

#### T5 — `bloque_insertions` (tenant-scoped, WORM auditoría)

Propósito: auditoría inmutable de cada inserción de bloque sectorial en un agreement. Conserva copia literal del texto al momento de inserción (F4 opción a).

| Columna | Tipo | Constraints | Propósito |
|---|---|---|---|
| `id` | uuid | PK | |
| `tenant_id` | uuid | NOT NULL | |
| `agreement_id` | uuid | NOT NULL, FK→agreements | Acuerdo donde se insertó |
| `bloque_id` | uuid | NOT NULL, FK→bloques_sectoriales | Referencia al bloque (puede ser ARCHIVADA en el futuro) |
| `bloque_clave` | text | NOT NULL | Snapshot de `clave_bloque` al insertar (denormalizado para auditoría tras ARCHIVADA) |
| `bloque_version` | text | NOT NULL | Versión exacta insertada |
| `texto_insertado` | text | NOT NULL | Copia literal al momento de inserción — preserva WORM aunque el bloque se actualice después |
| `inserted_at` | timestamptz | DEFAULT now() | |
| `inserted_by` | uuid | NULLABLE | Usuario secretario |

**WORM:** triggers BEFORE UPDATE/DELETE invocan `worm_guard()` (función ya existe en `rule_engine_tables`). Append-only.

**Constraints:**
- INDEX sobre `(agreement_id)` para reconstruir auditoría completa
- INDEX sobre `(bloque_id, bloque_version)` para dashboard de versiones obsoletas

**RLS:** tenant-scoped lectura, INSERT only.

#### T6 — `plantilla_changelog` (tenant-scoped, WORM)

Propósito: historial estructurado de cambios a plantillas, sustituye el ciclo de firma legal por trazabilidad técnica.

| Columna | Tipo | Constraints | Propósito |
|---|---|---|---|
| `id` | uuid | PK | |
| `tenant_id` | uuid | NOT NULL | |
| `plantilla_id` | uuid | NOT NULL, FK→plantillas_protegidas | |
| `from_version` | text | NULLABLE | Versión previa (NULL en bump inicial) |
| `to_version` | text | NOT NULL | Versión nueva |
| `bump_type` | text | NOT NULL, CHECK ∈ {`'PATCH'`, `'MINOR'`, `'MAJOR'`} | Tipo de cambio |
| `motivo` | text | NOT NULL | Razón del cambio |
| `autor` | text | NOT NULL | Quien hizo el cambio (nombre o usuario, no firma legal) |
| `diff_summary` | text | NULLABLE | Resumen humano del diff |
| `pr_url` | text | NULLABLE | Enlace al PR de GitHub si aplica |
| `created_at` | timestamptz | DEFAULT now() | |

**WORM:** triggers BEFORE UPDATE/DELETE. Append-only.

**Constraints:**
- INDEX sobre `(plantilla_id, created_at DESC)` para reconstrucción rápida del historial
- UNIQUE `(plantilla_id, to_version)` — una entrada por bump

**RLS:** tenant-scoped lectura, INSERT only.

### 4.2 Tablas existentes — sin alteraciones de schema

- `plantillas_protegidas`: sin cambios. `aprobada_por` queda como campo descriptivo opcional (ya nullable hoy). El gate de firma legal se elimina a nivel de proceso, no de schema.
- `rule_param_overrides`: sin cambios. Sigue siendo el mecanismo para parámetros normativos.
- `entities`: sin cambios. Los settings van a `entity_settings`, no a columnas nuevas en `entities`.

### 4.3 Seed inicial v2.0

**Decisión E confirmada**: poblar las ~40 claves del catálogo aunque no haya plantillas que las consuman.

**Catálogo de `entity_settings_catalog` poblado en v2.0:**

Aproximadamente 40 claves cubriendo Cats. 3 y 4. Inventario indicativo:

**Categoría CONFIG_CONDICIONAL (~20 claves):**
- `es_cotizada` (enum: `'SÍ'`, `'NO'`, default `'NO'`)
- `secretario_es_consejero` (enum: `'SÍ'`, `'NO'`, default `'NO'`)
- `tiene_reglamento_consejo` (boolean, default `false`)
- `tiene_reglamento_junta` (boolean, default `false`)
- `aseguradora_intragrupo` (boolean, default `false`)
- `tipo_social` (enum: `'SA'`, `'SL'`, `'SLU'`, `'SAU'`, default `'SA'`)
- `requiere_experto_independiente` (boolean, default `true`)
- `sector_regulado` (enum: `'BANCA'`, `'SEGUROS'`, `'ENERGIA'`, `'FARMA'`, `'GENERICO'`, default `'GENERICO'`)
- `tiene_politica_remuneracion_anterior` (boolean, default `false`)
- `requiere_borme` (boolean, default `true`)
- `requiere_dictamen_externo` (boolean, default `false`)

Las restantes ~9 claves de esta categoría (cobertura completa de los 10 casos de Cat. 3 documentados en el plan operativo) se enumeran y especifican en el plan de implementación, no aquí. La política es: cada clave del seed inicial v2.0 corresponde a al menos un caso de uso documentado.

**Categoría CARGO (~10 claves):**
- `cargo_secretario_label` (text, default `'Secretario del Consejo'`)
- `cargo_presidente_label` (text, default `'Presidente del Consejo'`)
- `cargo_ejecutivo_label` (text, default `'Consejero Delegado'`)
- `cargo_cfo_label` (text, default `'Dirección Financiera'`)
- `cargo_asesor_legal_label` (text, default `'Letrado Asesor'`)
- `firmante_por_delegacion_label` (text, NULLABLE)
- `organo_admin_label` (text, default `'El Consejo de Administración'`)
- `nombre_comite_auditoria` (text, default `'Comisión de Auditoría'`)
- `nombre_comite_retribuciones` (text, default `'Comisión de Nombramientos y Retribuciones'`)
- `rol_certificante` (enum: `'SECRETARIO'`, `'PRESIDENTE'`, default `'SECRETARIO'`)

**Categoría PERFIL_SOCIETARIO (~10 claves):**
- `subgrupo_consolidacion` (text, NULLABLE)
- `regulador_principal` (enum: `'CNMV'`, `'BdE'`, `'DGSFP'`, `'CNMC'`, `'AEMPS'`, `'NINGUNO'`, default `'NINGUNO'`)
- `numero_registro_cnmv` (text, NULLABLE)
- `numero_registro_reglamento_consejo` (text, NULLABLE)

Las restantes ~6 claves de esta categoría se especifican en el plan de implementación.

El seed completo se especifica en el plan de implementación, no aquí.

**Catálogo de `bloques_sectoriales` poblado en v2.0:**

10 bloques piloto (uno por caso de Cat. 5):
- `BANCA_IDONEIDAD_CRR` v1.0.0
- `SEGUROS_SOLVENCIA_II_COMITES` v1.0.0
- `SEGUROS_DyO_INTRAGRUPO` v1.0.0
- `COTIZADAS_MAR_DISCLAIMER` v1.0.0
- `ENERGIA_CNMC_AUTORIZACION` v1.0.0
- `MERCADO_VALORES_TENEDORES_BONOS` v1.0.0
- `INMOBILIARIO_SOCIMI_DIVIDENDOS` v1.0.0
- `EIP_ROTACION_AUDITOR` v1.0.0
- `FARMA_AEMPS_BPF` v1.0.0
- `PUBLICO_PRIVADO_LPAP` v1.0.0

Texto literal de cada bloque pendiente de redacción en plan de implementación.

---

## 5. Cambios en código

### 5.1 `src/lib/doc-gen/variable-resolver.ts`

**Cambio puntual en `resolveEntityVars`:**

1. Tras cargar la fila de `entities`, ejecutar query adicional:
   ```
   SELECT key, value FROM entity_settings WHERE entity_id = X AND tenant_id = Y
   ```
2. Para cada `(key, value)`:
   - Mergear `key` como propiedad del objeto retornado
   - Convertir `value` JSONB a tipo nativo según `value_type` del catalog
3. Para cada clave del catalog **sin override en `entity_settings`**, aplicar `default_value` del catalog
4. El resolver MOTOR existente no cambia — sigue consumiendo `compliance_snapshot`

**Caching del catalog (estrategia belt-and-suspenders):**
- **Lectura**: el catalog es global y cambia raramente. El resolver lo carga via TanStack Query con `staleTime: Infinity`, `gcTime: 24h`, query key `['entity-settings-catalog']`. Esto evita N+1 queries por cada render.
- **Invalidación vía mutation hook**: cuando un admin modifica el catálogo desde la página `PlantillasMantenimiento` (§5.4), la mutation hook (`useUpdateEntitySettingsCatalog`) llama a `queryClient.invalidateQueries(['entity-settings-catalog'])` tras success. Cubre el 95% de cambios.
- **Invalidación vía Realtime subscription**: como belt-and-suspenders para cambios fuera de la app (admin SQL directo, migración manual, otro tab abierto), se suscribe a Supabase Realtime sobre `entity_settings_catalog`. Cualquier evento INSERT/UPDATE/DELETE dispara `queryClient.invalidateQueries(['entity-settings-catalog'])`.
- **Fallback runtime**: si por race condition el render se ejecuta con cache stale, el resolver no rompe — usa el cache disponible. La próxima invocación recoge el cache fresco.

**Comportamiento ante claves no encontradas (R4):**
- Si `{{ENTIDAD.<key>}}` referencia una `key` que NO está en el catálogo NI en `entity_settings`: el resolver devuelve `""` (string vacío) y emite `console.warn` con el contexto. **Nunca lanza excepción.** Esto garantiza que la migración progresiva (introducir variables en capa1 antes de poblar entity_settings) no rompe el render.
- Si la `key` está en el catálogo pero la entidad no tiene override: el resolver aplica `default_value` del catalog (puede ser NULL para claves text opcionales — el render produce `""`).
- Cualquier `console.warn` se reporta en logs de Sentry/equivalente para detección operativa, pero no bloquea UX.

**Resultado:** `{{ENTIDAD.cargo_secretario_label}}` se resuelve con el valor de la sociedad o el default canónico. `normalizeFuente()` no cambia — `"entities.cargo_secretario_label"` ya se mapea a `ENTIDAD`.

### 5.2 `usePlantilla` hook (nuevo, en `src/hooks/secretaria/`)

Estado actual: las plantillas se cargan via `useRulePackForMateria` y `usePlantillas`. La capa3 se renderiza directamente desde `plantillas_protegidas.capa3_editables`.

Estado v2: introducir `usePlantillaWithOverrides(plantilla_id, entity_id)`:

```
plantilla = useQuery(plantillas_protegidas WHERE id = plantilla_id)
overrides = useQuery(plantilla_capa3_overrides_por_entidad WHERE entity_id, plantilla_id)
mergedCapa3 = applyCapa3Overrides(plantilla.capa3_editables, overrides)
warnCompatibility = overrides.some(o => o.compatible_with_canonical_version !== plantilla.version)
return { ...plantilla, capa3_editables: mergedCapa3, warnCompatibility }
```

Función `applyCapa3Overrides(canonical_capa3, overrides_rows)`:
- Para cada campo del array canónico, buscar override matching por `campo`
- Si existe `default_value_override` → reemplazar `default` del campo
- Si existe `opciones_override` → reemplazar `opciones` del campo
- Si existe `obligatoriedad_override` → reemplazar `obligatoriedad` del campo
- Resto: mantiene canónico inalterado

`TramitadorStepper` y `GenerarDocumentoStepper` consumen el hook nuevo en lugar de `usePlantillas` directo.

### 5.3 Composer UI — panel lateral de bloques sectoriales (alto nivel)

Componente nuevo en `src/components/secretaria/BloquesSectorialesPanel.tsx`. Detalle UX completo en §5.5.

**Inputs:**
- `entity_id` (de contexto del agreement)
- `materia` (de la plantilla seleccionada)

**Comportamiento:**
1. Lee `entity_settings.sector_regulado` para la entidad
2. Query: `bloques_sectoriales WHERE sector = <sector_regulado> AND <materia> = ANY(materia_aplicable) AND estado = 'ACTIVA'`
3. Renderiza panel lateral collapsable con tarjeta por bloque:
   - Título: `clave_bloque` + badge `version`
   - Descripción: texto corto
   - Referencia legal: citas
   - Botón "Insertar en campo libre sectorial"
4. Al pulsar "Insertar":
   - Append literal `texto_aprobado` al campo capa3 `campo_libre_sectorial` (textarea)
   - INSERT en `bloque_insertions` con `texto_insertado` = copia literal + `bloque_version` + `agreement_id`
   - Toast: "Bloque BANCA_IDONEIDAD_CRR v1.0.0 insertado. Puedes editar el texto antes de generar."

**Cambio en plantillas canónicas:** añadir progresivamente campo `campo_libre_sectorial` (textarea, OPCIONAL) a las plantillas Cat. 5-compatibles. Se hace en bumps futuros, no en v2.0.

**Graceful degradation cuando `campo_libre_sectorial` no existe en la plantilla actual:**
- En v2.0 las 41 plantillas canónicas todavía no tienen el campo `campo_libre_sectorial` en `capa3_editables`.
- El componente `BloquesSectorialesPanel` debe verificar la presencia del campo ANTES de mostrarse:
  - Si existe → panel funcional con botón "Insertar"
  - Si NO existe → panel renderiza estado deshabilitado con tooltip: *"Esta plantilla no admite bloques sectoriales todavía. Pendiente de bumpar a versión compatible. Mientras tanto, puedes copiar el texto del bloque manualmente."*
  - Bloques siguen visibles para que el secretario pueda copiar manualmente; INSERT en `bloque_insertions` se omite (no hay agreement field donde apunten)
- Esta degradación garantiza que la UI no genere errores en plantillas legacy y guía al secretario hacia la solución manual transitoria.

### 5.4 Dashboard de mantenimiento (admin)

Página nueva en `src/pages/admin/PlantillasMantenimiento.tsx` (no demo-prioritaria, pero infraestructura para v2.1+):

**RBAC:** Acceso restringido a usuarios con rol `ADMIN_TENANT` según `useUserRole.ts` (5 roles existentes: SECRETARIO, CONSEJERO, COMPLIANCE, ADMIN_TENANT, AUDITOR). Otros roles obtienen 403. Las mutations sobre `entity_settings_catalog` y `bloques_sectoriales` requieren `ADMIN_TENANT` tanto en frontend (componente protegido) como en RLS de Supabase (policy específica con check `auth.jwt() -> 'role' = 'ADMIN_TENANT'`).

**Secciones:**
1. **Overrides activos por sociedad** — tabla agregada `entity_id × N overrides en capa3_overrides + N entity_settings`
2. **Compatibilidad de overrides** (F3) — tabla con filas donde `compatible_with_canonical_version != plantilla.version` actual; badge `⚠️ Necesita revalidación`
3. **Bloques sectoriales obsoletos** — `bloque_insertions` agrupado por `(bloque_id, bloque_version)` mostrando si la `version` insertada es la `ACTIVA` actual
4. **Plantilla changelog** — historial reciente con filtros por plantilla, autor, bump_type
5. **Catálogo de claves** — vista de `entity_settings_catalog` con CRUD (solo ADMIN_TENANT). Edición dispara mutation hook que invalida cache TanStack del resolver (§5.1)
6. **Auditoría de uso** — claves del catalog sin uso real (no aparecen en `entity_settings` ni en `capa1_inmutable` de ninguna plantilla ACTIVA). Candidatas a ARCHIVADA

Esta página queda **lista pero no enlazada en navegación** en v2.0. Se promueve a v2.1 cuando el primer cliente real demanda.

### 5.5 Detalle UX — `BloquesSectorialesPanel`

Spec UX detallada para implementación. Cubre el hueco A5 detectado en review adversarial.

**Layout:**
- Panel lateral derecho del composer, ancho 320px, collapsable con botón en cabecera
- Header del panel: "Bloques sectoriales sugeridos" + badge contador `{n}`
- Si `n === 0` con `sector_regulado != 'GENERICO'`: mensaje "No hay bloques sectoriales sugeridos para este sector y materia. [Ver todos los bloques disponibles](#)"
- Si `sector_regulado === 'GENERICO'`: panel oculto por defecto (R10) con botón "Mostrar bloques genéricos" en la barra superior del composer

**Tarjeta de bloque (cada item del panel):**
- Línea 1: `<clave_bloque>` `<badge version v1.0.0>` `<icono sector>`
- Línea 2: descripción corta (truncada a 80 chars con tooltip al pasar)
- Línea 3: referencia legal (citas Reglamento UE 575/2013, etc.)
- Línea 4: 2 botones lado a lado:
  - **"Vista previa"** (secundario) — abre modal con el `texto_aprobado` completo en read-only
  - **"Insertar"** (primario) — flujo de inserción descrito abajo

**Flujo de inserción (botón "Insertar"):**
1. Verificar precondición: la plantilla tiene `campo_libre_sectorial` en `capa3_editables` (graceful degradation §5.3 ya garantiza esto). Si no, botón está deshabilitado.
2. Comportamiento por estado del cursor:
   - **Si el textarea `campo_libre_sectorial` tiene foco con cursor en posición X**: insertar el bloque en posición X, separando con `\n\n` antes y después si no hay saltos de línea ya
   - **Si el textarea no tiene foco**: insertar al final del campo, separado por `\n\n` del contenido previo
3. Modal de confirmación previa (solo si el textarea ya tiene contenido > 50 chars): *"Vas a insertar el bloque <clave_bloque> v<version> en el campo Libre Sectorial. Tienes contenido previo. ¿Continuar?"* con opciones "Insertar al final", "Insertar en cursor", "Cancelar".
4. Tras confirmar: append literal `texto_aprobado` + INSERT en `bloque_insertions` con `texto_insertado` = copia exacta + `bloque_version` actual + `agreement_id` + `inserted_by` (user from context).
5. Toast bottom-right: *"Bloque BANCA_IDONEIDAD_CRR v1.0.0 insertado. Puedes editarlo antes de generar el documento."*
6. Tarjeta del panel pasa a estado "Insertado" (badge verde, botón cambia a "Insertar otra vez").

**Toggle "Ver todos los bloques disponibles" (R10 con matiz):**
- Visible siempre en la cabecera del panel, incluso cuando `sector_regulado != 'GENERICO'`
- Al activarlo: query relax → `WHERE materia = ANY(materia_aplicable) AND estado='ACTIVA'` (sin filtro por sector)
- Permite al secretario insertar un bloque GENERICO o EIP aplicable a sociedad bancaria, etc.
- Etiqueta del toggle indica claramente "Filtro por sector activo: BANCA" o "Mostrando todos los sectores"

**Accesibilidad:**
- Panel navegable por teclado (Tab order definido)
- Tarjetas con `role="article"` y `aria-label` descriptivo
- Botones con `aria-disabled` cuando precondición no cumple

**Estados de error:**
- Failure de query → mensaje "No se pudieron cargar los bloques sugeridos. Reintentar." con botón retry
- Failure del INSERT en `bloque_insertions` → toast error + el `campo_libre_sectorial` no se modifica (transaccional client-side)

---

## 6. Jerarquía de precedencia formal (F5)

Para cualquier render de plantilla en runtime, el orden de aplicación es **estrictamente**:

| Prioridad | Mecanismo | Capa afectada | Naturaleza |
|---|---|---|---|
| 1 (más alta) | `rule_param_overrides` | MOTOR.* en resolver | Jurídicamente vinculante — motor LSC computa snapshot |
| 2 | `entity_settings` | ENTIDAD.* en resolver → capa1 condicionales | Configuración estática societaria |
| 3 | `plantilla_capa3_overrides_por_entidad` | capa3 form (defaults UI, opciones, obligatoriedad) | Conveniencia UX |
| 4 (más baja) | Default canónico | capa1, capa2, capa3 originales | Fallback |

**Reglas operativas:**
- Cuando hay conflicto entre niveles, gana el de mayor prioridad
- Capa3 override **no puede contradecir** un `rule_param_override` que afecte la misma materia (ej. si el motor exige BORME por ley, el override capa3 no puede eliminar BORME de opciones)
- `entity_settings` se aplica antes que el render de capa1; cualquier `{{#if (eq ENTIDAD.<key> ...)}}` se evalúa con el valor mergeado

**Validaciones cruzadas obligatorias** (triggers + tests + dashboard):
- `opciones_override = []` vacío → REJECT en trigger
- `default_value_override` ∉ `opciones_override` cuando ambos definidos → REJECT en trigger
- `entity_settings.value` enum no en `allowed_values` del catalog → REJECT en trigger
- Variable `{{ENTIDAD.<key>}}` en capa1 con `key` no en `entity_settings_catalog` → WARNING en CI (script `scripts/audit-entity-settings-keys.ts` que parsea capa1 de todas las plantillas activas y cruza con catalog)
- `compatible_with_canonical_version < plantilla.version actual` → WARNING en dashboard + badge en composer, no bloqueo

**Semántica de `compatible_with_canonical_version`:**
- Se setea al INSERT del override por el autor del PR (valor literal de `plantillas_protegidas.version` en el momento)
- **NO se actualiza automáticamente** al bumpar la canónica. La actualización es **explícita** vía PR del owner del override (el autor revisa que el override sigue teniendo sentido contra la nueva versión canónica)
- El dashboard de mantenimiento lista todos los overrides "obsoletos" (donde `compatible_with_canonical_version != plantilla.version actual`) para que el equipo decida revalidar o archivar
- No hay deadline ni penalización por no revalidar — un override obsoleto sigue funcionando, solo emite warning

---

## 7. Estrategia de migración progresiva

### Fase v2.0 — Infraestructura sin consumo (1 sprint, ~5-7 días)

**Objetivo:** desplegar las 6 tablas + extensiones de código + seed catálogo, sin migrar ninguna plantilla canónica todavía.

**Entregables:**
1. Migración SQL única consolidada con T1-T6 + RLS + triggers + WORM guards
2. Extensión `variable-resolver.ts` para mergear `entity_settings`
3. Hook `usePlantillaWithOverrides`
4. Componente `BloquesSectorialesPanel` (lazy-loaded, opt-in)
5. Página admin `PlantillasMantenimiento` (no enlazada en navegación)
6. Seed inicial:
   - ~40 claves en `entity_settings_catalog`
   - 10 bloques piloto en `bloques_sectoriales`
   - 0 filas en `entity_settings`, `plantilla_capa3_overrides_por_entidad`, `bloque_insertions`, `plantilla_changelog`
7. Tests:
   - Schema (estructura tablas + constraints)
   - RLS (tenant scoping)
   - Triggers validadores (rejection paths)
   - WORM guards (`bloque_insertions`, `plantilla_changelog`)
   - Resolver merge (`entity_settings` overrides defaults catalog)
   - Hook `applyCapa3Overrides` (merge correcto)

**Criterio de cierre v2.0:**
- `bun test`: pass + N nuevos tests
- `bun run typecheck`: pass
- `bun run lint`: pass
- Migración aplicada en Cloud con `bun run db:check-target` previo
- E2E smoke: composer renderiza plantilla con `usePlantillaWithOverrides` sin overrides activos (debe ser idéntico al render canónico actual)

**Lo que NO incluye v2.0:**
- Cambios en `capa1_inmutable` de las 41 plantillas canónicas
- Migración de cargos hardcodeados (`"Secretario del Consejo"`) a `{{ENTIDAD.cargo_secretario_label}}`
- Bloques sectoriales con texto completo redactado (se generan stubs para los 10, redacción real es plan separado)
- Página admin enlazada en navegación

### Fase v2.1 — Migración por demanda (continuo, sin sprint fijo)

**Objetivo:** consumir la infra de v2.0 conforme se necesita para clientes reales.

**Activadores:**
- Llega cliente real que necesita adaptación → identificar plantilla(s) afectada(s) → PR concreto
- O bien: oportunidad de mejora detectada en el dashboard de mantenimiento

**Patrones de PR:**
- **Cat. 3/4 (condicionales y cargos):** bumpar `capa1_inmutable` introduciendo `{{#if (eq ENTIDAD.<key> ...)}}` o `{{ENTIDAD.<key>}}`. Bump minor + entrada en `plantilla_changelog` con `bump_type='MINOR'`, motivo `"Adaptación cargos/condicionales para sociedad X"`, autor del PR.
- **Cat. 2 (overrides capa3):** insert en `plantilla_capa3_overrides_por_entidad` con `compatible_with_canonical_version` = versión actual. No toca canónica.
- **Cat. 5 (bloque sectorial nuevo):** insert en `bloques_sectoriales`. No toca canónica.

**Sin gates legales bloqueantes.** PR review estándar + tests automatizados. La responsabilidad legal recae en el revisor del PR.

### Fase v2.2+ — Consolidación oportunista

**Activadores:**
- Un bloque sectorial usado en 15+ insertions → considerar promoción a condicional canónico Cat. 3
- Un override capa3 replicado en 10+ entidades → considerar elevación a `default_value` global en `entity_settings_catalog`
- Detección de claves en `entity_settings_catalog` sin uso real → cleanup (archivado, no eliminación, para preservar trazabilidad)

**Sin compromiso de timeline.** Se hace cuando merece la pena.

---

## 8. Casos de uso — los 60 ejemplos

Los 60 casos concretos (10 por categoría) están en el plan operativo que genera el catálogo de claves para v2.0 seed. Resumen condensado por categoría:

| Categoría | # casos | Frecuencia esperada | Mecanismo | Cambio en v2.0 |
|---|---|---|---|---|
| 1 — Parámetros normativos | 10 | 40% | `rule_param_overrides` (statu quo) | Ninguno — verificar cobertura existente |
| 2 — Defaults/opciones capa3 | 10 | 25% | `plantilla_capa3_overrides_por_entidad` | Tabla nueva + merge hook |
| 3 — Bloques condicionales capa1 | 10 | 15% | `entity_settings_catalog` + `entity_settings` | Tabla nueva + resolver extension; capa1 sin tocar todavía |
| 4 — Cargos/firmantes textuales | 10 | 10% | Idem (3), claves `cargo_*_label` | Misma infra (3) |
| 5 — Texto sectorial extenso | 10 | 8% | `bloques_sectoriales` + `bloque_insertions` + UI panel | Tablas nuevas + componente lateral + WORM |
| 6 — Multi-jurisdicción | 10 | 2% | **OUT OF SCOPE v2** | Pospuesto a v3 |

Los 60 ejemplos concretos se mantienen como apéndice del plan de implementación, no de este spec, para evitar drift entre el diseño y los casos específicos.

---

## 9. Out-of-scope explícito de v2

### 9.1 Multi-jurisdicción (Cat. 6)

**Razón:** requiere motor LSC paralelo por jurisdicción (BR, MX, PT, CO, CL, PE, US-DE, LU, NL) + abogados locales + `rule_packs` jurisdiccionales + traducción de tooling. Es un sub-proyecto con presupuesto independiente.

**Lo que sí queda preparado:** el campo `plantillas_protegidas.jurisdiccion TEXT NOT NULL DEFAULT 'ES'` ya existe desde la migración `20260419_000004`. Cuando llegue v3, basta con poblar plantillas canónicas paralelas con `jurisdiccion != 'ES'` y filtrar por ese campo en `usePlantillaWithOverrides`. No hay deuda de schema.

### 9.2 Firma legal bloqueante

**Razón:** convertida en gobernanza por catálogo (§2). No es lock-in técnico — si en el futuro alguna jurisdicción exige firma individual por plantilla, se puede reintroducir como columna obligatoria o tabla `plantilla_firmas`.

### 9.3 Override de texto capa1 (B1/B2 completo del análisis original)

**Razón:** no necesario para 98% de casos. Para casos extremos sin solución: bloque sectorial + edición humana en `campo_libre_sectorial`. Si el texto requerido es tan crítico que no puede quedar en capa3, se promueve a condicional canónico Cat. 3 (§7 Fase v2.2+).

### 9.4 Fork por sociedad (Enfoque A original)

**Razón:** no se implementa para ningún caso. Multi-jurisdicción se trata como catálogo paralelo (§9.1), no fork.

### 9.5 Merge runtime de Handlebars templates

**Razón:** capa1 se mantiene inmutable. Toda variabilidad se modela como condicionales `{{#if}}` con variables del resolver, no como reescritura de plantilla.

### 9.6 Notificaciones push de bloques obsoletos (F4)

**Razón:** Decisión D confirmada — solo dashboard. Si en el futuro hay demanda, se añade job periódico que genera digest semanal. Fuera de v2.0.

### 9.7 Visibilidad per-tenant de bloques sectoriales

**Razón:** Decisión B confirmada — todos los bloques son globales en v2.0. Extensión futura (v2.2+) puede añadir campo `visibilidad ∈ {'GLOBAL', 'TENANT_ONLY'}` con `tenant_id` opcional sin migrar datos existentes.

---

## 10. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Typos en claves `{{ENTIDAD.<key>}}` que rompen condicionales silenciosamente | Media | Alto (bloques pre-aprobados nunca se renderizan) | Script CI `audit-entity-settings-keys.ts` que parsea capa1 de todas las plantillas activas y cruza con catalog. WARNING en CI, fail si la clave no existe ni siquiera con fallback |
| Override capa3 incompatible con bump canónica (F3) | Alta (con el tiempo) | Medio (UI muestra defaults stale, pero no rompe) | Dashboard de compatibilidad + flag `compatible_with_canonical_version` + badge `⚠️ Necesita revalidación` en composer |
| Bloque sectorial archivado pero referenciado en agreements firmados | Alta | Bajo (no afecta agreements pasados — texto está en `bloque_insertions.texto_insertado`) | `bloque_insertions.bloque_clave` denormalizado + WORM. Auditoría completa sin depender del bloque actual |
| Catálogo `entity_settings_catalog` crece sin control y se vuelve catch-all | Media | Medio (pérdida de coherencia semántica) | Revisión periódica del catálogo (v2.2+ consolidation). Categorías limitadas en CHECK |
| Promoción de bloque sectorial → condicional canónico genera duplicación temporal | Baja | Bajo | Proceso explícito en v2.2+: archivar bloque + bumpar plantilla en mismo PR |
| Resolver MOTOR consume `compliance_snapshot` que asume LSC-ES; en v3 multi-jurisdicción romperá | Baja en v2 (out of scope) | Alto en v3 | No mitigar en v2. Aceptar deuda explícita; v3 reescribe motor |
| Trigger validador de `entity_settings.value` vs `value_type` del catalog falla por edge cases de tipos JSONB | Baja | Medio | Tests exhaustivos de cada `value_type`: boolean, number, text, enum con allowed_values |
| `entity_settings_catalog` con `default_value` que no aplica a entidades existentes | Media | Bajo (defaults son fallback, no obligatorios) | Validar al introducir cada clave nueva: ¿tiene sentido como default para todas las sociedades del tenant? Si no, el campo `default_value` queda NULL y el resolver no rellena nada |
| Cambio breaking de `value_type` en clave existente del catalog (ej. `text` → `enum`) rompe `entity_settings` existentes | Baja | Alto (datos JSONB con tipo incoherente, trigger validador rechaza UPDATEs) | Procedimiento explícito de §3.4: clave nueva con sufijo `_v2` + backfill + bump plantillas + ARCHIVAR antigua. NUNCA UPDATE directo del `value_type` en una clave con datos |
| `bloques_sectoriales.texto_aprobado` modificado in-place sin bump version | Media | Medio (drift entre lo que se firmó hace meses y lo que está en BD) | Trigger BEFORE UPDATE rechaza cambios a `texto_aprobado` cuando `estado='ACTIVA'`. Bumps requieren nueva versión + ARCHIVAR la previa |
| Cache stale del catalog en TanStack Query causa render con `default_value` antiguo tras cambio admin | Baja | Bajo (próxima invalidación recoge cambios) | Belt-and-suspenders: mutation hook + Realtime subscription. Documentado en §5.1 |
| Override capa3 creado contra plantilla con `estado != 'ACTIVA'` (BORRADOR/ARCHIVADA) | Baja | Bajo (override nunca se consume) | Trigger BEFORE INSERT/UPDATE en T3 valida `plantillas_protegidas.estado='ACTIVA'`. Si la plantilla pasa a ARCHIVADA después, los overrides existentes quedan huérfanos pero no se borran (auditoría) |

---

## 11. Plan de tests

### 11.1 Tests de schema (`src/test/schema/v2-plantillas-overrides.test.ts`)

- Estructura de las 6 tablas (columnas + tipos + constraints)
- FKs correctas (cascade behavior verificado)
- RLS scoping (tenant aislamiento)
- UNIQUE constraints (rejection de duplicados)
- CHECK constraints (rejection de valores fuera de enum)

### 11.2 Tests de triggers

Cobertura mínima: **≥3 rejection paths por trigger** (R8).

**Trigger T2 `entity_settings.value` vs `value_type` del catalog:**
- Rechazo cuando catalog define `value_type='boolean'` y `value` es `"texto"` (string en JSONB)
- Rechazo cuando catalog define `value_type='number'` y `value` es `true`
- Rechazo cuando catalog define `value_type='enum'` con `allowed_values=['SÍ','NO']` y `value='QUIZAS'`
- Happy: cada `value_type` con valor correcto

**Trigger T3 `plantilla_capa3_overrides_por_entidad` opciones+default+motivo:**
- Rechazo de `opciones_override = []` (array vacío)
- Rechazo cuando `default_value_override` no está en `opciones_override` (ambos definidos)
- Rechazo cuando `length(motivo) < 10` (CHECK constraint)
- Rechazo cuando `campo` no existe en `plantillas_protegidas.capa3_editables` (función `jsonb_path_exists`)
- Rechazo cuando `plantillas_protegidas.estado != 'ACTIVA'` (R11)
- Happy: row con un override no-NULL, motivo válido, campo válido, plantilla ACTIVA

**Trigger T4 `bloques_sectoriales` soft-delete + texto_aprobado immutable:**
- Rechazo de DELETE físico
- Rechazo de UPDATE de `texto_aprobado` cuando `estado='ACTIVA'`
- Happy: UPDATE de `estado` ACTIVA→ARCHIVADA permitido
- Happy: INSERT de nueva versión con bump semver permitido

**WORM triggers T5 `bloque_insertions` y T6 `plantilla_changelog`:**
- Rechazo de UPDATE en cada tabla
- Rechazo de DELETE en cada tabla
- Happy: INSERT permitido

### 11.3 Tests de resolver (`src/lib/doc-gen/variable-resolver.test.ts`)

- `entity_settings` overrides catalog defaults
- Resolver fallback al `default_value` del catalog cuando no hay override
- `{{ENTIDAD.cargo_secretario_label}}` resuelve al valor de la sociedad
- Variable `{{ENTIDAD.<key>}}` con `key` no en catalog queda unresolved sin romper render

### 11.4 Tests de hook `usePlantillaWithOverrides`

- Merge correcto de `default_value_override`, `opciones_override`, `obligatoriedad_override`
- Sin overrides → render idéntico a canónico (regression guard)
- `warnCompatibility = true` cuando `compatible_with_canonical_version != plantilla.version`
- Múltiples overrides para distintos campos: aplicación granular correcta

### 11.5 Tests E2E (`e2e/20-secretaria-plantillas-overrides.spec.ts`, nuevo)

- Composer renderiza plantilla sin overrides (regression smoke)
- Composer renderiza plantilla con `entity_settings.es_cotizada = SÍ` y se muestra bloque condicional cotizada
- Composer muestra panel lateral de bloques sectoriales cuando `sector_regulado = BANCA`
- Insertar bloque → texto aparece en `campo_libre_sectorial` + INSERT en `bloque_insertions`

### 11.6 CI scripts

- `scripts/audit-entity-settings-keys.ts`: parsea capa1 de todas las plantillas `estado='ACTIVA'`, extrae claves `{{ENTIDAD.<key>}}`, cruza con `entity_settings_catalog`. **FAIL build (no warning)** si hay claves usadas no catalogadas (R2). Adicionalmente reconstruye `entity_settings_catalog.usado_por_plantillas` como side-effect informativo.
- `scripts/validate-capa3-overrides-compat.ts`: cruza `plantilla_capa3_overrides_por_entidad.compatible_with_canonical_version` con `plantillas_protegidas.version` actual. Reporta cuántos overrides están obsoletos por plantilla
- `scripts/validate-bloques-sectoriales-immutability.ts`: verifica que ninguna fila ACTIVA en `bloques_sectoriales` tiene `texto_aprobado` distinto al snapshot inmutable conocido (computado al deploy). Refuerzo de R5 a nivel CI por si el trigger BD falla

---

## 11bis. Reglas operativas R1–R12 (apéndice)

Estas 12 reglas fueron consolidadas en review adversarial post-spec y son **guardrails vinculantes** para la implementación. No son recomendaciones — son criterios de aceptación de PR.

### R1 — Handlebars se mantiene como motor de templates

No se introduce ningún motor alternativo (TemplateMark, Mustache, Jinja2, etc.). Las plantillas canónicas siguen usando la sintaxis Handlebars documentada en v1 (helpers cerrados: `fechaES`, `uppercase`, `lowercase`, `eq`, `or`, `and`, `gt`, `gte`, `porcentaje`, `ordinalES` + nativos `{{#if}}`, `{{#unless}}`, `{{#each}}`, `{{else}}`).

Cualquier propuesta de cambio de motor requiere spec separado con análisis de migración completo.

### R2 — Toda variable `{{ENTIDAD.<key>}}` en capa1 debe tener correspondencia en `entity_settings_catalog`

El script CI `audit-entity-settings-keys.ts` debe **fallar el build** (no solo WARNING) si una plantilla ACTIVA referencia una clave que no existe en el catálogo.

Excepción explícita: las claves legacy `entities.*` (denominacion_social, cif, etc.) que el resolver `resolveEntityVars` ya maneja por la vía existente (campos directos de la tabla `entities`). El script las detecta y las excluye de la validación.

### R3 — Un override capa3 sin `motivo` no se persiste

El campo `motivo` en T3 es `NOT NULL` con `CHECK length(motivo) >= 10` a nivel BD (no solo UI). El frontend debe exigir justificación (textarea con mínimo 10 caracteres) antes de crear un override. Esto previene overrides "de prueba" que se olvidan en producción y garantiza auditoría.

### R4 — El resolver NUNCA lanza excepción por clave ausente

Si `{{ENTIDAD.<key>}}` no tiene valor en `entity_settings` NI default en el catálogo, el resolver devuelve string vacío (`""`) y loguea `console.warn` con contexto. **No rompe el render.**

Esto es crítico para migración progresiva: las plantillas pueden referenciar claves antes de que todas las entidades tengan valores poblados. Documentado en §5.1 — comportamiento ante claves no encontradas.

Compatible con R2: R2 protege deploy estático (no se merge una plantilla con clave no catalogada), R4 protege runtime (incluso si algo escapa al CI, el render sigue funcionando).

### R5 — `bloques_sectoriales` son append-only en contenido

Un bloque ACTIVA nunca se modifica en `texto_aprobado`. Si hay corrección, se crea nueva versión (semver bump) y la anterior se ARCHIVA.

Garantías:
- Trigger BEFORE UPDATE rechaza cambios a `texto_aprobado` cuando `estado='ACTIVA'` (§4.1 T4)
- Trigger BEFORE DELETE rechaza DELETE físico de cualquier fila (§4.1 T4)
- CI script `validate-bloques-sectoriales-immutability.ts` como belt-and-suspenders

El WORM aplica también a `bloque_insertions` por triggers separados.

### R6 — El hook `usePlantillaWithOverrides` es opt-in, no breaking change

En v2.0, los componentes existentes (`TramitadorStepper`, `GenerarDocumentoStepper`) pueden seguir usando `usePlantillas` directo. La migración a `usePlantillaWithOverrides` se hace componente por componente.

Si un componente no ha migrado, simplemente no aplica overrides — el render es idéntico al canónico actual. Esto reduce el riesgo de regresión durante el rollout y permite migrar gradualmente.

### R7 — Cada bump de capa1 que introduce `{{ENTIDAD.<key>}}` requiere entrada en `plantilla_changelog`

No existe plantilla que referencie variables `ENTIDAD.*` nuevas sin un registro explícito en changelog con:
- `bump_type='MINOR'` (introducir variables nuevas no rompe contratos previos pero amplía superficie)
- `autor` del PR
- `motivo` que **enumera literalmente las claves introducidas** (ej. *"Introduce ENTIDAD.cargo_secretario_label, ENTIDAD.es_cotizada para adaptación de sociedad X"*)

Esto es el **equivalente técnico del gate de firma legal eliminado** en §2 — la trazabilidad no se relaja, solo se simplifica.

### R8 — Los triggers validadores se testean con rejection paths explícitos

Para cada trigger (T2 value type, T3 opciones+default+motivo+campo+estado, T4 soft-delete+immutability, T5/T6 WORM), el plan de tests debe incluir **al menos 3 casos de rechazo documentados** + happy paths.

No basta con testear el happy path. Detalle completo en §11.2.

### R9 — `compatible_with_canonical_version` se setea manualmente, nunca automáticamente

Cuando un desarrollador crea un override capa3, debe consultar la versión actual de la plantilla canónica y setearla explícitamente en el INSERT. **No hay auto-populate via trigger ni default value.**

Esto fuerza la conciencia de "contra qué versión estoy overrideando". Documentado en §6 — semántica de `compatible_with_canonical_version`.

### R10 — El panel de bloques sectoriales NO aparece por defecto si `sector_regulado = 'GENERICO'`

Para el 70%+ de sociedades sin perfil regulatorio específico, el panel lateral no se renderiza por defecto. Evita ruido visual y preguntas del secretario sobre bloques que no le aplican.

**Matiz** (refinamiento del review adversarial): toggle "Mostrar todos los bloques disponibles" siempre visible en cabecera del composer. Permite al secretario consultar bloques GENERICO o de otros sectores en casos edge sin requerir cambio de configuración. Detalle UX en §5.5.

### R11 — No se pueden crear overrides capa3 para plantillas en estado != 'ACTIVA'

Un override sobre una plantilla ARCHIVADA o BORRADOR no tiene sentido — nunca se consumirá. Trigger BEFORE INSERT/UPDATE en T3 valida que `plantillas_protegidas.estado='ACTIVA'` antes de aceptar.

Si una plantilla pasa de ACTIVA → ARCHIVADA después de tener overrides, los existentes quedan huérfanos pero no se borran (auditoría preservada). El dashboard de mantenimiento los lista como "overrides huérfanos".

### R12 — El E2E smoke de v2.0 es estrictamente de regresión

El test E2E principal de cierre v2.0 verifica que el composer renderiza **byte-idénticamente** con y sin la infra nueva cuando no hay overrides activos. Snapshot test con comparación literal del DOM renderizado y/o del documento generado.

Si el render cambia, hay regresión. Esto protege las 41 plantillas operativas actuales y garantiza que la introducción de la infra v2 no afecta la generación canónica.

---

## 12. Estado de aprobación

Este spec consolida las decisiones tomadas en sesión colaborativa 2026-05-10 / 2026-05-11:

- **Análisis de 3 enfoques A/B/C**: enfoque C ya es statu quo; A descartado salvo escape hatch que finalmente no se implementa; B se materializa como overrides granulares + settings + bloques
- **60 casos concretos** validados y distribuidos en 6 categorías con frecuencia esperada 80/20
- **6 puntos de fricción** resueltos: F1 (catálogo cerrado), F2 (migración progresiva — desbloqueada por §2), F3 (versionado con compatibilidad), F4 (copia literal + trazabilidad), F5 (precedencia formal), F6 (multi-jurisdicción out of scope)
- **5 sub-decisiones** confirmadas: A→global, B→global, C→granular, D→solo dashboard, E→poblar todas las ~40 claves
- **Cambio fundacional §2**: eliminación de firma legal bloqueante, gobernanza por catálogo

**Iteración adversarial (post-spec inicial 2026-05-11):**
- **6 huecos identificados y cubiertos inline**: A1 (política evolución catálogo §3.4), A2 (soft-delete + immutability bloques T4), A3 (`default_value` constraint para text en capa1), A4 (RBAC ADMIN_TENANT §5.4), A5 (detalle UX bloques §5.5), A6 (cache invalidation belt-and-suspenders §5.1)
- **4 puntos menores aceptados**: FK `campo` via `jsonb_path_exists` (T3), reconstrucción CI de `usado_por_plantillas` (T1 + §11.6), invalidación catalog explicitada (§5.1), graceful degradation de `campo_libre_sectorial` ausente (§5.3)
- **12 reglas operativas R1-R12** consolidadas en §11bis como guardrails vinculantes para implementación
- **5 riesgos nuevos** añadidos a §10 (cambio breaking value_type, modificación in-place texto_aprobado, cache stale, override sobre plantilla no-ACTIVA, etc.)
- **Tests reforzados** con ≥3 rejection paths por trigger (§11.2) + nuevo CI script `validate-bloques-sectoriales-immutability.ts` (§11.6)

**Próximo paso al aprobar:** invocar skill `writing-plans` para generar plan de implementación detallado con migración SQL, código TypeScript, tests y seed data.

---

## 13. Referencias

- `docs/superpowers/plans/2026-05-10-procedimiento-plantillas-v1.md` — guía operativa v1 (sigue vigente para corrección de plantillas)
- `docs/superpowers/plans/2026-05-10-b9-script-consolidado-final.sql` — rollup canónico B9 del catálogo actual
- `supabase/migrations/20260419_000004_plantillas_protegidas.sql` — schema base de `plantillas_protegidas`
- `supabase/migrations/20260419_000001_rule_engine_tables.sql` — `rule_param_overrides` (statu quo Cat. 1)
- `supabase/migrations/20260420_000015_pactos_parasociales.sql` — `pactos_parasociales` (parte de Cat. 1 vía motor)
- `src/lib/doc-gen/variable-resolver.ts` — punto de integración para `entity_settings` (§5.1)
- `src/lib/rules-engine/` — motor LSC (consumidor de `rule_param_overrides`, no se toca en v2)

---

**FIN del spec v2.0 — diseño cerrado, pendiente de aprobación final del usuario antes de pasar a plan de implementación.**
