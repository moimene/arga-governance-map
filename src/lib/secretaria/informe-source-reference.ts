/**
 * Criterio único: de dónde sale la "huella" de un informe preceptivo.
 *
 * Antes, la pantalla de Informes preceptivos guardaba en `source_hash`
 * literalmente lo que alguien tecleaba en un input libre, y la columna
 * "Huella" lo pintaba igual que una huella verificable. MOI-196: la huella
 * solo puede venir de un artefacto documental real del tenant (su propio
 * `hash_sha512`/`content_hash`) o de un acuerdo; cuando no hay artefacto,
 * la referencia se declara sin huella y se dice así en pantalla.
 */

export const DECLARED_REFERENCE_NO_HASH_LABEL = "Referencia declarada, sin huella";

export type InformeSourceSelection =
  | { kind: "agreement"; agreementId: string }
  | { kind: "artifact"; artifactId: string; hash: string | null }
  | { kind: "declared"; reference: string }
  | { kind: "none" };

export interface InformeSourceFields {
  sourceDomain: string | null;
  sourceId: string | null;
  sourceHash: string | null;
  sourcePayload: Record<string, unknown>;
}

export function buildInformeSourceFields(selection: InformeSourceSelection): InformeSourceFields {
  switch (selection.kind) {
    case "agreement":
      return {
        sourceDomain: "agreement",
        sourceId: selection.agreementId,
        sourceHash: null,
        sourcePayload: { agreement_id: selection.agreementId },
      };
    case "artifact":
      return {
        sourceDomain: "secretaria_document_artifact",
        sourceId: selection.artifactId,
        sourceHash: selection.hash,
        sourcePayload: { artifact_id: selection.artifactId },
      };
    case "declared":
      return {
        sourceDomain: "manual_preceptive_document",
        sourceId: null,
        sourceHash: null,
        sourcePayload: {
          declared_reference: selection.reference,
          source_label: DECLARED_REFERENCE_NO_HASH_LABEL,
        },
      };
    case "none":
    default:
      return { sourceDomain: null, sourceId: null, sourceHash: null, sourcePayload: {} };
  }
}

/** Qué pinta la columna "Huella". No toca filas heredadas con `source_hash` de texto libre. */
export function informeHashDisplay(artifact: {
  hash_sha512?: string | null;
  source_hash?: string | null;
  source_domain?: string | null;
}): string {
  if (artifact.hash_sha512) return artifact.hash_sha512;
  if (artifact.source_domain === "manual_preceptive_document" && !artifact.source_hash) {
    return DECLARED_REFERENCE_NO_HASH_LABEL;
  }
  return artifact.source_hash ?? "Pendiente";
}
