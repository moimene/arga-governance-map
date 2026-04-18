import { useNavigate } from "react-router-dom";
import { Users, Plus } from "lucide-react";
import { useReunionesList } from "@/hooks/useReunionSecretaria";

const STATUS_TONE: Record<string, string> = {
  PROGRAMADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  EN_CURSO:   "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  CELEBRADA:  "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  CANCELADA:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  BORRADOR:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

export default function ReunionesLista() {
  const navigate = useNavigate();
  const { data, isLoading } = useReunionesList();

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

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin reuniones.
                </td>
              </tr>
            ) : (
              data.map((m) => (
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
                      {m.status}
                    </span>
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
