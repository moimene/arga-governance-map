/**
 * Alcance vigente de los tipos de certificación autónoma.
 *
 * POR QUÉ EXISTE. El selector de `/secretaria/certificaciones` ofrece todo lo
 * que `standalone_certification_kinds` marque `is_active`, y en Cloud hay tipos
 * ACTIVOS que afirman capacidades que el producto NO tiene en el alcance
 * vigente (verificado 2026-09-05 sobre `governance_OS`):
 *
 *   - `CERT_ERDS_ENTREGA` — «Certificado de entrega electrónica certificada
 *     ERDS», `requires_qes = true`, `authority_policy.qtsp = 'EAD_TRUST'`.
 *   - `CERT_COMUNICACIONES_REGULATORIAS` — `requires_qes = true`, mismo qtsp.
 *   - `CERT_ENVIO_CONVOCATORIA` — «Certificado de emisión y **envío** de
 *     convocatoria».
 *
 * EAD Trust interviene como interposición, mensajería básica y custodia /
 * e-archiving. No firma, no sella, no envía y no entrega. Emitir un documento
 * que certifique una entrega ERDS o una firma cualificada sería afirmar un
 * hecho que nadie ha producido.
 *
 * El filtro vive en código porque el dato de Cloud no se toca desde este
 * carril; retirar o reclasificar esas filas queda anotado como deuda del dueño
 * del dato (Secretaría + Comité Legal).
 *
 * CRITERIO — se excluye un tipo si:
 *   1. exige firma electrónica cualificada (`requires_qes`), o
 *   2. su código o su rótulo afirma ERDS, entrega electrónica certificada,
 *      envío, firma cualificada o sello de tiempo.
 *
 * Lo que NO excluye: certificar que la sociedad hizo una notificación o una
 * comunicación es un hecho societario que la Secretaría sí acredita desde su
 * propio registro (art. 173 LSC). Lo prohibido es atribuir la firma, el envío
 * o la entrega a un tercero que no los presta.
 */

/** Términos que, en rótulo o código, afirman una capacidad fuera de alcance. */
const CAPACIDAD_NO_VIGENTE =
  /\bERDS\b|entrega\s+electr[oó]nica|entrega\s+certificada|\benv[ií]o\b|\benviad|firma\s+(electr[oó]nica\s+)?cualificada|\bQES\b|sello\s+de\s+tiempo/i;

export interface CertificationKindScopeInput {
  kind_code?: string | null;
  label?: string | null;
  requires_qes?: boolean | null;
}

export type CertificationKindExclusionReason = "REQUIERE_FIRMA_CUALIFICADA" | "AFIRMA_ENVIO_O_ENTREGA";

/**
 * Motivo por el que el tipo queda fuera del alcance vigente, o `null` si se
 * puede ofrecer.
 */
export function certificationKindExclusion(
  kind: CertificationKindScopeInput,
): CertificationKindExclusionReason | null {
  if (kind.requires_qes === true) return "REQUIERE_FIRMA_CUALIFICADA";
  const texto = `${kind.kind_code ?? ""} ${kind.label ?? ""}`;
  if (CAPACIDAD_NO_VIGENTE.test(texto)) return "AFIRMA_ENVIO_O_ENTREGA";
  return null;
}

/** ¿Se puede ofrecer este tipo en el alcance vigente? */
export function isCertificationKindInScope(kind: CertificationKindScopeInput): boolean {
  return certificationKindExclusion(kind) === null;
}

/** Filtra una lista de tipos dejando solo los del alcance vigente. */
export function filterCertificationKindsInScope<T extends CertificationKindScopeInput>(kinds: T[]): T[] {
  return (kinds ?? []).filter(isCertificationKindInScope);
}
