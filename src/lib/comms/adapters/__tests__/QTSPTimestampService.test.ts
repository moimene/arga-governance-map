import { describe, it, expect, vi } from 'vitest';
import { QTSPTimestampService } from '../QTSPTimestampService';

describe('QTSPTimestampService', () => {
  it('returns TSQ token + evidence id on success', async () => {
    const fakeClient = {
      generateTimestamp: vi.fn().mockResolvedValue({
        evidenceId: 'evd_123',
        tsqTokenBase64: 'AAEC',
        timestampedAt: '2026-05-18T10:00:00Z',
        hashSha512: 'abc',
      }),
    };
    const svc = new QTSPTimestampService(fakeClient);
    const result = await svc.getTimestamp('body_hash_xyz');
    expect(result.evidenceId).toBe('evd_123');
    expect(result.tsqTokenBase64).toBe('AAEC');
    expect(fakeClient.generateTimestamp).toHaveBeenCalledWith('body_hash_xyz');
  });

  it('throws MailAdapterError retriable=true on 5xx', async () => {
    const fakeClient = {
      generateTimestamp: vi.fn().mockRejectedValue({ status: 503, message: 'EAD Trust unavailable' }),
    };
    const svc = new QTSPTimestampService(fakeClient);
    await expect(svc.getTimestamp('hash')).rejects.toMatchObject({
      name: 'MailAdapterError',
      retriable: true,
    });
  });

  it('throws MailAdapterError retriable=false on 4xx', async () => {
    const fakeClient = {
      generateTimestamp: vi.fn().mockRejectedValue({ status: 400, message: 'invalid hash' }),
    };
    const svc = new QTSPTimestampService(fakeClient);
    await expect(svc.getTimestamp('hash')).rejects.toMatchObject({
      name: 'MailAdapterError',
      retriable: false,
    });
  });
});
