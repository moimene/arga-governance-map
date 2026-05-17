import type { Canal } from './types';
import type { MailAdapter, MailSendInput } from './adapters/MailAdapter';
import { computeNextAction } from './retry-policy';

export interface RecipientRow {
  id: string;
  communication_id: string;
  person_id?: string;
  canal_primario: Canal;
  canal_fallback: Canal | null;
  destino_primario: string;
  destino_fallback: string | null;
  intento_reenvio_n: number;
}

export interface CommunicationRow {
  id: string;
  tenant_id: string;
  asunto: string;
  cuerpo_render: string;
  cuerpo_hash_sha512: string;
}

export interface AttachmentRow {
  label: string;
  storage_uri: string;
  hash_sha512: string;
  mime_type: string;
  modo_entrega: 'ADJUNTO' | 'LINK_FIRMADO';
  signed_url_expiry_hours: number;
}

export interface DispatcherTx {
  updateRecipient(id: string, fields: Record<string, unknown>): Promise<void>;
  insertDeliveryEvent(row: {
    recipient_id: string;
    evento: string;
    proveedor: string;
    proveedor_evento_id: string | null;
    payload: Record<string, unknown> | null;
  }): Promise<void>;
}

export interface DispatcherDb {
  loadCommunication(id: string): Promise<CommunicationRow>;
  loadAttachments(communication_id: string): Promise<AttachmentRow[]>;
  tx<T>(fn: (tx: DispatcherTx) => Promise<T>): Promise<T>;
  markRecipientError(id: string, reason: string): Promise<void>;
  promoteFallback(id: string): Promise<void>;
  notifyInternal(communication_id: string, message: string): Promise<void>;
}

export interface DispatcherContext {
  remitente: { nombre: string; email: string };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function processRecipientBatch(
  recipients: RecipientRow[],
  db: DispatcherDb,
  getAdapter: (canal: Canal) => MailAdapter,
  context: DispatcherContext,
): Promise<void> {
  const CONCURRENCY = 5;
  for (const group of chunk(recipients, CONCURRENCY)) {
    await Promise.all(group.map((r) => processRecipient(r, db, getAdapter, context)));
  }
}

async function processRecipient(
  r: RecipientRow,
  db: DispatcherDb,
  getAdapter: (canal: Canal) => MailAdapter,
  context: DispatcherContext,
): Promise<void> {
  if (r.canal_primario === 'PORTAL_PUSH') {
    console.warn(`Skipping PORTAL_PUSH recipient ${r.id} (no adapter in P1)`);
    return;
  }

  let adapter: MailAdapter;
  try {
    adapter = getAdapter(r.canal_primario);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.markRecipientError(r.id, `No adapter: ${msg}`);
    return;
  }

  const comm = await db.loadCommunication(r.communication_id);
  const adjuntos = await db.loadAttachments(r.communication_id);

  const input: MailSendInput = {
    recipientId: r.id,
    idempotencyKey: `${r.id}-${comm.cuerpo_hash_sha512}-${r.intento_reenvio_n}`,
    destino: r.destino_primario,
    asunto: comm.asunto,
    cuerpoHtml: comm.cuerpo_render,
    cuerpoSha512: comm.cuerpo_hash_sha512,
    adjuntos: adjuntos.map((a) => ({
      label: a.label,
      storageUri: a.storage_uri,
      hashSha512: a.hash_sha512,
      mimeType: a.mime_type,
      modoEntrega: a.modo_entrega,
      signedUrlExpiryHours: a.signed_url_expiry_hours,
    })),
    remitente: context.remitente,
    metadata: { 'X-Communication-Id': comm.id, 'X-Tenant-Id': comm.tenant_id },
    tags: [
      { name: 'recipient_id', value: r.id },
      { name: 'communication_id', value: comm.id },
    ],
  };

  try {
    const res = await adapter.send(input);
    await db.tx(async (tx) => {
      await tx.updateRecipient(r.id, {
        estado_entrega: 'ENVIADO',
        canal_usado: r.canal_primario,
        fecha_envio: new Date().toISOString(),
        intento_reenvio_n: r.intento_reenvio_n + 1,
        ultimo_error: null,
      });
      await tx.insertDeliveryEvent({
        recipient_id: r.id,
        evento: 'SENT',
        proveedor: res.proveedor,
        proveedor_evento_id: res.proveedorEventoId,
        payload: { evidenceBundleId: res.evidenceBundleId ?? null },
      });
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const action = computeNextAction(errorObj, {
      intento_n: r.intento_reenvio_n,
      canal_fallback: r.canal_fallback,
    });
    if (action.kind === 'RETRY_SAME') {
      await db.tx(async (tx) => {
        await tx.updateRecipient(r.id, {
          estado_entrega: 'PENDIENTE',
          intento_reenvio_n: r.intento_reenvio_n + 1,
          ultimo_error: errorObj.message,
        });
      });
    } else if (action.kind === 'PROMOTE_FALLBACK') {
      await db.promoteFallback(r.id);
    } else {
      await db.markRecipientError(r.id, action.reason);
      await db.notifyInternal(r.communication_id, `Recipient ${r.id} en ERROR: ${action.reason}`);
    }
  }
}
