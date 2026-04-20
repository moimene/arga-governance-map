// ============================================================
// useERDSNotification — React hook for ERDS certified delivery
// D3: Notificación certificada ERDS en Secretaría
// Spec: Motor de Reglas LSC § QTSP ERDS Integration
// ============================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  generateEvidence,
  computeSha256,
  EADTrustError,
} from '@/lib/qtsp/ead-trust-client';

// ============================================================
// Input types
// ============================================================

export interface SendCertifiedNotificationInput {
  recipientEmail: string;
  subject: string;
  body: string;
  attachments?: Array<{
    name: string;
    data: ArrayBuffer;
  }>;
  onProgress?: (msg: string) => void;
}

export interface UpdateNotificationStatusInput {
  notificationId: string;
  erdsEvidenceId: string;
  erdsDeliveryRef: string;
  erdsEvidenceHash: string;
  erdsDeliveredAt: string;
  erdsStatus: 'PENDING' | 'DELIVERED' | 'FAILED' | 'COMPLETED';
}

// ============================================================
// Output types
// ============================================================

export interface CertifiedNotificationResult {
  ok: boolean;
  evidenceId: string;
  deliveryRef: string;
  evidenceHash: string;
  deliveredAt: string;
  status: string;
}

export interface NotificationStatusUpdateResult {
  ok: boolean;
  notificationId: string;
  erdsStatus: string;
}

/**
 * useERDSNotification — React hook for ERDS certified delivery
 *
 * Provides two mutations:
 * 1. sendCertifiedNotification: Creates evidence via EAD Trust API
 * 2. updateNotificationStatus: Updates Supabase with delivery info
 *
 * Usage:
 *   const { sendCertifiedNotification, updateNotificationStatus } = useERDSNotification();
 *
 *   const result = await sendCertifiedNotification.mutateAsync({
 *     recipientEmail: 'user@example.com',
 *     subject: 'Notificación de acuerdo aprobado',
 *     body: 'Se adjunta copia del acuerdo...',
 *   });
 *
 *   await updateNotificationStatus.mutateAsync({
 *     notificationId: 'not-123',
 *     erdsEvidenceId: result.evidenceId,
 *     erdsDeliveryRef: result.deliveryRef,
 *     erdsEvidenceHash: result.evidenceHash,
 *     erdsDeliveredAt: result.deliveredAt,
 *     erdsStatus: 'DELIVERED',
 *   });
 */
export function useERDSNotification() {
  const queryClient = useQueryClient();

  // Mutation 1: Send certified notification via EAD Trust API
  const sendCertifiedNotification = useMutation<
    CertifiedNotificationResult,
    Error,
    SendCertifiedNotificationInput
  >({
    mutationFn: async (input: SendCertifiedNotificationInput) => {
      try {
        input.onProgress?.('Preparando notificación certificada...');

        // Compose message content with subject and body
        const messageContent = `
Asunto: ${input.subject}

${input.body}

---
Notificación certificada ERDS
Enviado: ${new Date().toISOString()}
Destinatario: ${input.recipientEmail}
        `.trim();

        // Convert message to ArrayBuffer
        const messageData = new TextEncoder()
          .encode(messageContent)
          .buffer;

        // Generate unique evidence ID
        const evidenceId = `ERDS-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)
          .toUpperCase()}`;

        input.onProgress?.('Calculando integridad del mensaje...');

        // Compute SHA-256 of message
        const messageHash = await computeSha256(messageData);

        input.onProgress?.('Registrando evidencia en EAD Trust...');

        // Create evidence in EAD Trust API
        const evidence = await generateEvidence(
          {
            evidenceId,
            hash: messageHash,
            capturedAt: new Date().toISOString(),
            custodyType: 'EXTERNAL',
            title: `ERDS: ${input.subject}`,
            fileName: `notificacion-${evidenceId}.eml`,
            createdBy: input.recipientEmail,
            fileSize: messageData.byteLength,
            metadata: {
              recipient_email: input.recipientEmail,
              notification_type: 'ERDS',
              message_subject: input.subject,
              has_attachments: input.attachments ? 'true' : 'false',
            },
          },
          messageData,
          input.onProgress
        );

        input.onProgress?.('Notificación certificada completada.');

        // Extract evidence details
        const evidenceHash =
          evidence.id || messageHash.substring(0, 32);
        const deliveryRef = `DEL-${Date.now()}-${evidenceId.substring(5)}`;

        return {
          ok: true,
          evidenceId: evidence.id || evidenceId,
          deliveryRef,
          evidenceHash,
          deliveredAt: new Date().toISOString(),
          status: evidence.status?.status || 'COMPLETED',
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Notificación ERDS fallida: ${msg}`);
      }
    },
  });

  // Mutation 2: Update notification status in Supabase
  const updateNotificationStatus = useMutation<
    NotificationStatusUpdateResult,
    Error,
    UpdateNotificationStatusInput
  >({
    mutationFn: async (input: UpdateNotificationStatusInput) => {
      try {
        // Identify the table based on notification type (inferred from context)
        // For now, assuming 'no_session_notificaciones' table
        // This can be made more flexible if needed

        const { error } = await supabase
          .from('no_session_notificaciones')
          .update({
            erds_evidence_id: input.erdsEvidenceId,
            erds_delivery_ref: input.erdsDeliveryRef,
            erds_evidence_hash: input.erdsEvidenceHash,
            erds_delivered_at: input.erdsDeliveredAt,
            erds_status: input.erdsStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.notificationId);

        if (error) {
          throw new Error(
            `Supabase update failed: ${error.message}`
          );
        }

        // Invalidate related queries to refresh UI
        queryClient.invalidateQueries({
          queryKey: ['no_session_notificaciones'],
        });
        queryClient.invalidateQueries({
          queryKey: ['no_session_notificaciones', input.notificationId],
        });

        return {
          ok: true,
          notificationId: input.notificationId,
          erdsStatus: input.erdsStatus,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Estado de notificación no actualizado: ${msg}`);
      }
    },
  });

  // Utility: Combined workflow (send + update in one call)
  const sendAndTrackNotification = useMutation<
    { certification: CertifiedNotificationResult; tracking: NotificationStatusUpdateResult },
    Error,
    SendCertifiedNotificationInput & { notificationId: string }
  >({
    mutationFn: async (
      input: SendCertifiedNotificationInput & { notificationId: string }
    ) => {
      // Step 1: Send certified notification
      const certification = await sendCertifiedNotification.mutateAsync(
        input
      );

      // Step 2: Update status in Supabase
      const tracking = await updateNotificationStatus.mutateAsync({
        notificationId: input.notificationId,
        erdsEvidenceId: certification.evidenceId,
        erdsDeliveryRef: certification.deliveryRef,
        erdsEvidenceHash: certification.evidenceHash,
        erdsDeliveredAt: certification.deliveredAt,
        erdsStatus: 'DELIVERED',
      });

      return { certification, tracking };
    },
  });

  return {
    sendCertifiedNotification,
    updateNotificationStatus,
    sendAndTrackNotification,
  };
}
