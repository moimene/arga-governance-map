/**
 * Patrones de validación canónicos compartidos por template-admin.
 *
 * ITEM-138: `SEMVER` y la lista de fuentes legales se centralizan aquí para que
 * `gate-pre.ts` y `template-import-schema.ts` NO diverjan. Antes cada archivo
 * declaraba su propio `REF_LEGAL_PATTERN`: el de gate aceptaba `CNMV`/`CC` y el
 * del importer no, de modo que una plantilla con "art. 1261 CC" pasaba el Gate
 * PRE pero su export no era reimportable (divergencia latente, 0 filas afectadas
 * en Cloud hoy). Con una única lista de leyes el set aceptado queda unificado.
 *
 * Se mantienen DOS formas de `REF_LEGAL_PATTERN` a propósito (no es duplicación):
 *  - LAX (runtime Gate PRE): cualquier mención de una ley reconocida.
 *  - STRUCTURED (importer v1): Art./Arts. + ley, ley + Art./Arts., o ley sola.
 * Ambas se construyen desde `LEGAL_LAW_SOURCES`, así que la lista de leyes no
 * puede volver a divergir entre gate y schema.
 */

// SEMVER: pre-release y build metadata aceptados (1.0.0+sl, 1.0.0-beta.1).
export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

// Fuentes legales reconocidas como cita primaria (multi-jurisdicción).
// Incluye LGSM (México) y CNMV/CC para alinear gate e importer.
export const LEGAL_LAW_SOURCES = [
  "LSC",
  "RRM",
  "RDL",
  "LMV",
  "RDLeg",
  "CCom",
  "RDLey",
  "LOSSEAR",
  "CNMV",
  "CC",
  "LGSM",
] as const;

const LAW_ALT = LEGAL_LAW_SOURCES.join("|");

/**
 * Forma laxa (Gate PRE runtime): basta una mención de fuente legal reconocida.
 * Equivale al antiguo `REF_LEGAL_PATTERN` de gate-pre.ts.
 */
export const REF_LEGAL_PATTERN_LAX = new RegExp(`\\b(${LAW_ALT})\\b`);

/**
 * Forma estructurada (importer v1). Tres formas aceptadas:
 *  1. "Art. 160 LSC" / "Arts. 295-316 LSC" — prefijo Art./Arts. + ley.
 *  2. "LSC art. 15" / "RRM arts. 108-109" — ley + sufijo art./arts.
 *  3. Bare "LSC", "RRM" — ley sola como cita primaria.
 * Superset estructural de la forma laxa (la forma 3 cubre el caso de gate),
 * por lo que migrar el importer a esta lista de leyes sólo amplía el set
 * aceptado; no rechaza ningún caso previamente válido.
 */
export const REF_LEGAL_PATTERN_STRUCTURED = new RegExp(
  `(?:(?:Art\\.|Arts\\.|art\\.|arts\\.).*?\\b(?:${LAW_ALT})\\b)|` +
    `(?:\\b(?:${LAW_ALT})\\b.*?(?:Art\\.|Arts\\.|art\\.|arts\\.))|` +
    `(?:\\b(?:${LAW_ALT})\\b)`,
);
