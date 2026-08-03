/**
 * Reconciliación del ciclo de interposición y custodia EAD.
 *
 * EAD **no emite webhooks**: la integración es de consulta. Sin esto, un
 * expediente se queda en "interposición solicitada" aunque EAD ya haya
 * completado el proceso, porque nadie vuelve a preguntar.
 *
 * El navegador solo aporta el UUID interno de la solicitud y la fuente legal.
 * El Edge resuelve los IDs EAD persistidos, recupera el output y registra la
 * custodia, el consentimiento y la constancia sin claim de firma electrónica.
 */
import { useMutation } from "@tanstack/react-query";
import {
  reconcileVerifiedEADInterposition,
  type VerifiedEADInterpositionReconciliationInput,
  type VerifiedEADInterpositionReconciliationResult,
} from "@/lib/qtsp/qtsp-proxy-client";
import type { SignatureOutcome } from "@/lib/qtsp/signature-completion";

export type ReconcileInput = VerifiedEADInterpositionReconciliationInput;

export interface ReconcileResult {
  /** false cuando el proxy no está desplegado o configurado. */
  disponible: boolean;
  /** Estado crudo del proveedor (`ACTIVE`, `COMPLETED`…). */
  providerStatus: string | null;
  outcome: SignatureOutcome;
  outcomeLabel: string;
  /** Solo existe tras verificar y custodiar el output EAD sin claim de firma. */
  reconciliation: VerifiedEADInterpositionReconciliationResult | null;
  avisos: string[];
}

export function useQTSPReconcile() {
  return useMutation<ReconcileResult, Error, ReconcileInput>({
    mutationFn: async (input) => {
      // Única lectura permitida: la reconciliación source-bound. El endpoint
      // genérico `status` está retirado porque un UUID aislado no demuestra
      // vínculo con fuente, tenant, clase de artefacto ni hash canónico.
      const reconciliation = await reconcileVerifiedEADInterposition(input);
      if (!reconciliation) {
        return {
          disponible: false,
          providerStatus: null,
          outcome: "NO_SOLICITADA",
          outcomeLabel: "Proxy QTSP no disponible",
          reconciliation: null,
          avisos: [],
        };
      }

      return {
        disponible: true,
        providerStatus: reconciliation.providerStatus,
        outcome: "COMPLETADA",
        outcomeLabel: "Interposición EAD reconciliada",
        reconciliation,
        avisos: [],
      };
    },
  });
}
