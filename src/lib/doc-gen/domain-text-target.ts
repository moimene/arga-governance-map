import type { ProcessDocumentKind } from "./process-documents";

/**
 * W0 #1 — unificación de la fuente de verdad de texto.
 *
 * Al archivar un DOCX, el cuerpo revisado (`reviewedBodyText`) debe reescribirse
 * a la columna de texto canónica del dominio, de modo que la página de detalle
 * muestre lo mismo que se archivó (cierra la divergencia draft↔dominio descrita
 * en la Parte II del informe legal).
 *
 * Solo se sincronizan los kinds cuya columna de dominio es inequívoca y segura:
 *  - CONVOCATORIA → convocatorias.convocatoria_text
 *  - DECISION_UNIPERSONAL → unipersonal_decisions.content
 * Se EXCLUYEN deliberadamente:
 *  - ACTA: la gobierna el editor de borrador + RPC fn_actualizar_borrador_acta
 *    (y el trigger trg_minutes_lock_guard impide tocar un acta firmada).
 *  - CERTIFICACION: el cuerpo lo fija EmitirCertificacionButton antes de firmar
 *    (entra en hash_certificacion); reescribirlo aquí lo descuadraría.
 *  - Kinds registrales (DOCUMENTO_REGISTRAL, SUBSANACION_REGISTRAL) y otros sin
 *    columna de texto de dominio: null.
 */
export interface DomainTextTarget {
  table: "convocatorias" | "unipersonal_decisions";
  column: "convocatoria_text" | "content";
}

export function domainTextTargetForKind(
  kind: ProcessDocumentKind,
): DomainTextTarget | null {
  switch (kind) {
    case "CONVOCATORIA":
      return { table: "convocatorias", column: "convocatoria_text" };
    case "DECISION_UNIPERSONAL":
      return { table: "unipersonal_decisions", column: "content" };
    default:
      return null;
  }
}
