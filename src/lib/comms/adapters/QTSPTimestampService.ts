import { MailAdapterError } from './MailAdapter';

export interface QTSPClient {
  generateTimestamp(bodyHash: string): Promise<{
    evidenceId: string;
    tsqTokenBase64: string;
    timestampedAt: string;
    hashSha512: string;
  }>;
}

export interface TimestampResult {
  evidenceId: string;
  tsqTokenBase64: string;
  timestampedAt: string;
  hashSha512: string;
}

export class QTSPTimestampService {
  constructor(private readonly client: QTSPClient) {}

  async getTimestamp(bodyHash: string): Promise<TimestampResult> {
    try {
      return await this.client.generateTimestamp(bodyHash);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: string };
      const retriable = (e.status !== undefined && e.status >= 500)
        || e.status === 429
        || e.code === 'ETIMEDOUT';
      throw new MailAdapterError(
        `QTSP timestamp failed: ${e.message ?? String(err)}`,
        'EMAIL_CERTIFICADO',
        retriable,
        err,
      );
    }
  }
}
