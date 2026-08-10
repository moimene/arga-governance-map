import type { TipoOrgano, TipoSocial } from "@/lib/rules-engine";
import type { AgendaItemKind } from "@/lib/secretaria/agenda-kind";

/**
 * Catálogo canónico de materias del orden del día y su mapeo materia × órgano.
 *
 * Extraído de `ConvocatoriasStepper.tsx` (coherencia del módulo, 2026-07-03)
 * para que la estructura "materias propias del órgano / transversales / punto
 * libre" sea un modelo testable y reutilizable, no una lista plana embebida
 * en la página. El contenido de AGENDA_MATERIAS y MATERIA_ORGANOS es el
 * catálogo previo verbatim (ids canónicos de materia_catalog 20260424_000033).
 */

export interface AgendaMateriaDef {
  value: string;
  label: string;
  tipo: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribible: boolean;
  /** Especialidades LMV/CNMV aplicables si la entidad es SA cotizada. */
  lmvCotizada: boolean;
  /**
   * Restringe la materia a determinados `TipoSocial` (p.ej. las 6 materias de
   * la Junta de Socios SLP — G3 Garrigues, fix round 1 del review adversarial
   * de Task 4). Ausente = genérica, visible para cualquier tipo social (sin
   * cambio de comportamiento). Ver `isMateriaVisibleForTipoSocial`: fail-closed
   * — sin `tipoSocial` conocido, una materia restringida NO se ofrece.
   */
  soloTipoSocial?: readonly TipoSocial[];
}

export interface AgendaInformativeMateriaDef {
  value: string;
  label: string;
}

/**
 * Categorías canónicas para puntos que solo dejan constancia y no producen
 * un acuerdo. Se mantienen fuera de `AGENDA_MATERIAS`: nunca deben aparecer
 * en selectores de acuerdos ni adquirir clase, mayoría o efectos registrales.
 */
export const AGENDA_INFORMATIVE_MATERIAS: readonly AgendaInformativeMateriaDef[] = [
  {
    value: "INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD",
    label: "Informe de la Dirección General sobre la marcha de la sociedad",
  },
  {
    value: "INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO",
    label: "Informe de gobierno corporativo y cumplimiento",
  },
];

export const MATERIAS_INFORMATIVAS = new Set(
  AGENDA_INFORMATIVE_MATERIAS.map((materia) => materia.value),
);

export const ALL_ORGANOS: TipoOrgano[] = ["JUNTA_GENERAL", "CONSEJO", "COMISION_DELEGADA"];
export const JUNTA_ONLY: TipoOrgano[] = ["JUNTA_GENERAL"];
export const CONSEJO_ONLY: TipoOrgano[] = ["CONSEJO"];
export const CONSEJO_SCOPE: TipoOrgano[] = ["CONSEJO", "COMISION_DELEGADA"];
export const JUNTA_AND_CONSEJO: TipoOrgano[] = ["JUNTA_GENERAL", "CONSEJO", "COMISION_DELEGADA"];

