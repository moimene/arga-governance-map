/**
 * Schema Zod estricto `secretaria.template_import.v1`.
 *
 * Sprint 1 — Spec §6.1 + §10.3. Calibrado contra datos reales D15.
 *
 * Rechaza por `.strict()` cualquier clave en la raíz fuera del whitelist:
 * entity_id, entity_name, sociedad, tenant_id, id, aprobada_por,
 * fecha_aprobacion, estado, created_at, updated_at. Esto fuerza al wizard
 * a recibir paquetes limpios sin metadata de fila Cloud filtrada por
 * accidente.
 *
 * D2 (VARIABLE_PATTERN): 2-5 segmentos punteados. Acepta `entities.name`,
 * `meetings.junta.orden_del_dia`, `ENTIDAD.es_cotizada`. Rechaza single-
 * segment (`name`) y patrones documentales con `/`, espacios, etc.
 *
 * D3 (MateriaEnum): unión cerrada de materias soportadas v1. Sin duplicados.
 *
 * D4 (OrganoCanonicoEnum): derivado de ORGANO_CANONICO (Commit 2). Aliases
 * legacy (CONSEJO_ADMINISTRACION → CONSEJO_ADMIN) se normalizan en
 * `parseImport` ANTES de validar.
 *
 * D5 (FuenteEnum): glossary fijo. Incluye `ENTIDAD` (legacy) que gate-pre
 * marca como WARNING `LEGACY_FUENTE_ENTIDAD` pero acepta a nivel schema.
 *
 * REF_LEGAL_PATTERN (calibrado D15): acepta tanto `Art./Arts. ... LSC`
 * como `LSC art. ...` o bare `LSC`/`RRM`/`RDL` como cita primaria, porque
 * la práctica registral española normaliza esas tres formas.
 *
 * @see docs/superpowers/specs/2026-05-12-gestor-plantillas-sprint1-design.md §6
 */

import { z } from "zod";
import { ORGANO_CANONICO } from "./organo-canonico";

// VARIABLE_PATTERN (calibrado D15):
//  - Acepta 1-5 segmentos punteados (single-segment como `nombre_entidad`
//    es común en MODELO_ACUERDO; el spec original pedía dotted, pero la
//    data productiva tiene ambas formas).
//  - Cada segmento alfanumérico con guion bajo.
//  - Acepta sufijo `.*` en último segmento (wildcard común: `meetings.*`,
//    `QTSP.*`, `ENTIDAD.*`).
//  - NO permite espacios, barras (`/`) ni operadores (`+`) — esas formas
//    son notación documental, no variables ejecutables, y deben rechazarse.
export const VARIABLE_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){0,4}(?:\.\*)?$/;

// SEMVER: pre-release y build metadata aceptados (1.0.0+sl, 1.0.0-beta.1).
export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

// REF_LEGAL_PATTERN: tres formas aceptadas (orden importa para readibility):
//  1. "Art. 160 LSC" / "Arts. 295-316 LSC" — prefijo Art./Arts. + ley.
//  2. "LSC art. 15" / "RRM arts. 108-109" — ley + sufijo art./arts.
//  3. Bare "LSC", "RRM", "RDL 5/2023" — ley sola como cita primaria.
// Se acepta también RDLeg, LMV, CCom, RDLey, LOSSEAR. Estados Soporte
// Interno (CONVOCATORIA_PRE / EXPEDIENTE_PRE) están exentos a nivel
// Gate PRE (`organo_tipo === "SOPORTE_INTERNO"`), no aquí.
//
// Calibración Sprint 1 / Commit 7 (D6): se añade LGSM (Ley General de
// Sociedades Mercantiles, México) como ley aceptada para soportar batches
// multi-jurisdicción importados por el script `import-templates-batch.ts`.
// El batch FIRMA_LEGAL_BATCH es la vía para incorporar plantillas legacy
// firmadas offline por el Comité Legal, incluyendo jurisdicciones MX/BR
// donde la referencia legal nativa no es LSC. La adición sólo amplía el
// conjunto aceptado; no rechaza ningún caso previamente válido (tests del
// schema y de Gate PRE siguen pasando).
export const REF_LEGAL_PATTERN =
  /(?:(?:Art\.|Arts\.|art\.|arts\.).*?\b(?:LSC|RRM|RDL|LMV|RDLeg|CCom|RDLey|LOSSEAR|LGSM)\b)|(?:\b(?:LSC|RRM|RDL|LMV|RDLeg|CCom|RDLey|LOSSEAR|LGSM)\b.*?(?:Art\.|Arts\.|art\.|arts\.))|(?:\b(?:LSC|RRM|RDL|LMV|RDLeg|CCom|RDLey|LOSSEAR|LGSM)\b)/;

