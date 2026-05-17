import type { MailAdapter, MailSendInput, MailSendResult } from './MailAdapter';
import { MailAdapterError } from './MailAdapter';

export interface EADTrustClient {
  generateEvidence(
    opts: {
      evidenceId: string;
      hash: string;
      capturedAt: string;
      custodyType: 'EXTERNAL';
      title: string;
      fileName: string;
      createdBy: string;
      fileSize: number;
      metadata: Record<string, string>;
    },
    payload: ArrayBuffer,
  ): Promise<{
    id: string;
    hash: string;
    status: { status: string };
  }>;
}

export class EADTrustERDSAdapter implements MailAdapter {
  readonly canalSoportado = 'BUROFAX_ERDS' as const;

  constructor(private readonly client: EADTrustClient) {}

  async send(input: MailSendInput): Promise<MailSendResult> {
    const payload = new TextEncoder().encode(
      `Asunto: ${input.asunto}\n\n${input.cuerpoHtml}\n\nDestinatario: ${input.destino}`,
    ).buffer as ArrayBuffer;

    try {
      const evidence = await this.client.generateEvidence(
        {
          evidenceId: `ERDS-${input.recipientId}-${input.idempotencyKey.substring(0, 8)}`,
          hash: input.cuerpoSha512,
          capturedAt: new Date().toISOString(),
          custodyType: 'EXTERNAL',
          title: `ERDS: ${input.asunto}`,
          fileName: `notificacion-${input.recipientId}.eml`,
          createdBy: input.remitente.email,
          fileSize: payload.byteLength,
          metadata: {
            recipient_id: input.recipientId,
            destino: input.destino,
            ...input.metadata,
          },
        },
        payload,
      );

      return {
        ok: true,
        proveedor: 'EAD_TRUST',
        proveedorEventoId: evidence.id,
        evidenceBundleId: evidence.id,
        evidenceHashSha512: evidence.hash,
        enviadoEn: new Date().toISOString(),
        rawProveedorResponse: evidence,
      };
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: string };
      const status = e.status ?? 500;
      const retriable = status >= 500 || status === 429 || e.code === 'ETIMEDOUT';
      throw new MailAdapterError(
        `EAD Trust ERDS failed: ${e.message ?? String(err)}`,
        'BUROFAX_ERDS',
        retriable,
        err,
      );
    }
  }
}
