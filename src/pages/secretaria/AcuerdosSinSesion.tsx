import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollText, Plus } from "lucide-react";
import { useAcuerdosSinSesionList } from "@/hooks/useAcuerdosSinSesion";

const STATUS_TONE: Record<string, string> = {
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  VOTING_OPEN: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  APROBADO:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  RECHAZADO:   "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

const SELECT_CLASS =
  "rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]";

export default function AcuerdosSinSesion() {
  const navigate = useNavigate();
  const { data, isLoading } = useAcuerdosSinSesionList();

  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filtered = (data ?? []).filter((item) => {
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <ScrollText className="h-3.5 w-3.5" />
            Secretaría · Acuerdos sin sesión
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Acuerdos escritos sin sesión
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Adopción por escrito según art. 100 RRM y equivalentes PT/BR/MX — requiere unanimidad u
            otra mayoría reforzada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/secretaria/acuerdos-sin-sesion/nuevo")}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="h-4 w-4" />
            Sin sesión (unanimidad)
          </button>
          <button
            type="button"
            onClick={() => navigate("/secretaria/acuerdos-sin-sesion/co-aprobacion")}
            className="inline-flex items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="h-4 w-4" />
            Co-aprobación (k de n)
          </button>
          <button
            type="button"
            onClick={() => navigate("/secretaria/acuerdos-sin-sesion/solidario")}
            className="inline-flex items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="h-4 w-4" />
            Administrador solidario
          </button>
        </div>
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
          <option value="VOTING_OPEN">Votación abierta</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
        {filterStatus !== "ALL" && (
          <button
            type="button"
            onClick={() => setFilterStatus("ALL")}
            className="text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Título
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Órgano
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Votación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Plazo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">Cargando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">Sin acuerdos para los filtros seleccionados.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/secretaria/acuerdos-sin-sesion/${r.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                    {r.title}
                    {r.requires_unanimity ? (
                      <span
                        className="ml-2 bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        UNANIMIDAD
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {r.body_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {r.votes_for ?? 0}✓ · {r.votes_against ?? 0}✗ · {r.abstentions ?? 0}–
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {r.voting_deadline ? new Date(r.voting_deadline).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_TONE[r.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {r.status}
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
