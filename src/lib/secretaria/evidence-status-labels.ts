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
  /**
   * true solo cuando la evidencia es cualificada productiva. En el alcance
   * vigente NINGÚN estado lo es: EAD Trust interviene como interposición,
   * mensajería básica y custodia, sin firma, sello, envío ni entrega. El campo
   * se conserva porque es el contrato del badge, no porque haya un estado que
   * lo active.
   */
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
  // Vocabulario REAL de la única tabla que alimenta el badge:
  // `secretaria_document_artifacts.evidence_status` CHECK (verificado en Cloud
  // 2026-09-05) = DEMO_OPERATIVA | EVIDENCE_OPEN | EVIDENCE_SEALED |
  // EVIDENCE_VERIFIED | EVIDENCE_FAILED. Antes el mapa hablaba otro idioma
  // (SEALED/VERIFIED/PENDING/FAILED), disjunto del CHECK: un EVIDENCE_FAILED
  // caía al fallback y se rotulaba «Entorno de validación funcional», que es
  // decir que todo va bien cuando la evidencia ha fallado.
  DEMO_OPERATIVA: ENTORNO_VALIDACION_FUNCIONAL,
  EVIDENCE_OPEN: {
    label: "Evidencia en curso",
    tone: "neutral",
    disclaimer:
      "Captura abierta en el circuito de custodia. No acredita firma, sello, envío ni entrega.",
    isQualified: false,
  },
  EVIDENCE_SEALED: {
    label: "Custodiada",
    tone: "neutral",
    // EAD Trust interviene como interposición, mensajería básica y custodia /
    // e-archiving. No firma, no sella, no envía y no entrega: rotular esto
    // «Sellada con QTSP productivo» afirmaba una capacidad fuera de alcance.
    disclaimer:
      "Artefacto cerrado y custodiado en el circuito de interposición. No equivale a firma, sello de tiempo ni certificación cualificada.",
    isQualified: false,
  },
  EVIDENCE_VERIFIED: {
    label: "Integridad verificada",
    tone: "success",
    disclaimer:
      "Se ha verificado la integridad del artefacto custodiado. No acredita firma, sello cualificado, envío ni entrega.",
    isQualified: false,
  },
  EVIDENCE_FAILED: {
    label: "Error de evidencia",
    tone: "error",
    disclaimer: "No se pudo completar la evidencia. Revise el detalle técnico antes de utilizar el documento.",
    isQualified: false,
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
