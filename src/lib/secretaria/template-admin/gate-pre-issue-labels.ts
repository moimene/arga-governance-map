/**
 * gate-pre-issue-labels — etiquetas humanas en castellano para los issues
 * del Gate PRE (comprobación documental previa).
 *
 * Oleada 1 UX Gestor (G6): la consola de validación y el editor tri-capa
 * mostraban códigos crudos (SEM_NAMESPACE_SIN_PROVEEDOR, chips
 * "blocking/warning/info" en inglés) a un perfil jurídico no técnico. Sigue
 * el patrón ITEM-088 (schema-issue-mapper): traducir en la capa de
 * presentación sin tocar los códigos del motor, que siguen siendo el
 * contrato estable (tests, telemetría, deep-links).
 *
 * Regla de mantenimiento: cada `code:` nuevo en `gate-pre.ts` o
 * `gate-pre-semantic.ts` DEBE ganar entrada aquí; el test
 * `__tests__/gate-pre-issue-labels.test.ts` enumera los códigos desde el
 * fuente y falla si alguno queda sin etiqueta (sin fallback).
 */

/** Severidades del Gate PRE en castellano. Fallback: el valor recibido. */
export const GATE_PRE_SEVERITY_LABEL: Record<string, string> = {
  BLOCKING: "Bloqueante",
  WARNING: "Advertencia",
  INFO: "Informativa",
};

export function gatePreSeverityLabel(severity?: string | null): string {
  if (!severity) return "—";
  return GATE_PRE_SEVERITY_LABEL[severity] ?? severity;
}

/**
 * Etiqueta humana por código de issue del Gate PRE. Cubre todos los códigos
 * emitidos por `gate-pre.ts` y `gate-pre-semantic.ts`, más los diagnósticos
 * locales del editor tri-capa (CAPA2_DUPLICATE_VARIABLE / CAPA3_DUPLICATE_FIELD).
 * Fallback: el propio código.
 */
export const GATE_PRE_ISSUE_LABEL: Record<string, string> = {
  // Metadatos (gate-pre.ts)
  META_ORGANO_NULL: "Órgano societario ausente o sin normalizar",
  META_VERSION_SEMVER: "Número de versión con formato no válido",
  META_REF_LEGAL_FORMAT: "Referencia legal ausente o sin fuente legal reconocible",
  META_APROBADA_POR: "Aprobación formal incompleta (falta responsable o fecha)",
  META_APROBADA_POR_PENDING: "Aprobación formal pendiente: se exigirá al promover la plantilla",

  // Capas 1-3 (gate-pre.ts)
  CAPA1_LENGTH: "El texto de la plantilla es demasiado corto",
  CAPA2_HELPER_PROHIBIDO: "El texto usa una instrucción de plantilla no permitida",
  CAPA2_VAR_NO_CATALOGADA: "El texto usa una variable no declarada",
  ENTITY_REF_FORBIDDEN: "Referencia directa a la sociedad no permitida en variables",
  CAPA3_PREFIJO_PROTEGIDO: "Campo editable con prefijo reservado del motor",
  CAPA2_UNUSED_VARIABLE: "Variable declarada que no se usa en el texto",
  CAPA2_VARIABLE_REQUIRED: "Variable automática sin identificador",
  LEGACY_FUENTE_ENTIDAD: "Fuente de datos antigua: migrar a la fuente actual",
  GEN_IF_COUNT: "Exceso de ramas condicionales: valorar desdoblar la plantilla",

  // Duplicidad funcional (gate-pre.ts)
  DUP_ACTIVE_FUNCTIONAL_KEY: "Ya existe una plantilla activa equivalente",

  // Reglas semánticas (gate-pre-semantic.ts)
  SEM_FUSION_EXPERTO_CONDICIONAL: "Fusión/escisión sin el condicional de informe de experto",
  SEM_RATIFICACION_IDENTIFICACION: "Ratificación sin identificación obligatoria de los actos",
  SEM_ACTIVA_CAMPOS_REQUERIDOS: "Plantilla activa con metadatos obligatorios sin cumplimentar",
  SEM_NAMESPACE_SIN_PROVEEDOR:
    "Variables sin origen de datos: saldrían en blanco en el documento",

  // Diagnósticos locales del editor tri-capa (TriCapaEditor.tsx)
  CAPA2_DUPLICATE_VARIABLE: "Variable duplicada en la capa 2",
  CAPA3_DUPLICATE_FIELD: "Campo editable duplicado en la capa 3",
  CAPA3_FIELD_REQUIRED: "Campo editable sin identificador",
  CAPA3_PROTECTED_PREFIX: "Campo editable con prefijo reservado",
  CAPA3_DESCRIPTION_REQUIRED: "Campo editable sin descripción jurídica",
};

export function gatePreIssueLabel(code?: string | null): string {
  if (!code) return "—";
  return GATE_PRE_ISSUE_LABEL[code] ?? code;
}
