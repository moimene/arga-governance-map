import { describe, it, expect, vi } from 'vitest';
import { EADTrustERDSAdapter } from '../EADTrustERDSAdapter';
import type { MailSendInput } from '../MailAdapter';

const baseInput: MailSendInput = {
  recipientId: 'r1',
  idempotencyKey: 'k1',
  destino: 'u@x.com',
  asunto: 'A',
  cuerpoHtml: '<p>x</p>',
  cuerpoSha512: 'body_hash',
  adjuntos: [],
  remitente: { nombre: 'S', email: 's@x.com' },
  metadata: {},
  tags: [{ name: 'recipient_id', value: 'r1' }],
};

describe('EADTrustERDSAdapter', () => {
  it('generates evidence and returns proveedorEventoId', async () => {
    const fakeClient = {
      generateEvidence: vi.fn().mockResolvedValue({
        id: 'evd_erds_1',
        hash: 'evidence_hash',
        status: { status: 'COMPLETED' },
      }),
    };
    const adapter = new EADTrustERDSAdapter(fakeClient);
    const result = await adapter.send(baseInput);
    expect(result.proveedor).toBe('EAD_TRUST');
    expect(result.proveedorEventoId).toBe('evd_erds_1');
    expect(result.evidenceBundleId).toBe('evd_erds_1');
  });

  it('throws MailAdapterError retriable=false on 4xx', async () => {
    const fakeClient = {
      generateEvidence: vi.fn().mockRejectedValue({ status: 401, message: 'unauthorized' }),
    };
    const adapter = new EADTrustERDSAdapter(fakeClient);
    await expect(adapter.send(baseInput)).rejects.toMatchObject({ retriable: false });
  });

  it('throws MailAdapterError retriable=true on 5xx', async () => {
    const fakeClient = {
      generateEvidence: vi.fn().mockRejectedValue({ status: 503, message: 'gateway down' }),
    };
    const adapter = new EADTrustERDSAdapter(fakeClient);
    await expect(adapter.send(baseInput)).rejects.toMatchObject({ retriable: true });
  });
});
