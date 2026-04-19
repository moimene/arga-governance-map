// ============================================================
// useQTSPSign — React hook for QES signing and notifications
// Spec: Motor de Reglas LSC § QTSP Integration (T23)
// ============================================================

import { useMutation } from '@tanstack/react-query';
import {
  firmarDocumentoQES,
  notificarCertificado,
  validarPreFirma,
} from '@/lib/rules-engine';
import type {
  QTSPSignRequest,
  QTSPNotificationRequest,
} from '@/lib/rules-engine/types';
import type {
  QESSignResult,
  CertifiedNotificationResult,
} from '@/lib/rules-engine';

/**
 * useQTSPSign — React hook for QES signing with pre-validation
 *
 * Usage:
 *   const { signMutation, notifyMutation } = useQTSPSign();
 *
 *   const signRequest: QTSPSignRequest = {
 *     document_hash: 'SHA256-abc123',
 *     signer_id: 'SECRETARIO-001',
 *     signer_role: 'SECRETARIO',
 *     document_type: 'ACTA',
 *   };
 *
 *   signMutation.mutate(signRequest);
 *
 * The hook wraps the pure engine functions with error handling and
 * TanStack Query mutation management.
 */
export function useQTSPSign() {
  const signMutation = useMutation<QESSignResult, Error, QTSPSignRequest>({
    mutationFn: async (request: QTSPSignRequest) => {
      // Pre-flight validation
      const preCheck = validarPreFirma(
        request.document_hash,
        request.signer_role,
        request.document_type
      );

      if (!preCheck.ok) {
        const errorMsg = preCheck.errors.join('; ');
        throw new Error(`Validación pre-firma fallida: ${errorMsg}`);
      }

      // Execute signing
      const result = firmarDocumentoQES(request);

      if (!result.ok) {
        const errorMsg = result.errors.join('; ');
        throw new Error(`Firma QES fallida: ${errorMsg}`);
      }

      return result;
    },
  });

  const notifyMutation = useMutation<
    CertifiedNotificationResult,
    Error,
    QTSPNotificationRequest
  >({
    mutationFn: async (request: QTSPNotificationRequest) => {
      const result = notificarCertificado(request);

      if (!result.ok) {
        const errorMsg = result.errors.join('; ');
        throw new Error(`Notificación certificada fallida: ${errorMsg}`);
      }

      return result;
    },
  });

  return { signMutation, notifyMutation };
}
