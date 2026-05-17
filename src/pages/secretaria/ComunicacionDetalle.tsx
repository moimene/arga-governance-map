import { useParams, Link } from 'react-router-dom';
import { useCommunication } from '@/hooks/useCommunication';
import { useRetryRecipient } from '@/hooks/useCommunicationActions';

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ENVIANDO: 'Enviando',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  LEIDO: 'Leído',
  RESPONDIDO: 'Respondido',
  REBOTADO: 'Rebotado',
  ERROR: 'Error',
};

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
    cuerpo_render: string;
    tiene_rebotes: boolean;
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

  return (
    <div className="p-6 space-y-6">
      <header>
        <Link to="/secretaria/comunicaciones" className="text-sm text-[var(--g-link)] hover:underline">
          ← Volver a comunicaciones
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)] mt-2">{c.asunto}</h1>
        <p className="text-sm text-[var(--g-text-secondary)] mt-1">
          {c.tipo_comunicacion} · {c.organo_tipo} · Estado: <strong>{c.estado}</strong>
          {c.tiene_rebotes && <span className="text-[var(--status-warning)] ml-2">⚠ Tiene rebotes</span>}
        </p>
      </header>

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
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">{r.destino_primario}</td>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">
                      {r.canal_usado ?? r.canal_primario}
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
                        {ESTADO_LABELS[r.estado_entrega] ?? r.estado_entrega}
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
                      {(r.estado_entrega === 'ERROR' || r.estado_entrega === 'REBOTADO') && (
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
