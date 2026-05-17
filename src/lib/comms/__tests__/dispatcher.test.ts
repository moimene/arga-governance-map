import { describe, it, expect, vi } from 'vitest';
import { processRecipientBatch, type RecipientRow, type DispatcherDb, type DispatcherTx } from '../dispatcher';
import type { MailAdapter } from '../adapters/MailAdapter';

function mockTx(): DispatcherTx {
  return {
    updateRecipient: vi.fn(async () => undefined),
    insertDeliveryEvent: vi.fn(async () => undefined),
  };
}

function mockDb(): DispatcherDb {
  return {
    loadCommunication: vi.fn(async () => ({
      id: 'c1',
      tenant_id: 't1',
      asunto: 'A',
      cuerpo_render: '<p>x</p>',
      cuerpo_hash_sha512: 'h',
    })),
    loadAttachments: vi.fn(async () => []),
    tx: vi.fn(async (fn) => fn(mockTx())),
    markRecipientError: vi.fn(async () => undefined),
    promoteFallback: vi.fn(async () => undefined),
    notifyInternal: vi.fn(async () => undefined),
  };
}

describe('dispatcher.processRecipientBatch', () => {
  it('calls adapter.send and writes SENT event on success', async () => {
    const fakeAdapter: MailAdapter = {
      canalSoportado: 'EMAIL_NORMAL',
      send: vi.fn(async () => ({
        ok: true,
        proveedor: 'RESEND' as const,
        proveedorEventoId: 'msg_1',
        enviadoEn: '2026-05-18T10:00:00Z',
      })),
    };
    const db = mockDb();
    const recipient: RecipientRow = {
      id: 'r1',
      communication_id: 'c1',
      canal_primario: 'EMAIL_NORMAL',
      canal_fallback: null,
      destino_primario: 'u@x.com',
      destino_fallback: null,
      intento_reenvio_n: 0,
    };
    await processRecipientBatch([recipient], db, () => fakeAdapter, {
      remitente: { nombre: 'S', email: 's@x.com' },
    });
    expect(fakeAdapter.send).toHaveBeenCalledTimes(1);
    expect(db.tx).toHaveBeenCalledTimes(1);
  });

  it('skips PORTAL_PUSH recipients with warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = mockDb();
    const recipient: RecipientRow = {
      id: 'r1',
      communication_id: 'c1',
      canal_primario: 'PORTAL_PUSH',
      canal_fallback: null,
      destino_primario: 'pid_1',
      destino_fallback: null,
      intento_reenvio_n: 0,
    };
    await processRecipientBatch([recipient], db, () => {
      throw new Error('no adapter');
    }, {
      remitente: { nombre: 'S', email: 's@x.com' },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('PORTAL_PUSH'));
    expect(db.tx).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('calls promoteFallback when adapter fails with retriable=false and canal_fallback exists', async () => {
    const { MailAdapterError } = await import('../adapters/MailAdapter');
    const fakeAdapter: MailAdapter = {
      canalSoportado: 'EMAIL_NORMAL',
      send: vi.fn(async () => {
        throw new MailAdapterError('invalid email', 'EMAIL_NORMAL', false);
      }),
    };
    const db = mockDb();
    const recipient: RecipientRow = {
      id: 'r1',
      communication_id: 'c1',
      canal_primario: 'EMAIL_NORMAL',
      canal_fallback: 'BUROFAX_ERDS',
      destino_primario: 'u@x.com',
      destino_fallback: 'addr',
      intento_reenvio_n: 0,
    };
    await processRecipientBatch([recipient], db, () => fakeAdapter, {
      remitente: { nombre: 'S', email: 's@x.com' },
    });
    expect(db.promoteFallback).toHaveBeenCalledWith('r1');
  });
});
