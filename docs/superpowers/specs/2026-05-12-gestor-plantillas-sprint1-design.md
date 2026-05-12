# Gestor de Plantillas — Sprint 1 (refactor consola post-v2.0) — Design

**Fecha:** 2026-05-12
**Módulo:** Secretaría Societaria / Plantillas protegidas
**Base:** Plan `2026-05-12-plan-refactor-consola-plantillas-post-v2.md` + memoria de estado del catálogo Cloud demo ARGA.
**Worktree:** `claude/compassionate-elbakyan-63e406`
**Estado:** Diseño cerrado, pendiente de aprobación para writing-plans.

---

## 1. Contexto y objetivo

Tras los commits del 11–12 mayo (PR #1 v2-plantillas-overrides, PR #2 agenda-item-kind, y la cascada de fixes posteriores), la infraestructura v2.0 de plantillas está desplegada y el catálogo ARGA Cloud está saneado:

- 41 plantillas `ACTIVA` con metadata completa (firma, ref. legal, fecha, organo_tipo canónico, capa1 ≥100 chars).
- 35 archivadas (legacy con issues ya retirado).
- 14/14 combinaciones core v1.0 cubiertas con exactamente una plantilla activa.
- 0 duplicados funcionales activos.
- 2 plantillas activas con P0 semánticos pendientes de corrección legal: `FUSION_ESCISION` (sin condicional informe de experto) y `RATIFICACION_ACTOS` (sin campo obligatorio de identificación).
- Infra v2.0 lista pero sin uso operativo: `entity_settings_catalog` (36 claves), `entity_settings` (0), `plantilla_capa3_overrides_por_entidad` (0), `bloques_sectoriales` (10), `bloque_insertions` (0), `plantilla_changelog` (0).

**Objetivo del Sprint 1:** convertir la infraestructura v2.0 en una **consola operativa unificada** que permita importar plantillas, validar pre-activación, registrar changelog y centralizar transiciones de estado, sin requerir migraciones nuevas en Cloud.

**Fuera de Sprint 1 (Sprint 2+):** editor tri-capa, configuración por sociedad (`entity_settings` UI), administración de overrides Capa 3, gestión de bloques sectoriales desde UX, auditoría completa con diff visual, CI bloqueante de Gate PRE.

---

## 2. Estado actual y baseline congelada

### 2.1 Inventario Cloud (tenant demo `00000000-0000-0000-0000-000000000001`, snapshot 2026-05-12)

| Tipo | ACTIVA | ARCHIVADA |
|---|---|---|
| MODELO_ACUERDO | 25 | 12 |
| ACTA_SESION | 3 | 4 |
| CONVOCATORIA | 3 | 2 |
| ACTA_CONSIGNACION | 2 | 4 |
| Otros documentales (8 tipos) | 8 | 13 |
| **Total** | **41** | **35** |

### 2.2 Cobertura core v1.0

Las 14 combinaciones órgano/materia core (definidas en §4 del plan refactor) están cubiertas con exactamente 1 plantilla `ACTIVA` cada una.

### 2.3 Plantillas con P0 pendiente (toleradas en Sprint 1)

| ID | Materia | Issue | Política |
|---|---|---|---|
| `e3697ad9-e0c2-4baf-9144-c80a11808c07` | `FUSION_ESCISION` | `capa1_inmutable` no condiciona informe de experto en fusiones simplificadas (art. 53 RDL 5/2023) | `ACTIVE_WITH_P0` badge + WARNING runtime en `GenerarDocumentoStepper` |
| `edd5c389-0187-476c-9592-c020058fdc69` | `RATIFICACION_ACTOS` | `capa3_editables` sin campo obligatorio para identificación de actos | Idem |

Ambas conservan estado `ACTIVA` para no romper flujos demo. Reactivación tras archivado no permitida; nueva versión exige Gate PRE estricto.

### 2.4 Backup A — política de respaldo

Antes del primer commit funcional del sprint:

1. **Commit baseline** `chore(secretaria): baseline plantillas pre-refactor (Backup A)`.
2. Dump SQL read-only en `docs/superpowers/baselines/2026-05-12-plantillas-baseline.sql` con: counts por estado y tipo, IDs ACTIVA con metadata, IDs P0 conocidos, hash SHA-256 del set ordenado de IDs.
3. Snapshot de rutas: `docs/superpowers/baselines/2026-05-12-rutas-plantillas-baseline.txt` con la salida de `grep -r "secretaria/plantillas\|admin/PlantillasMantenimiento\|plantillas-tracker" src/`.
4. Test `src/lib/secretaria/__tests__/baseline-plantillas.test.ts` que afirma estado bueno y falla si el sprint accidentalmente degrada el catálogo.
5. Páginas legacy (`PlantillasTracker.tsx`, `admin/PlantillasMantenimiento.tsx`) se borran del repo en el sprint pero quedan recuperables vía `git show <baseline-sha>:path`.

---

## 3. Decisiones tomadas

| # | Decisión | Justificación |
|---|---|---|
| 1 | Sprint scope = Fases 0, 0-bis, 1, 8-parcial, 2, 7-parcial del plan refactor | Permite cerrar consola + importador + Gate PRE + changelog sin abrir editor/settings/overrides/bloques |
| 2 | Sin migraciones; todo TypeScript + rollback compensatorio | Política congelada de CLAUDE.md; race conditions cubiertos en preflight y dashboard de huérfanos |
| 3 | RBAC: ADMIN_TENANT para write (Importar, Validación), SECRETARIO/COMPLIANCE/ADMIN_TENANT read (Dashboard, Catálogo, Cobertura, Métricas, Auditoría) | LEGAL_OPS diferido; consola accesible a más roles en read-only sin migrar RBAC |
| 4 | Tabs Sprint 1 únicamente; sin tabs fantasma "Próximamente" | Limpieza UX; redirect `/plantillas-tracker` → `?tab=metricas`; eliminar `/admin/PlantillasMantenimiento` |
| 5 | Servicio TS centraliza transiciones + Gate PRE en APROBADA→ACTIVA + changelog en cada transición | `useUpdateEstadoPlantilla` se reescribe internamente para delegar al servicio sin romper consumers |
| 6 | Arquitectura modular: `template-admin/` lib + `hooks/secretaria/` + `components/secretaria/gestor/` | Aislamiento, testabilidad, isolation per skill brainstorming |
| 7 | Backup A: baseline + dump + snapshot tests + páginas viejas borradas | Recuperable via git; oráculo en CI |
| 8 | Gate PRE: 12 BLOCKING + 4 WARNING + 2 INFO + 2 reglas semánticas P0 + ACK en warnings | Pure function; reutilizable por importador, ValidaciónTab y runtime |
| 9 | Schema importador con regex variable extendida, materia enum cerrado, organo enum ampliado con alias, fuente glossary canónico, .strict() | Corpus real demanda multi-segmento dotted paths; legacy `ENTIDAD` aceptado con WARNING |
| 10 | P0 toleradas con badge `ACTIVE_WITH_P0` + WARNING runtime en `GenerarDocumentoStepper` | Demo no rompe; presión visible para corrección |

---

## 4. Arquitectura

### 4.1 Módulos nuevos

```
src/lib/secretaria/template-admin/
  index.ts                          # Re-exports público
  types.ts                          # TemplateImportPayload, GatePreResult, TransitionResult
  organo-canonico.ts                # Enum + normalizeOrganoTipo() + aliases
  functional-key.ts                 # buildFunctionalKey(), detectActiveDuplicate(), CORE_V1_MATERIAS
  known-p0.ts                       # KNOWN_P0_TEMPLATE_IDS + descripciones legales
  gate-pre.ts                       # validateTemplateForActivation() headless
  gate-pre-semantic.ts              # SEM_FUSION_EXPERTO + SEM_RATIFICACION
  template-import-schema.ts         # Zod schema secretaria.template_import.v1
  template-importer.ts              # parseImport(), buildDraftRows(), preflight(),
                                    # convertCloudRowToImportPayload()
  template-admin-service.ts         # createDraft, transition, archive, activate
  changelog.ts                      # appendChangelog(), buildDiffSummary(), idempotencyKey()
  cloud-helpers.ts                  # loadAllActiveTemplates(), computeCoreCoverage(),
                                    # detectAllActiveDuplicates(), countOrphanTemplates()
  __tests__/                        # Unitarios por archivo (~95 cases)
```

**Tipos compartidos heredados (no redefinidos):**

- `TipoEnum` — proviene de `src/hooks/usePlantillasProtegidas.ts` (PlantillaProtegidaRow.tipo).
- `AdoptionModeEnum` — proviene de `src/lib/rules-engine/types.ts`.
- `Capa3FieldSchema` — proviene de `src/lib/secretaria/capa3-fields.ts`.

El módulo `template-admin` consume estos tipos, no los duplica. Si una validación nueva exige extenderlos, se hace en su archivo original.

### 4.2 Hooks delgados

```
src/hooks/secretaria/
  useCreatePlantillaDraft.ts
  useImportPlantillaPackage.ts
  useTransitionPlantillaState.ts
  useActivatePlantilla.ts
  useArchivePlantilla.ts
  usePlantillaChangelog.ts
```

`useUpdateEstadoPlantilla` actual (en `usePlantillasProtegidas.ts`) **se reescribe internamente** para delegar al servicio. Firma pública intacta para no romper consumers.

### 4.3 Componentes de la consola

```
src/pages/secretaria/GestorPlantillas.tsx          # Shell + lectura ?tab
src/components/secretaria/gestor/
  KpiCard.tsx                                       # Extraído de PlantillasTracker
  AlertBanner.tsx                                   # Extraído de PlantillasTracker
  tab-guards.ts                                     # useTabAccess(), TAB_PERMISSIONS
  DashboardTab.tsx                                  # 8 KPIs + acciones rápidas + alertas
  CatalogoTab.tsx                                   # Lista filtrable, badges, ACTIVE_WITH_P0
  CoberturaLegalTab.tsx                             # Matriz Cloud vs core v1.0 + 14 combinaciones
  ImportarTab.tsx                                   # Host del wizard
  TemplateImportWizard.tsx                          # 5 pasos
  MetricasTab.tsx                                   # Absorbe contenido de PlantillasTracker
  AuditoriaTab.tsx                                  # Changelog filtrable + overrides + huérfanos
  ValidacionTab.tsx                                 # Rerun Gate PRE global + drilldown por plantilla
```

### 4.4 Páginas eliminadas en Sprint 1

- `src/pages/secretaria/PlantillasTracker.tsx` → contenido absorbido por `MetricasTab`. Ruta redirige a `?tab=metricas`.
- `src/pages/admin/PlantillasMantenimiento.tsx` → contenido absorbido por `AuditoriaTab`. Ruta borrada de `App.tsx`.

### 4.5 Páginas intactas

- `src/pages/secretaria/Plantillas.tsx` — catálogo de uso para Secretario. Sin cambios.

---

## 5. Gate PRE headless

Función pura, sin acceso a DB salvo preflight de duplicados. Reutilizable por importador, `ValidacionTab` y verificaciones runtime.

### 5.1 API

```typescript
export type GatePreIssue = {
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  field?: string;
  hint?: string;
};

export type GatePreResult = {
  ok: boolean;
  issues: GatePreIssue[];
  summary: { blocking: number; warning: number; info: number };
};

export async function validateTemplateForActivation(
  template: PlantillaCandidate,
  ctx: { tenantId: string; existingActiveTemplates: PlantillaRow[] }
): Promise<GatePreResult>;
```

### 5.2 Reglas BLOCKING

| Código | Verifica |
|---|---|
| `META_ORGANO_NULL` | `organo_tipo` no nulo y dentro del enum canónico |
| `META_ORGANO_ALIAS_NOT_RESOLVED` | Alias resolvible o falla |
| `META_REF_LEGAL_FORMAT` | `referencia_legal` empieza por `Art.`, `Arts.`, contiene `LSC/RRM/RDL/LMV/RDLeg/CCom/...` |
| `META_VERSION_SEMVER` | `version` cumple semver (con soporte de build metadata) |
| `META_APROBADA_POR` | `aprobada_por` no nulo + `fecha_aprobacion` no nula |
| `META_TIPO_REQUIRED` | `tipo` ∈ enum conocido |
| `CAPA1_LENGTH` | `length(capa1_inmutable) >= 100` |
| `CAPA2_VAR_NO_CATALOGADA` | Toda variable `{{X.Y}}` en capa1 está en `capa2_variables` y catalogada |
| `CAPA2_HELPER_PROHIBIDO` | Helpers Handlebars ∈ allowlist (`if`, `else`, `each`, `unless`) |
| `CAPA3_PREFIJO_PROTEGIDO` | Campos capa3 no empiezan por `ENTIDAD.`, `ORGANO.`, etc. |
| `DUP_ACTIVE_FUNCTIONAL_KEY` | No hay otra ACTIVA con misma clave funcional |
| `ENTITY_REF_FORBIDDEN` | Payload no contiene `entity_id`, `entity_name`, `sociedad`, `tenant_id` |
| `SEM_FUSION_EXPERTO_CONDICIONAL` | Si `materia=FUSION_ESCISION` → `capa1_inmutable` contiene rama `{{#if requiere_experto}}` o equivalente |
| `SEM_RATIFICACION_IDENTIFICACION` | Si `materia=RATIFICACION_ACTOS` → existe campo capa3 obligatorio con `min_length` o enumeración para identificación de actos |

### 5.3 Reglas WARNING (no bloquean; ACK requerido en importador)

| Código | Verifica |
|---|---|
| `GEN_IF_COUNT` | Más de 3 ramas `{{#if ...}}` de primer nivel en capa1 |
| `GEN_TIPO_OPERACION_OPCIONES` | Algún campo capa3 `tipo_operacion_*` con más de 2 opciones |
| `META_REVIEWER_MISSING` | `revisado_por` nulo |
| `LEGACY_METADATA_INCOMPLETE` | Plantilla pre-Phase 4 con `organo_tipo` viejo |
| `LEGACY_FUENTE_ENTIDAD` | Variable con fuente `ENTIDAD` literal (legacy); recomendar `entities.name` |
| `PENDIENTE_INGENIERIA` | Variable con fuente fuera del glosario canónico |
| `CAPA2_3_DUPLICATE` | Campo presente tanto en capa2 como capa3 |

### 5.4 Reglas INFO

| Código | Verifica |
|---|---|
| `META_COBERTURA_CORE_V1` | Plantilla cubre una de las 14 combinaciones core |
| `CAPA2_UNUSED_VARIABLE` | Variable declarada en capa2 pero no usada en capa1 |

### 5.5 Calibración inicial obligatoria (test commit 3)

Ejecutar Gate PRE sobre las 41 ACTIVA debe devolver **exactamente 2 BLOCKING**: los IDs en `KNOWN_P0_TEMPLATE_IDS`. Cualquier BLOCKING adicional bloquea el sprint y exige recalibrar.

### 5.6 Política de WARNING en importador

Si hay warnings pero 0 blocking, el wizard exige ACK explícito con motivo escrito (≥20 chars). El motivo va al `plantilla_changelog` del borrador creado.

---

## 6. Importador JSON

### 6.1 Schema `secretaria.template_import.v1`

```typescript
const VARIABLE_PATTERN = /^[A-Za-z_]+(?:\.[A-Za-z_]+){1,4}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const REF_LEGAL_PATTERN = /^(Art\.|Arts\.|art\.|arts\.).*\b(LSC|RRM|RDL|LMV|RDLeg|CCom|RDL\d+|RDLey)\b/;

const MateriaEnum = z.enum([
  // 23 materias de modelo de acuerdo
  'APROBACION_CUENTAS', 'APROBACION_PLAN_NEGOCIO', 'AUMENTO_CAPITAL',
  'AUTORIZACION_GARANTIA', 'ACCION_SOCIAL_RESPONSABILIDAD', 'ACTIVOS_ESENCIALES',
  'CESE_CONSEJERO', 'COMITES_INTERNOS', 'DELEGACION_FACULTADES',
  'DISTRIBUCION_CARGOS', 'DISTRIBUCION_DIVIDENDOS', 'FORMULACION_CUENTAS',
  'FUSION_ESCISION', 'MODIFICACION_ESTATUTOS', 'NOMBRAMIENTO_AUDITOR',
  'NOMBRAMIENTO_CONSEJERO', 'OPERACION_VINCULADA', 'POLITICA_REMUNERACION',
  'POLITICAS_CORPORATIVAS', 'RATIFICACION_ACTOS', 'REDUCCION_CAPITAL',
  'SEGUROS_RESPONSABILIDAD', 'TRANSFORMACION',
  // Materias documentales
  'CONVOCATORIA_JUNTA', 'CONVOCATORIA_CDA', 'CONVOCATORIA_COMISION_DELEGADA',
  'NOTIFICACION_CONVOCATORIA_SL', 'JUNTA_GENERAL', 'CONSEJO_ADMIN',
  'ACTA_COMISION_DELEGADA', 'ACUERDO_SIN_SESION', 'DECISION_SOCIO_UNICO',
  'DECISION_ADMIN_UNICO', 'CO_APROBACION', 'ADMIN_SOLIDARIO',
  'CERTIFICACION_ACUERDOS', 'EXPEDIENTE_PRE', 'CONVOCATORIA_PRE',
  'GESTION_SOCIEDAD',
]);

const OrganoCanonicoEnum = z.enum([
  'JUNTA_GENERAL', 'CONSEJO_ADMIN', 'ORGANO_ADMIN',
  'SOCIO_UNICO', 'ADMIN_UNICO',
  'ADMIN_CONJUNTA_O_COAPROBADORES', 'ADMIN_SOLIDARIOS',
  'COMISION_DELEGADA', 'SOPORTE_INTERNO', 'DERIVADO_DEL_ACTO',
]);

const ORGANO_ALIAS: Record<string, string> = {
  CONSEJO_ADMINISTRACION: 'CONSEJO_ADMIN',
  CONSEJO: 'CONSEJO_ADMIN',
  ADMIN_CONJUNTA: 'ADMIN_CONJUNTA_O_COAPROBADORES',
  ADMIN_SOLIDARIO: 'ADMIN_SOLIDARIOS',
};

const FuenteEnum = z.enum([
  'entities.name', 'entities.*',
  'agreements.*', 'agreement.*',
  'governing_bodies.*', 'mandate.*',
  'meetings.*',
  'capital_holdings.*', 'cap_table.*', 'parte_votante.*',
  'persons.*',
  'LEY', 'ESTATUTOS', 'PACTO_PARASOCIAL', 'REGLAMENTO',
  'rule_pack.*', 'evaluar*', 'calcular*',
  'QTSP.*', 'SISTEMA.*',
  'ENTIDAD',
  'USUARIO',
]);

export const TemplateImportSchema = z.object({
  schema_version: z.literal('secretaria.template_import.v1'),
  template: z.object({
    tipo: TipoEnum,
    materia: MateriaEnum,
    materia_acuerdo: z.string().optional(),
    jurisdiccion: z.enum(['ES', 'BR', 'MX', 'PT', 'UK', 'FR', 'DE']),
    version: z.string().regex(SEMVER),
    organo_tipo: OrganoCanonicoEnum,
    adoption_mode: AdoptionModeEnum,
    referencia_legal: z.string().regex(REF_LEGAL_PATTERN),
    tipo_social: z.enum(['SA', 'SL', 'SLU', 'SAU']).optional().nullable(),
    snapshot_rule_pack_required: z.boolean().optional(),
    contrato_variables_version: z.string().optional(),
  }),
  capa1_inmutable: z.string().min(100),
  capa2_variables: z.array(z.object({
    variable: z.string().regex(VARIABLE_PATTERN),
    fuente: FuenteEnum,
    condicion: z.string().default('SIEMPRE'),
  })),
  capa3_editables: z.array(Capa3FieldSchema),
  notas_legal: z.string().optional(),
}).strict();
```

`.strict()` rechaza campos desconocidos: `entity_id`, `entity_name`, `sociedad`, `tenant_id`, `id`, `aprobada_por`, `fecha_aprobacion`, `estado`, `created_at`, `updated_at`.

### 6.2 Modo batch service-role `FIRMA_LEGAL_BATCH`

```typescript
export const TemplateBatchImportSchema = z.object({
  schema_version: z.literal('secretaria.template_import.v1'),
  mode: z.literal('FIRMA_LEGAL_BATCH'),
  templates: z.array(TemplateImportSchema.shape).min(1).max(50),
  batch_meta: z.object({
    aprobada_por: z.string().min(10),
    fecha_aprobacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    motivo: z.literal('FIRMA_LEGAL_BATCH'),
  }),
});
```

Solo accesible vía `scripts/import-templates-batch.ts` con credencial service-role. Permite estado inicial `REVISADA` con firma entrante. Genera changelog masivo individualizado.

### 6.3 Wizard 5 pasos (UX)

| Paso | UI | Lógica |
|---|---|---|
| 1. Descargar base | Botón download + link a guía `.md` | Estático |
| 2. Subir JSON | Drop zone + file input; `application/json`, <1MB | Parse → error inline con línea/columna si falla |
| 3. Preflight | Resumen del payload + lista de issues Gate PRE | `validateTemplateForActivation(payload, ctx)` |
| 4. Resolver warnings | Solo si WARNINGS y 0 BLOCKING; textarea motivo (≥20 chars) | ACK obligatorio para avanzar |
| 5. Crear borrador | Resumen final + botón "Crear borrador" | `useImportPlantillaPackage()` |

Si hay BLOCKING en paso 3, no se avanza. Botón secundario "Reportar a Legal Ops" genera bug template en clipboard.

### 6.4 Función transaccional con rollback compensatorio

```typescript
export async function createDraftFromImport(
  payload: TemplateImportPayload,
  ctx: { tenantId: string; actor: string; ackMotivo?: string }
): Promise<{ plantillaId: string }> {
  // 0. Re-check duplicado funcional (race mitigation)
  const dup = await detectFunctionalDuplicate(payload.template, ctx.tenantId);
  if (dup) throw new ImportError('DUP_RACE_DETECTED', dup);

  // 1. Insert plantilla con estado='BORRADOR'
  const { data: plantilla, error: e1 } = await supabase
    .from('plantillas_protegidas')
    .insert(buildDraftRow(payload, ctx))
    .select('id')
    .single();
  if (e1) throw new ImportError('PLANTILLA_INSERT_FAILED', e1);

  // 2. Append changelog (rollback compensatorio si falla)
  try {
    await appendChangelog({
      plantillaId: plantilla.id,
      tenantId: ctx.tenantId,
      bumpType: 'MINOR',
      motivo: 'IMPORT',
      diff_summary: { action: 'IMPORT', source: 'wizard', ack: !!ctx.ackMotivo },
      fromVersion: null,
      toVersion: payload.template.version,
      autor: ctx.actor,
      ackMotivo: ctx.ackMotivo ?? null,
    });
  } catch (e2) {
    await supabase.from('plantillas_protegidas').delete().eq('id', plantilla.id);
    throw new ImportError('CHANGELOG_INSERT_FAILED', e2);
  }

  return { plantillaId: plantilla.id };
}
```

Riesgo residual de huérfanos (delete compensatorio que también falla) se mitiga con check "plantillas sin changelog" en el Dashboard.

### 6.5 Artefactos descargables

- `public/templates/secretaria/plantilla-base-importacion.v1.json`
- `docs/superpowers/specs/2026-05-12-plantilla-base-importacion.md` (guía humana)

Generación del JSON desde el schema vía `src/lib/secretaria/template-admin/sample.ts`.

---

## 7. Servicio de transiciones + changelog

### 7.1 State machine

```
BORRADOR ─→ REVISADA ─→ APROBADA ─→ ACTIVA
   ▲          │           │           │
   │          └─ volver ──┘           │
   └─────────────────────────────────┘
                                       └─→ ARCHIVADA (terminal; no reactivable)
```

Reglas:

| Transición | Gate PRE | Otros requisitos |
|---|---|---|
| BORRADOR → REVISADA | ❌ | Metadata core coherente |
| REVISADA → APROBADA | ❌ | `aprobada_por` y `fecha_aprobacion` no nulas |
| APROBADA → ACTIVA | ✅ sin BLOCKING; WARNINGS exigen `ackWarnings=true` | — |
| `*` → ARCHIVADA | ❌ | — |
| REVISADA/APROBADA → BORRADOR | ❌ | Solo si la plantilla nunca fue `ACTIVA` (consulta `plantilla_changelog`) |
| ARCHIVADA → ACTIVA | ❌ **Prohibido** | Forzar nueva versión vía importador |

`isTransitionAllowed(current, to, plantillaId)` consulta `plantilla_changelog` para determinar si la plantilla pasó por `ACTIVA` en algún momento.

**Edge case grandfather pre-Sprint 1:** las plantillas existentes pre-sprint no tienen entradas en `plantilla_changelog` (tabla actualmente con 0 filas). Para estos casos, la regla aplica una heurística complementaria: **si la plantilla está hoy `ACTIVA` o `ARCHIVADA` y no tiene changelog, se asume que estuvo `ACTIVA` históricamente** (el saneamiento Phase 4 archivó plantillas previamente activas). Esto preserva la disciplina "una vez ACTIVA, no se rebobina a BORRADOR sin crear nueva versión" incluso sin trazabilidad histórica.

### 7.2 API del servicio

```typescript
export type TransitionInput = {
  plantillaId: string;
  to: 'BORRADOR' | 'REVISADA' | 'APROBADA' | 'ACTIVA' | 'ARCHIVADA';
  motivo: string;       // ≥10 chars, requerido
  actor: string;
  ackWarnings?: boolean;
};

export type TransitionResult =
  | { ok: true; plantillaId: string; from: string; to: string; changelogId: string }
  | { ok: false; reason: 'GATE_PRE_BLOCKING'; issues: GatePreIssue[] }
  | { ok: false; reason: 'WARNINGS_NEED_ACK'; issues: GatePreIssue[] }
  | { ok: false; reason: 'INVALID_TRANSITION'; from: string; to: string }
  | { ok: false; reason: 'CHANGELOG_FAILED'; rolledBack: boolean };

export async function transitionTemplateState(
  input: TransitionInput,
  ctx: { tenantId: string }
): Promise<TransitionResult>;
```

### 7.3 Schema del changelog

`plantilla_changelog` ya existe (v2.0 sembrada). Se usa la forma actual:

| Campo | Uso en Sprint 1 |
|---|---|
| `bump_type` | `PATCH` (transición), `MINOR` (import ordinario / cambio capa3), `MAJOR` (import con efecto jurídico mayor) |
| `motivo` | Texto libre humano (`IMPORT`, `STATE_CHANGE`, `FIRMA_LEGAL_BATCH`, `ARCHIVADO`, etc.) |
| `diff_summary` | JSON estructurado: `{ action, from_state?, to_state?, source, ack? }` |
| `from_version` / `to_version` | Versiones semver |
| `autor` | Email o user.id |
| `created_at` | Timestamp |

### 7.4 Idempotencia

```typescript
const idempotencyKey = sha256(
  plantillaId + '|' + toVersion + '|' + bucket5s(timestamp)
);
```

Ventana 5 segundos cubre doble-click sin permitir colapsar acciones legítimas posteriores. Si no existe columna `idempotency_key` en la tabla, se codifica como sufijo `[idemp:<hash>]` en `motivo` y se verifica con query previa.

### 7.5 Hooks

```typescript
useTransitionPlantillaState()
useActivatePlantilla()
useArchivePlantilla()
useCreatePlantillaDraft()
useImportPlantillaPackage()
usePlantillaChangelog(plantillaId?)
```

`useUpdateEstadoPlantilla` existente delega al servicio. Firma intacta.

---

## 8. Rutas, navegación y RBAC

### 8.1 Rutas en `App.tsx`

```tsx
<Route path="/secretaria/plantillas"        element={<Plantillas />} />
<Route path="/secretaria/gestor-plantillas" element={<GestorPlantillas />} />
<Route
  path="/secretaria/plantillas-tracker"
  element={<Navigate to="/secretaria/gestor-plantillas?tab=metricas" replace />}
/>
{/* /admin/PlantillasMantenimiento — ELIMINADA */}
```

### 8.2 Tabs en la consola

```
?tab=dashboard     (default)
?tab=catalogo
?tab=cobertura
?tab=importar
?tab=metricas
?tab=auditoria
?tab=validacion
```

Lectura via `useSearchParams` con `replace: true` para no contaminar el historial.

### 8.3 RBAC por tab

```typescript
const TAB_PERMISSIONS: Record<TabId, ('SECRETARIO'|'COMPLIANCE'|'ADMIN_TENANT')[]> = {
  dashboard:  ['SECRETARIO', 'COMPLIANCE', 'ADMIN_TENANT'],
  catalogo:   ['SECRETARIO', 'COMPLIANCE', 'ADMIN_TENANT'],
  cobertura:  ['SECRETARIO', 'COMPLIANCE', 'ADMIN_TENANT'],
  metricas:   ['SECRETARIO', 'COMPLIANCE', 'ADMIN_TENANT'],
  auditoria:  ['SECRETARIO', 'COMPLIANCE', 'ADMIN_TENANT'],
  importar:   ['ADMIN_TENANT'],
  validacion: ['ADMIN_TENANT'],
};
```

Tabs no permitidas no se renderizan. Deep-link a tab no permitido → redirect a `?tab=dashboard` + toast.

### 8.4 Sidebar

`src/components/secretaria/shell/navigation.ts`:

| Item | Acción |
|---|---|
| Plantillas (catálogo de uso) | Sin cambios (`/secretaria/plantillas`) |
| Gestor de plantillas | Sin cambios de path; icono `LayoutDashboard` |
| Plantillas tracker | **Eliminado del sidebar** (la ruta queda como redirect) |

---

## 9. Dashboard del Gestor

### 9.1 KPIs (grid 2×4)

| # | KPI | Fuente | Tono |
|---|---|---|---|
| 1 | Total activas | `COUNT(*) WHERE estado='ACTIVA'` | success ≥41 |
| 2 | Cobertura core v1.0 | `n_cubiertas / CORE_V1_MATERIAS_COUNT` | success si = `CORE_V1_MATERIAS_COUNT` |
| 3 | Plantillas con P0 activo | `auditTemplateInventory().filter(p0)` | error si >0 |
| 4 | Borradores pendientes | `COUNT(*) WHERE estado='BORRADOR'` | neutral |
| 5 | Plantillas sin changelog (huérfanas) | `plantillas LEFT JOIN changelog WHERE changelog IS NULL` | warning si >0 |
| 6 | Sociedades con settings | `COUNT(DISTINCT entity_id) FROM entity_settings` | neutral |
| 7 | Bloques sectoriales activos | `COUNT(*) FROM bloques_sectoriales` | neutral |
| 8 | Última actividad changelog | `MAX(created_at) FROM plantilla_changelog` | informativo |

`CORE_V1_MATERIAS_COUNT` se exporta desde `template-admin/functional-key.ts` derivado de `CORE_V1_MATERIAS.length`.

### 9.2 Acciones rápidas

| Botón | RBAC | Navega a |
|---|---|---|
| Importar plantilla | ADMIN_TENANT | `?tab=importar` |
| Revisar cobertura legal | Todos | `?tab=cobertura` |
| Ver auditoría reciente | Todos | `?tab=auditoria` |
| Ejecutar Gate PRE global | ADMIN_TENANT | `?tab=validacion` |

### 9.3 Alertas

`buildDashboardAlerts(catalogo, changelog, audit)`:

| Condición | Severidad | Mensaje |
|---|---|---|
| `n_huerfanas > 0` | WARNING | "N plantillas sin changelog — revisar Auditoría" |
| `n_p0_activas > 0` (intersección con `KNOWN_P0_TEMPLATE_IDS`) | ERROR | "N plantillas activas con P0 conocido pendiente Comité Legal: [lista]" |
| `cobertura_core < CORE_V1_MATERIAS_COUNT` | ERROR | "Cobertura core v1.0 incompleta: N/14" |
| `borradores_olvidados > 0` (sin tocar >30 días) | WARNING | "N borradores sin tocar en >30 días" |
| `gate_pre_blocking_global > 0` (**excluyendo** `KNOWN_P0_TEMPLATE_IDS`) | ERROR | "N plantillas ACTIVA fallarían Gate PRE actual (regresión inesperada)" |

La última alerta se calcula vía `useQuery` con `staleTime: 5min`; resultado se reutiliza en `ValidacionTab`.

### 9.4 Empty state

Si `n_activas === 0`, oculta KPIs y secciones, muestra CTA primario "Importar tus primeras plantillas" → `?tab=importar`.

---

## 10. Tests

### 10.1 Resumen

| Categoría | Archivos | Cases nuevos | Ejecución |
|---|---|---|---|
| Unitarios (`template-admin/__tests__/`) | 9 | ~95 | `bun test` <30s (mocks Supabase) |
| Schema vs Cloud (`src/test/schema/`) | 5 | ~15 | `bun test` <120s |
| E2E (`e2e/`) | 5 | ~20 | `bunx playwright` <5min |
| Snapshot baseline | 1 | 1 | `bun test` <10s |
| **Total** | **20** | **~131** | — |

### 10.2 Unitarios

```
template-admin/__tests__/
  organo-canonico.test.ts              (12 cases)
  functional-key.test.ts               (8 cases)
  gate-pre.test.ts                     (19 cases)
  gate-pre-semantic.test.ts            (4 cases)
  template-import-schema.test.ts       (14 cases)
  template-importer.test.ts            (12 cases)
  template-admin-service.test.ts       (18 cases)
  changelog.test.ts                    (6 cases)
  known-p0.test.ts                     (2 cases)
```

Todos mockean Supabase vía `src/test/helpers/supabase-mock.ts`. Cero red.

### 10.3 Schema vs Cloud

```
src/test/schema/
  template-admin-cloud-baseline.test.ts          # Backup A
  template-admin-changelog.test.ts               # Forma de plantilla_changelog
  template-admin-coverage-core.test.ts           # 14/14 cobertura
  gate-pre-cloud-calibration.test.ts             # Commit 3: exactamente 2 BLOCKING conocidos
  template-import-schema-real-data.test.ts       # Commit 6: parsea 41 ACTIVA con convertCloudRowToImportPayload
```

`template-admin-cloud-baseline.test.ts`:

```typescript
const SNAPSHOT_DATE = '2026-05-12';

it(`catálogo ARGA mantiene baseline (snapshot ${SNAPSHOT_DATE})`, async () => {
  const { data } = await supabase
    .from('plantillas_protegidas')
    .select('id, estado, organo_tipo, aprobada_por, referencia_legal, fecha_aprobacion')
    .eq('tenant_id', DEMO_TENANT);

  const rows = data ?? [];
  const activas = rows.filter(r => r.estado === 'ACTIVA');

  expect(activas.length).toBeGreaterThanOrEqual(41);
  expect(activas.every(r => r.organo_tipo !== null)).toBe(true);

  const firmadas = activas.filter(
    r => r.aprobada_por !== null
      && r.aprobada_por !== ''
      && !/^(falta|pendiente)/i.test(r.aprobada_por)
  );
  expect(firmadas.length).toBeGreaterThanOrEqual(41);
  expect(firmadas.every(r => r.referencia_legal !== null && r.fecha_aprobacion !== null)).toBe(true);
});

it('cobertura core v1.0 se mantiene', async () => {
  const coverage = await computeCoreCoverage(DEMO_TENANT);
  expect(coverage.covered).toBe(CORE_V1_MATERIAS_COUNT);
  expect(coverage.gaps).toEqual([]);
});

it('no hay duplicados funcionales activos', async () => {
  expect(await detectAllActiveDuplicates(DEMO_TENANT)).toEqual([]);
});
```

`gate-pre-cloud-calibration.test.ts` (commit 3):

```typescript
it('Gate PRE sobre catálogo Cloud devuelve exactamente 2 BLOCKING conocidos', async () => {
  const activas = await loadAllActiveTemplates(DEMO_TENANT);
  const ctx = { tenantId: DEMO_TENANT, existingActiveTemplates: activas };
  let totalBlocking = 0;
  const blockingIds: string[] = [];
  for (const t of activas) {
    const result = await validateTemplateForActivation(t, ctx);
    if (result.summary.blocking > 0) {
      totalBlocking += result.summary.blocking;
      blockingIds.push(t.id);
    }
  }
  expect(totalBlocking).toBe(2);
  expect(blockingIds.sort()).toEqual([...KNOWN_P0_TEMPLATE_IDS].sort());
});
```

`template-import-schema-real-data.test.ts` (commit 6):

```typescript
it('parsea las 41 plantillas activas de Cloud como input válido', async () => {
  const activas = await loadAllActiveTemplates(DEMO_TENANT);
  for (const t of activas) {
    const asImport = convertCloudRowToImportPayload(t);
    const result = TemplateImportSchema.safeParse(asImport);
    expect(result.success, `${t.materia} falló: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  }
});
```

### 10.4 E2E

```
e2e/
  21-secretaria-gestor-plantillas-tabs.spec.ts
  22-secretaria-gestor-import-wizard.spec.ts
  23-secretaria-gestor-transitions.spec.ts
  24-secretaria-gestor-rbac.spec.ts
  25-secretaria-tracker-redirect.spec.ts