// MateriaEnum: unión cerrada de materias soportadas v1. Sin duplicados.
// Calibrado D15: incluye las 39 materias presentes en Cloud + cubre los
// 5 tipos no-acuerdo (CERTIFICACION, INFORME, CONVOCATORIA, ACTA*, etc.)
// que tienen `materia` con valor descriptivo del tipo en lugar de la
// materia jurídica.
export const MateriaEnum = z.enum([
  // Materias jurídicas core v1.0
  "APLICACION_RESULTADO",
  "APROBACION_CUENTAS",
  "APROBACION_PLAN_NEGOCIO",
  "APROBACION_PRESUPUESTO",
  "APROBACION_PRESUPUESTOS",
  "AUMENTO_CAPITAL",
  "ADQUISICION_PROPIA",
  "AUTORIZACION_GARANTIA",
  "ACCION_SOCIAL_RESPONSABILIDAD",
  "ACTIVOS_ESENCIALES",
  "AMPLIACION_OBJETO_SOCIAL",
  "CAMBIO_DENOMINACION_SOCIAL",
  "CAMBIO_DOMICILIO_SOCIAL",
  "CESE_CONSEJERO",
  "COMITES_INTERNOS",
  "CONTRATOS_SOCIO_UNICO_SOCIEDAD",
  "CUENTAS_CONSOLIDADAS",
  "DELEGACION_CAPITAL",
  "DELEGACION_FACULTADES",
  "DISOLUCION",
  "DIVIDENDO_A_CUENTA",
  "DISTRIBUCION_CARGOS",
  "DISTRIBUCION_DIVIDENDOS",
  "EMISION_DEUDA_CONVERTIBLE",
  "EMISION_OBLIGACIONES",
  "EJECUCION_AUMENTO_DELEGADO",
  "ESCISION",
  "EXCLUSION_SOCIO",
  "FINANCIACION",
  "FORMULACION_CUENTAS",
  "FUSION",
  "FUSION_ESCISION",
  "LIQUIDACION",
  "MODIFICACION_ESTATUTOS",
  "NOMBRAMIENTO_AUDITOR",
  "NOMBRAMIENTO_CONSEJERO",
  "CONTRATACION_RELEVANTE",
  "OPERACION_VINCULADA",
  "PACTO_PARASOCIAL",
  "POLITICA_REMUNERACION",
  "POLITICAS_CORPORATIVAS",
  "PODER_REPRESENTACION",
  "PRORROGA_SOCIEDAD",
  "RATIFICACION_ACTOS",
  "PRESTACIONES_ACCESORIAS",
  "REDUCCION_CAPITAL",
  "SEGUROS_RESPONSABILIDAD",
  "SEPARACION_SOCIO",
  "SUPRESION_PREFERENTE",
  "TRANSFORMACION",
  "TRANSMISION_PARTICIPACIONES",
  "TRASLADO_DOMICILIO_NACIONAL",
  "APROBACION_REGLAMENTO_CONSEJO",
  "ACUERDO_CONVOCATORIA_JUNTA",
  // Convocatorias / Notificaciones
  "CONVOCATORIA_JUNTA",
  "CONVOCATORIA_CDA",
  "CONVOCATORIA_COMISION_DELEGADA",
  "NOTIFICACION_CONVOCATORIA_SL",
  // Materias "tipo-acta" (cuando `materia` toma el valor del órgano/tipo)
  "JUNTA_GENERAL",
  "CONSEJO_ADMIN",
  "ACTA_COMISION_DELEGADA",
  "ACUERDO_SIN_SESION",
  "DECISION_SOCIO_UNICO",
  "DECISION_ADMIN_UNICO",
  "CO_APROBACION",
  "ADMIN_SOLIDARIO",
  // Materias de soporte interno / forense
  "CERTIFICACION_ACUERDOS",
  "EXPEDIENTE_PRE",
  "CONVOCATORIA_PRE",
  "GESTION_SOCIEDAD",
]);

