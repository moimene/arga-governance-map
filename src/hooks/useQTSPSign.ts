import { useMutation } from "@tanstack/react-query";

/**
 * Contrato legacy conservado únicamente para que los consumidores migren sin
 * reinterpretar estados históricos. La aplicación ya no inicia solicitudes de
 * firma electrónica: EAD Trust se usa como interposición, mensajería controlada
 * y custodia/e-archiving desde flujos source-bound.
 */
export interface EADSignResult {
  ok: boolean;
  sandbox?: boolean;
  srId: string;
  caseFileId?: string;
  srStatus?: string;
  signatureProduced?: false;
  documentId: string;
  documentHash: string;
  signatoryIds: string[];
  providerSignatureType?: "INTERPOSITION";
  providerRequestedAt?: string;
  providerActivatedAt?: string;
  signed_at: null;
  signedDocumentData?: ArrayBuffer;
  localRecordPersisted?: boolean;
  localRecordId?: string;
  localRecordError?: string;
  errors: string[];
}

export interface CertifiedNotificationResult {
  ok: boolean;
  sandbox?: boolean;
  evidenceId: string | null;
  deliveryRef: null;
  evidenceHash: string;
  deliveredAt: null;
  deliveryProven: false;
  evidenceArchived: boolean;
  status: string;
  errors: string[];
}

export interface EADSignFlowRequest {
  documentName: string;
  documentData: ArrayBuffer;
  signatories: Array<{
    name: string;
    email: string;
    surnames?: string;
    sequence?: number;
    personId?: string;
    signerRole?: "PRESIDENTE" | "SECRETARIO" | "CERTIFICANTE" | "VISTO_BUENO" | "ADMINISTRADOR";
    authorityEvidenceId?: string;
  }>;
  createdBy: string;
  agreementId?: string;
  documentType?: string;
  sourceDomain?: "MINUTE" | "CERTIFICATION" | "ANNUAL_ACCOUNTS";
  sourceId?: string;
  artifactKind?: "MINUTE_FINAL" | "CERTIFICATION_FINAL" | "ANNUAL_ACCOUNTS_EXECUTION";
  contentHashSha256?: string;
  providerSignatureType?: "INTERPOSITION";
  signatureAnchor?: { page: number; x: number; y: number };
  onProgress?: (step: string) => void;
}

export interface ERDSNotificationRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  attachments?: Array<{ name: string; data: ArrayBuffer }>;
}

const RETIRED_SIGN_MESSAGE =
  "La firma electrónica genérica está retirada. Use el flujo autoritativo del expediente para interposición y custodia/e-archiving.";

const CONTROLLED_MESSAGE =
  "La mensajería genérica está retirada. Use la comunicación source-bound, que reserva destinatarios y registra sus resultados.";

export function useQTSPSign() {
  const signMutation = useMutation<EADSignResult, Error, EADSignFlowRequest>({
    mutationFn: async (request) => {
      request.onProgress?.(RETIRED_SIGN_MESSAGE);
      throw new Error(RETIRED_SIGN_MESSAGE);
    },
  });

  const notifyMutation = useMutation<
    CertifiedNotificationResult,
    Error,
    ERDSNotificationRequest
  >({
    mutationFn: async () => {
      throw new Error(CONTROLLED_MESSAGE);
    },
  });

  return { signMutation, notifyMutation };
}