```

### 10.5 Snapshot baseline

```
src/lib/secretaria/__tests__/baseline-plantillas.test.ts
```

No skip, no flaky. Falla = sprint degradó el catálogo.

### 10.6 Performance baseline

TTFB `/secretaria/gestor-plantillas?tab=dashboard` frío <2.5s en CI.

---

## 11. Plan de ejecución — 8 commits

| # | Commit | Talla | Gate de salida |
|---|---|---|---|
| 1 | `chore(secretaria): baseline plantillas pre-refactor (Backup A)` | S | Test baseline verde, dump comprobado |
| 2 | `feat(secretaria): template-admin module — types + enums + functional key (Fase 0)` | M | ~20 cases verdes, sin tocar UI |
| 3 | `feat(secretaria): Gate PRE headless (Fase 8-parcial)` | M | ~25 cases verdes + calibración Cloud devuelve exactamente 2 BLOCKING conocidos |
| 4 | `feat(secretaria): template-admin service + changelog (Fase 7-parcial)` | L | E2E transición BORRADOR→ACTIVA verde; idempotencia 5s verificada |
| 5 | `feat(secretaria): consola unificada gestor-plantillas — tabs + RBAC (Fase 1)` | L | E2E tabs + RBAC + redirect verdes |
| 6 | `feat(secretaria): importer JSON wizard (Fase 2)` | XL | E2E wizard happy/warning/blocking + schema parsea 41 ACTIVA |
| 7 | `feat(secretaria): batch FIRMA_LEGAL_BATCH service-role script (D6)` | M | Dry-run con fixture verde |
| 8 | `chore(secretaria): eliminar páginas legacy + actualizar CLAUDE.md` | S | Build limpio, 0 imports rotos |

**Talla total:** ~21–24 jornadas / ~3 semanas calendario.

**Hitos visibles:**

- Día 3: Gate PRE headless funcional.
- Día 8: Consola navegable.
- Día 16: Importador UX funcional.
- Día 19: Batch service-role probado en dry-run.
- Día 21: Sprint cerrado, PR a main.

**Fallback demo Garrigues 19–23 mayo:** Si día 16 no hay importador funcional, commit 6 se difiere a Sprint 2 y el sprint cierra con commits 1–5 + 8 (consola unificada + Gate PRE + transiciones).

---

## 12. Criterios de aceptación

- [ ] `bun test` 100% pass, sin tests skip nuevos.
- [ ] `bun run typecheck` 0 errores.
- [ ] `bun run lint` 0 errores; warnings ≤23.
- [ ] `bun run build` clean.
- [ ] `bun run db:check-target` pass.
- [ ] E2E suite extendida (5 specs nuevos) 100% pass.
- [ ] Snapshot baseline test verde tras cada commit.
- [ ] Cobertura `template-admin/*` ≥80%.
- [ ] `/secretaria/gestor-plantillas` accesible desde sidebar; tabs correctos por RBAC.
- [ ] Importar JSON válido crea borrador + changelog atómicamente.
- [ ] Botón "Activar" en plantilla aprobada ejecuta Gate PRE y bloquea si hay BLOCKING.
- [ ] `/secretaria/plantillas` intacta y funcionando.
- [ ] `/secretaria/plantillas-tracker` redirige a `?tab=metricas`.
- [ ] `/admin/PlantillasMantenimiento` eliminada del repo.
- [ ] `CLAUDE.md` actualizado.
- [ ] PR landed en main con `/review` aprobado.

---

## 13. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Schema Zod rechaza plantillas reales | Media | Alta | Test `template-import-schema-real-data` en commit 6: parsea 41 ACTIVA via `convertCloudRowToImportPayload` |
| Rollback compensatorio deja huérfanos | Baja | Media | KPI "plantillas sin changelog" + bound test de 0 huérfanos tras cada commit |
| `useUpdateEstadoPlantilla` rompe consumers | Media | Media | Test integración wrap legacy + grep ampliado en commit 4 |
| E2E Playwright flaky por tiempos del wizard | Media | Baja | `await page.waitForResponse` para inserts; timeout 30s |
| Batch service-role escribe accidentalmente | Baja | Alta | Dry-run obligatorio; aborta sin `--commit` |
| Calibración Gate PRE clasifica issues conocidos como BLOCKING por error | Media | Alta | Test calibración Cloud en commit 3 valida exactamente 2 BLOCKING |
| Cambios paralelos en plantillas durante sprint | Baja | Baja | CLAUDE.md anuncia el sprint; PR paralelas se coordinan |
| Demo Garrigues 19–23 mayo: sprint no cierra a tiempo | Media | Media | Fallback: commit 6 difiere, sprint cierra con 1–5 + 8 |

---

## 14. Fuera de alcance (Sprint 2+)

| Tab/feature | Sprint propuesto |
|---|---|
| Editor tri-capa (Capa 1 markdown/Handlebars, Capa 2 variables, Capa 3 campos) | Sprint 2 |
| Configuración por sociedad (`entity_settings` UI) | Sprint 2 |
| Overrides Capa 3 por sociedad UI | Sprint 2 |
| Bloques sectoriales — biblioteca + edición | Sprint 2 |
| Auditoría con diff visual entre versiones | Sprint 3 |
| CI bloqueante de Gate PRE (Fase 8 completa) | Sprint 3 |
| Migraciones RPC `fn_importar_plantilla_protegida` y `fn_transition_plantilla_estado` | Sprint 3+ si demuestra concurrencia real |
| Índice único parcial de activas | Sprint 3+ |
| Rol `LEGAL_OPS` | Sprint 4+ |
| Importación `.zip` con assets | Sprint 4+ |

---

## 15. Apéndice — Deltas integrados (D1–D16)

Refinamientos acordados durante el brainstorming.

| # | Delta | Sección |
|---|---|---|
| D1 | 2 P0 conocidos: `FUSION_ESCISION` + `RATIFICACION_ACTOS` con badge `ACTIVE_WITH_P0` | §2.3, §9.3 |
| D2 | Regex variable `/^[A-Za-z_]+(?:\.[A-Za-z_]+){1,4}$/` para multi-segmento dotted | §6.1 |
| D3 | `MateriaEnum` cerrado con ~40 valores | §6.1 |
| D4 | `OrganoCanonicoEnum` ampliado + aliases `CONSEJO_ADMINISTRACION → CONSEJO_ADMIN`, etc. | §6.1 |
| D5 | `FuenteEnum` glossary canónico con tokens reservados + legacy `ENTIDAD` con WARNING | §6.1, §5.3 |
| D6 | Modo `FIRMA_LEGAL_BATCH` service-role para migrar legacy firmadas | §6.2, commit 7 |
| D7 | Check "plantillas sin changelog" en Dashboard | §9.1 KPI #5, §9.3 |
| D8 | Variables fuera del glosario → WARNING `PENDIENTE_INGENIERIA`, no BLOCKING | §5.3 |
| D9 | Badge `ACTIVE_WITH_P0` en Catálogo | §4.3, §9.3 |
| D10 | WARNING runtime en `GenerarDocumentoStepper` para FUSION + RATIFICACION | `GenerarDocumentoStepper.tsx` |
| D11 | Constante `CORE_V1_MATERIAS_COUNT` derivada de `CORE_V1_MATERIAS.length` | §4.1, §9.1 |
| D12 | `buildDashboardAlerts` separa alertas P0 conocidos vs `gate_pre_blocking_global` (regresión inesperada) | §9.3 |
| D13 | `known-p0.test.ts` verifica `estado='ACTIVA'` además de existencia | §10.2 |
| D14 | Unitarios mockean Supabase via `src/test/helpers/supabase-mock.ts` | §10.2 |
| D15 | Test `template-import-schema-real-data` en commit 6 parsea 41 ACTIVA con `convertCloudRowToImportPayload` (función reutilizada por batch commit 7) | §10.3, commit 6 |
| D16 | Test `gate-pre-cloud-calibration` en commit 3 valida exactamente 2 BLOCKING conocidos | §5.5, §10.3, commit 3 |

---

**Fin del diseño.** Aprobación pendiente para invocar writing-plans skill.
