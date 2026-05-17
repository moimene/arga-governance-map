import type { Canal, Proveedor } from '../types';

export interface MailSendInput {
  recipientId: string;
  idempotencyKey: string;
  destino: string;
  asunto: string;
  cuerpoHtml: string;
  cuerpoSha512: string;
  adjuntos: Array<{
    label: string;
    storageUri: string;
    hashSha512: string;
    mimeType: string;
    modoEntrega: 'ADJUNTO' | 'LINK_FIRMADO';
    signedUrlExpiryHours: number;
  }>;
  remitente: { nombre: string; email: string };
  metadata: Record<string, string>;
  tags: Array<{ name: string; value: string }>;
}

export interface MailSendResult {
  ok: boolean;
  proveedor: Proveedor;
  proveedorEventoId: string;
  evidenceBundleId?: string;
  evidenceHashSha512?: string;
  enviadoEn: string;
  rawProveedorResponse?: unknown;
}

export interface MailAdapter {
  readonly canalSoportado: Exclude<Canal, 'PORTAL_PUSH'>;
  send(input: MailSendInput): Promise<MailSendResult>;
}

export class MailAdapterError extends Error {
  constructor(
    message: string,
    public readonly canal: string,
    public readonly retriable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MailAdapterError';
  }
}
