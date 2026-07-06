/**
 * Etiquetas y disclaimers de estado de evidencia para el módulo Secretaría.
 *
 * Copy validado por el Comité Legal (informe UX 2026-06-20, §7.3 y §6.4.3; auditoría de
 * brechas 2026-06-20, P0-1/P0-2). Objetivo no negociable: la UI NUNCA debe presentar
 * evidencia de entorno de validación funcional (sandbox/demo) como evidencia cualificada
 * productiva.
 *
 * No confundir con `evidenceStatusLabel` de `usePoliciesObligations` (evidencia GRC de
 * controles/obligaciones), que es otro dominio.
 */
export type EvidenceTone = "success" | "warning" | "error" | "neutral";

export interface EvidenceStatusDescriptor {
  /** Etiqueta legible en español. */
  label: string;
  /** Tono visual; se mapea a tokens `--status-*` / `--g-*` en EvidenceStatusBadge. */
  tone: EvidenceTone;
  /** Disclaimer legal mostrado bajo la etiqueta cuando la evidencia no es cualificada. */
  disclaimer: string | null;
  /** true solo cuando la evidencia es cualificada productiva (sellada o verificada). */
  isQualified: boolean;
}

const ENTORNO_VALIDACION_FUNCIONAL: EvidenceStatusDescriptor = {
  label: "Entorno de validación funcional",
  tone: "warning",
  disclaimer:
    "Resultado generado sin eficacia jurídica cualificada productiva. No equivale a firma, sello o timestamp cualificado real.",
  isQualified: false,
};

export const EVIDENCE_STATUS: Record<string, EvidenceStatusDescriptor> = {
  DEMO_OPERATIVA: ENTORNO_VALIDACION_FUNCIONAL,
  OPEN: ENTORNO_VALIDACION_FUNCIONAL,
  SANDBOX: ENTORNO_VALIDACION_FUNCIONAL,
  PENDING: {
    label: "Pendiente de evidencia",
    tone: "neutral",
    disclaimer: "El documento existe, pero aún no tiene evidencia asociada.",
    isQualified: false,
  },
  FAILED: {
    label: "Error de evidencia",
    tone: "error",
    disclaimer: "No se pudo completar la evidencia. Reintenta o revisa el detalle técnico.",
    isQualified: false,
  },
  SEALED: {
    label: "Sellada",
    tone: "success",
    disclaimer: "Evidencia sellada con QTSP productivo (EAD Trust).",
    isQualified: true,
  },
  VERIFIED: {
    label: "Verificada",
    tone: "success",
    disclaimer: "Evidencia verificada frente al servicio cualificado correspondiente.",
    isQualified: true,
  },
};

/**
 * Resuelve el descriptor de evidencia. Fallback conservador: cualquier valor desconocido
 * o ausente se trata como entorno de validación funcional (no cualificada), nunca como
 * evidencia productiva.
 */
export function evidenceStatusDescriptor(status?: string | null): EvidenceStatusDescriptor {
  if (!status) return ENTORNO_VALIDACION_FUNCIONAL;
  return EVIDENCE_STATUS[status] ?? ENTORNO_VALIDACION_FUNCIONAL;
}
