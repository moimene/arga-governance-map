import { useIncidents } from "@/hooks/useIncidents";
import { Link, useNavigate } from "react-router-dom";
import { Plus, AlertOctagon } from "lucide-react";
import { deadlineLabel } from "@/hooks/useRegulatoryNotif";

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const STATUS_CHIP: Record<string, string> = {
  Abierto:           "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  "En contención":   "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  "En investigación":"bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  Resuelto:          "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Cerrado:           "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function IncidentesList() {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-[var(--g-brand-3308)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Incidentes</h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Todos los incidentes regulatorios y operacionales.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/grc/incidentes/nuevo")}
          className="inline-flex items-center gap-2 px-4 h-10 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label="Crear nuevo incidente"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo incidente
        </button>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      {!isLoading && incidents.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay incidentes registrados.
        </div>
      )}

      {/* Table */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Código
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Título
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Severidad
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Deadline notif.
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {incidents.map((i) => {
                const notif = (i.regulatory_notifications ?? [])[0];
                const dLabel = notif?.status === "Pendiente"
                  ? deadlineLabel(notif?.notification_deadline)
                  : notif?.status === "Enviada"
                  ? "Enviada"
                  : null;

                return (
                  <tr
                    key={i.id}
                    className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/grc/incidentes/${i.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                      {i.code}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-[var(--g-text-primary)]">
                        {i.title}
                      </div>
                      {i.is_major_incident && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-[var(--status-error)] text-[var(--g-text-inverse)] mt-0.5"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          MAJOR
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {i.incident_type ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[i.severity] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {i.severity ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[i.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {i.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {dLabel ? (
                        <span
                          className={`font-medium ${
                            dLabel === "VENCIDA"
                              ? "text-[var(--status-error)]"
                              : dLabel === "Enviada"
                              ? "text-[var(--status-success)]"
                              : "text-[var(--status-warning)]"
                          }`}
                        >
                          {dLabel}
                        </span>
                      ) : (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/grc/incidentes/${i.id}`}
                        className="text-xs text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
