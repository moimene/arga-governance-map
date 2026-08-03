import { useParams, Link } from 'react-router-dom';
import { useCommunication } from '@/hooks/useCommunication';
import { useRetryRecipient } from '@/hooks/useCommunicationActions';
import { statusLabel } from '@/lib/secretaria/status-labels';

export default function ComunicacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data: comm, isLoading } = useCommunication(id);
  const retry = useRetryRecipient();

  if (isLoading) return <div className="p-6 text-[var(--g-text-secondary)]">Cargando…</div>;
  if (!comm) return <div className="p-6 text-[var(--g-text-secondary)]">No encontrada.</div>;

  const c = comm as {
    id: string;
    asunto: string;
    organo_tipo: string;
    estado: string;
    tipo_comunicacion: string;
    nivel_certificacion_minimo: string | null;
    cuerpo_render: string;
    tiene_rebotes: boolean;
    entity_id: string | null;
    body_id: string | null;
    meeting_id: string | null;
    agreement_id: string | null;
    metadata?: Record<string, unknown> | null;
    communication_recipients?: Array<{
      id: string;
      canal_original: string;
      canal_primario: string;
      canal_usado: string | null;
      destino_primario: string;
      estado_entrega: string;
      ultimo_error: string | null;
      fecha_envio: string | null;
      fecha_entrega: string | null;
    }>;
    communication_attachments?: Array<{
      id: string;
      label: string;
      storage_uri: string;
      mime_type: string | null;
    }>;
  };

  const recipients = c.communication_recipients ?? [];
  const attachments = c.communication_attachments ?? [];
  const metadata = c.metadata ?? {};
  const eadService = metadata.ead_service && typeof metadata.ead_service === 'object'
    ? metadata.ead_service as Record<string, unknown>
    : null;
  const source = metadata.source && typeof metadata.source === 'object'
    ? metadata.source as Record<string, unknown>
    : null;
  const isEadInterpositionDraft = eadService?.mode === 'EAD_INTERPOSITION';
  const isLegacyErds = [
    c.nivel_certificacion_minimo,
    ...recipients.flatMap((recipient) => [
      recipient.canal_original,
      recipient.canal_primario,
      recipient.canal_usado,
    ]),
  ].some((channel) => ['ERDS', 'BUROFAX_ERDS'].includes((channel ?? '').trim().toUpperCase()));
  const noSessionSourceId = source?.domain === 'NO_SESSION_RESOLUTION'
    && typeof source.id === 'string'
    ? source.id
    : null;

  return (
    <div className="p-6 space-y-6">
      <header>
        <Link to="/secretaria/comunicaciones" className="text-sm text-[var(--g-link)] hover:underline">
          ← Volver a comunicaciones
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)] mt-2">{c.asunto}</h1>
        <p className="text-sm text-[var(--g-text-secondary)] mt-1">
          {c.tipo_comunicacion} · {c.organo_tipo} · Estado: <strong>{statusLabel(c.estado)}</strong>
          {c.tiene_rebotes && <span className="text-[var(--status-warning)] ml-2">⚠ Tiene rebotes</span>}
        </p>
      </header>

      {isEadInterpositionDraft ? (
        <section
          className="border border-[var(--status-info)] bg-[var(--g-surface-subtle)] p-4"
          style={{ borderRadius: 'var(--g-radius-md)' }}
          role="status"
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Interposición EAD registrada como borrador
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            No existe envío, programación, firma, ERDS, entrega ni interacción acreditada con el proveedor.
            El canal EMAIL_NORMAL es únicamente un campo físico neutro y no está activado.
          </p>
        </section>
      ) : isLegacyErds ? (
        <section
          className="border border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: 'var(--g-radius-md)' }}
          role="status"
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Registro ERDS histórico · solo lectura</h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Este código se conserva por trazabilidad. Está excluido del dispatcher y no puede reutilizarse en nuevas capturas.
          </p>
        </section>
      ) : null}

      {/* Origen — trazabilidad bidireccional al acto de origen */}
      {(c.meeting_id || c.agreement_id || c.entity_id || noSessionSourceId) && (
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          <h2 className="text-lg font-medium text-[var(--g-text-primary)] mb-2">Origen</h2>
          <ul className="text-sm space-y-1">
            {noSessionSourceId && (
              <li className="text-[var(--g-text-secondary)]">
                Acuerdo sin sesión:{' '}
                <Link
                  to={`/secretaria/acuerdos-sin-sesion/${noSessionSourceId}`}
                  className="text-[var(--g-link)] hover:underline"
                >
                  Ver votación de origen
                </Link>
              </li>
            )}
            {c.meeting_id && (
              <li className="text-[var(--g-text-secondary)]">
                Reunión:{' '}
                <Link
                  to={`/secretaria/reuniones/${c.meeting_id}`}
                  className="text-[var(--g-link)] hover:underline"
                >
                  Ver reunión de origen
                </Link>
              </li>
            )}
            {c.agreement_id && (
              <li className="text-[var(--g-text-secondary)]">
                Expediente:{' '}
                <Link
                  to={`/secretaria/acuerdos/${c.agreement_id}`}
                  className="text-[var(--g-link)] hover:underline"
                >
                  Ver expediente del acuerdo
                </Link>
              </li>
            )}
            {c.entity_id && (
              <li className="text-[var(--g-text-secondary)]">
                Sociedad:{' '}
                <Link
                  to={`/secretaria/sociedades/${c.entity_id}`}
                  className="text-[var(--g-link)] hover:underline"
                >
                  Ver sociedad
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Recipients table */}
      <section>
        <h2 className="text-lg font-medium text-[var(--g-text-primary)] mb-2">
          Destinatarios ({recipients.length})
        </h2>
        <div
          className="border border-[var(--g-border-subtle)] overflow-hidden bg-[var(--g-surface-card)]"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          <table className="w-full text-sm">
            <thead className="bg-[var(--g-surface-subtle)]">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Destino
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Canal
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Estado
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Envío
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Entrega
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {recipients.map((r) => {
                const isFallback =
                  r.canal_usado && r.canal_usado !== r.canal_original;
                const isLegacyRecipient = [r.canal_original, r.canal_primario, r.canal_usado]
                  .some((channel) => ['ERDS', 'BUROFAX_ERDS'].includes((channel ?? '').trim().toUpperCase()));
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">{r.destino_primario}</td>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">
                      {isEadInterpositionDraft
                        ? 'Interposición EAD · borrador sin transporte'
                        : isLegacyRecipient
                          ? 'ERDS histórico · solo lectura'
                          : r.canal_usado ?? r.canal_primario}
                      {isFallback && (
                        <span className="ml-2 text-xs text-[var(--status-warning)]">(fallback)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          r.estado_entrega === 'ERROR' || r.estado_entrega === 'REBOTADO'
                            ? 'text-[var(--status-error)]'
                            : r.estado_entrega === 'ENTREGADO'
                            ? 'text-[var(--status-success)]'
                            : 'text-[var(--g-text-primary)]'
                        }
                      >
                        {statusLabel(r.estado_entrega)}
                      </span>
                      {r.ultimo_error && (
                        <p className="text-xs text-[var(--status-error)]">{r.ultimo_error}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">
                      {r.fecha_envio ? new Date(r.fecha_envio).toLocaleString('es') : '—'}
                    </td>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">
                      {r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleString('es') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {!isEadInterpositionDraft
                        && !isLegacyRecipient
                        && (r.estado_entrega === 'ERROR' || r.estado_entrega === 'REBOTADO') && (
                        <button
                          type="button"
                          onClick={() => retry.mutate(r.id)}
                          className="text-[var(--g-link)] hover:underline"
                          disabled={retry.isPending}
                        >
                          Reintentar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Attachments */}
      {attachments.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-[var(--g-text-primary)] mb-2">Adjuntos</h2>
          <ul className="text-sm space-y-1">
            {attachments.map((a) => (
              <li key={a.id} className="text-[var(--g-text-secondary)]">
                · {a.label} <span className="text-xs text-[var(--g-text-secondary)]">({a.mime_type ?? 'unknown'})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
