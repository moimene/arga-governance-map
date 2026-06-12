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

// ITEM-127: hash corto (12 hex chars) de la clave de idempotencia COMPLETA.
// idempotencyKey = `${recipientId}-${cuerpo_hash_sha512}-${intento_reenvio_n}`,
// así que un `.substring(0, 8)` de la clave eran siempre los 8 primeros chars
// del UUID del recipient → evidenceId constante por destinatario, ignorando el
// cuerpo y el número de intento. Hasheamos la clave entera para que el
// discriminador cambie con el cuerpo (cuerpo_hash_sha512) y con cada reenvío
// (intento_reenvio_n). Web Crypto, no el módulo `crypto` de Node.
async function shortHash(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 12);
}

export class EADTrustERDSAdapter implements MailAdapter {
  readonly canalSoportado = 'BUROFAX_ERDS' as const;

  constructor(private readonly client: EADTrustClient) {}

  async send(input: MailSendInput): Promise<MailSendResult> {
    const payload = new TextEncoder().encode(
      `Asunto: ${input.asunto}\n\n${input.cuerpoHtml}\n\nDestinatario: ${input.destino}`,
    ).buffer as ArrayBuffer;

    // ITEM-127: discriminador derivado del hash de la clave completa, no de su substring.
    const idempotencyDiscriminator = await shortHash(input.idempotencyKey);

    try {
      const evidence = await this.client.generateEvidence(
        {
          evidenceId: `ERDS-${input.recipientId}-${idempotencyDiscriminator}`,
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
