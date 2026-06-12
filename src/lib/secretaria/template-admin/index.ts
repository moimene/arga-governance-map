/**
 * Re-exports públicos del módulo template-admin.
 * Sprint 1 — refactor Gestor de Plantillas.
 *
 * ITEM-138: `SEMVER` y la lista de fuentes legales de `REF_LEGAL_PATTERN` ahora
 * viven en `patterns.ts` (compartido por gate-pre y template-import-schema), así
 * que ya no pueden divergir. Lo que SÍ sigue siendo distinto a propósito es
 * `VARIABLE_PATTERN`: gate-pre extrae `{{var}}` del cuerpo (regex global de
 * captura) mientras el importer valida la forma de un path dotted (no es
 * duplicación, son validaciones diferentes). Los re-exports nombrados de abajo
 * mantienen ambos visibles sin colisión:
 *
 *  - `VARIABLE_PATTERN_IMPORT`, `SEMVER_IMPORT`, `REF_LEGAL_PATTERN_IMPORT`:
 *    los del schema del importer (REF_LEGAL forma estructurada).
 *  - `VARIABLE_PATTERN`, `SEMVER`, `REF_LEGAL_PATTERN`: los de gate-pre
 *    (REF_LEGAL forma laxa), consumidos por validadores runtime.
 */

export * from "./types";
export * from "./organo-canonico";
export * from "./functional-key";
export * from "./labels";
export * from "./known-p0";
export * from "./cloud-helpers";
export * from "./gate-pre";
export * from "./gate-pre-semantic";
export * from "./import-preflight";
export {
  VARIABLE_PATTERN as VARIABLE_PATTERN_IMPORT,
  SEMVER as SEMVER_IMPORT,
  REF_LEGAL_PATTERN as REF_LEGAL_PATTERN_IMPORT,
  MateriaEnum,
  TipoEnum,
  AdoptionModeEnum,
  OrganoCanonicoEnum,
  FuenteEnum,
  FuenteSchema,
  Capa3FieldSchema,
  TemplateImportSchema,
  TemplateBatchImportSchema,
  type TemplateImportPayload,
  type TemplateBatchImportPayload,
} from "./template-import-schema";
export * from "./template-importer";
export * from "./sample";