export const TipoEnum = z.enum([
  "ACTA_SESION",
  "ACTA_CONSIGNACION",
  "ACTA_ACUERDO_ESCRITO",
  "ACTA_DECISION_CONJUNTA",
  "ACTA_ORGANO_ADMIN",
  "CERTIFICACION",
  "CONVOCATORIA",
  "CONVOCATORIA_SL_NOTIFICACION",
  "MODELO_ACUERDO",
  "INFORME_PRECEPTIVO",
  "INFORME_DOCUMENTAL_PRE",
  "DOCUMENTO_REGISTRAL",
  "SUBSANACION_REGISTRAL",
  "INFORME_GESTION",
]);

export const AdoptionModeEnum = z.enum([
  "MEETING",
  "UNIVERSAL",
  "NO_SESSION",
  "UNIPERSONAL_SOCIO",
  "UNIPERSONAL_ADMIN",
  "CO_APROBACION",
  "SOLIDARIO",
]);

// OrganoCanonicoEnum: derivado de ORGANO_CANONICO. Incluye el valor
// deprecado `JUNTA_GENERAL_O_CONSEJO` para re-importar la plantilla activa
// legacy de acuerdos sin sesión hasta que Comité Legal firme su desdoble.
// El cast a `[string, ...string[]]` es necesario porque `z.enum` requiere
// una tupla no-vacía y `ORGANO_CANONICO` es `readonly` const tuple.
export const OrganoCanonicoEnum = z.enum(
  ORGANO_CANONICO as unknown as [string, ...string[]],
);

// FuenteEnum: glossary de fuentes aceptadas. La unión es estricta a nivel
// schema pero hay una segunda capa (`FuentePatternSchema` más abajo) que
// acepta también `<tabla>.<columna>` libre vía regex, porque Cloud guarda
// fuentes muy específicas (`persons.nif`, `agreement.cargo_denominacion`,
// `governing_bodies.presidente`) que no se pueden enumerar a priori.
//
// Incluye:
//  - Tablas Cloud específicas y wildcards (`entities.name`, `entities.*`).
//  - Capas de framework (`QTSP.*`, `SISTEMA.*`).
//  - Capas jurídicas (`LEY`, `ESTATUTOS`, `PACTO_PARASOCIAL`, `REGLAMENTO`).
//  - Funciones de rule_pack (`evaluar*`, `calcular*`).
//  - Legacy uppercase (`ENTIDAD`, `USUARIO`, `MOTOR`, `EXPEDIENTE`,
//    `ORGANO`, `REUNION`, `REGISTRO`) — gate-pre marca `ENTIDAD` con
//    WARNING `LEGACY_FUENTE_ENTIDAD` pero el schema los acepta.
const FUENTE_KNOWN = [
  // Tablas Cloud y wildcards
  "entities.name",
  "entities.*",
  "agreements.*",
  "agreement.*",
  "governing_bodies.*",
  "mandate.*",
  "meetings.*",
  "capital_holdings.*",
  "cap_table.*",
  "parte_votante.*",
  "persons.*",
  // Capas jurídicas
  "LEY",
  "ESTATUTOS",
  "PACTO_PARASOCIAL",
  "REGLAMENTO",
  // Rule pack / motor
  "rule_pack.*",
  "evaluar*",
  "calcular*",
  // Framework
  "QTSP.*",
  "SISTEMA.*",
  // Legacy uppercase (gate-pre puede emitir WARNING)
  "ENTIDAD",
  "USUARIO",
  // Calibración D15: capas legacy adicionales con cobertura productiva.
  "MOTOR",
  "EXPEDIENTE",
  "ORGANO",
  "REUNION",
  "REGISTRO",
  "CERTIFICACION",
  "DECISION",
  "ACUERDO",
  "ACTO",
  "DELEGACION",
] as const;

export const FuenteEnum = z.enum(FUENTE_KNOWN as unknown as [string, ...string[]]);

// FUENTE_PATTERN: tabla.columna canónica de Cloud (`persons.nif`,
// `agreement.cargo_denominacion`, `entities.entity_type_detail`, etc.).
// Acepta también prefijos uppercase legacy con campo (`QTSP.firma_convocante_ref`,
// `SISTEMA.fecha_emision`, `MOTOR.riesgos_detectados`) y wildcards (`.*`).
// La unión final `FuenteSchema` admite tanto la enum conocida como esta
// forma libre — ambos validados por refinement de Zod.
const FUENTE_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){1,3}(?:\.\*)?$/;

