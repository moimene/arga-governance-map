import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useCommunicationsList, type CommunicationsFilters } from '@/hooks/useCommunicationsList';
import { useCancelCommunication } from '@/hooks/useCommunicationActions';

type EstadoFilter = 'all' | 'borrador' | 'programada' | 'enviando' | 'enviada' | 'errores';

const ESTADO_TABS: Array<{ key: EstadoFilter; label: string; states: string[] }> = [
  { key: 'all', label: 'Todas', states: [] },
  { key: 'borrador', label: 'Borradores', states: ['BORRADOR'] },
  { key: 'programada', label: 'Programadas', states: ['PROGRAMADA'] },
  { key: 'enviando', label: 'Enviando', states: ['ENVIANDO'] },
  { key: 'enviada', label: 'Enviadas', states: ['ENVIADA', 'ENTREGADA_PARCIAL', 'ENTREGADA_TOTAL'] },
  { key: 'errores', label: 'Errores', states: ['ERROR'] },
];

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  PROGRAMADA: 'Programada',
  ENVIANDO: 'Enviando',
  ENVIADA: 'Enviada',
  ENTREGADA_PARCIAL: 'Entregada parcial',
  ENTREGADA_TOTAL: 'Entregada',
  RESPONDIDA_PARCIAL: 'Respondida parcial',
  RESPONDIDA_TOTAL: 'Respondida',
  EXPIRADA: 'Expirada',
  CANCELADA: 'Cancelada',
  ERROR: 'Error',
};

const TIPO_LABELS: Record<string, string> = {
  CONVOCATORIA: 'Convocatoria',
  NOTIFICACION_INDIVIDUAL: 'Notificación individual',
  PUESTA_DISPOSICION: 'Puesta a disposición',
  SOLICITUD_DECLARACION: 'Solicitud declaración',
  CIRCULAR_SIN_SESION: 'Circular sin sesión',
  RECORDATORIO: 'Recordatorio',
  NOTIFICACION_ACUERDO: 'Notificación acuerdo',
  REMISION_ACTA: 'Remisión acta',
  CERTIFICACION: 'Certificación',
  NOTIFICACION_CARGO: 'Notificación cargo',
  ALERTA_VENCIMIENTO: 'Alerta vencimiento',
  CONSIGNACION: 'Consignación',
  COMUNICACION_INTER_ORGANO: 'Comunicación inter-órgano',
  SOLICITUD_INFORMACION: 'Solicitud información',
  RESPUESTA_INFORMACION: 'Respuesta información',
  COMUNICACION_LIBRE: 'Libre',
};

export default function Comunicaciones() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as EstadoFilter | null) ?? 'all';
  const activeTab = ESTADO_TABS.find((t) => t.key === tab) ?? ESTADO_TABS[0];

  const [tieneRebotes, setTieneRebotes] = useState(false);
  const [comunicacionLibre, setComunicacionLibre] = useState(false);

  const filters: CommunicationsFilters = {
    estado: activeTab.states.length ? activeTab.states : undefined,
    tiene_rebotes: tieneRebotes || undefined,
    comunicacion_libre: comunicacionLibre || undefined,
  };
  const { data: comms = [], isLoading } = useCommunicationsList(filters);
  const cancel = useCancelCommunication();

  function setTab(next: EstadoFilter) {
    const np = new URLSearchParams(params);
    if (next === 'all') np.delete('tab');
    else np.set('tab', next);
    setParams(np, { replace: true });
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Comunicaciones</h1>
          <p className="text-sm text-[var(--g-text-secondary)] mt-1">
            Envíos a miembros de órganos sociales: convocatorias, notificaciones, certificaciones.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="flex gap-2 border-b border-[var(--g-border-subtle)]"
        role="tablist"
        aria-label="Filtros por estado"
      >
        {ESTADO_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={t.key === activeTab.key}
            className={
              t.key === activeTab.key
                ? 'px-4 py-2 text-[var(--g-text-primary)] border-b-2 border-[var(--g-brand-3308)] font-medium'
                : 'px-4 py-2 text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]'
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Filtros laterales (compact, on top) */}
      <div className="flex gap-4 text-sm text-[var(--g-text-secondary)]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={tieneRebotes}
            onChange={(e) => setTieneRebotes(e.target.checked)}
          />
          Solo con rebotes
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={comunicacionLibre}
            onChange={(e) => setComunicacionLibre(e.target.checked)}
          />
          Solo libres
        </label>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="p-6 text-[var(--g-text-secondary)]">Cargando…</div>
      ) : comms.length === 0 ? (
        <div
          className="p-8 text-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          {/* ITEM-065: empty-state con CTA explicando el origen de los envíos. */}
          <p className="text-sm font-medium text-[var(--g-text-primary)]">
            No hay comunicaciones registradas todavía.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--g-text-secondary)]">
            Las comunicaciones a miembros de órganos sociales (convocatorias, puesta a
            disposición de documentación, notificaciones certificadas) se originan al
            distribuir un Board Pack o emitir una convocatoria. Desde aquí se consulta su
            estado de entrega y se gestionan reintentos.
          </p>
          <Link
            to="/secretaria/board-pack"
            className="mt-4 inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
            style={{ borderRadius: 'var(--g-radius-md)' }}
          >
            <Send className="h-4 w-4" />
            Ir al Board Pack para distribuir
          </Link>
        </div>
      ) : (
        <div
          className="border border-[var(--g-border-subtle)] overflow-hidden bg-[var(--g-surface-card)]"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          <table className="w-full text-sm">
            <thead className="bg-[var(--g-surface-subtle)]">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Estado
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Tipo
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Asunto
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Órgano
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Fecha programada
                </th>
                <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)] uppercase tracking-wider text-xs">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {comms.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
                >
                  <td className="px-4 py-3 text-[var(--g-text-primary)]">
                    <span
                      className={
                        c.tiene_rebotes
                          ? 'text-[var(--status-warning)]'
                          : c.estado === 'ERROR'
                          ? 'text-[var(--status-error)]'
                          : c.estado === 'ENTREGADA_TOTAL'
                          ? 'text-[var(--status-success)]'
                          : 'text-[var(--g-text-primary)]'
                      }
                    >
                      {ESTADO_LABELS[c.estado as string] ?? c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--g-text-secondary)]">
                    {TIPO_LABELS[c.tipo_comunicacion as string] ?? c.tipo_comunicacion}
                  </td>
                  <td className="px-4 py-3 text-[var(--g-text-primary)]">{c.asunto}</td>
                  <td className="px-4 py-3 text-[var(--g-text-secondary)]">{c.organo_tipo}</td>
                  <td className="px-4 py-3 text-[var(--g-text-secondary)]">
                    {c.fecha_programada
                      ? new Date(c.fecha_programada).toLocaleString('es')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        to={`/secretaria/comunicaciones/${c.id}`}
                        className="text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
                      >
                        Ver
                      </Link>
                      {c.estado === 'PROGRAMADA' && (
                        <button
                          type="button"
                          onClick={() => cancel.mutate(c.id)}
                          className="text-[var(--status-error)] hover:underline"
                          disabled={cancel.isPending}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
