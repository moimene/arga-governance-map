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

/**
 * Marcadores de demostración o entorno de prueba en el campo `aprobada_por`.
 * MOI-137: Cualquier mención de 'demo', 'demo-operativo', 'seed', 'prototipo',
 * 'remediación', 'simulada', 'prueba', 'ficticio', 'ejemplo', 'test', 'placeholder', etc.
 * desmiente la aprobación formal nominativa y exige rotular «Vigente sin aprobación nominativa».
 */
export const DEMO_APPROVAL_MARKER_RE =
  /\b(demo|demo-operativo|seed|prototipo|remediaci[oó]n|simulad[oa]|prueba|fictici[oa]|ejemplo|test|placeholder)\b|demo\s+operativo/i;

export function hasDemoApprovalMarker(aprobadaPor?: string | null): boolean {
  if (!aprobadaPor) return false;
  return DEMO_APPROVAL_MARKER_RE.test(aprobadaPor);
}

/**
 * MOI-137, D-20: un `aprobada_por` que cita la aprobación de la plantilla de
 * ORIGEN de un clon ("… clon de la plantilla <id>, aprobada en origen por
 * «X»") no acredita que ESTA copia haya sido aprobada por nadie — solo
 * documenta de dónde procede el texto. Medido en Cloud (2026-09-26): 15
 * plantillas ACTIVA del Grupo Nuevo (…0003) citan «aprobada en origen por
 * «Garrigues / Comité Legal»», un dictamen de OTRO tenant que nunca evaluó la
 * copia. Sin este marcador, esas 15 pasarían el resto de los detectores
 * (referencia legal, órgano, versión no-borrador) y se rotularían «Aprobada
 * legalmente» solo porque el campo no está vacío.
 */
export const CITED_ORIGIN_APPROVAL_RE = /aprobada en origen por/i;

export function hasCitedOriginApproval(aprobadaPor?: string | null): boolean {
  if (!aprobadaPor) return false;
  return CITED_ORIGIN_APPROVAL_RE.test(aprobadaPor);
}

