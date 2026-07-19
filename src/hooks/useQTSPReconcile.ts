/**
 * Reconciliación del ciclo de firma.
 *
 * EAD **no emite webhooks**: la integración es de consulta. Sin esto, un
 * expediente se queda en "firma solicitada" para siempre aunque los firmantes ya
 * hayan firmado, porque nadie vuelve a preguntar.
 *
 * Este hook pregunta al proveedor y, cuando la firma está completada, recupera
 * los DOS artefactos que produce:
 *
 *   · el documento firmado — el acuerdo con los sellos visibles, que es lo que
 *     el abogado espera ver;
 *   · el certificado de finalización — la hoja de firmas, que acredita el
 *     proceso y NO contiene el texto del acuerdo.
 *
 * Cada uno se recupera de forma independiente: que falle el certificado no puede
 * impedir recuperar el documento, ni al revés.
 */
import { useMutation } from "@tanstack/react-query";
import {
  fetchQTSPSignatureArtifacts,
  fetchQTSPSignatureStatus,
  type ProxySignatureArtifacts,
} from "@/lib/qtsp/qtsp-proxy-client";
import {
  resolveSignatureOutcome,
  signatureOutcomeLabel,
  type SignatureOutcome,
} from "@/lib/qtsp/signature-completion";

export interface ReconcileInput {
  caseFileId: string;
  srId: string;
  documentId: string;
}

export interface ReconcileResult {
  /** false cuando el proxy no está desplegado o configurado. */
  disponible: boolean;
  /** Estado crudo del proveedor (`ACTIVE`, `COMPLETED`…). */
  providerStatus: string | null;
  outcome: SignatureOutcome;
  outcomeLabel: string;
  /** Solo hay artefactos cuando la firma está completada. */
  artifacts: ProxySignatureArtifacts | null;
  /** Motivos por los que algún artefacto no se pudo recuperar. No es fatal. */
  avisos: string[];
}

export function useQTSPReconcile() {
  return useMutation<ReconcileResult, Error, ReconcileInput>({
    mutationFn: async ({ caseFileId, srId, documentId }) => {
      const estado = await fetchQTSPSignatureStatus(caseFileId, srId);
      if (!estado) {
        return {
          disponible: false,
          providerStatus: null,
          outcome: "NO_SOLICITADA",
          outcomeLabel: "Proxy QTSP no disponible",
          artifacts: null,
          avisos: [],
        };
      }

      const outcome = resolveSignatureOutcome(estado.status);
      const base: ReconcileResult = {
        disponible: true,
        providerStatus: estado.status ?? null,
        outcome,
        outcomeLabel: signatureOutcomeLabel(outcome),
        artifacts: null,
        avisos: [],
      };

      // Los endpoints de artefactos solo responden cuando el documento está
      // firmado; pedirlos antes solo produce ruido.
      if (outcome !== "COMPLETADA") return base;

      const artifacts = await fetchQTSPSignatureArtifacts(caseFileId, srId, documentId);
      const avisos: string[] = [];
      if (artifacts?.signedDocumentError) {
        avisos.push(`Documento firmado no recuperado: ${artifacts.signedDocumentError}`);
      }
      if (artifacts?.certificateError) {
        avisos.push(`Certificado no recuperado: ${artifacts.certificateError}`);
      }
      return { ...base, artifacts: artifacts ?? null, avisos };
    },
  });
}
