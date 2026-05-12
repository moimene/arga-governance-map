/**
 * Re-exports públicos del módulo template-admin.
 * Sprint 1 — refactor Gestor de Plantillas.
 *
 * Importante: `gate-pre.ts` y `template-import-schema.ts` ambos exportan
 * `VARIABLE_PATTERN`, `SEMVER`, `REF_LEGAL_PATTERN` con regex distintas
 * (gate-pre acepta varios formatos legacy; importer es estricto para
 * paquetes v1 nuevos). Los re-exports nombrados de abajo evitan el
 * conflicto y dejan claro cuál es cuál:
 *
 *  - `VARIABLE_PATTERN_IMPORT`, `SEMVER_IMPORT`, `REF_LEGAL_PATTERN_IMPORT`:
 *    estricto, usado por el wizard.
 *  - `VARIABLE_PATTERN`, `SEMVER`, `REF_LEGAL_PATTERN`: los de gate-pre,
 *    consumidos por validadores runtime de plantillas existentes.
 */

export * from "./types";
export * from "./organo-canonico";
export * from "./functional-key";
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
