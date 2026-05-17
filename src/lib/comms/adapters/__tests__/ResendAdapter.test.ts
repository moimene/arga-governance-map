import { describe, it, expect, vi } from 'vitest';
import { ResendAdapter } from '../ResendAdapter';
import type { MailSendInput } from '../MailAdapter';

const baseInput: MailSendInput = {
  recipientId: 'rec_1',
  idempotencyKey: 'key_1',
  destino: 'user@example.com',
  asunto: 'Test',
  cuerpoHtml: '<p>Hello</p>',
  cuerpoSha512: 'hash',
  adjuntos: [],
  remitente: { nombre: 'Sec', email: 'sec@arga.com' },
  metadata: {},
  tags: [{ name: 'recipient_id', value: 'rec_1' }],
};

describe('ResendAdapter', () => {
  it('returns proveedorEventoId on success', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg_resend_123' }),
    } as unknown as Response);

    const adapter = new ResendAdapter({ apiKey: 'k', fetch: fakeFetch as unknown as typeof fetch });
    const result = await adapter.send(baseInput);

    expect(result.ok).toBe(true);
    expect(result.proveedor).toBe('RESEND');
    expect(result.proveedorEventoId).toBe('msg_resend_123');
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer k',
          'Idempotency-Key': 'key_1',
        }),
      }),
    );
  });

  it('throws MailAdapterError retriable=false on 4xx', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid email' }),
    } as unknown as Response);
    const adapter = new ResendAdapter({ apiKey: 'k', fetch: fakeFetch as unknown as typeof fetch });
    await expect(adapter.send(baseInput)).rejects.toMatchObject({ retriable: false });
  });

  it('throws MailAdapterError retriable=true on 5xx', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'server down' }),
    } as unknown as Response);
    const adapter = new ResendAdapter({ apiKey: 'k', fetch: fakeFetch as unknown as typeof fetch });
    await expect(adapter.send(baseInput)).rejects.toMatchObject({ retriable: true });
  });
});
