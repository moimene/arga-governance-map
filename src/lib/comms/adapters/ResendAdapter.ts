import type { MailAdapter, MailSendInput, MailSendResult } from './MailAdapter';
import { MailAdapterError } from './MailAdapter';

export interface ResendAdapterOptions {
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}

export class ResendAdapter implements MailAdapter {
  readonly canalSoportado = 'EMAIL_NORMAL' as const;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: ResendAdapterOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? fetch;
    this.baseUrl = opts.baseUrl ?? 'https://api.resend.com';
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    const body = {
      from: `${input.remitente.nombre} <${input.remitente.email}>`,
      to: [input.destino],
      subject: input.asunto,
      html: input.cuerpoHtml,
      attachments: input.adjuntos
        .filter((a) => a.modoEntrega === 'ADJUNTO')
        .map((a) => ({ filename: a.label, path: a.storageUri })),
      tags: input.tags,
      headers: input.metadata,
    };

    let resp: Response;
    try {
      resp = await this.fetchImpl(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MailAdapterError(`Resend network error: ${msg}`, 'EMAIL_NORMAL', true, err);
    }

    const json = (await resp.json()) as { id?: string; error?: string };
    if (!resp.ok) {
      const retriable = resp.status >= 500 || resp.status === 429;
      throw new MailAdapterError(
        `Resend ${resp.status}: ${json?.error ?? 'unknown'}`,
        'EMAIL_NORMAL',
        retriable,
        json,
      );
    }

    return {
      ok: true,
      proveedor: 'RESEND',
      proveedorEventoId: json.id ?? '',
      enviadoEn: new Date().toISOString(),
      rawProveedorResponse: json,
    };
  }
}
