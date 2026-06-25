/**
 * Etiquetas y estados compartidos de los artefactos documentales de Secretaría.
 *
 * Extraído de `DocumentosPendientesRevision.tsx` para reutilizarse también en la
 * Mesa (`Dashboard.tsx`, bloque "Documentos pendientes" — UX-2.A). Vive en `lib/`
 * (no en un componente) para no romper Fast Refresh ni acoplar chunks de páginas.
 */

/** Estados que cuentan como "pendiente de revisión" en la cola documental. */
export const REVIEWABLE_STATUSES = new Set(["DRAFT", "SOURCE_LOCKED", "PENDING", "GENERATED", "IN_REVIEW"]);

/** Tipo de documento (clave técnica → etiqueta legible). */
export const KIND_LABEL: Record<string, string> = {
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe documental PRE",
  INFORME_GESTION: "Informe de gestión",
  CERTIFICACION_AUTONOMA: "Certificación autónoma",
  CERTIFICACION_ACUERDO: "Certificación de acuerdo",
  ANEXO_EXTERNO: "Anexo externo",
  DOCUMENTO_REGISTRAL: "Documento registral",
  SUBSANACION_REGISTRAL: "Subsanación registral",
  OTRO_SOPORTE: "Soporte documental",
};