// `lmvCotizada=true` marca materias con especialidades aplicables a SA
// cotizadas (LMV / Código de Buen Gobierno CNMV). NO cambia la clase de
// materia (sigue siendo ORDINARIA/ESTATUTARIA/ESTRUCTURAL para el motor),
// pero activa advertencias en la UI si la entidad es cotizada.
export const AGENDA_MATERIAS: readonly AgendaMateriaDef[] = [
  // Consejo / órgano de administración
  { value: "APROBACION_PLAN_NEGOCIO", label: "Aprobación del plan de negocio", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "APROBACION_PRESUPUESTO", label: "Aprobación del presupuesto anual", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "FORMULACION_CUENTAS", label: "Formulación de cuentas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "FINANCIACION", label: "Aprobación de financiación", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "CONTRATACION_RELEVANTE", label: "Contratación relevante", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "COMITES_INTERNOS", label: "Constitución o modificación de comités internos", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "DISTRIBUCION_CARGOS", label: "Distribución de cargos del consejo", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  // Código legacy de representación genérica en filial/participada. Se conserva
  // sin reinterpretarlo: no acredita por sí solo condición de socio único.
  { value: "NOMBRAMIENTO_REPRESENTANTE_FILIAL", label: "Designación de representante de la sociedad en filial o participada", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  // Representación de la sociedad matriz en su condición de socia única de la
  // filial (arts. 15 y 183 LSC). Es una materia exclusiva del Consejo y no la
  // representación permanente de una administradora PJ del art. 212 bis LSC.
  { value: "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL", label: "Designación de representante de la socia única en la filial", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "POLITICAS_CORPORATIVAS", label: "Aprobación de políticas corporativas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "RATIFICACION_ACTOS", label: "Ratificación de actos previos", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "SEGUROS_RESPONSABILIDAD", label: "Seguro de responsabilidad de administradores", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },

  // Ordinarias (gestión recurrente del órgano)
  { value: "APROBACION_CUENTAS", label: "Aprobación de cuentas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "APLICACION_RESULTADO", label: "Aplicación del resultado", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "DISTRIBUCION_DIVIDENDOS", label: "Distribución de dividendos", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "DISTRIBUCION_RESERVAS", label: "Distribución de reservas / dividendo a cuenta", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "REELECCION_CONSEJERO", label: "Reelección de consejero", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "CESE_CONSEJERO", label: "Cese / separación de consejero", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento / reelección de auditor", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  // Canonical id `REMUNERACION_CONSEJEROS` (materia_catalog 20260424_000033).
  { value: "REMUNERACION_CONSEJEROS", label: "Política / informe de remuneración de consejeros", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "DELEGACION_FACULTADES", label: "Delegación de facultades", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  // Poder voluntario de representación: no es delegación orgánica del art.
  // 249 LSC. Los poderes generales se elevan a público y se inscriben, por lo
  // que necesitan identidad propia desde la selección de la materia.
  { value: "PODER_REPRESENTACION", label: "Otorgamiento o modificación de poderes de representación", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  // Codex P2 round 9 PR #3: id canonical singular `OPERACION_VINCULADA`
  // (verificado en supabase/migrations/20260420_000017_seed_rule_packs_v2.sql).
  // El plural ("OPERACIONES_VINCULADAS") rompía el match con el rule_pack
  // aprobado → convocatoria perdía payload LMV (comisión auditoría +
  // CNMV) y caía a warning genérico. Label visible plural por UX.
  { value: "OPERACION_VINCULADA", label: "Operaciones con partes vinculadas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "PROGRAMA_RECOMPRA", label: "Programa de recompra de acciones / autocartera", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  // Alta 2026-07-03 (coherencia fase 3): materia de Junta del art. 238 LSC,
  // registrada también en materia_catalog (migración 20260706131043).
  { value: "ACCION_SOCIAL_RESPONSABILIDAD", label: "Acción social de responsabilidad", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "AUTORIZACION_GARANTIA", label: "Garantía / aval intragrupo", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },

  // Estatutarias (mayoría reforzada art. 199/201 LSC)
  { value: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  // MODIFICACION_REGLAMENTO es ORDINARIA: reglamento del consejo/junta NO
  // es estatutos (jerarquía LEY → ESTATUTOS → REGLAMENTO). Art. 285-290 LSC
  // aplica sólo a modificación estatutaria; el reglamento se aprueba por
  // mayoría legal del órgano competente.
  { value: "MODIFICACION_REGLAMENTO", label: "Modificación de reglamento del consejo / junta", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "AUMENTO_CAPITAL", label: "Aumento de capital", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  { value: "REDUCCION_CAPITAL", label: "Reducción de capital", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  { value: "EMISION_OBLIGACIONES", label: "Emisión de obligaciones / convertibles", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: true },
  // Canonical ids con sufijo `_SOCIAL` (materia_catalog 20260424_000033).
  { value: "CAMBIO_DENOMINACION_SOCIAL", label: "Cambio de denominación social", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  { value: "CAMBIO_DOMICILIO_SOCIAL", label: "Cambio de domicilio social", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },

  // Estructurales (escritura pública + RM)
  { value: "TRANSFORMACION", label: "Transformación social", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: false },
  { value: "FUSION", label: "Fusión", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: true },
  { value: "ESCISION", label: "Escisión", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: true },
  { value: "DISOLUCION", label: "Disolución", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: false },
  { value: "CESION_GLOBAL", label: "Cesión global de activo y pasivo", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: true },
  { value: "AUTORIZACION_OPERACION_ESTRUCTURAL", label: "Autorización operación estructural intragrupo", tipo: "ESTRUCTURAL", inscribible: false, lmvCotizada: true },

  // SLP — Junta de Socios (G3 Garrigues, 2026-08-03/04). Las 6 materias
  // exigidas por los 12 puntos reales de la Junta de Socios 2026
  // (docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md).
  // Criterio vinculante del Comité Legal: las 4 de socio son ESTATUTARIA —
  // NUNCA ESPECIAL. ESPECIAL las excluiría de filterAgreementCompatibleMaterias
  // y del selector genérico, y el gate de informe preceptivo (Task 7) nunca
  // preguntaría por el informe del Consejo de Socios (falso negativo
  // silencioso: una Junta que acuerda sin que el sistema pregunte nunca).
  // `soloTipoSocial: ["SLP"]` (fix round 1, I-1): sin esto las 6 aparecían en
  // el selector de CUALQUIER tenant, incluida una Junta General de ARGA (SA).
  { value: "ADMISION_SOCIO_CUOTA", label: "Admisión de socio de cuota", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false, soloTipoSocial: ["SLP"] },
  // Retiro a los 60 (art. 21.1.e Estatutos) — exclusión estatutaria vía Junta
  // (art. 15 Ley 2/2007), distinta de EXCLUSION_SOCIO (art. 351 LSC, ESPECIAL,
  // cauce judicial) ya existente en el catálogo.
  { value: "EXCLUSION_SOCIO_ESTATUTARIA", label: "Exclusión estatutaria de socio (retiro a los 60)", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false, soloTipoSocial: ["SLP"] },
  { value: "CONTINUIDAD_SOCIO_POST_60", label: "Continuidad del socio tras los 60", tipo: "ESTATUTARIA", inscribible: false, lmvCotizada: false, soloTipoSocial: ["SLP"] },
  // Fix round 1, contraorden sobre I-2: Estatutos REALES art. 12.6 — acuerdo
  // ANUAL de la Junta (propuesta del Órgano de Administración, previo informe
  // del Consejo de Socios), no modificación estatutaria. NO inscribible.
  { value: "RETRIBUCION_PRESTACIONES_ACCESORIAS", label: "Retribución de prestaciones accesorias", tipo: "ESTATUTARIA", inscribible: false, lmvCotizada: false, soloTipoSocial: ["SLP"] },
  // ESTRUCTURAL (no ESTATUTARIA): aumento de capital + supresión del derecho
  // de preferencia (art. 308 LSC) para incorporar un despacho como socio.
  { value: "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA", label: "Integración de despacho (aumento sin derecho de preferencia)", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: false, soloTipoSocial: ["SLP"] },
  // Punto 1.2 real de la Junta 2026 (cese + reelección de Vives, BORME I/A
  // 960). Identidad nueva: no colisiona con NOMBRAMIENTO_CONSEJERO/AUDITOR/
  // CESE_CONSEJERO/NOMBRAMIENTO_REPRESENTANTE_FILIAL.
  { value: "NOMBRAMIENTO_ADMINISTRADOR_UNICO", label: "Nombramiento de administrador único", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false, soloTipoSocial: ["SLP"] },

  // BATCH 8.3 (ronda 2 U-A): opción "OTROS — acuerdo libre" para puntos
  // que no encajan en el catálogo predefinido. NO dispara motor V2 (se
  // filtra en agendaRuleSpecs) — es responsabilidad del secretario indicar
  // tipo correcto y aceptar que no hay rule pack aplicable.
  { value: "OTROS_LIBRE", label: "Otros — acuerdo libre (sin regla aplicable)", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
];

export const MATERIA_ORGANOS: Record<string, TipoOrgano[]> = {
  INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD: ALL_ORGANOS,
  INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO: ALL_ORGANOS,
  APROBACION_PLAN_NEGOCIO: CONSEJO_SCOPE,
  APROBACION_PRESUPUESTO: CONSEJO_SCOPE,
  FORMULACION_CUENTAS: CONSEJO_SCOPE,
  FINANCIACION: CONSEJO_SCOPE,
  CONTRATACION_RELEVANTE: CONSEJO_SCOPE,
  COMITES_INTERNOS: CONSEJO_SCOPE,
  DISTRIBUCION_CARGOS: CONSEJO_SCOPE,
  NOMBRAMIENTO_REPRESENTANTE_FILIAL: CONSEJO_SCOPE,
  DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL: CONSEJO_ONLY,
  POLITICAS_CORPORATIVAS: CONSEJO_SCOPE,
  RATIFICACION_ACTOS: CONSEJO_SCOPE,
  SEGUROS_RESPONSABILIDAD: CONSEJO_SCOPE,
  APROBACION_CUENTAS: JUNTA_ONLY,
  APLICACION_RESULTADO: JUNTA_ONLY,
  DISTRIBUCION_DIVIDENDOS: JUNTA_ONLY,
  DISTRIBUCION_RESERVAS: JUNTA_ONLY,
  NOMBRAMIENTO_CONSEJERO: JUNTA_AND_CONSEJO,
  REELECCION_CONSEJERO: JUNTA_ONLY,
  CESE_CONSEJERO: JUNTA_AND_CONSEJO,
  NOMBRAMIENTO_AUDITOR: JUNTA_ONLY,
  REMUNERACION_CONSEJEROS: JUNTA_ONLY,
  DELEGACION_FACULTADES: CONSEJO_SCOPE,
  PODER_REPRESENTACION: CONSEJO_SCOPE,
  OPERACION_VINCULADA: CONSEJO_SCOPE,
  PROGRAMA_RECOMPRA: JUNTA_ONLY,
  ACCION_SOCIAL_RESPONSABILIDAD: JUNTA_ONLY,
  AUTORIZACION_GARANTIA: CONSEJO_SCOPE,
  MODIFICACION_ESTATUTOS: JUNTA_ONLY,
  MODIFICACION_REGLAMENTO: JUNTA_AND_CONSEJO,
  AUMENTO_CAPITAL: JUNTA_ONLY,
  REDUCCION_CAPITAL: JUNTA_ONLY,
  EMISION_OBLIGACIONES: JUNTA_ONLY,
  CAMBIO_DENOMINACION_SOCIAL: JUNTA_ONLY,
  CAMBIO_DOMICILIO_SOCIAL: JUNTA_ONLY,
  TRANSFORMACION: JUNTA_ONLY,
  FUSION: JUNTA_ONLY,
  ESCISION: JUNTA_ONLY,
  DISOLUCION: JUNTA_ONLY,
  CESION_GLOBAL: JUNTA_ONLY,
  AUTORIZACION_OPERACION_ESTRUCTURAL: JUNTA_ONLY,
  // SLP — Junta de Socios (G3 Garrigues): las 6 son propias de la Junta.
  ADMISION_SOCIO_CUOTA: JUNTA_ONLY,
  EXCLUSION_SOCIO_ESTATUTARIA: JUNTA_ONLY,
  CONTINUIDAD_SOCIO_POST_60: JUNTA_ONLY,
  RETRIBUCION_PRESTACIONES_ACCESORIAS: JUNTA_ONLY,
  INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA: JUNTA_ONLY,
  NOMBRAMIENTO_ADMINISTRADOR_UNICO: JUNTA_ONLY,
  OTROS_LIBRE: ALL_ORGANOS,
};

// Materias que NO se envían al motor V2 (puntos libres sin regla).
export const MATERIAS_LIBRES = new Set<string>(["OTROS_LIBRE"]);

// LMV cotizada advertencias específicas por materia. Texto enseña al
// secretario qué especialidad cotizada aplica y dónde está la referencia.
export const LMV_COTIZADA_ADVERTENCIAS: Record<string, string> = {
  OPERACION_VINCULADA:
    "SA cotizada: requiere informe de la Comisión de Auditoría (art. 529 ter.h LSC) + aprobación del Consejo. Si la operación supera el 5% del balance debe comunicarse a CNMV (art. 530 LSC).",
  CONTRATACION_RELEVANTE:
    "SA cotizada: revisar si el contrato es operación vinculada significativa, afecta a activos esenciales o exige comunicación al mercado por su impacto.",
  PROGRAMA_RECOMPRA:
    "SA cotizada: autorización JGA (art. 277 LSC) + notificación CNMV + cumplimiento de ventanas de trading (Reglamento UE 596/2014 sobre abuso de mercado).",
  REMUNERACION_CONSEJEROS:
    "SA cotizada: informe anual de remuneraciones vinculante + voto consultivo de la JGA sobre la política de retribución (art. 529 novodecies LSC).",
  EMISION_OBLIGACIONES:
    "SA cotizada: posible obligación de folleto informativo CNMV (Reglamento UE 2017/1129) cuando la emisión se ofrezca al público.",
  FUSION: "SA cotizada: documento de fusión + informe del consejo + posible folleto CNMV si afecta a accionistas minoritarios.",
  ESCISION: "SA cotizada: documento de escisión + posible folleto CNMV.",
  CESION_GLOBAL:
    "SA cotizada: posible hecho relevante a CNMV si afecta a porción significativa del patrimonio social.",
  AUTORIZACION_OPERACION_ESTRUCTURAL:
    "SA cotizada: revisar especialidades LMV (informe a CNMV, autorización de la JGA si supera umbrales).",
};

/**
 * Alias históricos que comparten identidad funcional con su código canónico.
 * Se usan en resolución, matching e identidad única; por eso no deben incluir
 * sinónimos que solo compartan rótulo jurídico.
 */
export const MATERIA_CANONICAL_ALIAS: Readonly<Record<string, string>> = {
  AMPLIACION_CAPITAL: "AUMENTO_CAPITAL",
  MOD_ESTATUTOS: "MODIFICACION_ESTATUTOS",
  NOMBRAMIENTO_CESE: "NOMBRAMIENTO_CONSEJERO",
  // B7 Lote 3 (2026-07-18): el plural convive en datos Cloud legacy; el
  // singular es el canónico de materia_catalog. Espejado en
  // fn_secretaria_template_functional_key (migración 20260718090000).
  APROBACION_PRESUPUESTOS: "APROBACION_PRESUPUESTO",
};

/**
 * Sinónimos exclusivamente de presentación. No intervienen en resolución de
 * rule packs, matching de plantillas, navegación ni identidad funcional.
 *
 * D5 (art. 308 LSC): EXCLUSION y SUPRESION permanecen como materias técnicas
 * distintas aunque compartan un rótulo jurídico en la interfaz.
 */
export const MATERIA_PRESENTATION_ALIAS: Readonly<Record<string, string>> = {
  EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE: "SUPRESION_PREFERENTE",
};

const ART_308_MATERIA = "SUPRESION_PREFERENTE";
const ART_308_LABEL = "Exclusión del derecho de preferencia —supresión total o parcial—";

const PROCESS_MATERIA_LABELS: Readonly<Record<string, string>> = {
  ACUERDO_SIN_SESION: "Acuerdo sin sesión",
  ACTA_COMISION_DELEGADA: "Acta de comisión delegada",
  ACTAS_ORGANOS_DELEGADOS: "Actas de órganos delegados",
  ADMIN_SOLIDARIO: "Decisión de administrador solidario",
  CERTIFICACION_ACUERDOS: "Certificación de acuerdos",
  CO_APROBACION: "Coaprobación de administradores mancomunados",
  CONSEJO_ADMIN: "Consejo de Administración",
  CONVOCATORIA_CDA: "Convocatoria del Consejo de Administración",
  CONVOCATORIA_COMISION_DELEGADA: "Convocatoria de comisión delegada",
  CONVOCATORIA_JUNTA: "Convocatoria de Junta General",
  CONVOCATORIA_PRE: "Comprobación previa de convocatoria",
  DECISION_ADMIN_UNICO: "Decisión del administrador único",
  DECISION_SOCIO_UNICO: "Decisión del socio único",
  EXPEDIENTE_PRE: "Comprobación documental previa",
  GESTION_SOCIEDAD: "Gestión de la sociedad",
  JUNTA_GENERAL: "Junta General",
  NOTIFICACION_CONVOCATORIA_SL: "Notificación individual de convocatoria de S.L.",
};


/**
 * Espejo de presentación de `materia_catalog.materia_label_es` para códigos
 * del catálogo societario que no existen en AGENDA_MATERIAS (B6 Lote 3,
 * extraído de Cloud el 2026-07-18). Solo presentación: la fuente de verdad
 * sigue siendo la BD; si un label cambia en materia_catalog, actualizar aquí.
 */
const CATALOG_MATERIA_LABELS: Readonly<Record<string, string>> = {
  ACUERDO_CONVOCATORIA_JUNTA: "Acuerdo del órgano de administración por el que se convoca la Junta",
  ADQUISICION_PROPIA: "Adquisición de acciones/participaciones propias",
  AMPLIACION_OBJETO_SOCIAL: "Ampliación del objeto social",
  APROBACION_REGLAMENTO_CONSEJO: "Aprobación o modificación del Reglamento del Consejo",
  CONTRATOS_SOCIO_UNICO_SOCIEDAD: "Contratos entre socio único y sociedad",
  CUENTAS_CONSOLIDADAS: "Formulación de cuentas consolidadas",
  DELEGACION_CAPITAL: "Delegación en el órgano de administración para aumentar capital",
  DIVIDENDO_A_CUENTA: "Distribución de dividendo a cuenta",
  EJECUCION_AUMENTO_DELEGADO: "Ejecución de aumento de capital delegado",
  EMISION_DEUDA_CONVERTIBLE: "Emisión de deuda convertible",
  EXCLUSION_SOCIO: "Exclusión de socio",
  LIQUIDACION: "Liquidación de la sociedad",
  PACTO_PARASOCIAL: "Adhesión o modificación de pacto parasocial",
  PODER_REPRESENTACION: "Otorgamiento o modificación de poderes de representación",
  NOMBRAMIENTO_REPRESENTANTE_FILIAL: "Designación de representante de la sociedad en filial o participada",
  DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL: "Designación de representante de la socia única en la filial",
  PRESTACIONES_ACCESORIAS: "Creación, modificación o supresión de prestaciones accesorias",
  PRORROGA_SOCIEDAD: "Prórroga de la duración de la sociedad",
  SEPARACION_SOCIO: "Ejercicio del derecho de separación de socio",
  TRANSMISION_PARTICIPACIONES: "Autorización de transmisión de participaciones sociales",
  TRASLADO_DOMICILIO_NACIONAL: "Traslado de domicilio social dentro de España",
  VENTA_ACTIVOS_ESENCIALES: "Enajenación de activos esenciales",
};

function normalizeMateriaCode(value?: string | null): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[.\s/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function humanizeMateriaCode(value: string): string {
  if (!value) return "Materia no informada";
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isMateriaInformativa(materia?: string | null): boolean {
  return MATERIAS_INFORMATIVAS.has(normalizeMateriaCode(materia));
}

export function materiaInformativaDefault(): AgendaInformativeMateriaDef {
  return AGENDA_INFORMATIVE_MATERIAS[0];
}

export function resolveMateriaAlias(materia?: string | null): string {
  const normalized = normalizeMateriaCode(materia);
  return MATERIA_CANONICAL_ALIAS[normalized] ?? normalized;
}

export function resolveMateriaPresentationAlias(materia?: string | null): string {
  const identity = resolveMateriaAlias(materia);
  return MATERIA_PRESENTATION_ALIAS[identity] ?? identity;
}

export function isMateriaCompatibleWithOrgano(materia: string, organoTipo: TipoOrgano) {
  const organos = MATERIA_ORGANOS[resolveMateriaAlias(materia)] ?? ALL_ORGANOS;
  return organos.includes(organoTipo);
}

/**
 * Fail-closed (fix round 1, I-1): una materia restringida a determinados
 * tipos sociales (`soloTipoSocial`, p.ej. las 6 materias SLP de la Junta de
 * Socios) solo se ofrece cuando `tipoSocial` es conocido y está en esa lista.
 * Sin `tipoSocial` conocido, las restringidas quedan fuera del selector — el
 * lado seguro es ocultar, nunca mostrar de más. Una materia sin
 * `soloTipoSocial` (todo el catálogo previo a G3) no cambia nunca: sigue
 * visible para cualquier tipo social, con o sin `tipoSocial` conocido.
 */
export function isMateriaVisibleForTipoSocial(
  materia: Pick<AgendaMateriaDef, "soloTipoSocial">,
  tipoSocial?: TipoSocial,
): boolean {
  if (!materia.soloTipoSocial) return true;
  return tipoSocial !== undefined && materia.soloTipoSocial.includes(tipoSocial);
}

export function materiaDefaultForOrgano(organoTipo: TipoOrgano) {
  return AGENDA_MATERIAS.find((materia) => isMateriaCompatibleWithOrgano(materia.value, organoTipo)) ?? AGENDA_MATERIAS[0];
}

export interface AgendaMateriaSelection {
  materia: string;
  tipo: AgendaMateriaDef["tipo"];
  inscribible: boolean;
}

/**
 * Resuelve el cambio explícito de naturaleza realizado por el usuario.
 *
 * - DECISORIO solo conserva una materia del catálogo de acuerdos compatible.
 * - Cualquier naturaleza no decisoria conserva una categoría informativa o
 *   asigna el default visible y editable; nunca arrastra una materia de
 *   acuerdo que estuviera oculta en el estado anterior.
 */
export function agendaMateriaSelectionForKind(params: {
  kind: AgendaItemKind;
  currentMateria?: string | null;
  organoTipo: TipoOrgano;
}): AgendaMateriaSelection {
  if (params.kind === "DECISORIO") {
    const current = AGENDA_MATERIAS.find(
      (materia) =>
        materia.value === resolveMateriaAlias(params.currentMateria) &&
        isMateriaCompatibleWithOrgano(materia.value, params.organoTipo),
    );
    const materia = current ?? materiaDefaultForOrgano(params.organoTipo);
    return {
      materia: materia.value,
      tipo: materia.tipo,
      inscribible: materia.inscribible,
    };
  }

  const current = AGENDA_INFORMATIVE_MATERIAS.find(
    (materia) => materia.value === normalizeMateriaCode(params.currentMateria),
  );
  const materia = current ?? materiaInformativaDefault();
  return {
    materia: materia.value,
    tipo: "ORDINARIA",
    inscribible: false,
  };
}

/**
 * Boundary fail-closed para consumidores del motor y de la votación: solo
 * una clasificación DECISORIO explícita cruza el límite.
 */
export function agendaItemsForDecisionEngine<
  T extends { kind?: AgendaItemKind | null },
>(items: readonly T[]): T[] {
  return items.filter((item) => item.kind === "DECISORIO");
}

export function labelMateria(materia?: string | null, sourceLabel?: string | null) {
  const identity = resolveMateriaAlias(materia);
  const presentation = resolveMateriaPresentationAlias(identity);
  if (presentation === ART_308_MATERIA) return ART_308_LABEL;
  const informative = AGENDA_INFORMATIVE_MATERIAS.find((m) => m.value === presentation);
  if (informative) return informative.label;
  if (PROCESS_MATERIA_LABELS[presentation]) return PROCESS_MATERIA_LABELS[presentation];
  if (sourceLabel?.trim()) return sourceLabel.trim();
  return (
    AGENDA_MATERIAS.find((m) => m.value === presentation)?.label ??
    CATALOG_MATERIA_LABELS[presentation] ??
    humanizeMateriaCode(identity)
  );
}

export interface AgendaMateriaGroup {
  key: "propias" | "transversales" | "libre";
  label: string;
  materias: AgendaMateriaDef[];
}

const PROPIAS_LABEL: Record<TipoOrgano, string> = {
  JUNTA_GENERAL: "Propias de la Junta General",
  CONSEJO: "Propias del órgano de administración",
  COMISION_DELEGADA: "Del ámbito del consejo (delegables a la comisión)",
};

/**
 * Estructura el catálogo de materias compatibles con un órgano en tres grupos
 * para el orden del día: propias del órgano convocante, transversales a
 * cualquier órgano y el punto libre. La partición es exhaustiva y disjunta
 * sobre las materias compatibles con el órgano.
 *
 * `tipoSocial` (fix round 1, I-1) aplica el gate fail-closed de
 * `isMateriaVisibleForTipoSocial` además del filtro de órgano: una materia
 * `soloTipoSocial` (p.ej. las 6 SLP) no aparece si `tipoSocial` no se pasa o
 * no coincide. El resto del catálogo (sin `soloTipoSocial`) es idéntico con o
 * sin este parámetro — cero cambio de comportamiento para ARGA.
 */
export function agendaMateriaGroups(organoTipo: TipoOrgano, tipoSocial?: TipoSocial): AgendaMateriaGroup[] {
  const compatibles = AGENDA_MATERIAS.filter(
    (m) => isMateriaCompatibleWithOrgano(m.value, organoTipo) && isMateriaVisibleForTipoSocial(m, tipoSocial),
  );
  const esTransversal = (value: string) => (MATERIA_ORGANOS[value] ?? ALL_ORGANOS).length >= ALL_ORGANOS.length;

  const groups: AgendaMateriaGroup[] = [
    {
      key: "propias",
      label: PROPIAS_LABEL[organoTipo],
      materias: compatibles.filter((m) => !MATERIAS_LIBRES.has(m.value) && !esTransversal(m.value)),
    },
    {
      key: "transversales",
      label: "Transversales (cualquier órgano)",
      materias: compatibles.filter((m) => !MATERIAS_LIBRES.has(m.value) && esTransversal(m.value)),
    },
    {
      key: "libre",
      label: "Punto libre",
      materias: compatibles.filter((m) => MATERIAS_LIBRES.has(m.value)),
    },
  ];

  return groups.filter((group) => group.materias.length > 0);
}
