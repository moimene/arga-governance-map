import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Plus, FileText, FolderOpen } from "lucide-react";
import { useReunionesList } from "@/hooks/useReunionSecretaria";
import { statusLabel } from "@/lib/secretaria/status-labels";

const STATUS_TONE: Record<string, string> = {
  PROGRAMADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  EN_CURSO:   "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  CELEBRADA:  "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  CANCELADA:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  BORRADOR:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

const SELECT_CLASS =
  "rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]";

export default function ReunionesLista() {
  const navigate = useNavigate();
  const { data, isLoading } = useReunionesList();

  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterBody, setFilterBody] = useState<string>("ALL");

  // Obtener lista de órganos únicos para el selector
  const bodyOptions = Array.from(
    new Map((data ?? []).map((m) => [m.body_id, m.body_name ?? m.body_id])).entries()
  );

  const filtered = (data ?? []).filter((item) => {
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    if (filterBody !== "ALL" && item.body_id !== filterBody) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Users className="h-3.5 w-3.5" />
            Secretaría · Reuniones
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Reuniones
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Constitución, quórum, debates, votaciones y cierre — generación automática de acuerdos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/secretaria/reuniones/nueva")}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva reunión
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={SELECT_CLASS}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="PROGRAMADA">Programada</option>
          <option value="EN_CURSO">En curso</option>
          <option value="CELEBRADA">Celebrada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select
          value={filterBody}
          onChange={(e) => setFilterBody(e.target.value)}
          className={SELECT_CLASS}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todos los órganos</option>
          {bodyOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        {(filterStatus !== "ALL" || filterBody !== "ALL") && (
          <button
            type="button"
            onClick={() => { setFilterStatus("ALL"); setFilterBody("ALL"); }}
            className="text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div
        className="overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Órgano
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Entidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Fecha prevista
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Acuerdos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Board Pack
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="h-12 w-12 text-[var(--g-text-secondary)]/40 mb-3" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      Sin reuniones para los filtros seleccionados.
                    </p>
                    <p className="text-xs text-[var(--g-text-secondary)]/70 mt-1">
                      Programa una nueva reunión para comenzar.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/secretaria/reuniones/${m.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                    {m.body_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {m.entity_name ?? "—"}
                    {m.jurisdiction ? <span className="ml-2 text-[11px]">· {m.jurisdiction}</span> : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {m.meeting_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {m.scheduled_start ? new Date(m.scheduled_start).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {m.resolutions_count}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_TONE[m.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {statusLabel(m.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    {(m.status === "CONVOCADA" || m.status === "CELEBRADA" || m.status === "EN_CURSO") && (
                      <Link
                        to={`/secretaria/reuniones/${m.id}/board-pack`}
                        className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
