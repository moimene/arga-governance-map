import { describe, it, expect, vi } from 'vitest';
import { ResendCertifiedAdapter } from '../ResendCertifiedAdapter';
import type { MailSendInput, MailSendResult } from '../MailAdapter';

const baseInput: MailSendInput = {
  recipientId: 'r1',
  idempotencyKey: 'k',
  destino: 'u@x.com',
  asunto: 'A',
  cuerpoHtml: '<p>x</p>',
  cuerpoSha512: 'h',
  adjuntos: [],
  remitente: { nombre: 'S', email: 's@x.com' },
  metadata: {},
  tags: [],
};

describe('ResendCertifiedAdapter', () => {
  it('seals body with QTSP before delegating to ResendAdapter', async () => {
    const fakeQtsp = {
      getTimestamp: vi.fn().mockResolvedValue({
        evidenceId: 'evd_qtsp_1',
        tsqTokenBase64: 'TSQ',
        timestampedAt: '2026-05-18T10:00:00Z',
        hashSha512: 'hash_sealed',
      }),
    };
    const fakeResend = {
      canalSoportado: 'EMAIL_NORMAL' as const,
      send: vi.fn().mockResolvedValue({
        ok: true,
        proveedor: 'RESEND',
        proveedorEventoId: 'msg_1',
        enviadoEn: '2026-05-18T10:00:01Z',
      } as MailSendResult),
    };
    // Cast: tests only need the interface surface used by the adapter
    const adapter = new ResendCertifiedAdapter(fakeResend as never, fakeQtsp as never);
    const result = await adapter.send(baseInput);
    expect(fakeQtsp.getTimestamp).toHaveBeenCalledWith('h');
    expect(fakeResend.send).toHaveBeenCalled();
    expect(result.evidenceBundleId).toBe('evd_qtsp_1');
    expect(result.evidenceHashSha512).toBe('hash_sealed');
  });

  it('fails fast if QTSP timestamp fails', async () => {
    const fakeQtsp = {
      getTimestamp: vi.fn().mockRejectedValue(new Error('QTSP down')),
    };
    const fakeResend = {
      canalSoportado: 'EMAIL_NORMAL' as const,
      send: vi.fn(),
    };
    const adapter = new ResendCertifiedAdapter(fakeResend as never, fakeQtsp as never);
    await expect(adapter.send(baseInput)).rejects.toThrow();
    expect(fakeResend.send).not.toHaveBeenCalled();
  });
});