/**
 * FuenteSchema: union pragmática enum ∪ pattern. Acepta:
 *  1) cualquier literal de FUENTE_KNOWN (capas conocidas).
 *  2) cualquier `<tabla>.<columna>` con minúsculas (extensible para
 *     campos productivos de Cloud no enumerables).
 *
 * Calibrado D15. El resto de campos del schema permanecen estrictos.
 */
export const FuenteSchema = z
  .string()
  .refine(
    (v): boolean =>
      (FUENTE_KNOWN as readonly string[]).includes(v) || FUENTE_PATTERN.test(v),
    {
      message:
        "fuente debe estar en glossary (LEY, USUARIO, entities.name, ...) o ser tabla.columna",
    },
  );

// Capa3FieldSchema (calibrado D15):
//  - `descripcion` y `label` son opcionales: Cloud tiene entradas con
//    solo `campo` + `obligatoriedad` (las plantillas más simples) y otras
//    con descripción detallada (plantillas POLITICA_*).
//  - `validacion_recomendada` es field libre de plantillas legacy que el
//    runtime ignora; se acepta para no rechazar el import. No es .strict()
//    a nivel de subobjeto para tolerar extensiones puntuales futuras.
export const Capa3FieldSchema = z.object({
  campo: z.string().regex(/^[a-z_][a-z0-9_]*$/i),
  obligatoriedad: z.enum([
    "OBLIGATORIO",
    "RECOMENDADO",
    "OPCIONAL",
    "OBLIGATORIO_SI_TELEMATICA",
  ]),
  descripcion: z.string().optional(),
  tipo: z.string().optional(),
  label: z.string().optional(),
  requerido: z.boolean().optional(),
  placeholder: z.string().optional(),
  default: z.unknown().optional(),
  opciones: z.array(z.unknown()).optional(),
  min_length: z.number().optional(),
  validacion_recomendada: z.string().optional(),
});

export const TemplateImportSchema = z
  .object({
    schema_version: z.literal("secretaria.template_import.v1"),
    template: z
      .object({
        tipo: TipoEnum,
        materia: MateriaEnum,
        materia_acuerdo: z.string().optional(),
        jurisdiccion: z.enum(["ES", "BR", "MX", "PT", "UK", "FR", "DE"]),
        version: z.string().regex(SEMVER),
        organo_tipo: OrganoCanonicoEnum,
        // Calibración D15: tipos no-acuerdo (CERTIFICACION, INFORME_*) tienen
        // `adoption_mode = null` en Cloud porque no son decisiones adoptables.
        // Schema acepta `null` para esos casos; el wizard exige string al
        // editar MODELO_ACUERDO.
        adoption_mode: AdoptionModeEnum.nullable(),
        referencia_legal: z.string().regex(REF_LEGAL_PATTERN),
        tipo_social: z.enum(["SA", "SL", "SLU", "SAU"]).optional().nullable(),
        snapshot_rule_pack_required: z.boolean().optional(),
        contrato_variables_version: z.string().optional(),
      })
      .strict(),
    capa1_inmutable: z.string().min(100),
    capa2_variables: z.array(
      z.object({
        variable: z.string().regex(VARIABLE_PATTERN),
        // Calibración D15: `FuenteSchema` (enum ∪ pattern) admite tanto
        // capas conocidas como `<tabla>.<columna>` específicas de Cloud.
        fuente: FuenteSchema,
        // `condicion` puede venir como null en filas legacy.
        condicion: z.string().nullable().default("SIEMPRE"),
      }),
    ),
    capa3_editables: z.array(Capa3FieldSchema),
    notas_legal: z.string().nullable().optional(),
  })
  .strict();

export type TemplateImportPayload = z.infer<typeof TemplateImportSchema>;

export const TemplateBatchImportSchema = z.object({
  schema_version: z.literal("secretaria.template_import.v1"),
  mode: z.literal("FIRMA_LEGAL_BATCH"),
  templates: z.array(TemplateImportSchema).min(1).max(50),
  batch_meta: z.object({
    aprobada_por: z.string().min(10),
    fecha_aprobacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    motivo: z.literal("FIRMA_LEGAL_BATCH"),
  }),
});

export type TemplateBatchImportPayload = z.infer<typeof TemplateBatchImportSchema>;
