import type { MailAdapter, MailSendInput, MailSendResult } from './MailAdapter';
import type { ResendAdapter } from './ResendAdapter';
import type { QTSPTimestampService } from './QTSPTimestampService';

export class ResendCertifiedAdapter implements MailAdapter {
  readonly canalSoportado = 'EMAIL_CERTIFICADO' as const;

  constructor(
    private readonly resend: ResendAdapter,
    private readonly qtsp: QTSPTimestampService,
  ) {}

  async send(input: MailSendInput): Promise<MailSendResult> {
    // 1. Sello QTSP del cuerpo
    const seal = await this.qtsp.getTimestamp(input.cuerpoSha512);

    // 2. Adjuntar TSQ token + pie HTML
    const tsqAttachment = {
      label: 'timestamp.tsr',
      storageUri: `data:application/timestamp-reply;base64,${seal.tsqTokenBase64}`,
      hashSha512: seal.hashSha512,
      mimeType: 'application/timestamp-reply',
      modoEntrega: 'ADJUNTO' as const,
      signedUrlExpiryHours: 0,
    };
    const enrichedHtml = `${input.cuerpoHtml}
      <hr/>
      <p style="font-size:11px;color:#666">
        Sello de tiempo cualificado EAD Trust: ${seal.evidenceId}<br/>
        Emitido: ${seal.timestampedAt}<br/>
        Hash SHA-512: ${seal.hashSha512.substring(0, 32)}…
      </p>`;

    // 3. Delegate to ResendAdapter
    const result = await this.resend.send({
      ...input,
      cuerpoHtml: enrichedHtml,
      adjuntos: [...input.adjuntos, tsqAttachment],
    });

    return {
      ...result,
      evidenceBundleId: seal.evidenceId,
      evidenceHashSha512: seal.hashSha512,
    };
  }
}
